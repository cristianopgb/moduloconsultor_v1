/**
 * PROFESSIONAL ANALYST MODULE
 *
 * LLM acts as a senior data analyst with 10 years of experience.
 * Follows the 7-phase professional data analysis methodology.
 *
 * Core principles:
 * - Understand business context before technical analysis
 * - Generate user-friendly explanations (NO technical jargon)
 * - Plan analysis thoroughly before execution
 * - Ask clarifying questions when needed
 */

interface EnrichedProfile {
  columns: string[];
  columnTypes: Record<string, string>;
  cardinality: Record<string, number>;
  totalRows: number;
  sampleRows: any[];
  stats: Record<string, any>;
}

export interface ProfessionalAnalysisPlan {
  business_understanding: {
    real_intent: string;
    business_context: string;
    hypotheses: string[];
    business_impact: string;
  };
  data_assessment: {
    data_quality: string;
    missing_values_treatment: string;
    transformations_needed: string[];
  };
  analysis_approach: string;
  user_friendly_summary: string;
  queries_planned: Array<{
    purpose_technical: string;
    purpose_user_friendly: string;
    sql: string;
    will_process_rows: number;
    expected_result_type: string;
  }>;
  visualizations_planned: Array<{
    type: string;
    title: string;
    rationale: string;
  }>;
  needs_clarification: boolean;
  clarification_questions: string[];
}

function formatSampleDataAsTable(sampleRows: any[]): string {
  if (!sampleRows || sampleRows.length === 0) return 'No data available';

  const headers = Object.keys(sampleRows[0]);
  const maxRows = Math.min(50, sampleRows.length);

  let table = headers.join('\t') + '\n';
  table += headers.map(() => '---').join('\t') + '\n';

  for (let i = 0; i < maxRows; i++) {
    const row = sampleRows[i];
    table += headers.map(h => String(row[h] ?? '')).join('\t') + '\n';
  }

  return table;
}

async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateProfessionalAnalysisPlan(
  rowData: any[],
  profile: EnrichedProfile,
  userQuestion: string,
  openaiApiKey: string,
  openaiModel: string
): Promise<ProfessionalAnalysisPlan> {

  const prompt = `
Você é um analista de dados sênior com 10 anos de experiência em insights de negócio.

DATASET COMPLETO DISPONÍVEL:
- Total de registros: ${profile.totalRows} (você vai analisar TODOS)
- Colunas: ${profile.columns.join(', ')}
- Tipos de dados: ${JSON.stringify(profile.columnTypes, null, 2)}
- Cardinalidade (valores únicos por coluna): ${JSON.stringify(profile.cardinality, null, 2)}

AMOSTRA DE DADOS (primeiras 50 linhas para você entender a estrutura):
${formatSampleDataAsTable(profile.sampleRows)}

ESTATÍSTICAS DO DATASET:
${JSON.stringify(profile.stats, null, 2)}

IMPORTANTE: Esta amostra é apenas para você entender a ESTRUTURA DOS DADOS.
Suas análises vão processar TODAS as ${profile.totalRows} linhas do dataset completo.

SOLICITAÇÃO DO USUÁRIO:
"${userQuestion}"

SUA TAREFA - PLANEJAMENTO PROFISSIONAL:

Siga o processo profissional de análise de dados:

1. COMPREENSÃO DO NEGÓCIO
   - Qual é a REAL intenção do usuário? (não apenas o que ele escreveu)
   - Qual contexto de negócio está implícito?
   - Que hipóteses posso formular para testar?
   - Qual o impacto de negócio desta análise?

2. AVALIAÇÃO DOS DADOS
   - Os dados estão completos para responder a pergunta?
   - Há valores ausentes que precisam ser tratados?
   - Que transformações são necessárias?

3. PLANO DE ANÁLISE
   - Que análises vou fazer para responder a pergunta?
   - Como vou apresentar os resultados?
   - Que visualizações fazem sentido?

4. CLARIFICAÇÃO (se necessário)
   - Preciso de mais informações do usuário?
   - O que não ficou claro?

Retorne JSON VÁLIDO no seguinte formato:

{
  "business_understanding": {
    "real_intent": "Intenção real do usuário em linguagem de negócio",
    "business_context": "Contexto de negócio inferido",
    "hypotheses": ["Hipótese 1", "Hipótese 2"],
    "business_impact": "Impacto esperado desta análise"
  },
  "data_assessment": {
    "data_quality": "Avaliação da qualidade dos dados",
    "missing_values_treatment": "Como vou tratar valores ausentes",
    "transformations_needed": ["Transformação 1", "Transformação 2"]
  },
  "analysis_approach": "Estratégia geral de análise",
  "user_friendly_summary": "TEXTO AMIGÁVEL explicando o que você vai fazer (SEM jargão técnico, SEM mencionar 'query', 'SQL', 'dataset', 'agregação'). Use: 'vou analisar', 'vou comparar', 'vou identificar'. Máximo 200 palavras.",
  "queries_planned": [
    {
      "purpose_technical": "Documentação interna",
      "purpose_user_friendly": "O que usuário vai entender",
      "sql": "SELECT ... FROM data ...",
      "will_process_rows": ${profile.totalRows},
      "expected_result_type": "ranking | distribution | total | comparison"
    }
  ],
  "visualizations_planned": [
    {"type": "bar", "title": "Título do gráfico", "rationale": "Por que este gráfico"}
  ],
  "needs_clarification": false,
  "clarification_questions": []
}

REGRAS CRÍTICAS:
- NUNCA use jargão técnico no "user_friendly_summary"
- NUNCA mencione: "query", "SQL", "dataset", "agregação", "GROUP BY"
- Use linguagem conversacional: "Vou analisar...", "Vou comparar...", "Vou identificar..."
- Se algo não ficou claro, seja ESPECÍFICO nas perguntas
- Pense como analista de negócio, não como programador

REGRAS TÉCNICAS (para o SQL funcionar):
- Sempre use "FROM data" (nome da tabela é "data")
- Se usar SUM/AVG/COUNT/MIN/MAX, SEMPRE adicione GROUP BY
- Exceção: COUNT(*) sozinho não precisa GROUP BY
- Use apenas colunas que existem: ${profile.columns.join(', ')}
- Colunas no SELECT que não têm agregação DEVEM estar no GROUP BY
- Exemplo correto: SELECT coluna, SUM(valor) as total FROM data GROUP BY coluna
- Exemplo errado: SELECT coluna, SUM(valor) FROM data (falta GROUP BY)

Retorne APENAS o JSON (sem markdown, sem explicação adicional).
`;

  console.log('[ProfessionalAnalyst] Generating analysis plan...');

  const response = await callOpenAI(prompt, openaiApiKey, openaiModel);

  // Clean response (remove markdown code blocks if present)
  const cleanResponse = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');

  try {
    const plan = JSON.parse(cleanResponse);
    console.log('[ProfessionalAnalyst] Plan generated successfully');
    return plan;
  } catch (error: any) {
    console.error('[ProfessionalAnalyst] Failed to parse response:', cleanResponse);
    throw new Error(`Failed to parse LLM response: ${error.message}`);
  }
}
