// /supabase/functions/chat-analyze/index.ts
// VERSÃO UNIFICADA E CORRIGIDA

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ======================= CONFIG =======================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL" )!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_MODEL = "gpt-4o-mini";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
  global: { fetch },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

// ======================= TYPES =======================
interface DataSample {
  columns: string[];
  sample_rows: any[];
  total_rows: number;
  column_types: Record<string, string>;
  stats: Record<string, any>;
}

// ======================= UTILITIES =======================
function httpJson(body: any, status = 200 ) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

// ======================= SQL EXECUTION =======================
async function execSQL(dataset_id: string, sql: string): Promise<any[]> {
  if (!isUUID(dataset_id)) throw new Error("Invalid dataset_id");
  const sanitizedSQL = sql.replaceAll("$1::uuid", `'${dataset_id.replace(/'/g, "''")}'::uuid`);
  const wrapped = `SELECT COALESCE(json_agg(t), '[]'::json) AS result FROM (${sanitizedSQL}) t`;
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: wrapped });
  if (error) throw new Error("SQL execution failed: " + error.message);
  return (data as any)?.[0]?.result || [];
}

// ======================= DATA SAMPLING =======================
async function getDataSample(dataset_id: string): Promise<DataSample> {
  const sampleRows = await execSQL(dataset_id, `SELECT data FROM dataset_rows WHERE dataset_id = $1::uuid LIMIT 100`);
  if (sampleRows.length === 0) throw new Error("Dataset has no rows");

  const columnsSet = new Set<string>();
  sampleRows.forEach((row: any) => {
    if (row.data && typeof row.data === "object") Object.keys(row.data).forEach((key) => columnsSet.add(key));
  });
  const columns = Array.from(columnsSet);

  const countResult = await execSQL(dataset_id, `SELECT COUNT(*) as total FROM dataset_rows WHERE dataset_id = $1::uuid`);
  const total_rows = Number(countResult[0]?.total || 0);

  const column_types: Record<string, string> = {};
  const stats: Record<string, any> = {};
  for (const col of columns) {
    const values = sampleRows.map((r: any) => r.data?.[col]).filter((v) => v != null && v !== "");
    if (values.length === 0) { column_types[col] = "empty"; continue; }
    const numericCount = values.filter((v) => !isNaN(Number(v))).length;
    const dateCount = values.filter((v) => !isNaN(Date.parse(v))).length;
    if (numericCount / values.length > 0.8) {
      column_types[col] = "numeric";
      const numValues = values.map(Number).filter((n) => !isNaN(n));
      if (numValues.length > 0) stats[col] = { min: Math.min(...numValues), max: Math.max(...numValues) };
    } else if (dateCount / values.length > 0.8) {
      column_types[col] = "date";
    } else {
      column_types[col] = "text";
      stats[col] = { unique_count: new Set(values).size, sample_values: [...new Set(values)].slice(0, 5) };
    }
  }
  return { columns, sample_rows: sampleRows.slice(0, 10).map((r: any) => r.data), total_rows, column_types, stats };
}

// ======================= LLM INTERACTION =======================
async function callOpenAI(messages: any[], options?: { temperature?: number }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, temperature: options?.temperature ?? 0.2, messages } ),
  });
  if (!resp.ok) throw new Error(`OpenAI API Error: ${resp.status} - ${await resp.text()}`);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("No JSON object found in the LLM response.");
  } catch (e: any) {
    throw new Error(`Could not decode the AI response: ${e.message}`);
  }
}

// ======================= ANALYSIS PIPELINE =======================
async function runAnalysisPipeline(dataset_id: string, user_question: string, user_id: string, conversation_id: string) {
  // 1. Profile the data
  const dataSample = await getDataSample(dataset_id);

  // 2. Generate SQL
  const sqlGenPrompt = `Você é um analista de dados expert em PostgreSQL. Crie um plano de análise em JSON para responder à pergunta do usuário.
Contexto: "${user_question}"
Dataset Info: O dataset completo tem ${dataSample.total_rows} linhas. A tabela é 'dataset_rows', coluna JSONB 'data'.
Schema: Colunas: ${JSON.stringify(dataSample.columns)}. Tipos: ${JSON.stringify(dataSample.column_types)}.
Sua Tarefa: Retorne APENAS um objeto JSON com "reasoning" e "queries" (com "sql", "purpose"). O SQL deve ter "WHERE dataset_id = $1::uuid".`;
  const plan = await callOpenAI([{ role: "system", content: sqlGenPrompt }]);
  const queries = plan.queries;
  if (!queries || queries.length === 0) throw new Error("A IA não conseguiu criar um plano de análise (SQL).");

  // 3. Execute SQL
  const steps: any[] = [];
  for (const query of queries) {
    const result = await execSQL(dataset_id, query.sql);
    steps.push({ purpose: query.purpose, result });
  }

  // 4. Interpret Results
  const interpreterPrompt = `Você é um analista de dados sênior e especialista em storytelling. Transforme os dados brutos a seguir em uma análise clara para um gestor.
Pergunta Original: "${user_question}"
Total de Linhas: ${dataSample.total_rows}
Dados Brutos: ${JSON.stringify(steps, null, 2)}
Sua Tarefa: Crie uma narrativa coesa. Retorne APENAS um objeto JSON com "summary", "insights", "calculations", "charts", e "recommendations".`;
  const interpretation = await callOpenAI([{ role: "system", content: interpreterPrompt }], { temperature: 0.5 });

  // 5. Save and return
  const { data: analysisRecord } = await supabase.from("analyses").insert({
    user_id, dataset_id, conversation_id, model: OPENAI_MODEL + "-unified", prompt: user_question,
    result_json: interpretation, llm_response: interpretation, charts_config: interpretation.charts || [], status: 'completed'
  }).select("id").single();

  return {
    success: true,
    executed_query: true,
    message: interpretation.summary || "Análise concluída.",
    analysis_id: analysisRecord?.id,
    result: interpretation,
  };
}

// ======================= HTTP HANDLER =======================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  let step = "initialization";

  try {
    console.log("[chat-analyze] ===== INÍCIO DA REQUISIÇÃO =====");

    step = "auth_header_check";
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return httpJson({ success: false, error: "Authorization token required", step }, 401 );
    }

    step = "token_extraction";
    const token = authHeader.split(" ")[1];

    step = "get_user";
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return httpJson({ success: false, error: "User not authenticated", step, authError: authError?.message }, 401 );
    }

    console.log("[chat-analyze] User authenticated:", user.id);

    step = "parse_body";
    const body = await req.json();
    console.log("[chat-analyze] Body recebido:", JSON.stringify(body, null, 2));

    step = "extract_params";
    const { conversation_id, question, attachments } = body;

    step = "validate_conversation_id";
    if (!isUUID(conversation_id)) {
      return httpJson({ success: false, error: "A valid 'conversation_id' is required", step, received: conversation_id }, 400 );
    }

    step = "validate_question";
    if (!question || typeof question !== 'string' || question.trim().length < 3) {
      return httpJson({ success: false, error: "A valid 'question' is required", step, received: question }, 400 );
    }

    step = "validate_attachments";
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return httpJson({ success: false, error: "Attachments are required for analysis", step, received: attachments }, 400 );
    }

    console.log("[chat-analyze] Validation passed. Attachments count:", attachments.length);

    step = "find_data_file";
    const dataFile = attachments.find(att => /\.(xlsx|xls|csv)$/i.test(att.title || ''));
    if (!dataFile) {
        console.log("[chat-analyze] Nenhum arquivo Excel/CSV encontrado nos anexos");
        return httpJson({ success: false, executed_query: false, error: "Nenhum arquivo de dados (Excel/CSV ) foi encontrado nos anexos para análise.", step });
    }

    console.log("[chat-analyze] Data file found:", JSON.stringify(dataFile, null, 2));

    step = "validate_storage_path";
    if (!dataFile.storage_path) {
        console.error("[chat-analyze] ERRO: storage_path ausente. DataFile:", JSON.stringify(dataFile));
        throw new Error(`Arquivo anexado não possui storage_path. Dados do arquivo: ${JSON.stringify(dataFile)}`);
    }

    // Busca o dataset correspondente ao storage_path da referência
    step = "query_existing_dataset";
    console.log("[chat-analyze] Buscando dataset existente com storage_path:", dataFile.storage_path);
    const { data: existingDataset, error: datasetQueryError } = await supabase
        .from('datasets')
        .select('id, has_queryable_data')
        .eq('storage_path', dataFile.storage_path)
        .eq('user_id', user.id)
        .maybeSingle();

    if (datasetQueryError) {
        console.error("[chat-analyze] Erro ao buscar dataset:", datasetQueryError);
    } else {
        console.log("[chat-analyze] Dataset existente:", existingDataset);
    }

    let dataset_id: string;

    step = "check_existing_dataset";
    if (existingDataset && existingDataset.has_queryable_data) {
        // Dataset já existe e tem dados queryable
        console.log("[chat-analyze] Usando dataset existente:", existingDataset.id);
        dataset_id = existingDataset.id;
    } else {
        console.log("[chat-analyze] Precisa processar o arquivo. Iniciando download...");

        // Precisa processar o arquivo
        // Baixa o arquivo do storage para processar
        step = "download_file";
        const bucket = dataFile.storage_bucket || 'references';
        console.log("[chat-analyze] Download de bucket:", bucket, "path:", dataFile.storage_path);

        const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(dataFile.storage_path);

        if (downloadError || !fileData) {
            console.error("[chat-analyze] ERRO no download:", downloadError);
            throw new Error(`Falha ao baixar arquivo: ${downloadError?.message || 'Arquivo não encontrado'}`);
        }

        console.log("[chat-analyze] Arquivo baixado com sucesso. Tamanho:", fileData.size, "bytes");

        step = "convert_to_base64";
        console.log("[chat-analyze] Convertendo para base64...");

        // Converte para base64
        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const file_data = btoa(binary);

        console.log("[chat-analyze] Base64 criado. Tamanho:", file_data.length, "chars");

        step = "invoke_process_excel";
        console.log("[chat-analyze] Chamando process-excel...");

        const processBody = {
            file_data,
            filename: dataFile.title,
            conversation_id,
            store_queryable: true,
        };
        console.log("[chat-analyze] Body para process-excel:", {
            filename: dataFile.title,
            conversation_id,
            store_queryable: true,
            file_data_length: file_data.length
        });

        // Processa o arquivo
        // IMPORTANTE: Passar headers de autenticação para a função invocada
        const { data: processResult, error: processError } = await supabase.functions.invoke('process-excel', {
            body: processBody,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log("[chat-analyze] Resposta do process-excel:");
        console.log("[chat-analyze]   - processResult:", processResult);
        console.log("[chat-analyze]   - processError:", processError);

        if (processError) {
            console.error("[chat-analyze] ERRO na invocação:", processError);
            throw new Error(`Erro ao chamar process-excel: ${processError.message}`);
        }

        if (!processResult?.success) {
            console.error("[chat-analyze] process-excel retornou falha:", processResult);
            throw new Error(processResult?.error || "process-excel falhou sem detalhar o motivo.");
        }

        step = "extract_dataset_id";
        dataset_id = processResult.dataset_id;
        console.log("[chat-analyze] Dataset criado:", dataset_id);
    }

    // Roda o pipeline de análise completo
    step = "run_analysis_pipeline";
    console.log("[chat-analyze] Iniciando pipeline de análise...");
    console.log("[chat-analyze] Parâmetros:", { dataset_id, question, user_id: user.id, conversation_id });

    let analysisResult;
    try {
      analysisResult = await runAnalysisPipeline(dataset_id, question, user.id, conversation_id);
      console.log("[chat-analyze] Pipeline concluído. Resultado:", JSON.stringify(analysisResult, null, 2));
    } catch (pipelineError: any) {
      console.error("[chat-analyze] ERRO no pipeline:", pipelineError);
      throw new Error(`Erro na análise: ${pipelineError.message}`);
    }

    console.log("[chat-analyze] Análise concluída com sucesso!");
    return httpJson(analysisResult );

  } catch (e: any) {
    console.error("[chat-analyze] CRITICAL ERROR at step:", step);
    console.error("[chat-analyze] Error:", e);
    console.error("[chat-analyze] Stack trace:", e.stack);
    return httpJson({
      success: false,
      executed_query: false,
      error: e.message || "An internal server error occurred.",
      step,
      errorType: e.constructor.name
    }, 500 );
  }
});
