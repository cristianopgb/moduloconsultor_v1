/**
 * QUERY ANALYSIS - Post-Analysis Conversation System
 *
 * Allows users to ask questions about completed analyses without re-running them.
 * Uses cached analysis results to provide instant responses.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-4o-mini";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QueryAnalysisRequest {
  analysis_id: string;
  question: string;
  conversation_id?: string;
}

interface CachedAnalysis {
  id: string;
  user_question: string;
  ai_response: any;
  query_results: any[];
  parsed_schema: any[];
  full_dataset_rows: number;
  narrative_text?: string;
  narrative_structured?: any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: QueryAnalysisRequest = await req.json();
    const { analysis_id, question, conversation_id } = body;

    if (!analysis_id || !question) {
      return new Response(
        JSON.stringify({ success: false, error: "analysis_id and question are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[query-analysis] User ${user.id} asking about analysis ${analysis_id}`);
    console.log(`[query-analysis] Question: ${question}`);

    // Fetch cached analysis
    const { data: analysis, error: fetchError } = await supabase
      .from('data_analyses')
      .select('id, user_question, ai_response, query_results, parsed_schema, full_dataset_rows, narrative, narrative_text')
      .eq('id', analysis_id)
      .eq('user_id', user.id) // Security: only owner can query
      .single();

    if (fetchError || !analysis) {
      return new Response(
        JSON.stringify({ success: false, error: "Analysis not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[query-analysis] Found cached analysis with ${analysis.query_results?.length || 0} results`);

    // Determine question type
    const questionType = classifyQuestion(question, analysis);

    let response: string;

    switch (questionType) {
      case 'clarification':
        response = await answerClarification(question, analysis);
        break;
      case 'drill_down':
        response = await answerDrillDown(question, analysis);
        break;
      case 'comparison':
        response = await answerComparison(question, analysis);
        break;
      case 'what_if':
        response = await answerWhatIf(question, analysis);
        break;
      default:
        response = await answerGeneral(question, analysis);
    }

    // Save query to conversation if provided
    if (conversation_id) {
      await supabase.from('messages').insert([
        {
          conversation_id,
          role: 'user',
          content: question,
          message_type: 'follow_up_question'
        },
        {
          conversation_id,
          role: 'assistant',
          content: response,
          message_type: 'follow_up_answer',
          metadata: { analysis_id, question_type: questionType }
        }
      ]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        answer: response,
        question_type: questionType,
        analysis_id,
        cached: true
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('[query-analysis] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Classify the type of follow-up question
 */
function classifyQuestion(question: string, analysis: CachedAnalysis): string {
  const lower = question.toLowerCase();

  // Clarification: "o que significa...", "como interpretar..."
  if (
    lower.includes('o que significa') ||
    lower.includes('como interpretar') ||
    lower.includes('explique') ||
    lower.includes('o que é')
  ) {
    return 'clarification';
  }

  // Drill-down: "mostre detalhes", "quais são", "lista"
  if (
    lower.includes('detalhe') ||
    lower.includes('quais são') ||
    lower.includes('lista') ||
    lower.includes('mostre') ||
    lower.includes('específico')
  ) {
    return 'drill_down';
  }

  // Comparison: "comparado com", "vs", "diferença"
  if (
    lower.includes('compar') ||
    lower.includes(' vs ') ||
    lower.includes('diferença') ||
    lower.includes('melhor') ||
    lower.includes('pior')
  ) {
    return 'comparison';
  }

  // What-if: "e se", "o que aconteceria", "cenário"
  if (
    lower.includes('e se') ||
    lower.includes('se fosse') ||
    lower.includes('cenário') ||
    lower.includes('projeção')
  ) {
    return 'what_if';
  }

  return 'general';
}

/**
 * Answer clarification questions about the analysis
 */
async function answerClarification(question: string, analysis: CachedAnalysis): Promise<string> {
  const prompt = `Você é um analista de dados ajudando a esclarecer uma análise já realizada.

ANÁLISE ORIGINAL:
Pergunta: ${analysis.user_question}
Resumo: ${analysis.ai_response?.summary || 'N/A'}
Insights: ${JSON.stringify(analysis.ai_response?.insights || [])}

PERGUNTA DO USUÁRIO:
${question}

TAREFA:
Responda a pergunta de forma clara e direta, usando apenas as informações da análise já realizada.
Se a análise já contém a resposta, referencie-a. Se não, explique o que a análise mostrou relacionado ao tema.

Seja conciso e objetivo.`;

  const response = await callOpenAI(prompt);
  return response;
}

/**
 * Answer drill-down questions with specific details
 */
async function answerDrillDown(question: string, analysis: CachedAnalysis): Promise<string> {
  const prompt = `Você é um analista de dados fornecendo detalhes adicionais sobre uma análise.

DADOS DA ANÁLISE:
${JSON.stringify(analysis.query_results?.slice(0, 100) || [], null, 2)}

Total de registros: ${analysis.full_dataset_rows}
Pergunta original: ${analysis.user_question}

PERGUNTA DE DRILL-DOWN:
${question}

TAREFA:
Use os dados acima para responder com detalhes específicos.
Se os dados contêm a informação, forneça números, exemplos e contexto.
Se os dados são insuficientes para responder, explique o que está disponível e sugira nova análise se necessário.

Formate a resposta de forma estruturada e fácil de ler.`;

  const response = await callOpenAI(prompt);
  return response;
}

/**
 * Answer comparison questions
 */
async function answerComparison(question: string, analysis: CachedAnalysis): Promise<string> {
  const prompt = `Você é um analista comparativo.

DADOS DISPONÍVEIS:
${JSON.stringify(analysis.query_results?.slice(0, 50) || [], null, 2)}

INSIGHTS DA ANÁLISE:
${JSON.stringify(analysis.ai_response?.insights || [])}

PERGUNTA DE COMPARAÇÃO:
${question}

TAREFA:
Faça a comparação solicitada usando os dados disponíveis.
Destaque:
- Diferenças absolutas e percentuais
- Qual é melhor/pior e por quê
- Contexto de negócio relevante

Se a comparação exata não for possível com os dados atuais, faça o melhor possível e explique limitações.`;

  const response = await callOpenAI(prompt);
  return response;
}

/**
 * Answer what-if and scenario questions
 */
async function answerWhatIf(question: string, analysis: CachedAnalysis): Promise<string> {
  const prompt = `Você é um analista de cenários e projeções.

DADOS BASE:
${JSON.stringify(analysis.query_results?.slice(0, 30) || [], null, 2)}

CONTEXTO:
${analysis.ai_response?.summary || 'N/A'}

PERGUNTA DE CENÁRIO:
${question}

TAREFA:
Responda ao cenário hipotético de forma analítica:
1. Use os dados atuais como baseline
2. Projete o impacto da mudança proposta
3. Quantifique quando possível
4. Destaque riscos e oportunidades
5. Sugira passos práticos

Seja realista e baseado em dados, mas indique claramente que é uma projeção.`;

  const response = await callOpenAI(prompt);
  return response;
}

/**
 * Answer general follow-up questions
 */
async function answerGeneral(question: string, analysis: CachedAnalysis): Promise<string> {
  // Use enhanced narrative if available
  const context = analysis.narrative_text
    ? `NARRATIVA COMPLETA:\n${analysis.narrative_text}\n\n`
    : `RESUMO:\n${analysis.ai_response?.summary || 'N/A'}\n\nINSIGHTS:\n${JSON.stringify(analysis.ai_response?.insights || [])}\n\n`;

  const prompt = `Você é um assistente analítico respondendo perguntas sobre uma análise de dados.

${context}

DADOS (amostra):
${JSON.stringify(analysis.query_results?.slice(0, 20) || [], null, 2)}

PERGUNTA DO USUÁRIO:
${question}

TAREFA:
Responda à pergunta usando as informações disponíveis na análise.
Seja específico, use números quando relevante, e mantenha o contexto de negócio.
Se a pergunta não pode ser respondida com os dados atuais, explique e sugira próximos passos.`;

  const response = await callOpenAI(prompt);
  return response;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "Você é um analista de dados prestativo e conciso."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Não foi possível gerar resposta.";

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout: OpenAI não respondeu em 30 segundos');
    }
    throw error;
  }
}
