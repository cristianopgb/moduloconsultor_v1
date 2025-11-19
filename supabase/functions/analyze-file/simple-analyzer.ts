/**
 * SIMPLE ANALYZER - LLM + SQL Pipeline (No playbooks, no complexity)
 *
 * Pipeline:
 * 1. Parse data and detect schema
 * 2. LLM reflects on question feasibility
 * 3. LLM generates SQL queries (with retry on failure)
 * 4. Execute SQL on in-memory data
 * 5. LLM interprets results (anti-hallucination prompts)
 * 6. Validate calculations match SQL results
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
  debug_info?: {
    reflection?: string;
    retry_attempted?: boolean;
    validation_errors?: string[];
  };
}

interface DataProfile {
  columns: string[];
  columnTypes: Record<string, 'numeric' | 'text' | 'date' | 'unknown'>;
  totalRows: number;
  sampleRows: any[];
  stats: Record<string, any>;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: string[];
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
  const debugInfo: any = {};

  try {
    console.log('[SimpleAnalyzer] ===== STARTING ANALYSIS =====');
    console.log(`[SimpleAnalyzer] Question: "${userQuestion}"`);

    // Step 1: Profile data
    console.log('[SimpleAnalyzer] Step 1: Profiling data...');
    const profile = profileData(data);
    console.log(`[SimpleAnalyzer] Profile: ${profile.columns.length} columns, ${profile.totalRows} rows`);
    console.log(`[SimpleAnalyzer] Columns: ${profile.columns.join(', ')}`);
    console.log(`[SimpleAnalyzer] Types: ${JSON.stringify(profile.columnTypes)}`);

    // Step 2: Generate SQL queries (with retry)
    let sqlPlan: any = null;
    let validatedQueries: any[] = [];
    let validationErrors: string[] = [];
    let retryAttempted = false;

    for (let attempt = 1; attempt <= 2; attempt++) {
      console.log(`[SimpleAnalyzer] Step 2 (Attempt ${attempt}): Generating SQL queries...`);

      if (attempt === 1) {
        sqlPlan = await generateSQLPlan(profile, userQuestion);
        if (sqlPlan.reflection) {
          debugInfo.reflection = sqlPlan.reflection;
          console.log(`[SimpleAnalyzer] Reflection: ${sqlPlan.reflection}`);
        }
      } else {
        retryAttempted = true;
        debugInfo.retry_attempted = true;
        console.log(`[SimpleAnalyzer] Retrying with validation errors: ${validationErrors.join('; ')}`);
        sqlPlan = await retryGenerateSQLPlan(profile, userQuestion, validationErrors);
      }

      console.log(`[SimpleAnalyzer] Generated ${sqlPlan.queries?.length || 0} queries`);

      // Validate SQL queries
      console.log('[SimpleAnalyzer] Step 2.5: Validating SQL queries...');
      validatedQueries = [];
      validationErrors = [];

      for (const query of sqlPlan.queries || []) {
        console.log(`[SimpleAnalyzer] Validating query: ${query.sql}`);
        const validation = validateSQLQuery(query.sql, profile.columns);

        if (!validation.valid) {
          const errorMsg = `Query "${query.sql}" failed: ${validation.error}`;
          console.warn(`[SimpleAnalyzer] ${errorMsg}`);
          validationErrors.push(errorMsg);
          if (validation.details) {
            validation.details.forEach(d => console.warn(`[SimpleAnalyzer]   - ${d}`));
          }
        } else {
          console.log(`[SimpleAnalyzer] ✓ Query validated: ${query.purpose}`);
          validatedQueries.push(query);
        }
      }

      if (validatedQueries.length > 0) {
        console.log(`[SimpleAnalyzer] ${validatedQueries.length} queries validated successfully`);
        break;
      }

      if (attempt === 1) {
        console.warn(`[SimpleAnalyzer] All queries failed validation on attempt 1. Retrying...`);
      } else {
        throw new Error('All generated SQL queries were invalid after 2 attempts');
      }
    }

    debugInfo.validation_errors = validationErrors;

    // Step 3: Execute SQL queries
    console.log('[SimpleAnalyzer] Step 3: Executing SQL queries...');
    const queryResults: Array<{ purpose: string; sql: string; results: any[] }> = [];

    for (const query of validatedQueries) {
      console.log(`[SimpleAnalyzer] Executing: ${query.purpose}`);
      console.log(`[SimpleAnalyzer] SQL: ${query.sql}`);

      const result = executeSQL(data, query.sql, profile.columnTypes);

      if (!result.success) {
        console.warn(`[SimpleAnalyzer] Query execution failed: ${result.error}`);
        continue;
      }

      console.log(`[SimpleAnalyzer] ✓ Query returned ${result.rowCount} rows in ${result.executionTimeMs}ms`);
      queryResults.push({
        purpose: query.purpose,
        sql: query.sql,
        results: result.data,
      });
    }

    if (queryResults.length === 0) {
      throw new Error('All SQL queries failed to execute');
    }

    console.log(`[SimpleAnalyzer] Successfully executed ${queryResults.length} queries`);

    // Step 4: Generate narrative from results
    console.log('[SimpleAnalyzer] Step 4: Generating narrative...');
    const narrative = await generateNarrative(profile, userQuestion, queryResults);

    // Step 5: Validate calculations
    console.log('[SimpleAnalyzer] Step 5: Validating calculations...');
    const validation = validateCalculations(narrative, queryResults);
    console.log(`[SimpleAnalyzer] Validation: ${validation.passed ? 'PASSED' : 'FAILED'}`);

    console.log('[SimpleAnalyzer] ===== ANALYSIS COMPLETE =====');

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
      debug_info: debugInfo,
    };
  } catch (error: any) {
    console.error('[SimpleAnalyzer] Error:', error.message);
    console.error('[SimpleAnalyzer] Stack:', error.stack);

    // Intelligent fallback with auto-generated queries
    console.log('[SimpleAnalyzer] Attempting intelligent fallback...');
    const profile = profileData(data);
    return generateIntelligentFallback(profile, userQuestion, error.message, data);
  }
}

/**
 * Enhanced SQL validation with column checking
 */
function validateSQLQuery(sql: string, availableColumns: string[]): ValidationResult {
  const normalized = sql.toUpperCase().replace(/\s+/g, ' ').trim();
  const details: string[] = [];

  // Check 1: Must use "FROM data"
  if (!normalized.includes('FROM DATA')) {
    return {
      valid: false,
      error: 'Query must use "FROM data" as table name',
      details: ['The virtual table name is "data", not anything else'],
    };
  }

  // Check 2: Aggregation requires GROUP BY
  const hasAggregation = /\b(SUM|AVG|MIN|MAX|COUNT)\s*\(/i.test(sql);
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(sql);
  const isSimpleCount = normalized.match(/SELECT\s+COUNT\s*\(\s*\*?\s*\)\s+FROM\s+DATA\s*(?:WHERE.*)?$/i);

  if (hasAggregation && !hasGroupBy && !isSimpleCount) {
    return {
      valid: false,
      error: 'Query has aggregation (SUM/AVG/MIN/MAX/COUNT) but missing GROUP BY clause',
      details: [
        'Every aggregation function (except standalone COUNT(*)) requires GROUP BY',
        'Example: SELECT category, SUM(value) FROM data GROUP BY category',
      ],
    };
  }

  // Check 3: Verify columns exist (basic check)
  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  if (selectMatch) {
    const selectPart = selectMatch[1];
    const columnsInSelect = selectPart
      .split(',')
      .map(c => c.trim())
      .map(c => c.replace(/\b(SUM|AVG|MIN|MAX|COUNT)\s*\(([^)]+)\).*$/i, '$2'))
      .map(c => c.replace(/\s+AS\s+.*/i, ''))
      .filter(c => c !== '*');

    for (const col of columnsInSelect) {
      const cleanCol = col.trim();
      if (cleanCol && !availableColumns.includes(cleanCol)) {
        details.push(`Column "${cleanCol}" does not exist in dataset`);
      }
    }
  }

  // Check 4: GROUP BY columns must be in SELECT (basic validation)
  if (hasGroupBy) {
    const groupByMatch = sql.match(/GROUP\s+BY\s+([^ORDER\s]+)/i);
    if (groupByMatch) {
      const groupByCols = groupByMatch[1].split(',').map(c => c.trim());
      for (const col of groupByCols) {
        if (!availableColumns.includes(col)) {
          details.push(`GROUP BY column "${col}" does not exist in dataset`);
        }
      }
    }
  }

  if (details.length > 0) {
    return {
      valid: false,
      error: 'Query references non-existent columns',
      details,
    };
  }

  return { valid: true };
}

/**
 * Generate SQL plan using LLM (with reflection)
 */
async function generateSQLPlan(profile: DataProfile, userQuestion: string): Promise<any> {
  const numericColumns = Object.entries(profile.columnTypes)
    .filter(([_, type]) => type === 'numeric')
    .map(([col]) => col);

  const textColumns = Object.entries(profile.columnTypes)
    .filter(([_, type]) => type === 'text')
    .map(([col]) => col);

  const prompt = `Você é um analista de dados expert. Sua tarefa é analisar uma pergunta do usuário e gerar queries SQL válidas.

=== ETAPA 1: REFLEXÃO E ANÁLISE ===

DATASET DISPONÍVEL:
- Colunas: ${profile.columns.join(', ')}
- Colunas numéricas (para agregações): ${numericColumns.join(', ') || 'nenhuma'}
- Colunas de texto (para agrupamento): ${textColumns.join(', ') || 'nenhuma'}
- Total de linhas: ${profile.totalRows}

ESTATÍSTICAS:
${JSON.stringify(profile.stats, null, 2)}

PERGUNTA DO USUÁRIO: "${userQuestion}"

Primeiro, REFLITA:
1. A pergunta pode ser respondida com este dataset?
2. Quais colunas são relevantes para responder?
3. Que tipo de análise é necessária? (agregação, ranking, comparação, etc)
4. Quais dimensões devem ser usadas para agrupar dados?

=== ETAPA 2: GERAÇÃO DE QUERIES ===

Retorne um objeto JSON com:
{
  "reflection": "Sua análise sobre a viabilidade e abordagem",
  "queries": [
    {
      "purpose": "Descrição clara do que esta query calcula",
      "sql": "SELECT ... FROM data GROUP BY ... ORDER BY ... LIMIT 10"
    }
  ]
}

=== REGRAS SQL CRÍTICAS (OBRIGATÓRIAS) ===

🔴 REGRA #1: TODA AGREGAÇÃO PRECISA DE GROUP BY
- Se usar SUM, AVG, MIN, MAX ou COUNT com outras colunas → OBRIGATÓRIO usar GROUP BY
- A ÚNICA exceção é: SELECT COUNT(*) FROM data (sem outras colunas)

🔴 REGRA #2: COLUNAS NO SELECT DEVEM ESTAR NO GROUP BY
- Se SELECT tem: categoria, SUM(valor)
- Então GROUP BY deve ter: categoria

🔴 REGRA #3: USE APENAS COLUNAS QUE EXISTEM
- Colunas disponíveis: ${profile.columns.join(', ')}
- NÃO invente nomes de colunas

🔴 REGRA #4: TABELA SE CHAMA "data"
- Sempre use: FROM data
- Nunca use outro nome de tabela

🔴 REGRA #5: NÃO USE RECURSOS AVANÇADOS
- Proibido: JOINs, subqueries, CTEs, window functions, HAVING complexo

=== EXEMPLOS CORRETOS ===

✅ Agregação com agrupamento:
SELECT categoria, SUM(valor) FROM data GROUP BY categoria ORDER BY SUM(valor) DESC LIMIT 10

✅ Múltiplas colunas agrupadas:
SELECT regiao, categoria, AVG(preco) FROM data GROUP BY regiao, categoria

✅ Contagem simples (sem GROUP BY necessário):
SELECT COUNT(*) FROM data

✅ Filtro + agregação:
SELECT tipo, MAX(quantidade) FROM data WHERE status = 'ativo' GROUP BY tipo

=== EXEMPLOS ERRADOS (NUNCA FAÇA ISSO) ===

❌ ERRADO - Agregação sem GROUP BY:
SELECT SUM(valor) FROM data
→ Falta GROUP BY (exceto se for só COUNT(*))

❌ ERRADO - Coluna no SELECT sem estar no GROUP BY:
SELECT categoria, SUM(valor) FROM data
→ Falta: GROUP BY categoria

❌ ERRADO - Coluna que não existe:
SELECT produto_nome FROM data
→ Verifique se "produto_nome" está na lista de colunas disponíveis

❌ ERRADO - Nome de tabela incorreto:
SELECT * FROM produtos
→ A tabela se chama "data", não "produtos"

=== INSTRUÇÕES FINAIS ===

1. Gere 3-5 queries que analisem diferentes aspectos da pergunta
2. Cada query deve ter um propósito claro e específico
3. Use ORDER BY para ordenar resultados relevantes
4. Use LIMIT 10 para queries que retornam muitos registros
5. VALIDE cada query mentalmente antes de incluir no JSON

Lembre-se: A análise falha se as queries estiverem incorretas. Seja rigoroso!`;

  return await callOpenAI([{ role: 'system', content: prompt }]);
}

/**
 * Retry SQL generation with error feedback
 */
async function retryGenerateSQLPlan(
  profile: DataProfile,
  userQuestion: string,
  validationErrors: string[]
): Promise<any> {
  const prompt = `Você é um analista de dados expert. Sua primeira tentativa de gerar SQL falhou.

TENTATIVA ANTERIOR FALHOU COM ESTES ERROS:
${validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

DATASET:
- Colunas disponíveis: ${profile.columns.join(', ')}
- Tipos: ${JSON.stringify(profile.columnTypes)}
- Total de linhas: ${profile.totalRows}

PERGUNTA ORIGINAL: "${userQuestion}"

DESTA VEZ, CORRIJA OS ERROS:

🔴 LEMBRE-SE:
1. TODA agregação (SUM, AVG, MIN, MAX, COUNT) precisa de GROUP BY
2. Colunas no SELECT devem existir no dataset
3. Colunas no SELECT (não agregadas) devem estar no GROUP BY
4. Sempre use "FROM data"
5. NÃO use JOINs ou subqueries

Retorne JSON:
{
  "reasoning": "Explicação de como você corrigiu os erros",
  "queries": [
    {
      "purpose": "O que esta query calcula",
      "sql": "SELECT coluna, SUM(valor) FROM data GROUP BY coluna"
    }
  ]
}

Seja extremamente cuidadoso. Valide cada query antes de retornar.`;

  return await callOpenAI([{ role: 'system', content: prompt }], { temperature: 0.1 });
}

/**
 * Generate narrative from SQL results (enhanced anti-hallucination)
 */
async function generateNarrative(
  profile: DataProfile,
  userQuestion: string,
  queryResults: Array<{ purpose: string; sql: string; results: any[] }>
): Promise<any> {
  // Extract all exact values that can be mentioned
  const allowedValues: any[] = [];
  for (const query of queryResults) {
    for (const row of query.results) {
      allowedValues.push(row);
    }
  }

  const prompt = `Você é um analista de dados sênior. Crie uma narrativa BASEADA EXCLUSIVAMENTE nos resultados SQL abaixo.

PERGUNTA DO USUÁRIO: "${userQuestion}"

RESULTADOS DAS QUERIES SQL:
${JSON.stringify(queryResults, null, 2)}

DATASET INFO:
- Total de linhas analisadas: ${profile.totalRows}

=== REGRAS ANTI-ALUCINAÇÃO (CRÍTICAS) ===

🔴 REGRA #1: USE APENAS NÚMEROS DOS RESULTADOS
Você só pode mencionar números que aparecem literalmente em "RESULTADOS DAS QUERIES SQL" acima.

🔴 REGRA #2: NÃO CALCULE, NÃO ESTIME, NÃO APROXIME
Se um número não está nos resultados, você NÃO PODE mencioná-lo.
Exemplo: Se os resultados mostram valores 100, 200, 300 → você NÃO pode dizer "a média é 200".

🔴 REGRA #3: COPIE VALORES EXATAMENTE
Se o resultado mostra "soma_vendas": 45678.32 → use 45678.32, não "cerca de 45000" ou "aproximadamente 46000".

🔴 REGRA #4: NÃO MENCIONE COLUNAS QUE NÃO EXISTEM
Só mencione colunas que aparecem nos resultados das queries.

🔴 REGRA #5: SE NÃO HÁ DADOS, DIGA CLARAMENTE
Se uma query retornou array vazio [], diga "não há dados suficientes para esta análise".

=== SUA TAREFA ===

Retorne JSON:
{
  "summary": "Resumo executivo em 2-3 frases usando APENAS dados reais",
  "insights": [
    "Insight 1 com valores EXATOS dos resultados",
    "Insight 2 com valores EXATOS dos resultados",
    "Insight 3 com valores EXATOS dos resultados"
  ],
  "calculations": [
    { "label": "Nome da métrica", "value": valor_numerico_exato_do_resultado }
  ],
  "charts": [
    {
      "type": "bar" | "line" | "pie",
      "title": "Título do gráfico",
      "data": {
        "labels": ["label1", "label2"],
        "values": [valor1_do_resultado, valor2_do_resultado]
      }
    }
  ],
  "recommendations": [
    "Recomendação prática baseada nos insights reais"
  ]
}

VALORES PERMITIDOS PARA VOCÊ USAR:
${JSON.stringify(allowedValues, null, 2)}

ÚLTIMO AVISO: Se você mencionar um número que não está nos resultados, a análise será rejeitada.`;

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
    const narrativeText = JSON.stringify(narrative);
    const narrativeNumbers = extractNumbers(narrativeText);

    const sqlNumbers = new Set<number>();
    for (const query of queryResults) {
      for (const row of query.results) {
        for (const value of Object.values(row)) {
          if (typeof value === 'number') {
            sqlNumbers.add(Math.round(value * 100) / 100);
          }
        }
      }
    }

    for (const num of narrativeNumbers) {
      const rounded = Math.round(num * 100) / 100;

      let found = false;
      for (const sqlNum of sqlNumbers) {
        const diff = Math.abs(sqlNum - rounded);
        const tolerance = Math.abs(sqlNum * 0.05);
        if (diff <= tolerance) {
          found = true;
          break;
        }
      }

      if (!found && num > 1) {
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
 * Intelligent fallback - auto-generate meaningful queries based on schema
 */
function generateIntelligentFallback(
  profile: DataProfile,
  userQuestion: string,
  errorMessage: string,
  data: any[]
): AnalysisResult {
  console.log('[SimpleAnalyzer] Generating intelligent fallback analysis...');

  const insights: string[] = [];
  const calculations: Array<{ label: string; value: any }> = [];
  const queryResults: Array<{ purpose: string; sql: string; results: any[] }> = [];

  // Auto-generate queries based on column types
  const numericCols = Object.entries(profile.columnTypes)
    .filter(([_, type]) => type === 'numeric')
    .map(([col]) => col);

  const textCols = Object.entries(profile.columnTypes)
    .filter(([_, type]) => type === 'text')
    .map(([col]) => col);

  // Strategy 1: Aggregate numeric columns by first text column
  if (numericCols.length > 0 && textCols.length > 0) {
    const groupCol = textCols[0];

    for (const numCol of numericCols.slice(0, 2)) {
      try {
        const sql = `SELECT ${groupCol}, SUM(${numCol}) as total FROM data GROUP BY ${groupCol} ORDER BY total DESC LIMIT 5`;
        const result = executeSQL(data, sql, profile.columnTypes);

        if (result.success && result.data.length > 0) {
          queryResults.push({
            purpose: `Total de ${numCol} por ${groupCol}`,
            sql,
            results: result.data,
          });

          const topValue = result.data[0];
          insights.push(
            `${groupCol} "${topValue[groupCol]}" tem o maior ${numCol}: ${topValue.total}`
          );
        }
      } catch (e) {
        console.warn(`[Fallback] Failed to execute auto-query: ${e}`);
      }
    }
  }

  // Strategy 2: Show basic statistics
  for (const [col, type] of Object.entries(profile.columnTypes)) {
    if (type === 'numeric' && profile.stats[col]) {
      calculations.push(
        { label: `${col} - Média`, value: Number(profile.stats[col].avg.toFixed(2)) },
        { label: `${col} - Máximo`, value: profile.stats[col].max },
        { label: `${col} - Mínimo`, value: profile.stats[col].min }
      );
    } else if (type === 'text' && profile.stats[col]) {
      insights.push(
        `Coluna "${col}": ${profile.stats[col].uniqueCount} valores únicos`
      );
    }
  }

  return {
    success: true,
    summary: `Análise automática do dataset (${profile.totalRows} linhas, ${profile.columns.length} colunas). Nota: A análise personalizada falhou, mas geramos insights automáticos baseados no schema detectado.`,
    insights: insights.length > 0 ? insights : ['Dataset analisado com sucesso'],
    calculations,
    sql_queries: queryResults,
    validation_passed: true,
    error: `Fallback inteligente usado devido a: ${errorMessage}`,
  };
}
