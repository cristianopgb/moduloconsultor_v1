// /supabase/functions/analyze-data/index.ts
// Sistema INTELIGENTE de análise de dados que funciona como um analista real
// Abordagem: LLM vê dados reais → entende contexto → gera SQL customizado → executa → interpreta → apresenta insights
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ======================= CONFIG =======================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL" )!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-4o-mini";

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

interface SQLQuery {
  sql: string;
  purpose: string;
  expected_columns: string[];
}

interface AnalysisStep {
  step: number;
  action: string;
  query?: SQLQuery;
  result?: any;
  interpretation?: string;
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

  // Security: Replace $1::uuid with literal UUID to prevent SQL injection
  const sanitizedSQL = sql.replaceAll("$1::uuid", `'${dataset_id.replace(/'/g, "''")}'::uuid`);

  const wrapped = `
    SELECT COALESCE(json_agg(t), '[]'::json) AS result
    FROM (
      ${sanitizedSQL}
    ) t
  `;

  // This uses your existing 'exec_sql' function which is correctly set as DEFINER
  const { data, error } = await supabase.rpc("exec_sql", {
    sql_query: wrapped,
    sql_params: {}, // Your function signature might not need this, but it's harmless
  });

  if (error) throw new Error("SQL execution failed: " + error.message);

  if (Array.isArray(data) && data.length && typeof data[0] === "object" && "result" in data[0]) {
    return (data[0] as any).result || [];
  }
  return Array.isArray(data) ? data : [];
}

// ======================= DATA SAMPLING =======================
async function getDataSample(dataset_id: string): Promise<DataSample> {
  // Get sample rows (first 100 for LLM to understand structure)
  const sampleRows = await execSQL(
    dataset_id,
    `SELECT data FROM dataset_rows WHERE dataset_id = $1::uuid LIMIT 100`
  );

  if (sampleRows.length === 0) {
    throw new Error("Dataset has no rows");
  }

  // Extract all unique column names from the sample
  const columnsSet = new Set<string>();
  sampleRows.forEach((row: any) => {
    if (row.data && typeof row.data === "object") {
      Object.keys(row.data).forEach((key) => columnsSet.add(key));
    }
  });
  const columns = Array.from(columnsSet);

  // **THE CRITICAL FIX**: Get total row count from the complete dataset
  const countResult = await execSQL(
    dataset_id,
    `SELECT COUNT(*) as total FROM dataset_rows WHERE dataset_id = $1::uuid`
  );
  const total_rows = Number(countResult[0]?.total || 0);

  // Detect column types and basic stats to help the LLM
  const column_types: Record<string, string> = {};
  const stats: Record<string, any> = {};

  for (const col of columns) {
    const values = sampleRows
      .map((r: any) => r.data?.[col])
      .filter((v) => v != null && v !== "");

    if (values.length === 0) {
      column_types[col] = "empty";
      continue;
    }

    const numericCount = values.filter((v) => !isNaN(Number(v))).length;
    const dateCount = values.filter((v) => !isNaN(Date.parse(v))).length;

    if (numericCount / values.length > 0.8) {
      column_types[col] = "numeric";
      const numValues = values.map(Number).filter((n) => !isNaN(n));
      if (numValues.length > 0) {
        stats[col] = {
          min: Math.min(...numValues),
          max: Math.max(...numValues),
          avg: numValues.reduce((a, b) => a + b, 0) / numValues.length,
        };
      }
    } else if (dateCount / values.length > 0.8) {
      column_types[col] = "date";
    } else {
      column_types[col] = "text";
      stats[col] = {
        unique_count: new Set(values).size,
        sample_values: [...new Set(values)].slice(0, 5),
      };
    }
  }

  return {
    columns,
    sample_rows: sampleRows.slice(0, 10).map((r: any) => r.data), // A small sample for context
    total_rows, // The full count
    column_types,
    stats,
  };
}

// ======================= LLM INTERACTION =======================
async function callOpenAI(messages: any[], options?: { temperature?: number }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: options?.temperature ?? 0.2, // Lower temperature for more predictable SQL
      messages,
    } ),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenAI API Error: ${resp.status} - ${txt}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  
  // Robust JSON parsing
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON object found in the LLM response.");
  } catch (e) {
    console.error("Failed to parse LLM JSON response. Raw content:", content);
    throw new Error(`Could not decode the analysis plan from the AI: ${e.message}`);
  }
}

// ======================= SQL GENERATION (Analyst Pillar: Technical Skill) =======================
async function generateAnalysisSQL(
  userQuestion: string,
  dataSample: DataSample
): Promise<SQLQuery[]> {
  const systemPrompt = `Você é um analista de dados expert em PostgreSQL. Sua tarefa é criar um plano de análise em formato JSON para responder à pergunta do usuário.

**Contexto do Negócio:**
A pergunta do usuário é: "${userQuestion}"

**Informações do Dataset:**
- **O dataset completo tem ${dataSample.total_rows} linhas.** Suas queries devem operar no conjunto completo, não na amostra.
- A tabela se chama 'dataset_rows' e os dados estão na coluna JSONB 'data'.
- Para acessar um campo, use a sintaxe: \`data->>'nome_da_coluna'\`.
- Para converter para número, use \`(data->>'nome_da_coluna')::numeric\`. Faça isso apenas em colunas numéricas.

**Schema e Amostra:**
- Colunas Disponíveis: ${JSON.stringify(dataSample.columns)}
- Tipos de Coluna (detectado): ${JSON.stringify(dataSample.column_types)}
- Estatísticas da Amostra: ${JSON.stringify(dataSample.stats)}
- Exemplo de Linhas: ${JSON.stringify(dataSample.sample_rows)}

**Sua Tarefa:**
1.  Pense como um analista de dados. Qual é a intenção por trás da pergunta?
2.  Crie um plano com uma ou mais queries SQL para responder à pergunta de forma completa.
3.  Retorne **APENAS** um objeto JSON com a seguinte estrutura:
    {
      "reasoning": "Sua breve explicação sobre a estratégia de análise.",
      "queries": [
        {
          "sql": "SELECT ... FROM dataset_rows WHERE dataset_id = $1::uuid ...",
          "purpose": "O que esta query específica calcula (ex: 'Calcular o total de vendas por mês').",
          "expected_columns": ["coluna_esperada_1", "coluna_esperada_2"]
        }
      ]
    }`;

  const response = await callOpenAI([{ role: "system", content: systemPrompt }]);
  return response.queries || [];
}

// ======================= RESULT INTERPRETATION (Analyst Pillar: Storytelling) =======================
async function interpretResults(
  userQuestion: string,
  dataSample: DataSample,
  steps: AnalysisStep[]
): Promise<any> {
  const systemPrompt = `Você é um analista de dados sênior e especialista em storytelling. Sua tarefa é transformar dados brutos em uma análise clara e acionável para um gestor.

**Contexto:**
- A pergunta original do gestor foi: "${userQuestion}"
- O dataset analisado tem um total de ${dataSample.total_rows} linhas.

**Dados Brutos (Resultados das Queries):**
${JSON.stringify(steps, null, 2)}

**Sua Tarefa:**
Crie uma narrativa coesa a partir dos dados. Não apenas liste os números, explique o que eles significam.
Retorne **APENAS** um objeto JSON com a seguinte estrutura:
{
  "summary": "Um resumo executivo da análise em 2-3 frases.",
  "insights": [
    { "title": "Principal Insight 1", "description": "Explicação detalhada do achado, incluindo números e contexto." }
  ],
  "calculations": [
    { "metric": "Nome da Métrica", "value": "Valor Formatado (ex: R$ 12.345,67)", "interpretation": "O que este número significa para o negócio." }
  ],
  "charts": [
    {
      "type": "line" | "bar" | "pie",
      "title": "Título do Gráfico",
      "data": { "labels": ["Jan", "Fev"], "datasets": [{ "label": "Vendas", "data": [100, 150] }] }
    }
  ],
  "recommendations": [
    "Recomendação acionável baseada nos insights."
  ]
}`;

  return await callOpenAI([{ role: "system", content: systemPrompt }], { temperature: 0.5 });
}

// ======================= MAIN ANALYSIS FLOW =======================
async function analyzeDataset(dataset_id: string, user_question: string) {
  const steps: AnalysisStep[] = [];

  // 1. Entender o Terreno (Amostragem e Metadados)
  console.log(`[1/4] Profiling dataset ${dataset_id}...`);
  const dataSample = await getDataSample(dataset_id);

  // 2. Criar o Plano de Ataque (Gerar SQL)
  console.log("[2/4] Devising analysis plan (generating SQL)...");
  const queries = await generateAnalysisSQL(user_question, dataSample);
  if (!queries || queries.length === 0) {
    throw new Error("A IA não conseguiu criar um plano de análise. Tente reformular a pergunta.");
  }

  // 3. Executar o Plano (Rodar as Queries)
  console.log(`[3/4] Executing ${queries.length} queries...`);
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    try {
      const result = await execSQL(dataset_id, query.sql);
      steps.push({
        step: i + 1,
        action: query.purpose,
        query,
        result,
      });
    } catch (e: any) {
      throw new Error(`Erro ao executar a etapa ${i + 1} do plano (${query.purpose}): ${e.message}`);
    }
  }

  // 4. Contar a História (Interpretar Resultados)
  console.log("[4/4] Interpreting results and building narrative...");
  const interpretation = await interpretResults(user_question, dataSample, steps);

  return {
    ...interpretation,
    execution_details: {
      total_rows_analyzed: dataSample.total_rows,
      queries_executed: steps.length,
    },
  };
}

// ======================= HTTP HANDLER =======================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return httpJson({ success: false, error: "Authorization token required" }, 401 );
    }
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return httpJson({ success: false, error: "User not authenticated" }, 401 );
    }

    const body = await req.json();
    const { dataset_id, analysis_request } = body;

    if (!dataset_id || !isUUID(dataset_id)) {
      return httpJson({ success: false, error: "A valid 'dataset_id' is required" }, 400 );
    }
    if (!analysis_request || typeof analysis_request !== 'string' || analysis_request.trim().length < 3) {
      return httpJson({ success: false, error: "A valid 'analysis_request' is required" }, 400 );
    }

    // Verify dataset ownership
    const { data: ds, error: dsError } = await supabase
      .from("datasets")
      .select("id, user_id, processing_status, has_queryable_data, row_count")
      .eq("id", dataset_id)
      .eq("user_id", user.id)
      .single();

    if (dsError || !ds) {
      return httpJson({ success: false, error: "Dataset not found or access denied" }, 404 );
    }
    if (ds.processing_status !== "completed" || !ds.has_queryable_data || (ds.row_count ?? 0) === 0) {
        return httpJson({ success: false, error: "Dataset is not ready for analysis or is empty." }, 409 );
    }

    // Run the full analysis pipeline
    const result = await analyzeDataset(dataset_id, analysis_request);

    // Save the successful analysis to the database
    let analysis_id: string | null = null;
    try {
      const { data: ins, error: insError } = await supabase
        .from("analyses")
        .insert([{
            user_id: user.id,
            dataset_id,
            model: OPENAI_MODEL + "-dynamic",
            prompt: analysis_request,
            result_json: result,
            llm_response: result, // Store the final structured response
            charts_config: result.charts || [],
            status: 'completed'
        }])
        .select("id")
        .single();

      if (insError) throw insError;
      analysis_id = ins.id;
    } catch (e: any) {
      console.error("Failed to save analysis record:", e.message);
    }

    return httpJson({
      success: true,
      executed_query: true,
      message: "Análise concluída com sucesso.",
      analysis_id,
      result,
    } );

  } catch (e: any) {
    console.error("[analyze-data] CRITICAL ERROR:", e);
    return httpJson({
      success: false,
      executed_query: false,
      error: e.message || "An internal server error occurred.",
    }, 500 );
  }
});
