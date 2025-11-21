/**
 * SEMANTIC REFLECTION ANALYZER
 *
 * Core principle: THINK before generating SQL
 *
 * Flow:
 * 1. Semantic Reflection: Map user intent to available columns
 * 2. Validation: Check if mapping makes sense
 * 3. SQL Generation: Generate queries based on validated mapping
 * 4. Execution with Retry: Run queries, retry if failed
 * 5. Narrative: Generate insights from REAL results only
 */

import { executeSQL } from '../_shared/simple-sql-executor.ts';

interface SemanticReflection {
  user_intent: string;
  relevant_columns: string[];
  analysis_strategy: string;
  confidence: number;
  potential_issues: string[];
}

interface AnalysisResult {
  success: boolean;
  error?: string;
  semantic_reflection?: string;
  summary: string;
  insights: string[];
  calculations: any[];
  charts: any[];
  recommendations: string[];
  sql_queries: any[];
  validation_passed: boolean;
  confidence: number;
}

/**
 * Main analysis function with semantic reflection
 */
export async function analyzeWithSemanticReflection(
  data: any[],
  userQuestion: string,
  profile: any,
  openaiApiKey: string,
  openaiModel: string
): Promise<AnalysisResult> {

  console.log('[SemanticReflection] Starting analysis with reflection...');

  // STEP 1: Semantic Reflection - understand intent before generating SQL
  let reflection: SemanticReflection;
  try {
    reflection = await performSemanticReflection(
      userQuestion,
      profile,
      openaiApiKey,
      openaiModel
    );

    console.log('[SemanticReflection] Reflection complete:', {
      intent: reflection.user_intent,
      columns: reflection.relevant_columns,
      confidence: reflection.confidence
    });
    console.log('[SemanticReflection] User question:', userQuestion);
    console.log('[SemanticReflection] Available columns:', profile.columns);
    console.log('[SemanticReflection] Strategy:', reflection.analysis_strategy);
  } catch (error: any) {
    console.error('[SemanticReflection] Reflection failed:', error);
    return {
      success: false,
      error: `Failed to understand your question: ${error.message}`,
      summary: '',
      insights: [],
      calculations: [],
      charts: [],
      recommendations: [],
      sql_queries: [],
      validation_passed: false,
      confidence: 0
    };
  }

  // Check if confidence is too low
  if (reflection.confidence < 50) {
    console.log('[SemanticReflection] Low confidence, needs clarification');
    return {
      success: false,
      error: 'Low confidence in understanding your question',
      semantic_reflection: JSON.stringify(reflection, null, 2),
      summary: `Entendi que você quer: ${reflection.user_intent}\n\nMas tenho baixa confiança (${reflection.confidence}%) nessa interpretação.\n\nProblemas identificados:\n${reflection.potential_issues.join('\n')}`,
      insights: [],
      calculations: [],
      charts: [],
      recommendations: reflection.potential_issues,
      sql_queries: [],
      validation_passed: false,
      confidence: reflection.confidence
    };
  }

  // STEP 2: Generate SQL based on reflection
  let sqlPlan: any;
  try {
    sqlPlan = await generateSQLFromReflection(
      reflection,
      profile,
      openaiApiKey,
      openaiModel
    );

    console.log('[SemanticReflection] SQL plan generated:', {
      queries: sqlPlan.queries?.length || 0
    });
    console.log('[SemanticReflection] Generated SQLs:');
    sqlPlan.queries?.forEach((q: any, i: number) => {
      console.log(`  [${i+1}] ${q.purpose}: ${q.sql}`);
    });
  } catch (error: any) {
    console.error('[SemanticReflection] SQL generation failed:', error);
    return {
      success: false,
      error: `Failed to generate analysis plan: ${error.message}`,
      semantic_reflection: JSON.stringify(reflection, null, 2),
      summary: '',
      insights: [],
      calculations: [],
      charts: [],
      recommendations: [],
      sql_queries: [],
      validation_passed: false,
      confidence: reflection.confidence
    };
  }

  if (!sqlPlan.queries || sqlPlan.queries.length === 0) {
    console.log('[SemanticReflection] No queries generated');
    return {
      success: false,
      error: 'Could not generate analysis queries',
      semantic_reflection: JSON.stringify(reflection, null, 2),
      summary: '',
      insights: [],
      calculations: [],
      charts: [],
      recommendations: [],
      sql_queries: [],
      validation_passed: false,
      confidence: reflection.confidence
    };
  }

  // STEP 3: Execute queries with validation
  const executedQueries: any[] = [];
  let retryAttempts = 0;
  const maxRetries = 2;

  for (const query of sqlPlan.queries) {
    if (!query.sql) {
      console.warn('[SemanticReflection] Skipping query without SQL');
      continue;
    }

    let success = false;
    let attempts = 0;
    let lastError = null;

    while (!success && attempts <= maxRetries) {
      attempts++;
      try {
        const result = executeSQL(data, query.sql, profile.columnTypes);

        if (result.success && result.data.length > 0) {
          executedQueries.push({
            purpose: query.purpose,
            sql: query.sql,
            results: result.data
          });
          success = true;
          console.log(`[SemanticReflection] Query executed successfully: ${query.purpose}`);
        } else if (!result.success) {
          lastError = result.error;
          console.warn(`[SemanticReflection] Query failed (attempt ${attempts}): ${result.error}`);
          console.log('[SemanticReflection] Failed SQL:', query.sql);
          console.log('[SemanticReflection] Error details:', result.error);
          console.log('[SemanticReflection] Available columns:', profile.columns);

          // Try to fix query if possible
          if (attempts < maxRetries) {
            const fixedQuery = await tryFixQuery(
              query.sql,
              result.error || 'Unknown error',
              profile,
              openaiApiKey,
              openaiModel
            );
            if (fixedQuery) {
              query.sql = fixedQuery;
              retryAttempts++;
            } else {
              break;
            }
          }
        }
      } catch (error: any) {
        lastError = error.message;
        console.error(`[SemanticReflection] Query execution error (attempt ${attempts}):`, error);
        break;
      }
    }

    if (!success && lastError) {
      console.log(`[SemanticReflection] Query failed after ${attempts} attempts: ${lastError}`);
    }
  }

  if (executedQueries.length === 0) {
    console.log('[SemanticReflection] No queries executed successfully');
    return {
      success: false,
      error: 'No queries executed successfully',
      semantic_reflection: JSON.stringify(reflection, null, 2),
      summary: '',
      insights: [],
      calculations: [],
      charts: [],
      recommendations: ['Verifique se sua pergunta está clara', 'Tente reformular usando nomes de colunas disponíveis'],
      sql_queries: [],
      validation_passed: false,
      confidence: reflection.confidence
    };
  }

  console.log(`[SemanticReflection] Successfully executed ${executedQueries.length} queries (${retryAttempts} retries)`);

  // STEP 4: Generate narrative from real results
  let narrative: any;
  try {
    narrative = await generateNarrativeFromResults(
      userQuestion,
      reflection,
      executedQueries,
      profile,
      openaiApiKey,
      openaiModel
    );

    console.log('[SemanticReflection] Narrative generated');
  } catch (error: any) {
    console.error('[SemanticReflection] Narrative generation failed:', error);
    return {
      success: false,
      error: `Failed to generate insights: ${error.message}`,
      semantic_reflection: JSON.stringify(reflection, null, 2),
      summary: '',
      insights: [],
      calculations: [],
      charts: [],
      recommendations: [],
      sql_queries: executedQueries,
      validation_passed: false,
      confidence: reflection.confidence
    };
  }

  // STEP 5: Return complete analysis
  return {
    success: true,
    semantic_reflection: JSON.stringify(reflection, null, 2),
    summary: narrative.summary || 'Análise concluída',
    insights: narrative.insights || [],
    calculations: narrative.calculations || [],
    charts: narrative.charts || [],
    recommendations: narrative.recommendations || [],
    sql_queries: executedQueries,
    validation_passed: true,
    confidence: reflection.confidence
  };
}

/**
 * STEP 1: Semantic Reflection - Understand intent before SQL
 */
async function performSemanticReflection(
  userQuestion: string,
  profile: any,
  openaiApiKey: string,
  openaiModel: string
): Promise<SemanticReflection> {

  const prompt = `Você é um analista de dados experiente. Sua tarefa é PENSAR sobre a pergunta do usuário antes de gerar qualquer query.

## Dados disponíveis:
${profile.columns.map((col: string) => {
  const type = profile.columnTypes[col];
  const stats = profile.stats[col];
  let info = `- **${col}** (${type})`;
  if (stats?.sampleValues) {
    info += ` - exemplos: [${stats.sampleValues.slice(0, 3).join(', ')}]`;
  }
  if (stats?.min !== undefined) {
    info += ` - range: ${stats.min} a ${stats.max}`;
  }
  return info;
}).join('\n')}

Total de linhas: ${profile.totalRows}

## Pergunta do usuário:
"${userQuestion}"

## Sua tarefa:
Reflita sobre a pergunta e responda em JSON:

{
  "user_intent": "O que o usuário realmente quer saber? (seja específico)",
  "relevant_columns": ["lista", "de", "colunas", "relevantes"],
  "analysis_strategy": "Estratégia para responder a pergunta (ex: agregação por X, comparação entre Y e Z, etc)",
  "confidence": 0-100 (sua confiança em entender a pergunta),
  "potential_issues": ["possíveis problemas que você identifica"]
}

## Regras importantes:
1. Use APENAS colunas que existem nos dados
2. Se a pergunta for ambígua, marque baixa confiança e liste os problemas
3. Se não tiver certeza de qual coluna usar, marque baixa confiança
4. Seja honesto sobre sua confiança - é melhor pedir clarificação do que adivinhar errado

## IMPORTANTE - Cálculos permitidos:
5. Se o usuário pedir métrica que NÃO existe como coluna, você PODE calculá-la:
   - Divergência/Diferença/Gap: (coluna1 - coluna2)
   - Total combinado: (coluna1 + coluna2)
   - Proporção: (coluna1 / coluna2)
   - Percentual: ((coluna1 / coluna2) * 100)
   - Variação: ((atual - anterior) / anterior * 100)
6. Exemplo: Se usuário pede "divergência" mas só existem colunas "qnt_atual" e "contagem_fisica",
   você deve identificar: relevant_columns: ["qnt_atual", "contagem_fisica"]
   e na estratégia mencionar: "Calcular (qnt_atual - contagem_fisica) como divergência"

## Exemplos:

EXEMPLO 1 - Alta confiança:
Pergunta: "Qual produto vendeu mais?"
Colunas: [produto, quantidade, valor]
Resposta:
{
  "user_intent": "Identificar o produto com maior volume de vendas (soma de quantidade)",
  "relevant_columns": ["produto", "quantidade"],
  "analysis_strategy": "Agrupar por produto e somar quantidade, ordenar decrescente",
  "confidence": 95,
  "potential_issues": []
}

EXEMPLO 2 - Baixa confiança:
Pergunta: "Analise as vendas"
Colunas: [data, produto, quantidade, valor, cliente, regiao]
Resposta:
{
  "user_intent": "Usuário quer análise de vendas mas não especificou o que exatamente",
  "relevant_columns": ["data", "produto", "quantidade", "valor"],
  "analysis_strategy": "Incerto - poderia ser: evolução temporal, por produto, por região, etc",
  "confidence": 40,
  "potential_issues": [
    "Pergunta muito vaga - não sei se quer análise temporal, por produto, por região, etc",
    "Não sei qual métrica é mais importante: quantidade ou valor?",
    "Não sei o período de interesse"
  ]
}

EXEMPLO 3 - Coluna não existe:
Pergunta: "Mostre as vendas por loja"
Colunas: [data, produto, quantidade, valor]
Resposta:
{
  "user_intent": "Usuário quer ver vendas separadas por loja",
  "relevant_columns": [],
  "analysis_strategy": "Impossível - não há coluna de loja nos dados",
  "confidence": 20,
  "potential_issues": [
    "Não existe coluna 'loja' ou similar nos dados",
    "Dados disponíveis não permitem essa análise"
  ]
}

EXEMPLO 4 - Métrica calculável:
Pergunta: "divergência entre estoque e contagem por rua"
Colunas: [rua, qnt_atual, contagem_fisica, produto]
Resposta:
{
  "user_intent": "Calcular a diferença entre quantidade atual e contagem física, agrupado por rua",
  "relevant_columns": ["rua", "qnt_atual", "contagem_fisica"],
  "analysis_strategy": "Calcular (qnt_atual - contagem_fisica) como divergência, agrupar por rua e somar",
  "confidence": 90,
  "potential_issues": []
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content);
}

/**
 * STEP 2: Generate SQL from validated reflection
 */
async function generateSQLFromReflection(
  reflection: SemanticReflection,
  profile: any,
  openaiApiKey: string,
  openaiModel: string
): Promise<any> {

  const prompt = `Agora que você entendeu a intenção do usuário, gere queries SQL para responder.

## Reflexão Semântica:
${JSON.stringify(reflection, null, 2)}

## Colunas disponíveis:
${profile.columns.join(', ')}

## Tipos de colunas:
${JSON.stringify(profile.columnTypes, null, 2)}

## Sua tarefa:
Gere 1-3 queries SQL que implementem a estratégia de análise.

Responda em JSON:
{
  "queries": [
    {
      "purpose": "O que esta query faz",
      "sql": "SELECT ... FROM data GROUP BY ... LIMIT 20"
    }
  ]
}

## Regras CRÍTICAS:
1. Use APENAS colunas de: ${reflection.relevant_columns.join(', ')}
2. SEMPRE use "FROM data"
3. Toda agregação (SUM, AVG, COUNT, MIN, MAX) exige GROUP BY
4. Exceção: COUNT(*) sozinho não precisa GROUP BY
5. NUNCA use JOINs, subqueries, CTEs ou HAVING
6. Use LIMIT para não retornar muitos dados (máximo 20 linhas)
7. Se a coluna for text, use para agrupar
8. Se a coluna for numeric, use para agregar

## CÁLCULOS PERMITIDOS:
9. Você PODE fazer operações matemáticas no SELECT:
   - Diferença: (coluna1 - coluna2) as divergencia
   - Soma: (coluna1 + coluna2) as total
   - Razão: (CAST(coluna1 AS FLOAT) / NULLIF(coluna2, 0)) as proporcao
   - Percentual: ((CAST(coluna1 AS FLOAT) / NULLIF(coluna2, 0)) * 100) as percentual
10. Use alias descritivo para resultados calculados
11. NUNCA tente selecionar coluna que não existe - sempre CALCULE
12. Se a estratégia menciona cálculo, IMPLEMENTE o cálculo no SQL

## VALIDAÇÃO ANTES DE GERAR:
- Revise a estratégia: "${reflection.analysis_strategy}"
- Se menciona "calcular", "diferença", "divergência", "variação": USE operação matemática
- Se menciona coluna que não existe em ${reflection.relevant_columns.join(', ')}: CALCULE usando colunas disponíveis

## Exemplos:

EXEMPLO 1 - Agregação simples:
Intenção: "Total de vendas por produto"
Colunas relevantes: ["produto", "quantidade"]
Query:
{
  "queries": [
    {
      "purpose": "Total de vendas por produto ordenado por maior volume",
      "sql": "SELECT produto, SUM(quantidade) as total FROM data GROUP BY produto ORDER BY total DESC LIMIT 10"
    }
  ]
}

EXEMPLO 2 - Cálculo de divergência:
Intenção: "Calcular (qnt_atual - contagem_fisica) como divergência, agrupar por rua"
Colunas relevantes: ["rua", "qnt_atual", "contagem_fisica"]
Query:
{
  "queries": [
    {
      "purpose": "Divergência entre estoque e contagem física por rua",
      "sql": "SELECT rua, SUM(qnt_atual - contagem_fisica) as divergencia FROM data GROUP BY rua ORDER BY divergencia DESC LIMIT 20"
    }
  ]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content);
}

/**
 * Try to fix a failed query
 */
async function tryFixQuery(
  failedSQL: string,
  error: string,
  profile: any,
  openaiApiKey: string,
  openaiModel: string
): Promise<string | null> {

  console.log('[SemanticReflection] Attempting to fix query...');

  const prompt = `Esta query SQL falhou. Corrija-a.

Query que falhou:
${failedSQL}

Erro:
${error}

Colunas disponíveis: ${profile.columns.join(', ')}
Tipos: ${JSON.stringify(profile.columnTypes)}

Regras:
- Use FROM data
- Agregação precisa de GROUP BY
- Use apenas colunas disponíveis

Retorne JSON:
{
  "fixed_sql": "SELECT ... FROM data ..."
}

Se não conseguir corrigir, retorne:
{
  "fixed_sql": null
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content);
    return result.fixed_sql;
  } catch (error) {
    console.error('[SemanticReflection] Failed to fix query:', error);
    return null;
  }
}

/**
 * STEP 4: Generate narrative from real results
 */
async function generateNarrativeFromResults(
  userQuestion: string,
  reflection: SemanticReflection,
  executedQueries: any[],
  profile: any,
  openaiApiKey: string,
  openaiModel: string
): Promise<any> {

  const prompt = `Gere insights baseados APENAS nos resultados SQL reais.

## Pergunta original:
"${userQuestion}"

## O que você entendeu:
${reflection.user_intent}

## Resultados das queries:
${JSON.stringify(executedQueries, null, 2)}

## Sua tarefa:
Crie uma narrativa analítica baseada SOMENTE nesses dados.

Retorne JSON:
{
  "summary": "Resumo executivo da análise (2-3 frases)",
  "insights": ["Insight 1", "Insight 2", ...],
  "calculations": [
    { "label": "Nome da métrica", "value": número }
  ],
  "charts": [
    {
      "type": "bar" | "line" | "pie",
      "title": "Título do gráfico",
      "data": {
        "labels": ["label1", "label2", ...],
        "values": [valor1, valor2, ...]
      }
    }
  ],
  "recommendations": ["Ação sugerida 1", "Ação sugerida 2"]
}

## Regras ANTI-ALUCINAÇÃO:
1. Use APENAS números que aparecem nos resultados SQL
2. NÃO invente médias, somas ou percentuais
3. NÃO mencione colunas que não estão nos resultados
4. Se não houver dados suficientes, diga isso claramente
5. Seja específico e cite os números reais

## Exemplo:
Query result: [{"produto": "A", "total": 150}, {"produto": "B", "total": 120}]

BOM:
{
  "summary": "Analisados 2 produtos. Produto A lidera com 150 unidades vendidas.",
  "insights": ["Produto A vendeu 150 unidades (25% mais que B)", "Produto B vendeu 120 unidades"],
  "calculations": [{"label": "Total Produto A", "value": 150}, {"label": "Total Produto B", "value": 120}]
}

RUIM (alucinação):
{
  "summary": "Analisados 10 produtos com média de 200 unidades",
  "insights": ["Produto C é o mais vendido"],
  "calculations": [{"label": "Média geral", "value": 200}]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content);
}
