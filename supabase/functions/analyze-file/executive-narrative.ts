/**
 * EXECUTIVE NARRATIVE GENERATOR WITH INTELLIGENT VISUALIZATIONS
 *
 * Transforms technical results into business-friendly narratives with professional visualizations.
 * Think: Senior analyst presenting to CEO with charts, tables, and KPIs.
 *
 * Core principles:
 * - Simple, direct language (as if speaking, not writing)
 * - Concrete numbers (not generalizations)
 * - Business insights (not technical details)
 * - Professional visualizations (charts, tables, KPIs)
 * - Actionable recommendations
 * - ZERO technical jargon
 */

import { formatCurrency, formatPercentage, formatNumber, detectColumnType } from '../_shared/data-formatters.ts';

export interface ChartVisualization {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'table' | 'kpi' | 'heatmap';
  title: string;
  data: any;
  config?: any;
  interpretation: string;
  insights?: string[];
}

export interface KPICard {
  label: string;
  value: string;
  trend?: string;
  comparison?: string;
  icon?: string;
}

export interface ExecutiveNarrative {
  headline: string;
  executive_summary: string;
  kpi_cards: KPICard[];
  key_insights: Array<{
    title: string;
    description: string;
    numbers: string[];
    importance: 'high' | 'medium' | 'low';
    emoji: string;
  }>;
  visualizations: ChartVisualization[];
  business_recommendations: Array<{
    action: string;
    rationale: string;
    expected_impact: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  next_questions: string[];
}

/**
 * Analyze query results and recommend appropriate visualizations
 */
function analyzeResultsForVisualizations(executedQueries: any[]): string {
  const recommendations: string[] = [];

  for (const query of executedQueries) {
    const results = query.results || [];
    const purpose = query.purpose_user_friendly || query.purpose || '';

    if (results.length === 0) continue;

    const firstRow = results[0];
    const columns = Object.keys(firstRow);
    const numericColumns = columns.filter(col => typeof firstRow[col] === 'number');
    const textColumns = columns.filter(col => typeof firstRow[col] === 'string');

    // KPI Cards - for single aggregate values
    if (results.length === 1 && numericColumns.length >= 1) {
      recommendations.push(`📊 KPI Cards para "${purpose}": Destacar métricas principais (${numericColumns.join(', ')})`);
    }

    // Bar Chart - for rankings and comparisons (up to 20 items)
    if (results.length >= 2 && results.length <= 20 && numericColumns.length >= 1 && textColumns.length >= 1) {
      recommendations.push(`📊 Gráfico de Barras para "${purpose}": Comparar ${textColumns[0]} por ${numericColumns[0]}`);
    }

    // Pie Chart - for distributions (up to 8 categories)
    if (results.length >= 2 && results.length <= 8 && numericColumns.length >= 1 && purpose.match(/distribuição|concentração|participação/i)) {
      recommendations.push(`🥧 Gráfico de Pizza para "${purpose}": Mostrar proporção de ${textColumns[0]}`);
    }

    // Line Chart - for temporal data
    if (results.length >= 3 && columns.some(c => c.match(/data|date|periodo|mes|month|ano|year/i))) {
      recommendations.push(`📈 Gráfico de Linha para "${purpose}": Mostrar evolução temporal`);
    }

    // Table - for detailed data (always useful)
    if (results.length >= 3) {
      recommendations.push(`📋 Tabela para "${purpose}": Dados detalhados para exploração (${results.length} linhas)`);
    }

    // Scatter Plot - for correlations
    if (numericColumns.length >= 2 && results.length >= 5 && purpose.match(/correlação|relação|comparação/i)) {
      recommendations.push(`🔗 Gráfico de Dispersão para "${purpose}": Visualizar relação entre ${numericColumns[0]} e ${numericColumns[1]}`);
    }
  }

  return recommendations.join('\n');
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
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateExecutiveNarrative(
  userQuestion: string,
  businessUnderstanding: any,
  executedQueries: any[],
  openaiApiKey: string,
  openaiModel: string
): Promise<ExecutiveNarrative> {

  // Analyze results to recommend visualizations
  const vizRecommendations = analyzeResultsForVisualizations(executedQueries);

  const prompt = `
Você é um analista de dados sênior apresentando resultados ao CEO com relatório profissional completo.

SOLICITAÇÃO ORIGINAL:
"${userQuestion}"

CONTEXTO DE NEGÓCIO:
${JSON.stringify(businessUnderstanding, null, 2)}

RESULTADOS DA ANÁLISE (${executedQueries.length} queries executadas):
${JSON.stringify(executedQueries, null, 2)}

RECOMENDAÇÕES DE VISUALIZAÇÕES:
${vizRecommendations}

═══════════════════════════════════════════════════════════════════════════════
SUA TAREFA: Criar Relatório Executivo Profissional Completo
═══════════════════════════════════════════════════════════════════════════════

COMPONENTES OBRIGATÓRIOS DO RELATÓRIO:

1️⃣ KPI CARDS (3-5 cards)
   - Métricas-chave destacadas visualmente
   - Valor formatado + contexto (vs média, vs meta, tendência)
   - Exemplo: "R$ 128.400 | +23% vs mês anterior | Receita Total"

2️⃣ VISUALIZAÇÕES (3-5 gráficos/tabelas)
   - Use as recomendações acima como guia
   - Cada visualização DEVE ter interpretação clara
   - Dados formatados apropriadamente (moeda, percentual, número)

3️⃣ INSIGHTS (2-4 insights)
   - Conectar todos os resultados das queries
   - Identificar padrões, concentrações, outliers, correlações
   - Números concretos sempre

4️⃣ RECOMENDAÇÕES (2-3 ações)
   - Práticas e acionáveis
   - Com impacto esperado quantificado

REGRAS DE STORYTELLING:
1. Comece com o PRINCIPAL ACHADO (headline impactante)
2. Adicione CONTEXTO usando TODOS os resultados das queries
3. Compare com REFERÊNCIAS (outros, média, benchmark)
4. Identifique PADRÕES (concentração, tendência, anomalia, correlação)
5. Sugira AÇÕES práticas e quantifique impacto
6. Use emojis com PARCIMÔNIA (1-2 por insight)
7. Números SEMPRE concretos (nunca "muitos", sempre "45%")
8. OBRIGATÓRIO: Use TODAS as ${executedQueries.length} queries executadas na narrativa

EXEMPLO DE BOM STORYTELLING:

Pergunta: "Como foi a performance de Fernando?"

❌ RUIM (vago, sem contexto):
"Fernando vendeu 408 unidades totalizando R$ 39.404,32."

✅ BOM (rico, com contexto, insights):
"Fernando é especialista em argamassa! 🎯

Ele concentrou 100% das vendas (408 unidades) em um único produto: Argamassa AC-II 20kg,
gerando R$ 39.404,32 em receita.

**Contexto:** O dataset tem 15 vendedores ativos. Fernando representa 7,8% das vendas totais.

**Padrão interessante:** Essa especialização extrema pode ser:
- 💪 **Força:** Expertise profunda = fechamentos mais rápidos
- ⚠️ **Oportunidade:** Diversificar portfólio poderia multiplicar resultados

**Comparação:** A média dos vendedores é R$ 33.600. Fernando está 17% acima da média,
mas concentrado em uma única categoria.

**Insight de negócio:** Se Fernando aplicar o mesmo nível de especialização em 2-3
categorias complementares (ex: cimento, rejunte), pode potencialmente dobrar o volume."

REGRAS TÉCNICAS:
- Linguagem simples e direta (como se estivesse falando)
- Números concretos (não generalizações)
- Insights de negócio (não técnicos)
- ZERO jargão técnico
- Conecte insights com ações práticas
- Conte uma HISTÓRIA com os dados
- Use TODOS os resultados (não deixe queries sem mencionar)

Retorne JSON VÁLIDO no seguinte formato:

{
  "headline": "Título chamativo do principal achado (máximo 10 palavras)",
  "executive_summary": "Resumo executivo de 2-3 frases diretas integrando TODOS os resultados",
  "kpi_cards": [
    {
      "label": "Receita Total",
      "value": "R$ 128.400",
      "trend": "+23%",
      "comparison": "vs mês anterior",
      "icon": "💰"
    },
    {
      "label": "ROI Médio",
      "value": "6,8x",
      "trend": "+2,1x",
      "comparison": "vs benchmark",
      "icon": "📈"
    },
    {
      "label": "Top Performer",
      "value": "Black Friday",
      "trend": "R$ 52k",
      "comparison": "40% do total",
      "icon": "🏆"
    }
  ],
  "key_insights": [
    {
      "title": "Especialização em produto único",
      "description": "Fernando vendeu exclusivamente Argamassa AC-II 20kg (408 unidades), demonstrando expertise profunda nesta categoria. Essa especialização resultou em R$ 39.404,32 em receita, mas limita o potencial de crescimento.",
      "numbers": ["100% de concentração em 1 produto", "408 unidades vendidas", "R$ 39.404,32 em receita"],
      "importance": "high",
      "emoji": "🎯"
    },
    {
      "title": "Performance acima da média",
      "description": "Entre 15 vendedores ativos, Fernando fica 17% acima da média de receita (R$ 33.600). Representa 7,8% do total de vendas da empresa.",
      "numbers": ["17% acima da média", "7,8% do total", "15 vendedores no time"],
      "importance": "medium",
      "emoji": "📊"
    }
  ],
  "visualizations": [
    {
      "type": "bar",
      "title": "Ranking de Campanhas por ROI",
      "data": {
        "labels": ["Black Friday", "Promo Outubro", "Lookalike 1%", "Remarketing"],
        "datasets": [{
          "label": "ROI",
          "data": [6.8, 4.2, 3.9, 2.1]
        }]
      },
      "config": {
        "horizontal": false,
        "showValues": true
      },
      "interpretation": "Black Friday lidera com ROI de 6,8x, seguida por Promo Outubro com 4,2x. Existe uma clara diferenciação entre as top 2 campanhas e as demais.",
      "insights": ["Top 2 campanhas geram 70% do retorno total", "ROI cai drasticamente após a 4ª posição"]
    },
    {
      "type": "table",
      "title": "Dados Detalhados por Campanha",
      "data": {
        "columns": ["Campanha", "Investimento", "Receita", "ROI", "Conversões"],
        "rows": [
          ["Black Friday", "R$ 18.900", "R$ 128.000", "6,8x", 147],
          ["Promo Outubro", "R$ 11.200", "R$ 71.000", "4,2x", 89]
        ]
      },
      "interpretation": "Tabela completa com todas as métricas para análise detalhada",
      "insights": []
    }
  ],
  "business_recommendations": [
    {
      "action": "Diversificar portfólio de Fernando para 2-3 categorias complementares",
      "rationale": "Dado o sucesso em argamassa, aplicar a mesma expertise em cimento e rejunte pode capturar vendas cruzadas. Clientes de argamassa frequentemente compram esses produtos.",
      "expected_impact": "Potencial de aumentar receita em 60-80% mantendo a mesma base de clientes",
      "priority": "high"
    },
    {
      "action": "Criar programa de mentoria com Fernando para outros vendedores",
      "rationale": "Fernando tem técnicas de especialização que funcionam. Replicar isso pode elevar a performance média do time.",
      "expected_impact": "Elevar a média do time de R$ 33.600 para R$ 40.000+",
      "priority": "medium"
    }
  ],
  "next_questions": [
    "Quais clientes de Fernando têm maior potencial para vendas cruzadas?",
    "Como Fernando se compara aos outros vendedores em taxa de conversão?",
    "Qual a margem de lucro média de argamassa vs outras categorias?"
  ]
}

IMPORTANTE - REQUISITOS OBRIGATÓRIOS:
✅ Inclua 3-5 KPI Cards com métricas destacadas
✅ Inclua 3-5 Visualizações (mix de gráficos e tabelas conforme recomendações)
✅ Inclua 2-4 Insights conectando TODOS os ${executedQueries.length} resultados
✅ Inclua 2-3 Recomendações com impacto quantificado
✅ Formate valores apropriadamente:
   - Moeda: "R$ 1.234,56"
   - Percentual: "23,5%"
   - Número: "1.234"
✅ Seja honesto se dados não responderam completamente
✅ Use linguagem conversacional (como apresentação oral, não escrita)
✅ ZERO jargão técnico (sem "query", "SQL", "dataset", "agregação")

Retorne APENAS o JSON (sem markdown, sem explicação adicional).
`;

  console.log('[ExecutiveNarrative] Generating narrative...');

  const response = await callOpenAI(prompt, openaiApiKey, openaiModel);

  const cleanResponse = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');

  try {
    const narrative = JSON.parse(cleanResponse);
    console.log('[ExecutiveNarrative] Narrative generated successfully');
    return narrative;
  } catch (error: any) {
    console.error('[ExecutiveNarrative] Failed to parse response:', cleanResponse);
    throw new Error(`Failed to parse narrative: ${error.message}`);
  }
}
