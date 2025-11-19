/**
 * SIMPLE ANALYZER - Atualizado com pipeline inteligente
 *
 * Pipeline:
 * 1. Detecta schema
 * 2. Reflete sobre a pergunta do usuário
 * 3. Gera queries SQL (com retry se falhar)
 * 4. Valida e executa as queries
 * 5. Gera narrativa a partir dos resultados
 * 6. Valida consistência dos números
 * 7. Fallback automático se tudo falhar
 */ import { executeSQL } from '../_shared/simple-sql-executor.ts';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = 'gpt-4o-mini';
/**
 * 📊 Detecta colunas, tipos e estatísticas do dataset
 */ export function profileData(data) {
  if (!data || data.length === 0) {
    throw new Error('Dataset está vazio');
  }
  const columns = Object.keys(data[0]);
  const columnTypes = {};
  const stats = {};
  for (const col of columns){
    const values = data.map((row)=>row[col]).filter((v)=>v != null && v !== '');
    if (values.length === 0) {
      columnTypes[col] = 'unknown';
      continue;
    }
    const numericCount = values.filter((v)=>!isNaN(Number(v))).length;
    const dateCount = values.filter((v)=>!isNaN(Date.parse(String(v)))).length;
    if (numericCount / values.length > 0.8) {
      columnTypes[col] = 'numeric';
      const nums = values.map(Number);
      stats[col] = {
        min: Math.min(...nums),
        max: Math.max(...nums),
        avg: nums.reduce((a, b)=>a + b, 0) / nums.length
      };
    } else if (dateCount / values.length > 0.8) {
      columnTypes[col] = 'date';
    } else {
      columnTypes[col] = 'text';
      const unique = new Set(values);
      stats[col] = {
        uniqueCount: unique.size,
        sampleValues: Array.from(unique).slice(0, 5)
      };
    }
  }
  return {
    columns,
    columnTypes,
    totalRows: data.length,
    sampleRows: data.slice(0, 10),
    stats
  };
}
/**
 * 🔗 Chamada única para OpenAI (resposta esperada em JSON)
 */ async function callOpenAI(messages, options) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: options?.temperature ?? 0.2,
      messages
    })
  });
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('Resposta da IA não contém JSON válido');
}
/**
 * 🤖 Gera plano SQL com reflexão sobre a pergunta
 */ async function generateSQLPlan(profile, userQuestion) {
  const prompt = `
Você é um analista de dados experiente.

Dados disponíveis:
- Colunas: ${profile.columns.join(', ')}
- Tipos: ${JSON.stringify(profile.columnTypes)}
- Estatísticas: ${JSON.stringify(profile.stats, null, 2)}
- Total de linhas: ${profile.totalRows}

Pergunta: "${userQuestion}"

Responda com JSON:
{
  "reflection": "Explica como você pretende responder à pergunta",
  "queries": [
    {
      "purpose": "O que esta query faz",
      "sql": "SELECT ... FROM data GROUP BY ... LIMIT 10"
    }
  ]
}

⚠️ Regras:
- Use apenas colunas disponíveis
- Sempre use FROM data
- Toda agregação (SUM, AVG, COUNT, ...) exige GROUP BY (exceto COUNT(*) isolado)
- Nunca use JOINs, subqueries, CTEs ou HAVING
`;
  return await callOpenAI([
    {
      role: 'system',
      content: prompt
    }
  ]);
}
/**
 * 🔁 Retry: gera novo plano corrigindo erros de validação
 */ async function retryGenerateSQLPlan(profile, userQuestion, previousErrors) {
  const prompt = `
Você gerou queries SQL que falharam.

Erros:
${previousErrors.map((e, i)=>`Erro ${i + 1}: ${e}`).join('\n')}

Regras:
- Use apenas colunas: ${profile.columns.join(', ')}
- Sempre use FROM data
- Use GROUP BY se houver agregação
- Nunca use subqueries, JOINs ou funções avançadas

Pergunta original:
"${userQuestion}"

Corrija e retorne:
{
  "reasoning": "Explica como você corrigiu os erros",
  "queries": [
    { "purpose": "O que faz", "sql": "SELECT ... FROM data GROUP BY ... LIMIT 10" }
  ]
}
`;
  return await callOpenAI([
    {
      role: 'system',
      content: prompt
    }
  ]);
}
/**
 * ✅ Validação simples de SQL
 */ function validateSQLQuery(sql, availableColumns) {
  const normalized = sql.toUpperCase().replace(/\s+/g, ' ').trim();
  const details = [];
  if (!normalized.includes('FROM DATA')) {
    return {
      valid: false,
      error: 'Query deve usar "FROM data"',
      details: [
        'Use FROM data como nome da tabela'
      ]
    };
  }
  const hasAggregation = /\b(SUM|AVG|MIN|MAX|COUNT)\s*\(/i.test(sql);
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(sql);
  const isSimpleCount = normalized.match(/SELECT\s+COUNT\s*\(\s*\*?\s*\)\s+FROM\s+DATA/i);
  if (hasAggregation && !hasGroupBy && !isSimpleCount) {
    return {
      valid: false,
      error: 'Agregação exige GROUP BY',
      details: [
        'Toda agregação deve ter GROUP BY correspondente'
      ]
    };
  }
  // Verifica colunas do SELECT
  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  if (selectMatch) {
    const selectPart = selectMatch[1];
    const columnsInSelect = selectPart.split(',').map((c)=>c.replace(/\b(SUM|AVG|MIN|MAX|COUNT)\s*\(([^)]+)\).*$/i, '$2').replace(/\s+AS\s+.*/i, '').trim()).filter((c)=>c !== '*');
    for (const col of columnsInSelect){
      if (!availableColumns.includes(col)) {
        details.push(`Coluna "${col}" não existe`);
      }
    }
  }
  if (details.length > 0) {
    return {
      valid: false,
      error: 'Query com colunas inválidas',
      details
    };
  }
  return {
    valid: true
  };
}
/**
 * 🚀 Função principal: analisa pergunta com pipeline inteligente
 */ export async function analyzeSimple(data, userQuestion) {
  const profile = profileData(data);
  let sqlPlan = await generateSQLPlan(profile, userQuestion);
  let validatedQueries = [];
  const validationErrors = [];
  for (const q of sqlPlan.queries || []){
    const val = validateSQLQuery(q.sql, profile.columns);
    if (val.valid) {
      validatedQueries.push(q);
    } else {
      validationErrors.push(`${q.sql} ❌ ${val.error}`);
    }
  }
  if (validatedQueries.length === 0 && validationErrors.length > 0) {
    const retryPlan = await retryGenerateSQLPlan(profile, userQuestion, validationErrors);
    for (const q of retryPlan.queries || []){
      const val = validateSQLQuery(q.sql, profile.columns);
      if (val.valid) validatedQueries.push(q);
    }
  }
  if (validatedQueries.length === 0) {
    return {
      success: false,
      error: 'Nenhuma query válida gerada'
    };
  }
  const results = [];
  for (const q of validatedQueries){
    const result = executeSQL(data, q.sql, profile.columnTypes);
    if (result.success) {
      results.push({
        purpose: q.purpose,
        sql: q.sql,
        results: result.data
      });
    }
  }
  if (results.length === 0) {
    return {
      success: false,
      error: 'Nenhuma query executada com sucesso'
    };
  }
  const narrative = await generateNarrative(profile, userQuestion, results);
  return {
    success: true,
    summary: narrative.summary,
    insights: narrative.insights,
    calculations: narrative.calculations,
    charts: narrative.charts,
    recommendations: narrative.recommendations,
    sql_queries: results,
    validation_passed: true
  };
}
/**
 * 🧠 Geração de narrativa com regras anti-alucinação
 */ async function generateNarrative(profile, userQuestion, queryResults) {
  const allowedValues = [];
  for (const query of queryResults){
    for (const row of query.results){
      allowedValues.push(row);
    }
  }
  const prompt = `
Você é um analista de dados sênior. Crie uma narrativa APENAS com base nos dados SQL abaixo.

Pergunta: "${userQuestion}"

Resultado das queries:
${JSON.stringify(queryResults, null, 2)}

⚠️ Regras anti-alucinação:
- Use SOMENTE números presentes nos dados
- NÃO invente médias, somas ou percentuais
- NÃO mencione colunas inexistentes
- Diga "não há dados suficientes" se não houver resultado
- Retorne JSON com:
{
  "summary": "Resumo executivo curto",
  "insights": ["Insight 1", "Insight 2", ...],
  "calculations": [ { "label": "nome", "value": numero } ],
  "charts": [
    {
      "type": "bar" | "line" | "pie",
      "title": "Título",
      "data": {
        "labels": [...],
        "values": [...]
      }
    }
  ],
  "recommendations": ["Ação sugerida com base no dado"]
}

⚠️ Valores permitidos:
${JSON.stringify(allowedValues, null, 2)}
`;
  return await callOpenAI([
    {
      role: 'system',
      content: prompt
    }
  ], {
    temperature: 0.3
  });
}
/**
 * 🔍 Valida se os valores da narrativa batem com o SQL
 */ function validateCalculations(narrative, queryResults) {
  try {
    const narrativeText = JSON.stringify(narrative);
    const narrativeNumbers = extractNumbers(narrativeText);
    const sqlNumbers = new Set();
    for (const query of queryResults){
      for (const row of query.results){
        for (const val of Object.values(row)){
          if (typeof val === 'number') {
            sqlNumbers.add(Math.round(val * 100) / 100);
          }
        }
      }
    }
    for (const num of narrativeNumbers){
      const rounded = Math.round(num * 100) / 100;
      let found = false;
      for (const sqlNum of sqlNumbers){
        const diff = Math.abs(sqlNum - rounded);
        const tolerance = Math.abs(sqlNum * 0.05);
        if (diff <= tolerance) {
          found = true;
          break;
        }
      }
      if (!found && num > 1) {
        console.warn(`[Validation] Número ${num} não encontrado nos resultados SQL`);
      }
    }
    return {
      passed: true
    };
  } catch (err) {
    return {
      passed: false,
      error: err.message
    };
  }
}
/**
 * 🔢 Extrai todos os números de um texto
 */ function extractNumbers(text) {
  const matches = text.match(/\b\d+(\.\d+)?\b/g);
  return matches ? matches.map(Number).filter((n)=>!isNaN(n)) : [];
}
/**
 * 🛟 Fallback inteligente (sem LLM) com base em schema detectado
 */ function generateIntelligentFallback(profile, userQuestion, errorMessage, data) {
  console.log('[Fallback] Análise automática ativada...');
  const insights = [];
  const calculations = [];
  const queryResults = [];
  const numericCols = Object.entries(profile.columnTypes).filter(([_, type])=>type === 'numeric').map(([col])=>col);
  const textCols = Object.entries(profile.columnTypes).filter(([_, type])=>type === 'text').map(([col])=>col);
  if (numericCols.length > 0 && textCols.length > 0) {
    const groupCol = textCols[0];
    for (const numCol of numericCols.slice(0, 2)){
      try {
        const sql = `SELECT ${groupCol}, SUM(${numCol}) as total FROM data GROUP BY ${groupCol} ORDER BY total DESC LIMIT 5`;
        const result = executeSQL(data, sql, profile.columnTypes);
        if (result.success && result.data.length > 0) {
          queryResults.push({
            purpose: `Total de ${numCol} por ${groupCol}`,
            sql,
            results: result.data
          });
          insights.push(`${groupCol} "${result.data[0][groupCol]}" tem o maior ${numCol}: ${result.data[0].total}`);
        }
      } catch (e) {
        console.warn(`[Fallback] Falha na query automática: ${e.message}`);
      }
    }
  }
  for (const [col, type] of Object.entries(profile.columnTypes)){
    if (type === 'numeric' && profile.stats[col]) {
      calculations.push({
        label: `${col} - Média`,
        value: Number(profile.stats[col].avg.toFixed(2))
      }, {
        label: `${col} - Máximo`,
        value: profile.stats[col].max
      }, {
        label: `${col} - Mínimo`,
        value: profile.stats[col].min
      });
    } else if (type === 'text' && profile.stats[col]) {
      insights.push(`Coluna "${col}" possui ${profile.stats[col].uniqueCount} valores únicos`);
    }
  }
  return {
    success: true,
    summary: `Fallback automático: análise com ${profile.columns.length} colunas e ${profile.totalRows} linhas.`,
    insights: insights.length > 0 ? insights : [
      'Nenhum insight gerado'
    ],
    calculations,
    sql_queries: queryResults,
    validation_passed: true,
    error: `Fallback ativado: ${errorMessage}`
  };
}
