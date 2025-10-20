/**
 * ADVANCED VISUALIZATION ENGINE
 *
 * Generates intelligent, multi-perspective visualizations based on:
 * - Data characteristics
 * - Analysis type
 * - Domain context
 * - Insights discovered
 */

export interface VisualizationSuite {
  charts: ChartConfig[];
  narrative: AnalysisNarrative;
  recommendations: ActionPlan;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter' | 'gauge' | 'table';
  title: string;
  description: string;
  data: any[];
  config: any;
  insights: string[];
}

export interface AnalysisNarrative {
  executiveSummary: string;
  context: string;
  findings: Finding[];
  conclusions: string[];
  methodology: string;
}

export interface Finding {
  title: string;
  description: string;
  severity: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  evidence: any;
}

export interface ActionPlan {
  quickWins: Action[];
  strategicActions: Action[];
  monitoringPoints: string[];
}

export interface Action {
  title: string;
  description: string;
  expectedImpact: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
}

/**
 * Generate complete visualization suite with narrative
 */
export function generateVisualizationSuite(
  analysisType: string,
  queryResults: any[],
  domainContext: any,
  metadata: any
): VisualizationSuite {

  console.log(`[VisualizationEngine] Generating suite for ${analysisType}`);

  // Select appropriate visualizations based on analysis type
  const charts = selectCharts(analysisType, queryResults, domainContext);

  // Create executive narrative
  const narrative = createNarrative(analysisType, queryResults, domainContext, metadata);

  // Generate actionable recommendations
  const recommendations = createActionPlan(analysisType, queryResults, domainContext);

  return {
    charts,
    narrative,
    recommendations
  };
}

/**
 * Select appropriate chart types based on analysis
 */
function selectCharts(
  analysisType: string,
  results: any[],
  context: any
): ChartConfig[] {

  const charts: ChartConfig[] = [];

  // OTIF-specific charts
  if (analysisType.includes('otif') || analysisType.includes('OTIF')) {
    charts.push(createOTIFDashboard(results, context));
    charts.push(createTemporalEvolution(results, 'otif'));
    charts.push(createRootCausePareto(results));
    charts.push(createBenchmarkComparison(results, context));
    charts.push(createPerformanceHeatmap(results));
  }

  // ABC Curve charts
  else if (analysisType.includes('abc') || analysisType.includes('ABC')) {
    charts.push(createParetoChart(results));
    charts.push(createABCDistribution(results));
    charts.push(createTopContributors(results, 10));
  }

  // Temporal analysis charts
  else if (analysisType.includes('temporal') || analysisType.includes('evolution')) {
    charts.push(createTimeSeriesChart(results));
    charts.push(createTrendAnalysis(results));
  }

  // Ranking charts
  else if (analysisType.includes('ranking') || analysisType.includes('top')) {
    charts.push(createRankingBar(results));
    charts.push(createDistributionChart(results));
  }

  // Generic exploratory charts
  else {
    charts.push(createSummaryTable(results));
    if (hasTemporalData(results)) {
      charts.push(createTimeSeriesChart(results));
    }
  }

  return charts;
}

/**
 * Create OTIF Dashboard gauge chart
 */
function createOTIFDashboard(results: any[], context: any): ChartConfig {
  const data = results[0] || {};
  const total = data.total_orders || 1;
  const otifScore = Math.round((data.otif_count / total) * 100);
  const onTimeScore = Math.round((data.on_time_count / total) * 100);
  const inFullScore = Math.round((data.in_full_count / total) * 100);

  const target = context.benchmarks?.otif_target || 95;

  const insights: string[] = [];

  if (otifScore >= target) {
    insights.push(`✅ OTIF de ${otifScore}% SUPERA a meta de ${target}%`);
  } else {
    const gap = target - otifScore;
    insights.push(`🔴 OTIF de ${otifScore}% está ${gap}pp ABAIXO da meta de ${target}%`);
  }

  if (onTimeScore < target) {
    insights.push(`⚠️ On Time (${onTimeScore}%) é o principal gargalo`);
  }

  if (inFullScore < target) {
    insights.push(`⚠️ In Full (${inFullScore}%) precisa de atenção`);
  }

  return {
    type: 'gauge',
    title: 'OTIF Performance Dashboard',
    description: 'Indicadores principais de performance de entrega',
    data: [
      { metric: 'OTIF', value: otifScore, target },
      { metric: 'On Time', value: onTimeScore, target },
      { metric: 'In Full', value: inFullScore, target }
    ],
    config: {
      thresholds: {
        excellent: 95,
        good: 85,
        acceptable: 75,
        poor: 0
      }
    },
    insights
  };
}

/**
 * Create temporal evolution chart
 */
function createTemporalEvolution(results: any[], metric: string): ChartConfig {
  return {
    type: 'line',
    title: 'Evolução Temporal dos Indicadores',
    description: 'Performance ao longo do tempo',
    data: results,
    config: {
      xAxis: 'month',
      yAxis: ['on_time_pct', 'in_full_pct'],
      showTrend: true
    },
    insights: detectTrends(results)
  };
}

/**
 * Create root cause Pareto chart
 */
function createRootCausePareto(results: any[]): ChartConfig {
  const sorted = [...results].sort((a, b) => b.occurrences - a.occurrences);
  const total = sorted.reduce((sum, item) => sum + item.occurrences, 0);

  let cumulative = 0;
  const data = sorted.map(item => {
    cumulative += item.occurrences;
    return {
      ...item,
      cumulative_pct: (cumulative / total) * 100
    };
  });

  return {
    type: 'bar',
    title: 'Análise de Pareto - Causas de Falha',
    description: 'Principais problemas que impactam OTIF',
    data,
    config: {
      xAxis: 'failure_type',
      yAxis: 'occurrences',
      cumulativeLine: true
    },
    insights: [
      `${data[0]?.failure_type} representa ${Math.round((data[0]?.occurrences / total) * 100)}% das falhas`,
      `Top 2 causas respondem por ${Math.round((data[0]?.cumulative_pct + (data[1]?.cumulative_pct || 0)) / 2)}% dos problemas`
    ]
  };
}

/**
 * Create benchmark comparison
 */
function createBenchmarkComparison(results: any[], context: any): ChartConfig {
  const actual = results[0] || {};
  const benchmarks = context.benchmarks || {};

  return {
    type: 'bar',
    title: 'Comparação com Benchmarks da Indústria',
    description: 'Performance vs. padrões do mercado',
    data: [
      { metric: 'OTIF', atual: actual.otif_pct, benchmark: benchmarks.otif_target || 95 },
      { metric: 'On Time', atual: actual.on_time_pct, benchmark: benchmarks.on_time_target || 95 },
      { metric: 'In Full', atual: actual.in_full_pct, benchmark: benchmarks.in_full_target || 98 }
    ],
    config: {
      comparison: true,
      colors: { atual: '#3b82f6', benchmark: '#10b981' }
    },
    insights: []
  };
}

/**
 * Create performance heatmap
 */
function createPerformanceHeatmap(results: any[]): ChartConfig {
  return {
    type: 'heatmap',
    title: 'Heatmap de Performance',
    description: 'Visualização de padrões de performance',
    data: results,
    config: {
      xAxis: 'week',
      yAxis: 'carrier',
      value: 'otif_score',
      colorScale: 'RedYellowGreen'
    },
    insights: []
  };
}

/**
 * Create Pareto chart for ABC analysis
 */
function createParetoChart(results: any[]): ChartConfig {
  return {
    type: 'line',
    title: 'Curva de Pareto (ABC)',
    description: 'Concentração acumulada de valor',
    data: results,
    config: {
      xAxis: 'item',
      yAxis: 'cumulative_pct',
      showThresholds: [80, 95]
    },
    insights: [
      'Curva ABC mostra concentração típica de Pareto',
      'Classe A concentra 80% do valor em minoria dos itens'
    ]
  };
}

/**
 * Create ABC distribution pie chart
 */
function createABCDistribution(results: any[]): ChartConfig {
  const distribution = results.reduce((acc: any, item) => {
    acc[item.abc_class] = (acc[item.abc_class] || 0) + 1;
    return acc;
  }, {});

  return {
    type: 'pie',
    title: 'Distribuição das Classes ABC',
    description: 'Quantidade de itens por classe',
    data: Object.entries(distribution).map(([cls, count]) => ({
      class: cls,
      count
    })),
    config: {
      colors: { A: '#ef4444', B: '#f59e0b', C: '#10b981' }
    },
    insights: []
  };
}

/**
 * Create top contributors bar chart
 */
function createTopContributors(results: any[], limit: number): ChartConfig {
  const top = results.slice(0, limit);

  return {
    type: 'bar',
    title: `Top ${limit} Contribuidores`,
    description: 'Maiores valores agregados',
    data: top,
    config: {
      xAxis: 'item',
      yAxis: 'total_value',
      horizontal: true
    },
    insights: [
      `Top ${limit} representam ${Math.round(top.reduce((sum, i) => sum + (i.pct_of_total || 0), 0))}% do total`
    ]
  };
}

/**
 * Create time series chart
 */
function createTimeSeriesChart(results: any[]): ChartConfig {
  return {
    type: 'line',
    title: 'Série Temporal',
    description: 'Evolução ao longo do tempo',
    data: results,
    config: {
      xAxis: 'period',
      yAxis: 'value',
      showMovingAverage: true
    },
    insights: detectTrends(results)
  };
}

/**
 * Create trend analysis
 */
function createTrendAnalysis(results: any[]): ChartConfig {
  return {
    type: 'line',
    title: 'Análise de Tendência',
    description: 'Tendência e sazonalidade',
    data: results,
    config: {
      showTrendline: true,
      showSeasonality: true
    },
    insights: []
  };
}

/**
 * Create ranking bar chart
 */
function createRankingBar(results: any[]): ChartConfig {
  return {
    type: 'bar',
    title: 'Ranking',
    description: 'Classificação por valor',
    data: results,
    config: {
      horizontal: true,
      sorted: true
    },
    insights: []
  };
}

/**
 * Create distribution chart
 */
function createDistributionChart(results: any[]): ChartConfig {
  return {
    type: 'bar',
    title: 'Distribuição de Valores',
    description: 'Histograma de distribuição',
    data: results,
    config: {
      bins: 10
    },
    insights: []
  };
}

/**
 * Create summary table
 */
function createSummaryTable(results: any[]): ChartConfig {
  return {
    type: 'table',
    title: 'Tabela Resumo',
    description: 'Dados agregados',
    data: results.slice(0, 50),
    config: {
      sortable: true,
      filterable: true
    },
    insights: []
  };
}

/**
 * Check if data has temporal component
 */
function hasTemporalData(results: any[]): boolean {
  if (results.length === 0) return false;
  const firstRow = results[0];
  return Object.keys(firstRow).some(key =>
    key.toLowerCase().includes('data') ||
    key.toLowerCase().includes('date') ||
    key.toLowerCase().includes('mes') ||
    key.toLowerCase().includes('month')
  );
}

/**
 * Detect trends in temporal data
 */
function detectTrends(results: any[]): string[] {
  if (results.length < 3) return [];

  const insights: string[] = [];

  // Simple trend detection
  const firstValue = results[0]?.value || results[0]?.on_time_pct || 0;
  const lastValue = results[results.length - 1]?.value || results[results.length - 1]?.on_time_pct || 0;
  const change = ((lastValue - firstValue) / firstValue) * 100;

  if (Math.abs(change) > 10) {
    if (change > 0) {
      insights.push(`📈 Tendência de crescimento de ${Math.round(change)}%`);
    } else {
      insights.push(`📉 Tendência de queda de ${Math.round(Math.abs(change))}%`);
    }
  } else {
    insights.push('➡️ Tendência estável no período');
  }

  return insights;
}

/**
 * Create executive narrative
 */
function createNarrative(
  analysisType: string,
  results: any[],
  context: any,
  metadata: any
): AnalysisNarrative {

  return {
    executiveSummary: createExecutiveSummary(analysisType, results, context),
    context: createContextDescription(analysisType, metadata),
    findings: extractFindings(analysisType, results, context),
    conclusions: generateConclusions(analysisType, results, context),
    methodology: describeMethodology(analysisType, context)
  };
}

function createExecutiveSummary(type: string, results: any[], context: any): string {
  if (type.includes('otif')) {
    const data = results[0] || {};
    const otif = Math.round((data.otif_count / data.total_orders) * 100);
    return `Análise OTIF revela performance de ${otif}% no período analisado. ` +
           `Principais gargalos identificados e recomendações priorizadas para melhoria.`;
  }

  return `Análise completa dos dados revela padrões importantes e oportunidades de otimização.`;
}

function createContextDescription(type: string, metadata: any): string {
  return `Análise realizada sobre ${metadata.totalRows || 0} registros, ` +
         `abrangendo ${metadata.columns?.length || 0} dimensões de dados. ` +
         `Metodologia aplicada: ${type}.`;
}

function extractFindings(type: string, results: any[], context: any): Finding[] {
  const findings: Finding[] = [];

  if (type.includes('otif') && results[0]) {
    const data = results[0];
    const otif = Math.round((data.otif_count / data.total_orders) * 100);
    const target = context.benchmarks?.otif_target || 95;

    findings.push({
      title: otif >= target ? 'OTIF acima da meta' : 'OTIF abaixo da meta',
      description: `Performance OTIF de ${otif}% ${otif >= target ? 'supera' : 'não atinge'} a meta de ${target}%`,
      severity: otif >= target ? 'positive' : 'negative',
      impact: 'high',
      evidence: { otif, target, gap: target - otif }
    });
  }

  return findings;
}

function generateConclusions(type: string, results: any[], context: any): string[] {
  return [
    'Análise identificou oportunidades claras de melhoria',
    'Recomendações priorizadas por impacto e esforço',
    'Monitoramento contínuo recomendado para validar melhorias'
  ];
}

function describeMethodology(type: string, context: any): string {
  return `Metodologia ${type} aplicada com base em padrões da indústria ${context.domain || 'genérica'}. ` +
         `Benchmarks e indicadores alinhados com melhores práticas do setor.`;
}

/**
 * Create actionable recommendations
 */
function createActionPlan(
  analysisType: string,
  results: any[],
  context: any
): ActionPlan {

  const quickWins: Action[] = [];
  const strategicActions: Action[] = [];
  const monitoringPoints: string[] = [];

  if (analysisType.includes('otif')) {
    quickWins.push({
      title: 'Reduzir lead time de digitação',
      description: 'Implementar processo automatizado de entrada de pedidos',
      expectedImpact: 'Redução de 5-7 dias no ciclo total',
      priority: 'high',
      effort: 'medium'
    });

    strategicActions.push({
      title: 'Revisar SLA com transportadoras',
      description: 'Renegociar prazos e performance mínima com carriers',
      expectedImpact: 'Melhoria de 15-20pp no On Time',
      priority: 'high',
      effort: 'high'
    });

    monitoringPoints.push('OTIF semanal por transportadora');
    monitoringPoints.push('Lead time médio de processamento');
    monitoringPoints.push('Taxa de devolução por cliente');
  }

  return {
    quickWins,
    strategicActions,
    monitoringPoints
  };
}
