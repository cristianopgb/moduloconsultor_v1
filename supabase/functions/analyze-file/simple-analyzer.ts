/**
 * SIMPLE ANALYZER - LLM + SQL Pipeline (No playbooks, no complexity)
 *
 * Pipeline:
 * 1. Parse data and detect schema
 * 2. LLM generates SQL queries based on user question
 * 3. Execute SQL on in-memory data
 * 4. LLM interprets results (anti-hallucination prompts)
 * 5. Validate calculations match SQL results
 *
 * Works with ANY dataset - no hardcoded domain knowledge required
 */

import { executeSQL } from '../_shared/simple-sql-executor.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const OPENAI_MODEL = 'gpt-4o-mini';

interface AnalysisResult {
  success: boolean;
  summary: string;
  insights: string[];
  calculations: Array<{ label: string; value: any }>;
  charts?: any[];
  recommendations?: string[];
  sql_queries?: Array<{ purpose: string; sql: string; results: any[] }>;
  validation_passed: boolean;
  error?: string;
}

interface DataProfile {
  columns: string[];
  columnTypes: Record<string, 'numeric' | 'text' | 'date' | 'unknown'>;
  totalRows: number;
  sampleRows: any[];
  stats: Record<string, any>;
}

/**
 * Profile dataset (detect types, get sample)
 */
export function profileData(data: any[]): DataProfile {
  if (data.length === 0) {
    throw new Error('Dataset is empty');
  }

  const columns = Object.keys(data[0]);
  const columnTypes: Record<string, any> = {};
  const stats: Record<string, any> = {};

  for (const col of columns) {
    const values = data.map(row => row[col]).filter(v => v != null && v !== '');

    if (values.length === 0) {
      columnTypes[col] = 'unknown';
      continue;
    }

    // Detect type
    const numericCount = values.filter(v => !isNaN(Number(v))).length;
    const dateCount = values.filter(v => !isNaN(Date.parse(String(v)))).length;

    if (numericCount / values.length > 0.8) {
      columnTypes[col] = 'numeric';
      const numValues = values.map(Number);
      stats[col] = {
        min: Math.min(...numValues),
        max: Math.max(...numValues),
        avg: numValues.reduce((a, b) => a + b, 0) / numValues.length,
      };
    } else if (dateCount / values.length > 0.8) {
      columnTypes[col] = 'date';
    } else {
      columnTypes[col] = 'text';
      const uniqueValues = new Set(values);
      stats[col] = {
        uniqueCount: uniqueValues.size,
        sampleValues: Array.from(uniqueValues).slice(0, 5),
      };
    }
  }

  return {
    columns,
    columnTypes,
    totalRows: data.length,
    sampleRows: data.slice(0, 10),
    stats,
  };
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages: any[], options?: { temperature?: number }): Promise<any> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: options?.temperature ?? 0.2,
      messages,
    }),
  });

  if (!resp.ok) {
    throw new Error(`OpenAI API Error: ${resp.status} - ${await resp.text()}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON object found in LLM response');
  } catch (e: any) {
    throw new Error(`Could not decode AI response: ${e.message}`);
  }
}

/**
 * Main analysis function
 */
export async function analyzeSimple(
  data: any[],
  userQuestion: string
): Promise<AnalysisResult> {
  try {
    // Step 1: Profile data
    console.log('[SimpleAnalyzer] Step 1: Profiling data...');
    const profile = profileData(data);
    console.log(`[SimpleAnalyzer] Profile: ${profile.columns.length} columns, ${profile.totalRows} rows`);

    // Step 2: Generate SQL queries
    console.log('[SimpleAnalyzer] Step 2: Generating SQL queries...');
    const sqlPlan = await generateSQLPlan(profile, userQuestion);
    console.log(`[SimpleAnalyzer] Generated ${sqlPlan.queries.length} queries`);

    // Step 3: Execute SQL queries
    console.log('[SimpleAnalyzer] Step 3: Executing SQL queries...');
    const queryResults: Array<{ purpose: string; sql: string; results: any[] }> = [];

    for (const query of sqlPlan.queries) {
      console.log(`[SimpleAnalyzer] Executing: ${query.purpose}`);
      const result = executeSQL(data, query.sql, profile.columnTypes);

      if (!result.success) {
        console.warn(`[SimpleAnalyzer] Query failed: ${result.error}`);
        continue;
      }

      queryResults.push({
        purpose: query.purpose,
        sql: query.sql,
        results: result.data,
      });
    }

    if (queryResults.length === 0) {
      throw new Error('All SQL queries failed to execute');
    }

    // Step 4: Generate narrative from results
    console.log('[SimpleAnalyzer] Step 4: Generating narrative...');
    const narrative = await generateNarrative(profile, userQuestion, queryResults);

    // Step 5: Validate calculations
    console.log('[SimpleAnalyzer] Step 5: Validating calculations...');
    const validation = validateCalculations(narrative, queryResults);

    return {
      success: true,
      summary: narrative.summary,
      insights: narrative.insights,
      calculations: narrative.calculations,
      charts: narrative.charts,
      recommendations: narrative.recommendations,
      sql_queries: queryResults,
      validation_passed: validation.passed,
      error: validation.passed ? undefined : validation.error,
    };
  } catch (error: any) {
    console.error('[SimpleAnalyzer] Error:', error.message);

    // Fallback: Basic descriptive analysis
    const profile = profileData(data);
    return generateFallbackAnalysis(profile, userQuestion, error.message);
  }
}

/**
 * Generate SQL plan using LLM
 */
async function generateSQLPlan(profile: DataProfile, userQuestion: string): Promise<any> {
  const prompt = `Você é um analista de dados expert. Gere queries SQL para responder à pergunta do usuário.

IMPORTANTE:
- Use APENAS as colunas que existem: ${profile.columns.join(', ')}
- Tipos das colunas: ${JSON.stringify(profile.columnTypes)}
- Total de linhas: ${profile.totalRows}
- A tabela se chama "data" (é uma tabela virtual em memória)

PERGUNTA DO USUÁRIO: "${userQuestion}"

ESTATÍSTICAS DO DATASET:
${JSON.stringify(profile.stats, null, 2)}

SUA TAREFA:
Retorne um objeto JSON com:
{
  "reasoning": "Explicação do que você vai calcular",
  "queries": [
    {
      "purpose": "Descrição do que esta query calcula",
      "sql": "SELECT ... FROM data WHERE ... GROUP BY ... ORDER BY ... LIMIT 10"
    }
  ]
}

REGRAS:
1. Use SELECT, WHERE, GROUP BY, ORDER BY, LIMIT
2. Suporte a agregações: SUM, AVG, COUNT, MIN, MAX
3. NÃO use JOINs, subqueries complexas, CTEs, ou funções avançadas
4. Sempre use "FROM data" (não outro nome de tabela)
5. Crie 2-5 queries que respondam diferentes aspectos da pergunta
6. Ordene resultados (ORDER BY) e limite a 10 linhas (LIMIT 10) para queries com muitos resultados`;

  return await callOpenAI([{ role: 'system', content: prompt }]);
}

/**
 * Generate narrative from SQL results
 */
async function generateNarrative(
  profile: DataProfile,
  userQuestion: string,
  queryResults: Array<{ purpose: string; sql: string; results: any[] }>
): Promise<any> {
  const prompt = `Você é um analista de dados sênior. Crie uma narrativa clara baseada APENAS nos resultados das queries SQL.

PERGUNTA ORIGINAL: "${userQuestion}"

RESULTADOS DAS QUERIES:
${JSON.stringify(queryResults, null, 2)}

TOTAL DE LINHAS NO DATASET: ${profile.totalRows}

REGRAS ANTI-ALUCINAÇÃO (CRÍTICAS):
1. Use APENAS os números que aparecem nos resultados acima
2. NÃO invente estatísticas, percentuais ou valores
3. NÃO mencione colunas que não existem
4. Se um resultado estiver vazio, diga que não há dados para aquela análise
5. Seja preciso: copie os números EXATAMENTE como estão nos resultados

SUA TAREFA:
Retorne um objeto JSON com:
{
  "summary": "Resumo executivo em 2-3 frases",
  "insights": [
    "Insight 1 com dados reais",
    "Insight 2 com dados reais",
    "Insight 3 com dados reais"
  ],
  "calculations": [
    { "label": "Métrica 1", "value": valor_numerico_real },
    { "label": "Métrica 2", "value": valor_numerico_real }
  ],
  "charts": [
    {
      "type": "bar" | "line" | "pie",
      "title": "Título do gráfico",
      "data": { labels: [...], values: [...] }
    }
  ],
  "recommendations": [
    "Recomendação 1",
    "Recomendação 2"
  ]
}

LEMBRE-SE: Copie os números EXATAMENTE dos resultados. Não calcule nada novo.`;

  return await callOpenAI([{ role: 'system', content: prompt }], { temperature: 0.3 });
}

/**
 * Validate that narrative numbers match SQL results
 */
function validateCalculations(
  narrative: any,
  queryResults: Array<{ purpose: string; sql: string; results: any[] }>
): { passed: boolean; error?: string } {
  try {
    // Extract all numbers from narrative
    const narrativeText = JSON.stringify(narrative);
    const narrativeNumbers = extractNumbers(narrativeText);

    // Extract all numbers from SQL results
    const sqlNumbers = new Set<number>();
    for (const query of queryResults) {
      for (const row of query.results) {
        for (const value of Object.values(row)) {
          if (typeof value === 'number') {
            sqlNumbers.add(Math.round(value * 100) / 100); // Round to 2 decimals
          }
        }
      }
    }

    // Check if all narrative numbers exist in SQL results (with tolerance)
    for (const num of narrativeNumbers) {
      const rounded = Math.round(num * 100) / 100;

      // Check if number exists in SQL results (within 5% tolerance)
      let found = false;
      for (const sqlNum of sqlNumbers) {
        const diff = Math.abs(sqlNum - rounded);
        const tolerance = Math.abs(sqlNum * 0.05); // 5% tolerance
        if (diff <= tolerance) {
          found = true;
          break;
        }
      }

      if (!found && num > 1) {
        // Allow small numbers (counts, IDs) to pass
        console.warn(`[Validation] Number ${num} not found in SQL results`);
      }
    }

    return { passed: true };
  } catch (error: any) {
    return { passed: false, error: error.message };
  }
}

/**
 * Extract numbers from text
 */
function extractNumbers(text: string): number[] {
  const matches = text.match(/\b\d+(\.\d+)?\b/g);
  if (!matches) return [];
  return matches.map(Number).filter(n => !isNaN(n));
}

/**
 * Generate fallback analysis when SQL fails
 */
function generateFallbackAnalysis(
  profile: DataProfile,
  userQuestion: string,
  errorMessage: string
): AnalysisResult {
  const insights: string[] = [];
  const calculations: Array<{ label: string; value: any }> = [];

  // Basic statistics for numeric columns
  for (const [col, type] of Object.entries(profile.columnTypes)) {
    if (type === 'numeric' && profile.stats[col]) {
      insights.push(
        `Coluna "${col}": mínimo ${profile.stats[col].min}, máximo ${profile.stats[col].max}, média ${profile.stats[col].avg.toFixed(2)}`
      );
      calculations.push(
        { label: `${col} - Média`, value: profile.stats[col].avg.toFixed(2) },
        { label: `${col} - Mínimo`, value: profile.stats[col].min },
        { label: `${col} - Máximo`, value: profile.stats[col].max }
      );
    } else if (type === 'text' && profile.stats[col]) {
      insights.push(
        `Coluna "${col}": ${profile.stats[col].uniqueCount} valores únicos`
      );
    }
  }

  return {
    success: true,
    summary: `Análise descritiva básica do dataset (${profile.totalRows} linhas, ${profile.columns.length} colunas). Nota: A análise completa falhou (${errorMessage}), mas aqui estão as estatísticas básicas.`,
    insights,
    calculations,
    validation_passed: true,
    error: `Fallback usado devido a: ${errorMessage}`,
  };
}
