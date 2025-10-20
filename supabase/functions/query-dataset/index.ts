// /supabase/functions/query-dataset/index.ts
// Executa o DSL gerado por /functions/plan-query de forma DETERMINÍSTICA e SEGURA (sem IA).
// Base: tabela public.dataset_rows com coluna JSONB "data" (uma linha por registro original).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ======================= Config =======================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
  global: { fetch },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

// ======================= Tipos do DSL =================
type MetricOp = "count" | "sum" | "avg" | "min" | "max" | "count_distinct";
type FilterOp =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "starts_with" | "ends_with"
  | "ilike" | "between" | "in" | "is_null" | "not_null";
type OrderDir = "asc" | "desc";

type QueryDSL = {
  from?: "dataset_matrix" | "dataset_rows"; // por enquanto, implementado sobre dataset_rows
  mode?: "lookup" | "default";
  select?: string[] | null; // ex.: ["Produto", "Estado"]
  metrics?: Array<{ op: MetricOp; column?: string | null; as?: string | null }> | null;
  group_by?: string[] | null; // nomes de colunas OU "day(col)"|"month(col)"|"year(col)"
  where?: Array<{ column: string; op: FilterOp; value?: any; value2?: any }> | null;
  order_by?: Array<{ by: string; dir: OrderDir }> | null; // "by" pode ser alias de métrica/agrupamento ou coluna direta
  limit?: number | null;
  note?: string | null;
};

// ======================= Constantes ===================
const MAX_RESULT_ROWS = 10_000;
const QUERY_TIMEOUT_MS = 30_000;

const ALLOWED_METRICS: MetricOp[] = ["count", "sum", "avg", "min", "max", "count_distinct"];
const ALLOWED_FILTERS: FilterOp[] = [
  "eq","neq","gt","gte","lt","lte",
  "contains","starts_with","ends_with",
  "ilike","between","in","is_null","not_null",
];
const ALLOWED_DIR: OrderDir[] = ["asc", "desc"];

function httpJson(status: number, payload: any) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampLimit(n: any, fallback = 100, max = MAX_RESULT_ROWS) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return fallback;
  return Math.min(Math.max(1, Math.floor(x)), max);
}

function qIdent(id: string) {
  // aspas duplas para identificadores seguros (sem montar nada dinâmico de usuário aqui)
  return `"${id.replace(/"/g, '""')}"`;
}
function sanitizeColumnName(name: string) {
  // colunas vêm do planner; aqui só limpamos espaços
  return String(name || "").trim();
}

const DATE_GB_REG = /^(day|month|year)\((.+)\)$/i;

function buildGroupByExpr(raw: string, paramPrefix = "gb"): { expr: string; alias: string; needsCast: boolean } {
  const m = raw.match(DATE_GB_REG);
  if (!m) {
    // agrupamento por coluna literal (texto)
    const col = sanitizeColumnName(raw);
    const expr = `dr.data->>'${col.replace(/'/g, "''")}'`;
    const alias = col;
    return { expr, alias, needsCast: false };
  }
  const fn = m[1].toLowerCase(); // day|month|year
  const col = sanitizeColumnName(m[2]);
  const base = `(dr.data->>'${col.replace(/'/g, "''")}')`;
  // Cast com segurança básica; se falhar o cast, vira NULL e não entra no bucket
  const ts = `NULLIF(${base}, '')::timestamptz`;
  const expr = `date_trunc('${fn}', ${ts})`;
  const alias = `${fn}_${col}`;
  return { expr, alias, needsCast: true };
}

function buildNumericExpr(col?: string | null) {
  if (!col) {
    // usado apenas por count(*)
    return "*";
  }
  const c = sanitizeColumnName(col);
  const base = `(dr.data->>'${c.replace(/'/g, "''")}')`;
  // numeric seguro: remove vazio → NULL::numeric
  return `NULLIF(${base}, '')::numeric`;
}

// ======================= Validação ====================
function validateDSL(dsl: any): QueryDSL {
  const out: QueryDSL = {};

  out.from = dsl?.from === "dataset_matrix" ? "dataset_matrix" : "dataset_rows";
  out.mode = dsl?.mode === "lookup" ? "lookup" : "default";

  if (dsl?.select != null) {
    if (!Array.isArray(dsl.select)) throw new Error("select must be an array or null");
    out.select = dsl.select.map((s: any) => sanitizeColumnName(String(s))).filter(Boolean);
  } else {
    out.select = null;
  }

  if (dsl?.metrics != null) {
    if (!Array.isArray(dsl.metrics)) throw new Error("metrics must be an array or null");
    const m: NonNullable<QueryDSL["metrics"]> = [];
    for (const mm of dsl.metrics) {
      const op = String(mm?.op || "").toLowerCase();
      if (!ALLOWED_METRICS.includes(op as MetricOp)) continue;
      const column = mm?.column != null ? sanitizeColumnName(String(mm.column)) : null;
      const as = mm?.as != null ? String(mm.as).slice(0, 64) : null;
      m.push({ op: op as MetricOp, column, as });
    }
    out.metrics = m.length ? m : null;
  } else {
    out.metrics = null;
  }

  if (dsl?.group_by != null) {
    if (!Array.isArray(dsl.group_by)) throw new Error("group_by must be an array or null");
    out.group_by = dsl.group_by.map((g: any) => sanitizeColumnName(String(g))).filter(Boolean).slice(0, 8);
  } else {
    out.group_by = null;
  }

  if (dsl?.where != null) {
    if (!Array.isArray(dsl.where)) throw new Error("where must be an array or null");
    const w: NonNullable<QueryDSL["where"]> = [];
    for (const ww of dsl.where) {
      const col = sanitizeColumnName(String(ww?.column || ""));
      const op = String(ww?.op || "").toLowerCase();
      if (!col || !ALLOWED_FILTERS.includes(op as FilterOp)) continue;
      const obj: any = { column: col, op: op as FilterOp };
      if (!["is_null", "not_null"].includes(op)) obj.value = ww?.value;
      if (op === "between") obj.value2 = ww?.value2;
      w.push(obj);
    }
    out.where = w.length ? w : null;
  } else {
    out.where = null;
  }

  if (dsl?.order_by != null) {
    if (!Array.isArray(dsl.order_by)) throw new Error("order_by must be an array or null");
    const o: NonNullable<QueryDSL["order_by"]> = [];
    for (const oo of dsl.order_by) {
      const by = String(oo?.by || "").trim();
      const dir = String(oo?.dir || "desc").toLowerCase();
      if (!by) continue;
      if (!ALLOWED_DIR.includes(dir as OrderDir)) continue;
      o.push({ by, dir: dir as OrderDir });
    }
    out.order_by = o.length ? o : null;
  } else {
    out.order_by = null;
  }

  out.limit = clampLimit(dsl?.limit, out.mode === "lookup" ? 50 : 200, MAX_RESULT_ROWS);
  out.note = dsl?.note ? String(dsl.note).slice(0, 400) : null;

  // Regras mínimas: precisa ter ao menos algo pra selecionar
  if ((!out.select || out.select.length === 0) && (!out.metrics || out.metrics.length === 0)) {
    // fallback: count(*)
    out.metrics = [{ op: "count", column: null, as: "linhas" }];
  }

  return out;
}

// ======================= SQL Builder ==================
function buildSQL(dataset_id: string, dsl: QueryDSL) {
  const params: any[] = [];
  let p = 1;

  // FROM fixo em dataset_rows (usamos alias dr)
  let fromClause = `public.dataset_rows dr`;

  // WHERE inicial: dataset_id
  const whereParts: string[] = [];
  whereParts.push(`dr.dataset_id = $${p++}`);
  params.push(dataset_id);

  // WHERE (filtros)
  if (dsl.where) {
    for (const w of dsl.where) {
      const col = w.column.replace(/'/g, "''");
      const field = `dr.data->>'${col}'`;

      switch (w.op) {
        case "eq":
          whereParts.push(`${field} = $${p++}`); params.push(String(w.value ?? "")); break;
        case "neq":
          whereParts.push(`${field} <> $${p++}`); params.push(String(w.value ?? "")); break;
        case "gt":
          whereParts.push(`NULLIF(${field}, '')::numeric > $${p++}::numeric`); params.push(String(w.value ?? "")); break;
        case "gte":
          whereParts.push(`NULLIF(${field}, '')::numeric >= $${p++}::numeric`); params.push(String(w.value ?? "")); break;
        case "lt":
          whereParts.push(`NULLIF(${field}, '')::numeric < $${p++}::numeric`); params.push(String(w.value ?? "")); break;
        case "lte":
          whereParts.push(`NULLIF(${field}, '')::numeric <= $${p++}::numeric`); params.push(String(w.value ?? "")); break;
        case "contains":
          whereParts.push(`${field} ILIKE '%' || $${p++} || '%'`); params.push(String(w.value ?? "")); break;
        case "starts_with":
          whereParts.push(`${field} ILIKE $${p++} || '%'`); params.push(String(w.value ?? "")); break;
        case "ends_with":
          whereParts.push(`${field} ILIKE '%' || $${p++}`); params.push(String(w.value ?? "")); break;
        case "ilike":
          whereParts.push(`${field} ILIKE $${p++}`); params.push(String(w.value ?? "")); break;
        case "in":
          if (!Array.isArray(w.value) || w.value.length === 0) break;
          const ph = w.value.map(() => `$${p++}`).join(", ");
          whereParts.push(`${field} IN (${ph})`);
          for (const v of w.value) params.push(String(v));
          break;
        case "between":
          whereParts.push(`NULLIF(${field}, '')::numeric BETWEEN $${p}::numeric AND $${p + 1}::numeric`);
          params.push(String(w.value ?? "")); params.push(String((w as any).value2 ?? "")); p += 2;
          break;
        case "is_null":
          whereParts.push(`${field} IS NULL OR ${field} = ''`);
          break;
        case "not_null":
          whereParts.push(`${field} IS NOT NULL AND ${field} <> ''`);
          break;
      }
    }
  }

  // SELECT parts
  const selectParts: string[] = [];
  const groupParts: string[] = [];
  const orderableAliases = new Set<string>(); // para permitir ORDER BY por alias

  // select (colunas "cruas" do JSON)
  if (dsl.select) {
    for (const colRaw of dsl.select) {
      const col = colRaw.replace(/'/g, "''");
      const alias = colRaw;
      selectParts.push(`dr.data->>'${col}' AS ${qIdent(alias)}`);
      orderableAliases.add(alias);
      groupParts.push(`dr.data->>'${col}'`);
    }
  }

  // group_by (incluindo day()/month()/year())
  if (dsl.group_by) {
    for (const g of dsl.group_by) {
      const { expr, alias } = buildGroupByExpr(g);
      selectParts.push(`${expr} AS ${qIdent(alias)}`);
      orderableAliases.add(alias);
      groupParts.push(expr);
    }
  }

  // metrics
  if (dsl.metrics) {
    for (const m of dsl.metrics) {
      const op = m.op;
      const alias = (m.as && m.as.trim()) ? m.as.trim() : `${op}${m.column ? "_" + m.column : ""}`;
      let expr = "";
      if (op === "count" && !m.column) {
        expr = "COUNT(*)";
      } else if (op === "count_distinct" && m.column) {
        const field = `dr.data->>'${m.column.replace(/'/g, "''")}'`;
        expr = `COUNT(DISTINCT ${field})`;
      } else {
        const num = buildNumericExpr(m.column ?? null);
        const agg = op.toUpperCase(); // SUM/AVG/MIN/MAX
        expr = `${agg}(${num})`;
      }
      selectParts.push(`${expr} AS ${qIdent(alias)}`);
      orderableAliases.add(alias);
    }
  }

  if (selectParts.length === 0) {
    // impossível (já garantimos fallback count), mas por segurança:
    selectParts.push(`COUNT(*) AS "linhas"`);
  }

  // Montagem do SQL
  let sqlCore = `SELECT ${selectParts.join(", ")} FROM ${fromClause}`;
  if (whereParts.length) sqlCore += ` WHERE ${whereParts.join(" AND ")}`;
  if (groupParts.length) sqlCore += ` GROUP BY ${groupParts.join(", ")}`;

  // ORDER BY (por alias de select/métrica/gb ou por coluna literal do JSON)
  if (dsl.order_by && dsl.order_by.length) {
    const orders: string[] = [];
    for (const o of dsl.order_by) {
      const by = o.by.trim();
      const dir = o.dir.toLowerCase() === "asc" ? "ASC" : "DESC";
      if (orderableAliases.has(by)) {
        orders.push(`${qIdent(by)} ${dir}`);
      } else {
        // tentar por coluna literal do JSON
        const col = by.replace(/'/g, "''");
        orders.push(`dr.data->>'${col}' ${dir}`);
      }
    }
    if (orders.length) sqlCore += ` ORDER BY ${orders.join(", ")}`;
  }

  // LIMIT
  const limit = clampLimit(dsl.limit, dsl.mode === "lookup" ? 50 : 200, MAX_RESULT_ROWS);
  sqlCore += ` LIMIT ${limit}`;

  // Envelopar para JSON via exec_sql (jsonb)
  // Resultado será: [{...}, {...}]
  const sqlWrapped = `
    SELECT COALESCE(json_agg(t), '[]'::json) AS result
    FROM (
      ${sqlCore}
    ) AS t
  `;

  return { sql: sqlWrapped, params };
}

// ======================= Execução =====================
async function execSQL(sql: string, params: any[]) {
  const { data, error } = await supabase.rpc("exec_sql", {
    sql_query: sql,
    sql_params: params, // hoje a função não usa, mas mantemos assinatura
  });
  if (error) throw error;
  // data vem como jsonb (obj ou array). Esperamos { result: [...] } ou diretamente [...]
  let rows: any[] = [];
  if (Array.isArray(data)) {
    // alguns PostgRESTs retornam linhas de objetos, pegamos o primeiro com .result
    const first = data[0];
    if (first && typeof first === "object" && "result" in first) {
      rows = first.result || [];
    } else {
      rows = data;
    }
  } else if (data && typeof data === "object" && "result" in data) {
    rows = (data as any).result || [];
  }
  return rows;
}

// ======================= Handler ======================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const started = Date.now();
  try {
    // Auth
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Authorization token required");
    const token = auth.split(" ")[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    const dataset_id = String(body?.dataset_id || "").trim();
    const dslInput = body?.dsl;

    if (!dataset_id) return httpJson(400, { success: false, error: "dataset_id is required" });
    if (!dslInput) return httpJson(400, { success: false, error: "dsl is required" });

    // Segurança: checar propriedade do dataset
    const { data: ds, error: dsErr } = await supabase
      .from("datasets")
      .select("id, user_id, has_queryable_data, row_count, column_count")
      .eq("id", dataset_id)
      .eq("user_id", user.id)
      .single();

    if (dsErr || !ds) return httpJson(404, { success: false, error: "Dataset not found or access denied" });
    if (!ds.has_queryable_data) {
      return httpJson(400, { success: false, error: "Dataset does not have queryable data. Reprocess with store_queryable=true." });
    }

    // Validar DSL
    const dsl = validateDSL(dslInput);

    // Gerar SQL
    const { sql, params } = buildSQL(dataset_id, dsl);

    // Timeout
    const execPromise = (async () => {
      const rows = await execSQL(sql, params);
      return rows;
    })();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT_MS)
    );

    const rowsObj = await Promise.race([execPromise, timeoutPromise]);
    const row_count = Array.isArray(rowsObj) ? rowsObj.length : 0;

    // Derivar colunas do 1º objeto
    const columns = row_count > 0 ? Object.keys(rowsObj[0]) : (dsl.select?.length ? [...dsl.select] : []);
    const rows = row_count > 0
      ? rowsObj.map((r: any) => columns.map((c) => r[c]))
      : [];

    const took = Date.now() - started;
    return httpJson(200, {
      success: true,
      result: {
        columns,
        rows,
        row_count,
        execution_time_ms: took,
        was_limited: row_count >= (dsl.limit || 0),
        actual_limit: dsl.limit,
      },
      dsl_executed: dsl,
      sql_generated: sql,
      params_used: params,
    });
  } catch (e: any) {
    return httpJson(500, { success: false, error: e?.message || "Internal error" });
  }
});
