/**
 * FREE-FORM ANALYSIS MODULE
 *
 * This module provides intelligent, template-free analysis when:
 * 1. No suitable template is found
 * 2. Template-based approach fails
 * 3. Question is too specific/unique for pre-defined templates
 *
 * It applies domain knowledge and creates custom methodologies on-the-fly
 */

export interface DomainContext {
  domain: 'logistics' | 'sales' | 'finance' | 'operations' | 'generic';
  confidence: number;
  indicators: string[];
  benchmarks: Record<string, any>;
}

export interface AnalysisMethodology {
  approach: string;
  steps: AnalysisStep[];
  expectedOutputs: string[];
  domainContext?: DomainContext;
}

export interface AnalysisStep {
  name: string;
  description: string;
  sqlQuery: string;
  purpose: string;
}

/**
 * Detect domain and context from question and data schema
 */
export function detectDomain(question: string, schema: any[]): DomainContext {
  const questionLower = question.toLowerCase();
  const columnNames = schema.map(s => s.name.toLowerCase()).join(' ');
  const combinedText = questionLower + ' ' + columnNames;

  // Logistics indicators
  const logisticsKeywords = [
    'otif', 'entrega', 'delivery', 'prazo', 'atraso', 'lead time',
    'transportadora', 'carrier', 'frete', 'devolucao', 'nf', 'nota fiscal',
    'embarcador', 'carga', 'pedido', 'ordem'
  ];

  // Sales indicators
  const salesKeywords = [
    'vendas', 'sales', 'receita', 'revenue', 'ticket', 'cliente', 'customer',
    'produto', 'product', 'conversao', 'abc', 'curva', 'ranking', 'top',
    'churn', 'ltv', 'cac'
  ];

  // Finance indicators
  const financeKeywords = [
    'receita', 'despesa', 'lucro', 'margem', 'roi', 'ebitda',
    'fluxo de caixa', 'cash flow', 'contas', 'pagamento', 'recebimento',
    'inadimplencia', 'provisao'
  ];

  // Operations indicators
  const operationsKeywords = [
    'producao', 'production', 'estoque', 'inventory', 'capacidade',
    'utilizacao', 'eficiencia', 'downtime', 'oee', 'setup',
    'manutencao', 'qualidade', 'defeito'
  ];

  // Calculate match scores
  const scores = {
    logistics: countMatches(combinedText, logisticsKeywords),
    sales: countMatches(combinedText, salesKeywords),
    finance: countMatches(combinedText, financeKeywords),
    operations: countMatches(combinedText, operationsKeywords)
  };

  const maxScore = Math.max(...Object.values(scores));
  const domain = maxScore >= 2
    ? (Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as any)
    : 'generic';

  console.log(`[FreeFormAnalyzer] Domain detected: ${domain} (confidence: ${maxScore})`);

  return {
    domain,
    confidence: Math.min(100, maxScore * 20),
    indicators: getIndicatorsForDomain(domain),
    benchmarks: getBenchmarksForDomain(domain)
  };
}

function countMatches(text: string, keywords: string[]): number {
  return keywords.filter(kw => text.includes(kw)).length;
}

/**
 * Get standard indicators for each domain
 */
function getIndicatorsForDomain(domain: string): string[] {
  const indicators: Record<string, string[]> = {
    logistics: [
      'OTIF (On Time In Full)',
      'On Time Delivery %',
      'In Full Delivery %',
      'Lead Time médio',
      'Taxa de devolução',
      'Custo de frete por pedido',
      'Performance por transportadora'
    ],
    sales: [
      'Receita total',
      'Ticket médio',
      'Curva ABC de produtos/clientes',
      'Taxa de conversão',
      'LTV (Lifetime Value)',
      'Churn rate',
      'Top produtos/clientes'
    ],
    finance: [
      'Margem bruta/líquida',
      'ROI',
      'Fluxo de caixa',
      'DRE (Receitas vs Despesas)',
      'Break-even',
      'Taxa de inadimplência'
    ],
    operations: [
      'OEE (Overall Equipment Effectiveness)',
      'Utilização de capacidade',
      'Tempo de setup',
      'Taxa de defeitos',
      'Produtividade',
      'Downtime'
    ],
    generic: [
      'Análise descritiva',
      'Distribuição de valores',
      'Tendências temporais',
      'Comparações por categoria',
      'Identificação de padrões'
    ]
  };

  return indicators[domain] || indicators.generic;
}

/**
 * Get industry benchmarks for domain
 */
function getBenchmarksForDomain(domain: string): Record<string, any> {
  const benchmarks: Record<string, Record<string, any>> = {
    logistics: {
      otif_target: 95,
      on_time_target: 95,
      in_full_target: 98,
      max_lead_time_days: 7,
      max_return_rate: 0.05,
      description: 'Benchmarks baseados em padrões da indústria logística brasileira'
    },
    sales: {
      abc_curve: { a: 0.8, b: 0.15, c: 0.05 },
      min_conversion_rate: 0.02,
      good_conversion_rate: 0.05,
      description: 'Benchmarks típicos de e-commerce e varejo'
    },
    finance: {
      min_gross_margin: 0.30,
      good_gross_margin: 0.50,
      max_default_rate: 0.03,
      description: 'Benchmarks financeiros conservadores'
    },
    operations: {
      min_oee: 0.60,
      good_oee: 0.85,
      max_defect_rate: 0.02,
      description: 'Benchmarks de manufatura classe mundial'
    },
    generic: {
      description: 'Análise sem benchmarks específicos de indústria'
    }
  };

  return benchmarks[domain] || benchmarks.generic;
}

/**
 * Create custom analysis methodology based on question and domain
 */
export function createAnalysisMethodology(
  question: string,
  schema: any[],
  domainContext: DomainContext
): AnalysisMethodology {

  const questionLower = question.toLowerCase();

  // Special case: OTIF Analysis
  if ((questionLower.includes('otif') ||
       (questionLower.includes('prazo') && questionLower.includes('completo'))) &&
      domainContext.domain === 'logistics') {
    return createOTIFMethodology(schema, domainContext);
  }

  // Special case: ABC Curve
  if (questionLower.includes('abc') || questionLower.includes('curva')) {
    return createABCMethodology(schema, domainContext);
  }

  // Special case: Ranking/Top N
  if (questionLower.includes('top') || questionLower.includes('ranking') ||
      questionLower.includes('melhores') || questionLower.includes('maiores')) {
    return createRankingMethodology(schema, domainContext, question);
  }

  // Special case: Temporal Analysis
  if (questionLower.includes('evolucao') || questionLower.includes('tendencia') ||
      questionLower.includes('mensal') || questionLower.includes('temporal')) {
    return createTemporalMethodology(schema, domainContext);
  }

  // Default: Generic exploratory analysis
  return createExploratoryMethodology(schema, domainContext, question);
}

/**
 * Create OTIF-specific methodology
 */
function createOTIFMethodology(schema: any[], context: DomainContext): AnalysisMethodology {
  // ⚠️ NOTA IMPORTANTE: Esta função foi desativada porque gera SQL hardcoded inválido.
  // O Enhanced Analyzer não deve usar metodologias pré-definidas.
  // Em vez disso, ele deve gerar SQL dinamicamente via LLM.

  // Retornar metodologia vazia que força geração dinâmica
  return {
    approach: 'OTIF (On Time In Full) Analysis - Dynamic Generation Required',
    steps: [], // Empty - força o Enhanced a usar geração dinâmica
    expectedOutputs: [
      'OTIF Score calculado com colunas reais do dataset',
      'Análise baseada nas colunas disponíveis'
    ],
    domainContext: context
  };
}

/**
 * Create ABC Curve methodology
 */
function createABCMethodology(schema: any[], context: DomainContext): AnalysisMethodology {
  const valueCol = schema.find(s =>
    s.type === 'numeric' && (
      s.name.toLowerCase().includes('valor') ||
      s.name.toLowerCase().includes('receita') ||
      s.name.toLowerCase().includes('volume')
    )
  )?.name || 'valor';

  const groupCol = schema.find(s =>
    s.name.toLowerCase().includes('produto') ||
    s.name.toLowerCase().includes('cliente') ||
    s.name.toLowerCase().includes('item')
  )?.name || schema.find(s => s.type === 'text')?.name || 'item';

  return {
    approach: 'ABC Curve Analysis (Pareto)',
    steps: [
      {
        name: 'Aggregate and Rank',
        description: 'Agregar valores e ranquear por importância',
        sqlQuery: `
          WITH aggregated AS (
            SELECT
              "${groupCol}" as item,
              SUM("${valueCol}") as total_value
            FROM {{temp_table}}
            GROUP BY 1
          ),
          ranked AS (
            SELECT
              *,
              SUM(total_value) OVER () as grand_total,
              SUM(total_value) OVER (ORDER BY total_value DESC) as cumulative_value
            FROM aggregated
          )
          SELECT
            item,
            total_value,
            ROUND(100.0 * total_value / grand_total, 2) as pct_of_total,
            ROUND(100.0 * cumulative_value / grand_total, 2) as cumulative_pct,
            CASE
              WHEN cumulative_value / grand_total <= 0.80 THEN 'A'
              WHEN cumulative_value / grand_total <= 0.95 THEN 'B'
              ELSE 'C'
            END as abc_class
          FROM ranked
          ORDER BY total_value DESC
        `,
        purpose: 'Classificar itens em categorias ABC'
      },
      {
        name: 'ABC Summary',
        description: 'Resumo da distribuição ABC',
        sqlQuery: `
          SELECT
            abc_class,
            COUNT(*) as item_count,
            SUM(total_value) as class_value,
            ROUND(100.0 * SUM(total_value) / SUM(SUM(total_value)) OVER (), 2) as pct_value
          FROM (/* previous query */) abc_data
          GROUP BY 1
          ORDER BY 1
        `,
        purpose: 'Sumarizar distribuição das classes'
      }
    ],
    expectedOutputs: [
      'Classificação ABC de cada item',
      'Distribuição de valor por classe',
      'Curva de Pareto (acumulado)',
      'Insights sobre concentração'
    ],
    domainContext: context
  };
}

/**
 * Create Ranking methodology
 */
function createRankingMethodology(schema: any[], context: DomainContext, question: string): AnalysisMethodology {
  const valueCol = schema.find(s => s.type === 'numeric')?.name || 'valor';
  const groupCol = schema.find(s => s.type === 'text')?.name || 'categoria';

  // Extract top N from question (default 10)
  const topNMatch = question.match(/top\s+(\d+)/i);
  const topN = topNMatch ? parseInt(topNMatch[1]) : 10;

  return {
    approach: `Top ${topN} Ranking Analysis`,
    steps: [
      {
        name: 'Calculate Rankings',
        description: `Calcular top ${topN} por valor agregado`,
        sqlQuery: `
          SELECT
            "${groupCol}" as item,
            SUM("${valueCol}") as total_value,
            COUNT(*) as occurrences,
            AVG("${valueCol}") as avg_value
          FROM {{temp_table}}
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT ${topN}
        `,
        purpose: `Identificar ${topN} maiores contribuidores`
      }
    ],
    expectedOutputs: [
      `Lista dos top ${topN} itens`,
      'Valor total e percentual do todo',
      'Insights sobre concentração'
    ],
    domainContext: context
  };
}

/**
 * Create Temporal Analysis methodology
 */
function createTemporalMethodology(schema: any[], context: DomainContext): AnalysisMethodology {
  const dateCol = schema.find(s => s.type === 'date')?.name ||
                  schema.find(s => s.name.toLowerCase().includes('data'))?.name || 'data';
  const valueCol = schema.find(s => s.type === 'numeric')?.name || 'valor';

  return {
    approach: 'Temporal Trend Analysis',
    steps: [
      {
        name: 'Monthly Evolution',
        description: 'Evolução mensal dos valores',
        sqlQuery: `
          SELECT
            DATE_TRUNC('month', "${dateCol}")::date as month,
            COUNT(*) as record_count,
            SUM("${valueCol}") as total_value,
            AVG("${valueCol}") as avg_value
          FROM {{temp_table}}
          GROUP BY 1
          ORDER BY 1
        `,
        purpose: 'Identificar tendências e sazonalidade'
      }
    ],
    expectedOutputs: [
      'Evolução temporal',
      'Identificação de tendências',
      'Detecção de sazonalidade'
    ],
    domainContext: context
  };
}

/**
 * Create generic exploratory methodology
 */
function createExploratoryMethodology(schema: any[], context: DomainContext, question: string): AnalysisMethodology {
  return {
    approach: 'Exploratory Data Analysis',
    steps: [
      {
        name: 'Descriptive Statistics',
        description: 'Estatísticas descritivas gerais',
        sqlQuery: `SELECT COUNT(*) as total_rows FROM {{temp_table}}`,
        purpose: 'Entender dimensão e características dos dados'
      }
    ],
    expectedOutputs: [
      'Estatísticas descritivas',
      'Distribuições principais',
      'Padrões identificados'
    ],
    domainContext: context
  };
}
