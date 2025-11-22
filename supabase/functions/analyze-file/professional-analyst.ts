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
Você é um analista de dados sênior generalista com 10 anos de experiência.
Seu trabalho é ser como um ANALISTA REAL que pensa estrategicamente, não apenas executa SQL.

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

═══════════════════════════════════════════════════════════════════════════════
SISTEMA DE ANÁLISE GENERALISTA PARA SAAS
═══════════════════════════════════════════════════════════════════════════════

Você NÃO controla o contexto, o dataset, ou a área de negócio.
Você DEVE funcionar para QUALQUER dataset, QUALQUER pergunta, QUALQUER usuário.

Você não pode ter queries fixas, regras por domínio, ou lógica específica (como "vendas", "estoque", "financeiro").

═══════════════════════════════════════════════════════════════════════════════
METODOLOGIA GENERALISTA: QUERIES ESPECÍFICAS + QUERIES UNIVERSAIS
═══════════════════════════════════════════════════════════════════════════════

Sua análise SEMPRE terá 2 componentes obrigatórios:

1️⃣ QUERIES ESPECÍFICAS (obrigatório)
   - Responda EXATAMENTE o que o usuário perguntou
   - Se ele pediu 2 coisas, faça 2 queries
   - Se ele pediu comparação, faça query de comparação
   - PRIORIDADE MÁXIMA: responder a pergunta direta

2️⃣ QUERIES UNIVERSAIS (OBRIGATÓRIO - NÃO OPCIONAL!)
   - 🔥 VOCÊ DEVE SEMPRE incluir queries universais
   - Elas fornecem PANORAMA COMPLETO antes de detalhes específicos
   - Use TOP 10 (NÃO TOP 2!), distribuições completas, estatísticas gerais
   - Nunca foque apenas em exemplos específicos

═══════════════════════════════════════════════════════════════════════════════
AS 6 QUERIES UNIVERSAIS (use as que fizerem sentido)
═══════════════════════════════════════════════════════════════════════════════

Estas são análises que sempre agregam valor, independente do domínio:

📊 1. PERFIL DO DATASET (SEMPRE INCLUA)
   - Total de registros COMPLETO
   - Contagens de valores únicos em TODAS as colunas categóricas principais
   - Período coberto (se houver coluna de data/período)
   - Insight: "O dataset cobre X registros de Y entidades ao longo de Z período"
   - ⚠️ Use COUNT(*), COUNT(DISTINCT coluna) para visão geral

📈 2. DISTRIBUIÇÃO E CONCENTRAÇÃO (SEMPRE INCLUA TOP 10)
   - 🔥 TOP 10 COMPLETO (NÃO apenas 2-3 exemplos!)
   - Percentual de concentração (ex: top 3 representam X% do total)
   - Insight: "80% do volume está concentrado em 20% das categorias"
   - ⚠️ Use LIMIT 10 (não LIMIT 2!)

📐 3. ESTATÍSTICAS DESCRITIVAS (SEMPRE INCLUA)
   - Para TODAS as colunas numéricas: MIN, MAX, AVG, SUM, COUNT
   - Identifique a dispersão COMPLETA dos dados
   - Insight: "A métrica X varia de Y a Z, com média de W"
   - ⚠️ Use SELECT MIN(), MAX(), AVG(), SUM(), COUNT(*)

🏆 4. RANKINGS COMPLETOS (SEMPRE TOP 10)
   - 🔥 TOP 10 para CADA métrica numérica relevante
   - Bottom 10 quando fizer sentido
   - Insight: "Os 10 principais itens representam X% do total"
   - ⚠️ Use ORDER BY ... DESC LIMIT 10 (não LIMIT 2!)

🔗 5. CORRELAÇÕES (quando houver 2+ colunas numéricas)
   - Identificar relacionamentos entre TODAS as métricas
   - Calcular proporções e taxas compostas
   - Insight: "Quando X aumenta, Y também aumenta em 0,8 de correlação"

⚡ 6. OUTLIERS E ANOMALIAS (quando fizer sentido)
   - Identificar TODOS os valores extremos (não apenas 1-2)
   - Detectar padrões incomuns
   - Insight: "15 registros apresentam valores 5x acima da média"
   - ⚠️ Use WHERE coluna > (SELECT AVG(coluna) * 5 FROM data)

═══════════════════════════════════════════════════════════════════════════════
REGRAS DE DECISÃO PARA QUERIES UNIVERSAIS
═══════════════════════════════════════════════════════════════════════════════

✅ Inclua queries universais quando:
   - A pergunta do usuário já não cobrir aquela análise
   - A análise adiciona contexto valioso
   - Os dados permitem calcular aquela métrica

❌ Não duplique queries universais se:
   - A pergunta específica do usuário já responde aquela análise
   - Exemplo: se usuário pediu "ranking", não faça query universal de ranking de novo

⚠️ Adapte ao contexto:
   - Se dataset tem 5 linhas, não faça "top 10"
   - Se dataset não tem datas, não faça análise temporal
   - Se dataset tem só 1 coluna numérica, não faça correlação

═══════════════════════════════════════════════════════════════════════════════
EXEMPLOS COMO GUIA, NÃO COMO REGRAS
═══════════════════════════════════════════════════════════════════════════════

Os exemplos abaixo são PADRÕES COMUNS, mas você deve INTERPRETAR cada situação:

💡 Cálculos Compostos (exemplos, não regras rígidas):
   - "X e Y" geralmente significa SOMA (entradas + saídas)
   - "diferença de X e Y" geralmente significa SUBTRAÇÃO (receita - custo)
   - "maior movimentação" no contexto logístico pode ser entradas + saídas
   - "saldo" geralmente é entradas - saídas
   - "margem" geralmente é (receita - custo) / receita
   - "taxa de conversão" geralmente é convertidos / total

   ⚠️ MAS: Use raciocínio analítico! Se o contexto sugerir algo diferente, adapte!

💡 Palavras-gatilho para clarificação (exemplos, não regras absolutas):
   - "melhor", "pior" → geralmente precisa especificar métrica (mas use contexto!)
   - "comparar" → geralmente precisa referência (mas inferir se possível!)
   - "tendência" → geralmente precisa período (mas usar dados disponíveis!)
   - "desempenho" → geralmente precisa métrica (mas inferir do contexto!)

   ⚠️ MAS: Avalie se você consegue inferir do contexto! Só peça se REALMENTE não der pra inferir!

═══════════════════════════════════════════════════════════════════════════════
INTERPRETAÇÃO CONTEXTUAL É OBRIGATÓRIA
═══════════════════════════════════════════════════════════════════════════════

Você DEVE elaborar cenários interpretativos quando encontrar situações não cobertas pelos exemplos.

Exemplos de raciocínio interpretativo correto:
✅ "O usuário quer 'items com mais movimento' → vou somar entradas + saídas por SKU"
✅ "O usuário quer 'performance' → vejo que há 'receita' e 'custo', vou calcular margem"
✅ "O usuário quer 'melhor campanha' → vejo que há 'conversões' e 'gasto', vou calcular ROI"

Exemplos de raciocínio ERRADO:
❌ "Não sei o que é 'movimento', vou retornar erro"
❌ "Não tem a métrica 'performance' no dataset, vou pedir clarificação"
❌ "'Melhor' não está nos exemplos, não vou prosseguir"

SEU OBJETIVO: Entregar insights valiosos, não seguir regras rígidas!

═══════════════════════════════════════════════════════════════════════════════
SUA TAREFA - PLANEJAMENTO PROFISSIONAL:
═══════════════════════════════════════════════════════════════════════════════

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

4. CLARIFICAÇÃO (seja inteligente, não robótico!)
   - Só peça clarificação se REALMENTE não conseguir inferir do contexto
   - Tente SEMPRE interpretar primeiro usando os dados disponíveis
   - Use raciocínio analítico para preencher lacunas

   ✅ PERGUNTE APENAS quando:
   - Ambiguidade CRÍTICA que impede análise: "analise X" sem dados relacionados a X
   - Múltiplas interpretações possíveis sem preferência clara

   ❌ NÃO PERGUNTE se:
   - Você consegue inferir do contexto dos dados
   - Há uma interpretação óbvia e razoável
   - Você pode incluir múltiplas perspectivas na análise

5. PLANEJAMENTO DE QUERIES (Estrutura Obrigatória)

   🎯 ESTRUTURA PADRÃO:

   A) QUERIES ESPECÍFICAS (1-3 queries)
      - Responda EXATAMENTE a pergunta do usuário
      - Se ele pediu X e Y, faça query para X e query para Y
      - Estas são SEMPRE as primeiras queries

   B) QUERIES UNIVERSAIS (3-5 queries)
      - Perfil do Dataset (se ainda não estiver coberto)
      - Distribuição/Concentração (se fizer sentido)
      - Estatísticas Descritivas (sempre útil)
      - Rankings (se houver métricas numéricas)
      - Correlações (se houver 2+ colunas numéricas)
      - Outliers (se fizer sentido)

   Total recomendado: 6-10 queries (específicas + universais)

   ⚠️ REGRA OBRIGATÓRIA: MÍNIMO 6 QUERIES (NÃO 4!)
   Você DEVE gerar pelo menos 6 queries robustas.
   Se sua análise tem menos, adicione queries universais obrigatórias:
   - Perfil completo (COUNT, COUNT DISTINCT)
   - Distribuição TOP 10 (não TOP 2!)
   - Estatísticas completas (MIN, MAX, AVG, SUM)
   - Ranking TOP 10 por métrica principal
   - Análise de concentração/outliers

   EXEMPLO de sequência completa:
   [ESPECÍFICAS]
   Query 1: "Resposta direta à pergunta do usuário"
   Query 2: "Detalhamento ou segunda parte da pergunta"

   [UNIVERSAIS - OBRIGATÓRIAS]
   Query 3: "Perfil Completo: SELECT COUNT(*) as total, COUNT(DISTINCT categoria) as categorias FROM data"
   Query 4: "Distribuição TOP 10: SELECT categoria, COUNT(*) FROM data GROUP BY categoria ORDER BY COUNT(*) DESC LIMIT 10"
   Query 5: "Estatísticas: SELECT MIN(valor), MAX(valor), AVG(valor), SUM(valor) FROM data"
   Query 6: "Ranking TOP 10: SELECT item, SUM(metrica) as total FROM data GROUP BY item ORDER BY total DESC LIMIT 10"
   Query 7: "Concentração: WITH totals AS (SELECT categoria, SUM(valor) as total FROM data GROUP BY categoria ORDER BY total DESC) SELECT *, ROUND(100.0 * total / (SELECT SUM(total) FROM totals), 2) as percentual FROM totals LIMIT 10"
   Query 8: "Outliers: SELECT * FROM data WHERE valor > (SELECT AVG(valor) * 3 FROM data) ORDER BY valor DESC LIMIT 10"

   🔥 IMPORTANTE: Use LIMIT 10 (NÃO LIMIT 2) para rankings e distribuições!

   ⚠️ Adapte conforme necessário:
   - Se pergunta do usuário já é um "ranking", não duplique na query universal
   - Se dataset é pequeno (< 10 linhas), ajuste accordingly
   - Se não há múltiplas métricas numéricas, skip correlações

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
  "analysis_approach": "Estratégia geral: queries específicas para responder a pergunta + queries universais para contexto robusto",
  "user_friendly_summary": "TEXTO CONVERSACIONAL explicando o plano completo de análise. Estrutura sugerida: 'Vou fazer uma análise completa para responder sua pergunta. Primeiro, vou [resposta específica]. Depois vou adicionar contexto analisando [análises universais que fazem sentido]. Isso vai te dar uma visão completa de [valor da análise].' NUNCA use jargão: 'query', 'SQL', 'dataset', 'agregação', 'GROUP BY'. Máximo 250 palavras.",
  "queries_planned": [
    {
      "purpose_technical": "Documentação interna",
      "purpose_user_friendly": "Contexto geral: total de vendedores no dataset",
      "sql": "SELECT COUNT(DISTINCT salesperson) as total_vendedores FROM data",
      "will_process_rows": ${profile.totalRows},
      "expected_result_type": "total"
    },
    {
      "purpose_technical": "Análise específica",
      "purpose_user_friendly": "Total de vendas de Fernando (filtrado)",
      "sql": "SELECT SUM(total_value) as vendas_fernando FROM data WHERE salesperson = 'Fernando'",
      "will_process_rows": ${profile.totalRows},
      "expected_result_type": "total"
    },
    {
      "purpose_technical": "Comparação",
      "purpose_user_friendly": "Fernando comparado com outros vendedores",
      "sql": "SELECT salesperson, SUM(total_value) as total FROM data GROUP BY salesperson ORDER BY total DESC",
      "will_process_rows": ${profile.totalRows},
      "expected_result_type": "ranking"
    }
  ],
  "visualizations_planned": [
    {"type": "kpi", "title": "Principais Métricas", "rationale": "Destacar valores-chave para visão rápida"},
    {"type": "bar", "title": "Ranking visual", "rationale": "Facilita comparação entre entidades"},
    {"type": "table", "title": "Dados detalhados", "rationale": "Permitir exploração profunda dos números"},
    {"type": "line", "title": "Evolução temporal (se houver datas)", "rationale": "Mostrar tendências ao longo do tempo"}
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

═══════════════════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS SQL (PARA O SQL FUNCIONAR CORRETAMENTE)
═══════════════════════════════════════════════════════════════════════════════

🔴 CRÍTICO - REGRAS OBRIGATÓRIAS:

1. SEMPRE use "FROM data" (nome da tabela é "data")

2. GROUP BY é OBRIGATÓRIO quando você mistura:
   - Colunas agregadas (SUM, AVG, COUNT, MIN, MAX)
   - Colunas não-agregadas (colunas normais)

3. CÁLCULOS COMPOSTOS (exemplos corretos):
   ✅ Diferença/divergência: SELECT coluna_a - coluna_b AS divergencia FROM data
   ✅ Soma de múltiplas colunas: SELECT (coluna_a + coluna_b) AS total FROM data
   ✅ Com agregação: SELECT categoria, SUM(coluna_a - coluna_b) AS total_divergencia FROM data GROUP BY categoria
   ✅ Valor absoluto de diferença: SELECT ABS(coluna_a - coluna_b) AS divergencia FROM data

4. REGRAS DE GROUP BY:
   ✅ CORRETO: SELECT categoria, SUM(valor) as total FROM data GROUP BY categoria
   ❌ ERRADO: SELECT categoria, SUM(valor) FROM data (falta GROUP BY)
   ✅ CORRETO: SELECT COUNT(*) as total FROM data (COUNT sozinho não precisa GROUP BY)
   ❌ ERRADO: SELECT categoria, COUNT(*) FROM data (falta GROUP BY categoria)

5. COLUNAS DISPONÍVEIS:
   Use APENAS estas colunas: ${profile.columns.join(', ')}

6. FILTROS E CONDIÇÕES:
   ✅ WHERE antes de GROUP BY: SELECT categoria, SUM(valor) FROM data WHERE ativo = true GROUP BY categoria
   ✅ HAVING depois de GROUP BY: SELECT categoria, SUM(valor) as total FROM data GROUP BY categoria HAVING total > 1000

7. ORDENAÇÃO E LIMITES:
   ✅ ORDER BY com alias: SELECT categoria, SUM(valor) as total FROM data GROUP BY categoria ORDER BY total DESC
   ✅ LIMIT: SELECT * FROM data LIMIT 10

8. ERROS COMUNS E COMO EVITAR:
   ❌ "Aggregation requires GROUP BY" → Você misturou SUM/AVG/etc com coluna normal. Adicione GROUP BY.
   ❌ "Column not found" → Você usou coluna que não existe. Confira lista acima.
   ❌ Valores zerados → Verifique se o cálculo está correto (ex: SUM(a - b), não SUM(a) - SUM(b))

9. EXEMPLOS DE QUERIES CORRETAS PARA DIVERGÊNCIAS:
   ✅ Simples: SELECT produto, (quantidade_total - contagem_fisica) AS divergencia FROM data
   ✅ Com filtro: SELECT produto, (quantidade_total - contagem_fisica) AS divergencia FROM data WHERE divergencia != 0
   ✅ Agregada: SELECT categoria, SUM(quantidade_total - contagem_fisica) AS total_divergencia FROM data GROUP BY categoria
   ✅ Com ranking: SELECT produto, (quantidade_total - contagem_fisica) AS divergencia FROM data ORDER BY ABS(quantidade_total - contagem_fisica) DESC LIMIT 10

Retorne APENAS o JSON (sem markdown, sem explicação adicional).
`;

  console.log('[ProfessionalAnalyst] Generating analysis plan...');

  const response = await callOpenAI(prompt, openaiApiKey, openaiModel);

  // Clean response (remove markdown code blocks if present)
  const cleanResponse = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');

  try {
    const plan = JSON.parse(cleanResponse);

    // 🔥 VALIDATION: Ensure minimum 6 queries (not 4!)
    if (!plan.queries_planned || plan.queries_planned.length < 6) {
      console.warn(`[ProfessionalAnalyst] ⚠️ Only ${plan.queries_planned?.length || 0} queries generated. Minimum is 6. Adding universal queries...`);

      // Add universal queries as fallback
      const existingQueries = plan.queries_planned || [];
      const universalQueries = [];

      // 🔥 ALWAYS add comprehensive profile query
      if (!existingQueries.some(q => q.purpose_technical?.includes('profile'))) {
        const categoricalCols = profile.columns.filter(col => profile.cardinality[col] < 100 && profile.cardinality[col] > 1);
        const distinctCounts = categoricalCols.slice(0, 3).map(col => `COUNT(DISTINCT ${col}) as distintos_${col}`).join(', ');
        universalQueries.push({
          purpose_technical: "Universal - Complete Dataset Profile",
          purpose_user_friendly: "Perfil completo do dataset: total de registros e entidades únicas",
          sql: `SELECT COUNT(*) as total_registros${distinctCounts ? ', ' + distinctCounts : ''} FROM data`,
          will_process_rows: profile.totalRows,
          expected_result_type: "total"
        });
      }

      // 🔥 ALWAYS add TOP 10 distribution (not TOP 2!)
      if (existingQueries.length + universalQueries.length < 6 && profile.columns.length > 0) {
        const categoricalColumn = profile.columns.find(col => profile.cardinality[col] < 100 && profile.cardinality[col] > 1);
        if (categoricalColumn) {
          universalQueries.push({
            purpose_technical: "Universal - TOP 10 Distribution",
            purpose_user_friendly: `TOP 10 completo por ${categoricalColumn} (visão geral)`,
            sql: `SELECT ${categoricalColumn}, COUNT(*) as total FROM data GROUP BY ${categoricalColumn} ORDER BY total DESC LIMIT 10`,
            will_process_rows: profile.totalRows,
            expected_result_type: "ranking"
          });
        }
      }

      // 🔥 ALWAYS add complete statistics for ALL numeric columns
      const numericColumns = Object.entries(profile.columnTypes)
        .filter(([_, type]) => type === 'number')
        .map(([col, _]) => col);

      if (existingQueries.length + universalQueries.length < 6 && numericColumns.length > 0) {
        const statsFields = numericColumns.slice(0, 2).map(col =>
          `MIN(${col}) as min_${col}, MAX(${col}) as max_${col}, AVG(${col}) as avg_${col}, SUM(${col}) as sum_${col}`
        ).join(', ');
        universalQueries.push({
          purpose_technical: "Universal - Complete Statistics",
          purpose_user_friendly: `Estatísticas completas: mínimo, máximo, média e total de todas as métricas`,
          sql: `SELECT COUNT(*) as total_registros, ${statsFields} FROM data`,
          will_process_rows: profile.totalRows,
          expected_result_type: "total"
        });
      }

      // 🔥 ALWAYS add TOP 10 ranking (not TOP 2!)
      if (existingQueries.length + universalQueries.length < 6 && numericColumns.length > 0) {
        const categoricalColumn = profile.columns.find(col => profile.cardinality[col] < 100 && profile.cardinality[col] > 1);
        if (categoricalColumn && numericColumns[0]) {
          universalQueries.push({
            purpose_technical: "Universal - TOP 10 Ranking",
            purpose_user_friendly: `TOP 10 ranking completo de ${categoricalColumn} por ${numericColumns[0]}`,
            sql: `SELECT ${categoricalColumn}, SUM(${numericColumns[0]}) as total FROM data GROUP BY ${categoricalColumn} ORDER BY total DESC LIMIT 10`,
            will_process_rows: profile.totalRows,
            expected_result_type: "ranking"
          });
        }
      }

      // 🔥 Add concentration analysis
      if (existingQueries.length + universalQueries.length < 6 && numericColumns.length > 0) {
        const categoricalColumn = profile.columns.find(col => profile.cardinality[col] < 100 && profile.cardinality[col] > 1);
        if (categoricalColumn && numericColumns[0]) {
          universalQueries.push({
            purpose_technical: "Universal - Concentration Analysis",
            purpose_user_friendly: `Análise de concentração: quanto do total está nos TOP 10`,
            sql: `WITH ranked AS (SELECT ${categoricalColumn}, SUM(${numericColumns[0]}) as total FROM data GROUP BY ${categoricalColumn} ORDER BY total DESC LIMIT 10) SELECT ${categoricalColumn}, total, ROUND(100.0 * total / (SELECT SUM(${numericColumns[0]}) FROM data), 2) as percentual_do_total FROM ranked`,
            will_process_rows: profile.totalRows,
            expected_result_type: "ranking"
          });
        }
      }

      // 🔥 Add outliers detection
      if (existingQueries.length + universalQueries.length < 6 && numericColumns.length > 0) {
        const col = numericColumns[0];
        universalQueries.push({
          purpose_technical: "Universal - Outliers Detection",
          purpose_user_friendly: `Detecção de outliers: valores extremos acima de 2x a média`,
          sql: `SELECT * FROM data WHERE ${col} > (SELECT AVG(${col}) * 2 FROM data) ORDER BY ${col} DESC LIMIT 10`,
          will_process_rows: profile.totalRows,
          expected_result_type: "ranking"
        });
      }

      plan.queries_planned = [...existingQueries, ...universalQueries];
      console.log(`[ProfessionalAnalyst] ✅ Queries expanded to ${plan.queries_planned.length} (added ${universalQueries.length} universal queries)`);

      // Final validation: ensure we have at least 6
      if (plan.queries_planned.length < 6) {
        console.warn(`[ProfessionalAnalyst] ⚠️ Still only ${plan.queries_planned.length} queries. Analysis may lack depth.`);
      }
    }

    console.log('[ProfessionalAnalyst] Plan generated successfully');
    return plan;
  } catch (error: any) {
    console.error('[ProfessionalAnalyst] Failed to parse response:', cleanResponse);
    throw new Error(`Failed to parse LLM response: ${error.message}`);
  }
}
