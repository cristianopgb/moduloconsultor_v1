import { profileData } from './simple-analyzer.ts';
import { executeSQL } from '../_shared/simple-sql-executor.ts';
import { validateSQLQuery } from './simple-analyzer.ts';
import { callOpenAI } from './simple-analyzer.ts'; // ou de onde estiver definida

// 🧠 1. Reflete sobre a pergunta antes de gerar SQL
async function reflectOnQuestion(profile, question: string) {
  const prompt = `
Você é um analista de dados experiente.

Primeiro, reflita sobre a seguinte pergunta do usuário:

"${question}"

Considere:
- As colunas disponíveis são: ${profile.columns.join(', ')}
- Tipos: ${JSON.stringify(profile.columnTypes)}
- Estatísticas: ${JSON.stringify(profile.stats, null, 2)}
- Total de linhas: ${profile.totalRows}

Agora responda em JSON:

{
  "isAnswerable": true,
  "columnsNeeded": ["coluna1", "coluna2"],
  "assumptions": ["Hipótese que você está fazendo"],
  "strategy": "Como você pretende responder à pergunta"
}

Se a pergunta for irrelevante para esse dataset, retorne "isAnswerable": false.
`;

  return await callOpenAI([
    { role: 'system', content: prompt }
  ]);
}

// 🔁 2. Tenta refazer queries se todas falharem
async function retryQueryGeneration(profile, question: string, previousErrors: string[]) {
  const prompt = `
Você gerou queries SQL que falharam.

Erros detectados:
${previousErrors.map((e, i) => `Erro ${i + 1}: ${e}`).join('\n')}

Por favor, gere novas queries SQL corrigindo esses problemas.

Use apenas colunas: ${profile.columns.join(', ')}

Retorne o seguinte JSON:

{
  "reasoning": "Explicação",
  "queries": [
    { "purpose": "Explica o que faz", "sql": "SELECT ... FROM data GROUP BY ..." }
  ]
}
`;

  return await callOpenAI([
    { role: 'system', content: prompt }
  ]);
}

// 🎯 3. Função principal
export async function analyzeSmart(data, userQuestion: string) {
  const profile = profileData(data);

  // Etapa 1: Reflexão
  const reflection = await reflectOnQuestion(profile, userQuestion);
  if (reflection?.isAnswerable === false) {
    return {
      success: false,
      error: 'A pergunta não é compatível com o dataset enviado.'
    };
  }

  // Etapa 2: Geração de queries
  const sqlPlan = await generateSQLPlan(profile, userQuestion);

  // Etapa 3: Validação
  const validatedQueries = [];
  const validationErrors = [];

  for (const q of sqlPlan.queries) {
    const val = validateSQLQuery(q.sql);
    if (val.valid) {
      validatedQueries.push(q);
    } else {
      validationErrors.push(val.error);
    }
  }

  // Etapa 4: Retry se todas falharem
  if (validatedQueries.length === 0 && validationErrors.length > 0) {
    const retryPlan = await retryQueryGeneration(profile, userQuestion, validationErrors);
    for (const q of retryPlan.queries) {
      const val = validateSQLQuery(q.sql);
      if (val.valid) validatedQueries.push(q);
    }

    if (validatedQueries.length === 0) {
      return {
        success: false,
        error: 'Todas as queries falharam, mesmo após retry.'
      };
    }
  }

  // Etapa 5: Executa queries
  const executedQueries = [];
  for (const q of validatedQueries) {
    const result = executeSQL(data, q.sql, profile.columnTypes);
    if (result.success) {
      executedQueries.push({
        purpose: q.purpose,
        sql: q.sql,
        results: result.data
      });
    }
  }

  if (executedQueries.length === 0) {
    return {
      success: false,
      error: 'Nenhuma query executada com sucesso.'
    };
  }

  // Etapa 6: Geração de narrativa
  const narrative = await generateNarrative(profile, userQuestion, executedQueries);

  return {
    success: true,
    summary: narrative.summary,
    insights: narrative.insights,
    charts: narrative.charts,
    calculations: narrative.calculations,
    recommendations: narrative.recommendations,
    sql_queries: executedQueries,
    validation_passed: true
  };
}

// 🔧 Reaproveita generateSQLPlan e generateNarrative já existentes
async function generateSQLPlan(profile, question: string) {
  const prompt = `Você é um analista de dados. Gere queries SQL para responder à pergunta:

"${question}"

Use a tabela "data" com colunas: ${profile.columns.join(', ')}
Tipos: ${JSON.stringify(profile.columnTypes)}

⚠️ IMPORTANTE:
- Sempre use GROUP BY se usar SUM, AVG, COUNT, etc.
- Não use subqueries, JOINs, CTEs
- Use apenas colunas disponíveis
- Gere de 2 a 5 queries diferentes
- Use LIMIT 10

Formato de resposta:

{
  "reasoning": "Explicação",
  "queries": [
    { "purpose": "Explica o que faz", "sql": "SELECT ... FROM data GROUP BY ..." }
  ]
}
`;

  return await callOpenAI([
    { role: 'system', content: prompt }
  ]);
}

async function generateNarrative(profile, question: string, queryResults: any[]) {
  const prompt = `
Você é um analista de dados sênior.

Baseie-se **apenas** nos dados a seguir:
${JSON.stringify(queryResults, null, 2)}

Crie um relatório com:

{
  "summary": "Resumo em até 3 frases",
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "calculations": [{ "label": "Total de itens", "value": 123 }],
  "charts": [{ "type": "bar", "title": "Movimentação por rua", "data": { labels: [], values: [] } }],
  "recommendations": ["Sugestão 1", "Sugestão 2"]
}

⚠️ Use apenas números que estão nos resultados.
Não invente valores. Não estime. Copie exatamente como estão.
`;

  return await callOpenAI([
    { role: 'system', content: prompt }
  ]);
}
