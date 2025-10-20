// /supabase/functions/plan-query/index.ts
// Gera um DSL de consulta seguro a partir de uma pergunta em linguagem natural.
// Fluxo: pega summary do dataset → orienta LLM com colunas válidas → força retorno em JSON (schema) → valida → responde.
// O DSL será consumido por /functions/query-dataset (próximo passo).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ======================= Configs =======================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-4o-mini";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false }, global: { fetch } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

// ======================= Types =========================
type ColumnSummary = {
  name: string;
  type: "numeric" | "text" | "date" | "boolean" | "mixed";
  stats?: { null_count?: number; unique_count?: number; mean?: number; min?: number; max?: number };
  sample_values?: string[];
  top_values?: { value: string; count: number }[];
};
type StatisticalSummary = {
  columns: ColumnSummary[];
  total_rows: number;
  total_columns: number;
  data_quality_score?: number;
};

type Intent =
  | "exploratory_overview"
  | "aggregation"
  | "temporal_aggregation"
  | "topn_ranking"
  | "lookup_record"
  | "filter_table"
  | "correlation"
  | "unknown";

type MetricOp = "count" | "sum" | "avg" | "min" | "max" | "count_distinct";

type FilterOp =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "starts_with" | "ends_with"
  | "ilike" | "between" | "in" | "is_null" | "not_null";

type OrderDir = "asc" | "desc";

type QueryDSL = {
  // Tabela base para execução. Preferimos trabalhar em dataset_matrix (colunar), mas query-dataset pode decidir.
  from: "dataset_matrix" | "dataset_rows";

  // Seleção estruturada:
  // - columns: lista de colunas “originais” (case-sensitive conforme summary) que devem aparecer no resultado final
  // - metrics: agregações numéricas
  // - group_by: colunas categóricas ou buckets de data (“month(Data)”, “year(Data)”)
  select?: string[]; // nomes de colunas (ex.: ["Produto", "Estado"])
  metrics?: Array<{ op: MetricOp; column?: string; as?: string }>;
  group_by?: string[]; // nomes de colunas ou expressões temporais permitidas: "day(<col>)"|"month(<col>)"|"year(<col>)"

  // Filtros
  where?: Array<{ column: string; op: FilterOp; value?: string | number | boolean | (string | number)[]; value2?: any }>;

  // Ordenação e limite
  order_by?: Array<{ by: string; dir: OrderDir }>; // "by" pode ser nome de métrica (via "as") ou coluna
  limit?: number; // padrão controlado

  // Observações livres (explicação breve do plano)
  note?: string;

  // Modo especial para lookup pontual
  mode?: "lookup" | "default";
};

// ======================= Helpers =======================
function httpJson(status: number, payload: any) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeCol(s?: string) {
  return String(s || "").trim();
}

function isAllowedMetric(op: string): op is MetricOp {
  return ["count", "sum", "avg", "min", "max", "count_distinct"].includes(op);
}
function isAllowedFilter(op: string): op is FilterOp {
  return [
    "eq","neq","gt","gte","lt","lte",
    "contains","starts_with","ends_with","ilike",
    "between","in","is_null","not_null"
  ].includes(op);
}
function isAllowedDir(dir?: string): dir is OrderDir {
  return dir === "asc" || dir === "desc";
}

function clampLimit(n: any, fallback = 100, max = 500) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return fallback;
  return Math.min(Math.max(1, Math.floor(x)), max);
}

function detectLikelyDateColumns(summary: StatisticalSummary): string[] {
  return (summary.columns || [])
    .filter((c) => c.type === "date" || /data|date|emissao|vencimento|entrega|created|updated/i.test(c.name))
    .map((c) => c.name);
}

function detectLikelyIdColumns(summary: StatisticalSummary): string[] {
  return (summary.columns || [])
    .filter((c) => /id|nota|nf|pedido|os|protocolo|numero|número|documento/i.test(c.name))
    .map((c) => c.name);
}

function detectLikelyValueColumns(summary: StatisticalSummary): string[] {
  return (summary.columns || [])
    .filter((c) => c.type === "numeric" && /valor|total|fatur|receita|price|amount|frete|desconto|margem|custo/i.test(c.name))
    .map((c) => c.name);
}

function pickTopCategorical(summary: StatisticalSummary, max = 6): string[] {
  const cats = (summary.columns || [])
    .filter((c) => c.type === "text" || c.type === "boolean" || c.type === "mixed")
    .map((c) => ({ name: c.name, uniq: c.stats?.unique_count ?? 0 }))
    .sort((a, b) => b.uniq - a.uniq);
  return cats.slice(0, max).map((c) => c.name);
}

function inferIntent(question: string): Intent {
  const q = question.toLowerCase();

  // lookup por identificador típico
  if (/\b(nf|nota|pedido|os|ordem|protocolo|id)\b.*\d/.test(q) || /\b\d{5,}\b/.test(q)) return "lookup_record";

  if (/top\s*\d+|top\s+(?:five|ten)|maiores|mais vendidos|ranking|top-?n|top\s*\b/i.test(q)) return "topn_ranking";
  if (/\b(mes(es)?|mês|mensal|seman(a|al)|diári[oa]|diario|trimestre|trimestral|ano|anual|yoy|mom)\b/.test(q)) return "temporal_aggregation";
  if (/\btotal|média|media|soma|contagem|quantidade|avg|sum|count|group by\b/.test(q)) return "aggregation";
  if (/\bcorr(e|e)lação|correlation|associa(ç|c)ão\b/.test(q)) return "correlation";
  if (/lista|listar|tabela|mostre|quais são|filtr(a|e)|onde|igual|contém|contiver/i.test(q)) return "filter_table";
  if (/analise|análise|overview|resumo|insight|comentar|explorat(ó|o)ria|descritiva/i.test(q)) return "exploratory_overview";

  return "unknown";
}

// Validação forte do DSL contra colunas disponíveis
function validateAndTightenDSL(dsl: any, columnsAllowed: string[], intent: Intent): QueryDSL {
  const colsSet = new Set(columnsAllowed.map(normalizeCol));

  // Base
  const out: QueryDSL = {
    from: dsl?.from === "dataset_rows" ? "dataset_rows" : "dataset_matrix",
    mode: dsl?.mode === "lookup" ? "lookup" : "default",
  };

  // select
  if (Array.isArray(dsl?.select)) {
    const safeSel = dsl.select
      .map((s: any) => normalizeCol(s))
      .filter((s: string) => s && colsSet.has(s));
    if (safeSel.length) out.select = [...new Set(safeSel)].slice(0, 30);
  }

  // metrics
  if (Array.isArray(dsl?.metrics)) {
    const safeMetrics: QueryDSL["metrics"] = [];
    for (const m of dsl.metrics) {
      const op = String(m?.op || "").toLowerCase();
      if (!isAllowedMetric(op)) continue;
      const col = m?.column ? normalizeCol(m.column) : undefined;
      if (col && !colsSet.has(col)) continue; // sum/avg/min/max precisam de col válida
      safeMetrics.push({
        op,
        column: col,
        as: String(m?.as || "").slice(0, 64) || undefined,
      });
    }
    if (safeMetrics.length) out.metrics = safeMetrics.slice(0, 20);
  }

  // group_by (permitimos colunas diretas e expressões day()/month()/year() com colunas de data)
  const dateCols = new Set(detectLikelyDateColumns({ columns: columnsAllowed.map((n) => ({ name: n, type: "date" } as any)) } as any));
  const groupRegex = /^(day|month|year)\((.+)\)$/i;
  if (Array.isArray(dsl?.group_by)) {
    const safeGB: string[] = [];
    for (const g of dsl.group_by) {
      const raw = normalizeCol(g);
      if (!raw) continue;
      const m = raw.match(groupRegex);
      if (m) {
        const col = normalizeCol(m[2]);
        if (colsSet.has(col)) safeGB.push(`${m[1].toLowerCase()}(${col})`);
      } else {
        if (colsSet.has(raw)) safeGB.push(raw);
      }
    }
    if (safeGB.length) out.group_by = [...new Set(safeGB)].slice(0, 8);
  }

  // where
  if (Array.isArray(dsl?.where)) {
    const safeW: NonNullable<QueryDSL["where"]> = [];
    for (const w of dsl.where) {
      const col = normalizeCol(w?.column);
      const op = String(w?.op || "").toLowerCase();
      if (!colsSet.has(col)) continue;
      if (!isAllowedFilter(op)) continue;

      let value = w?.value;
      if (op === "between") {
        if (!Array.isArray(value) || value.length !== 2) continue;
      }
      if (op === "in") {
        if (!Array.isArray(value) || value.length === 0) continue;
      }
      // is_null / not_null não precisam de value
      if (["is_null", "not_null"].includes(op)) value = undefined;

      safeW.push({ column: col, op, value, value2: w?.value2 });
    }
    if (safeW.length) out.where = safeW.slice(0, 20);
  }

  // order_by
  if (Array.isArray(dsl?.order_by)) {
    const safeOB: NonNullable<QueryDSL["order_by"]> = [];
    for (const o of dsl.order_by) {
      const by = String(o?.by || "").trim();
      const dir = String(o?.dir || "desc").toLowerCase();
      // permitimos ordenar por nome de coluna (válida) ou por alias de métrica (validado em query-dataset)
      if (!by) continue;
      if (!isAllowedDir(dir)) continue;
      if (colsSet.has(by) || /^[_A-Za-z][\w-]{0,63}$/.test(by)) {
        safeOB.push({ by, dir });
      }
    }
    if (safeOB.length) out.order_by = safeOB.slice(0, 5);
  }

  // limit
  out.limit = clampLimit(dsl?.limit, intent === "lookup_record" ? 10 : intent === "topn_ranking" ? 10 : 100, 500);

  // nota
  if (dsl?.note) out.note = String(dsl.note).slice(0, 400);

  // Regras mínimas por intenção
  if (intent === "lookup_record") {
    out.mode = "lookup";
    // Se não veio where, garantimos que a execução não trará milhões de linhas
    if (!out.where || out.where.length === 0) out.limit = 50;
  }

  return out;
}

// ======================= OpenAI ========================
async function callOpenAI(messages: Array<{ role: "system" | "user"; content: string }>) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenAI API error ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI: resposta vazia");
  return content;
}

// ======================= Handler =======================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const started = Date.now();
  try {
    // Auth (user token)
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Authorization token required");
    const token = auth.split(" ")[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("User not authenticated");

    const body = await req.json().catch(() => ({}));
    const dataset_id = String(body?.dataset_id || "").trim();
    const question = String(body?.question || body?.prompt || body?.query || "").trim();

    if (!dataset_id) return httpJson(400, { success: false, error: "dataset_id is required" });
    if (!question) return httpJson(400, { success: false, error: "question is required" });

    // Carrega summary do dataset
    const { data: ds, error: dsErr } = await supabase
      .from("datasets")
      .select("id, original_filename, row_count, column_count, statistical_summary")
      .eq("id", dataset_id)
      .eq("user_id", user.id)
      .single();

    if (dsErr || !ds) return httpJson(404, { success: false, error: "Dataset not found" });

    const summary: StatisticalSummary = (ds.statistical_summary || { columns: [], total_rows: ds.row_count, total_columns: ds.column_count });

    const columnNames = (summary.columns || []).map((c) => c.name).filter(Boolean);
    if (!columnNames.length) return httpJson(400, { success: false, error: "Dataset has no column summary" });

    // Inferir intenção
    const intent = inferIntent(question);

    // Montar prompt forte (system + user) com colunas válidas e instruções
    const likelyDates = detectLikelyDateColumns(summary);
    const likelyIds = detectLikelyIdColumns(summary);
    const likelyValues = detectLikelyValueColumns(summary);
    const topCats = pickTopCategorical(summary);

    const schemaText = `
Você deve responder **exclusivamente** em JSON (um único objeto) com o seguinte SCHEMA **estrito**:

{
  "from": "dataset_matrix" | "dataset_rows",
  "mode": "lookup" | "default",
  "select": string[] | null,
  "metrics": [{"op": "count"|"sum"|"avg"|"min"|"max"|"count_distinct", "column": string|null, "as": string|null}] | null,
  "group_by": string[] | null,                // pode usar "day(<col>)" | "month(<col>)" | "year(<col>)"
  "where": [{"column": string, "op": "eq"|"neq"|"gt"|"gte"|"lt"|"lte"|"contains"|"starts_with"|"ends_with"|"ilike"|"between"|"in"|"is_null"|"not_null", "value": any, "value2": any}] | null,
  "order_by": [{"by": string, "dir": "asc"|"desc"}] | null,
  "limit": number | null,
  "note": string | null
}

REGRAS:
- Use **apenas** colunas desta lista: ${JSON.stringify(columnNames)}.
- Não invente nomes de colunas.
- Para agregações temporais, use "day(col)", "month(col)" ou "year(col)" somente com colunas de data: ${JSON.stringify(likelyDates)}.
- Para "top N", ordene por métrica relevante em "desc" e inclua "limit".
- Para "lookup" (registro específico), defina "mode": "lookup" e inclua filtros em "where".
- Se a pergunta exigir soma/média/contagem, preencha "metrics" e "group_by" conforme necessário.
- Caso não seja necessária métrica, deixe "metrics": null.
- Prefira "from": "dataset_matrix".
- Nunca retorne SQL.
`;

    const hints = `
Dicas do dataset:
- Prováveis colunas de ID: ${JSON.stringify(likelyIds)}
- Prováveis colunas de VALOR: ${JSON.stringify(likelyValues)}
- Principais categóricas: ${JSON.stringify(topCats)}
- Contagem de linhas: ${summary.total_rows} | colunas: ${summary.total_columns}
`;

    const systemPrompt = [
      "Você é um planejador de consultas (planner) para análise de dados.",
      "Sua função é devolver um JSON DSL válido, minimalista, que responda à pergunta com segurança.",
      "Se a pergunta for genérica (exploratória), proponha um agrupamento simples por uma categórica e uma métrica total; ou apenas métricas globais.",
      "Se for temporal, use year()/month()/day() sobre colunas de data existentes.",
      "Se for lookup/registro específico, use where com a coluna de ID correta e mode='lookup'.",
      "Se não tiver certeza, retorne algo simples e seguro (ex.: count total; limit pequeno) e explique em 'note'.",
    ].join("\n");

    const userPrompt = [
      `Arquivo: ${ds.original_filename || "(sem nome)"}`,
      `Pergunta do usuário: "${question}"`,
      `Colunas disponíveis: ${JSON.stringify(columnNames)}`,
      hints,
      schemaText,
      `Intenção inferida (sugestão): ${intent}`,
    ].join("\n\n");

    // Chamada à OpenAI
    const content = await callOpenAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    // Parse/Validação
    let raw: any;
    try {
      raw = JSON.parse(content);
    } catch {
      // fallback ultra-seguro
      raw = {
        from: "dataset_matrix",
        select: null,
        metrics: [{ op: "count", column: null, as: "linhas" }],
        group_by: null,
        where: null,
        order_by: null,
        limit: 100,
        note: "Fallback seguro: não foi possível interpretar totalmente a pergunta.",
      };
    }

    const dsl = validateAndTightenDSL(raw, columnNames, intent);

    const finished = Date.now() - started;
    return httpJson(200, {
      success: true,
      intent,
      dsl,
      debug: {
        dataset_id,
        row_count: ds.row_count,
        column_count: ds.column_count,
        took_ms: finished,
      },
    });
  } catch (e: any) {
    const finished = Date.now() - started;
    return httpJson(500, { success: false, error: e?.message || "Internal error", took_ms: finished });
  }
});
