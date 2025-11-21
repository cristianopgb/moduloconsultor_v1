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

2️⃣ QUERIES UNIVERSAIS (obrigatório)
   - Sempre adicione um "pacote padrão" de análises robustas
   - Estas queries funcionam para QUALQUER dataset
   - Elas enriquecem a análise e agregam valor profissional

═══════════════════════════════════════════════════════════════════════════════
AS 6 QUERIES UNIVERSAIS (use as que fizerem sentido)
═══════════════════════════════════════════════════════════════════════════════

Estas são análises que sempre agregam valor, independente do domínio:

📊 1. PERFIL DO DATASET
   - Total de registros
   - Contagens de valores únicos em colunas categóricas principais
   - Período coberto (se houver coluna de data/período)
   - Insight: "O dataset cobre X registros de Y entidades ao longo de Z período"

📈 2. DISTRIBUIÇÃO E CONCENTRAÇÃO
   - Top 10 por colunas categóricas relevantes
   - Percentual de concentração (ex: top 3 representam X% do total)
   - Insight: "80% do volume está concentrado em 20% das categorias"

📐 3. ESTATÍSTICAS DESCRITIVAS
   - Para cada coluna numérica: MIN, MAX, AVG, SUM
   - Identifique a dispersão dos dados
   - Insight: "A métrica X varia de Y a Z, com média de W"

🏆 4. RANKINGS
   - Ordenar por cada métrica numérica relevante
   - Top 10 e Bottom 10 (quando fizer sentido)
   - Insight: "Os 5 principais itens representam 45% do total"

🔗 5. CORRELAÇÕES (quando houver múltiplas colunas numéricas)
   - Identificar relacionamentos entre métricas
   - Calcular proporções e taxas compostas
   - Insight: "Quando X aumenta, Y também aumenta em 0,8 de correlação"

⚡ 6. OUTLIERS E ANOMALIAS
   - Identificar valores extremos
   - Detectar padrões incomuns
   - Insight: "3 registros apresentam valores 5x acima da média"

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

   Total recomendado: 4-8 queries (específicas + universais)

   EXEMPLO de sequência completa:
   [ESPECÍFICAS]
   Query 1: "Resposta direta à pergunta do usuário"
   Query 2: "Detalhamento ou segunda parte da pergunta"

   [UNIVERSAIS]
   Query 3: "Perfil: Total de registros e entidades únicas"
   Query 4: "Distribuição: Top 10 e concentração"
   Query 5: "Estatísticas: Min, Max, Avg de métricas numéricas"
   Query 6: "Rankings: Ordenação por métricas principais"
   Query 7: "Outliers: Valores extremos ou anomalias"

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
