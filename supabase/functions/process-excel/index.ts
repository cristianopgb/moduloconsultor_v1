// /supabase/functions/process-excel/index.ts
// (ARQUIVO COMPLETO — aceita file_data+filename OU dataset_id)
// - Lê Excel/CSV, faz EDA, salva CSV normalizado no Storage
// - Upsert em datasets
// - Popula dataset_rows e materializa dataset_matrix via RPC
// - Idempotente para reprocessamento (limpa linhas antigas)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =================== Supabase client (SERVICE ROLE) ===================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("[process-excel] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  global: { fetch },
  auth: { persistSession: false }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info"
};

// =================== Helpers de EDA ===================
function detectColumnType(values: any[]) {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNull.length === 0) return { type: "text", confidence: 1 };

  let numeric = 0, date = 0, boolean = 0;

  const looksLikeDate = (s: string) => {
    if (/^[0-9.,-]+$/.test(s)) return false; // evita confundir "123,45" com data
    const t = Date.parse(s);
    if (isNaN(t)) return false;
    const y = new Date(t).getFullYear();
    return y >= 1900 && y <= 2100;
  };

  const looksLikeNumber = (s: string) => {
    let c = s.replace(/[R$\s€£¥₹%]/g, "").replace(/\.(?=.*\.)/g, "");
    if (/,/.test(c) && !/\.\d{1,3}$/.test(c)) c = c.replace(",", ".");
    const n = Number(c);
    return !isNaN(n) && isFinite(n);
  };

  for (const v of nonNull) {
    const s = String(v).trim();
    if (s === "true" || s === "false" || s === "True" || s === "False") {
      boolean++;
    } else if (looksLikeNumber(s)) {
      numeric++;
    } else if (looksLikeDate(s)) {
      date++;
    }
  }

  const total = nonNull.length;
  const numPct = numeric / total;
  const datePct = date / total;
  const boolPct = boolean / total;

  if (numPct > 0.6) return { type: "number", confidence: numPct };
  if (datePct > 0.6) return { type: "date", confidence: datePct };
  if (boolPct > 0.8) return { type: "boolean", confidence: boolPct };
  return { type: "text", confidence: 1 };
}

function analyzeColumn(values: any[]) {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const nullCount = values.length - nonNull.length;
  if (nonNull.length === 0) {
    return { type: "text", stats: {}, nullCount };
  }

  const detection = detectColumnType(values);
  const type = detection.type;
  const stats: any = {};

  if (type === "number") {
    const nums = nonNull.map((v) => {
      const s = String(v).trim().replace(/[R$\s€£¥₹%]/g, "").replace(/\.(?=.*\.)/g, "");
      const cleaned = /,/.test(s) && !/\.\d{1,3}$/.test(s) ? s.replace(",", ".") : s;
      return Number(cleaned);
    }).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      nums.sort((a, b) => a - b);
      const sum = nums.reduce((acc, n) => acc + n, 0);
      stats.min = nums[0];
      stats.max = nums[nums.length - 1];
      stats.mean = sum / nums.length;
      stats.median = nums[Math.floor(nums.length / 2)];
    }
  } else if (type === "date") {
    const dates = nonNull.map((v) => new Date(String(v).trim())).filter((d) => !isNaN(d.getTime()));
    if (dates.length > 0) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      stats.min = dates[0].toISOString();
      stats.max = dates[dates.length - 1].toISOString();
    }
  } else if (type === "text") {
    const unique = new Set(nonNull);
    stats.uniqueCount = unique.size;
    if (unique.size <= 10) {
      const freq: any = {};
      nonNull.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
      stats.topValues = Object.entries(freq).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
    }
  }

  return { type, stats, nullCount };
}

// =================== Processa o arquivo (gera CSV normalizado + EDA) ===================
async function processExcelFile(
  buf: ArrayBuffer,
  filename: string,
  userId: string,
  conversationId: string | null,
  existingDatasetId: string | null
) {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Worksheet não encontrado no arquivo Excel");

  const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
  if (rawData.length === 0) throw new Error("Nenhuma linha de dados encontrada na planilha");

  const headers = Object.keys(rawData[0]);
  const rows = rawData;

  // EDA
  const warnings: string[] = [];
  if (headers.some((h) => !h || h.trim() === "")) {
    warnings.push("Algumas colunas não possuem cabeçalhos (foram omitidas)");
  }

  const columnData: any = {};
  headers.forEach((h) => {
    columnData[h] = rows.map((r) => r[h]);
  });

  const column_types: any = {};
  const statistical_summary: any = {};
  for (const col of headers) {
    const analysis = analyzeColumn(columnData[col]);
    column_types[col] = analysis.type;
    statistical_summary[col] = {
      type: analysis.type,
      stats: analysis.stats,
      nullCount: analysis.nullCount,
      totalCount: rows.length
    };
  }

  // Gera CSV
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const csvFilename = filename.replace(/\.[^/.]+$/, "") + "_normalized.csv";
  const csvPath = `datasets/${userId}/${csvFilename}`;

  const csvBlob = new Blob([csvContent], { type: "text/csv" });
  const uploadResult = await supabase.storage.from("datasets").upload(csvPath, csvBlob, { upsert: true });
  if (uploadResult.error) throw new Error(`Falha ao salvar CSV: ${uploadResult.error.message}`);

  // Upsert dataset
  let dataset: any;
  const dsPayload = {
    storage_bucket: "datasets",
    storage_path: csvPath,
    normalized_csv_path: csvPath,
    column_types,
    statistical_summary,
    row_count: rows.length,
    column_count: headers.length,
    processing_status: "completed",
    updated_at: new Date().toISOString()
  };

  if (existingDatasetId) {
    const { data, error } = await supabase
      .from("datasets")
      .update(dsPayload)
      .eq("id", existingDatasetId)
      .select()
      .single();
    if (error || !data) throw new Error(`Falha ao atualizar dataset: ${error?.message || "sem dados"}`);
    dataset = data;
  } else {
    const { data, error } = await supabase
      .from("datasets")
      .insert({
        user_id: userId,
        conversation_id: conversationId || null,
        original_filename: filename,
        file_size: csvContent.length,
        mime_type: "xlsx",
        ...dsPayload
      })
      .select()
      .single();
    if (error || !data) throw new Error(`Falha ao criar dataset: ${error?.message || "sem dados"}`);
    dataset = data;
  }

  return {
    dataset_id: dataset.id as string,
    summary: statistical_summary,
    warnings,
    csv_path: csvPath
  };
}

// =================== Popula dataset_rows e materializa matrix ===================
async function populateDatasetRowsAndMatrix(buf: ArrayBuffer, datasetId: string) {
  // 1) Limpa antigas (idempotência)
  await supabase.from("dataset_rows").delete().eq("dataset_id", datasetId);
  await supabase.from("dataset_matrix").delete().eq("dataset_id", datasetId);

  // 2) Re-parse e insere dataset_rows em lotes
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
  const headers = Object.keys(rawData[0] || {});

  const rowsToInsert = rawData.map((rowData, idx) => ({
    dataset_id: datasetId,
    row_index: idx,
    data: rowData
  }));

  const BATCH_SIZE = 500;
  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("dataset_rows").insert(batch);
    if (error) {
      console.error(`[populateDatasetRowsAndMatrix] Erro no lote ${i}:`, error);
      throw new Error(`Falha ao inserir dataset_rows: ${error.message}`);
    }
  }

  // 3) Materializa dataset_matrix via RPC
  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/materialize_dataset_matrix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Prefer: "params=single-object"
    },
    body: JSON.stringify({ p_dataset: datasetId })
  });

  if (!rpc.ok) {
    const errText = await rpc.text().catch(() => "");
    console.error("[materialize_dataset_matrix_rpc] failed:", errText);
    throw new Error(`Falha ao materializar dataset_matrix: ${rpc.status}`);
  }

  return { rowsInserted: rowsToInsert.length, cols: headers.length };
}

// =================== HTTP Handler ===================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const began = Date.now();
  let step = "initialization";

  try {
    console.log("[process-excel] ===== INÍCIO =====");

    step = "auth_check";
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      console.error("[process-excel] Token ausente ou inválido");
      throw new Error("Token de autorização necessário");
    }
    const token = auth.split(" ")[1];

    step = "get_user";
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      console.error("[process-excel] Erro de autenticação:", authErr);
      throw new Error("Usuário não autenticado");
    }
    console.log("[process-excel] Usuário autenticado:", user.id);

    step = "parse_body";
    const body = await req.json().catch(() => ({}));
    console.log("[process-excel] Body recebido:", {
      has_file_data: !!body?.file_data,
      file_data_length: body?.file_data?.length,
      filename: body?.filename,
      dataset_id: body?.dataset_id,
      conversation_id: body?.conversation_id,
      store_queryable: body?.store_queryable
    });

    const { file_data, filename, dataset_id, conversation_id, store_queryable } = body ?? {};

    let buf: ArrayBuffer;
    let finalName: string;
    let finalDatasetId: string | null = dataset_id ?? null;

    step = "decode_file";
    if (file_data && filename) {
      // Modo 1: upload direto (base64)
      console.log("[process-excel] Decodificando base64...");
      const bin = atob(file_data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      buf = bytes.buffer;
      finalName = filename;
      console.log("[process-excel] Arquivo decodificado. Tamanho:", buf.byteLength);
    } else if (dataset_id) {
      // Modo 2: reprocessa a partir de um dataset já criado (baixa do Storage)
      const { data: ds, error: dsErr } = await supabase
        .from("datasets")
        .select("*")
        .eq("id", dataset_id)
        .eq("user_id", user.id)
        .single();

      if (dsErr || !ds) throw new Error("Dataset não encontrado para reprocessamento");

      const bucket = ds.storage_bucket || "datasets";
      const path = ds.storage_path || ds.normalized_csv_path;
      if (!path) throw new Error("Dataset sem storage_path/normalized_csv_path");

      const dl = await supabase.storage.from(bucket).download(path);
      if (dl.error || !dl.data) throw new Error(`Falha ao baixar arquivo do Storage: ${dl?.error?.message}`);

      buf = await dl.data.arrayBuffer();
      finalName = ds.original_filename || "arquivo.xlsx";
    } else {
      throw new Error("Envie file_data+filename ou dataset_id");
    }

    // Processa arquivo (gera CSV normalizado e atualiza/insere dataset)
    step = "process_excel_file";
    console.log("[process-excel] Processando arquivo...");
    const result = await processExcelFile(buf, finalName, user.id, conversation_id ?? null, finalDatasetId);
    console.log("[process-excel] Arquivo processado. Dataset ID:", result.dataset_id);

    // Se não veio dataset_id, agora temos o novo id
    finalDatasetId = result.dataset_id;

    // Popula dataset_rows + materializa matrix se solicitado
    step = "check_store_queryable";
    let populated: any = null;
    if (store_queryable === true) {
      step = "populate_rows_and_matrix";
      console.log("[process-excel] Populando dataset_rows e materializando matrix...");
      populated = await populateDatasetRowsAndMatrix(buf, finalDatasetId);
      console.log("[process-excel] Linhas inseridas:", populated.rowsInserted, "Colunas:", populated.cols);
    }

    const elapsed = Date.now() - began;

    return new Response(JSON.stringify({
      success: true,
      dataset_id: finalDatasetId,
      summary: result.summary,
      warnings: result.warnings,
      populated,
      message: "Arquivo processado com sucesso",
      processing_time_ms: elapsed
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    const elapsed = Date.now() - began;
    console.error("[process-excel][ERROR] at step:", step);
    console.error("[process-excel][ERROR]", e?.message || e);
    console.error("[process-excel][ERROR] Stack:", e?.stack);
    return new Response(JSON.stringify({
      success: false,
      error: e?.message || "Erro interno",
      step,
      errorType: e?.constructor?.name || "Error",
      processing_time_ms: elapsed
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
