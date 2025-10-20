/**
 * NARRATIVE ENGINE - Manus-Style Storytelling
 *
 * Transforms raw data analysis into compelling business narratives.
 * Mimics the Manus AI approach: contextualized introduction, investigation,
 * diagnosis, and actionable recommendations.
 */

export interface NarrativeContext {
  domain: string; // 'logistics', 'sales', 'hr', 'financial', 'generic'
  userGoals?: string[];
  timeframe?: { start?: string; end?: string };
  benchmarks?: Record<string, number>;
  industryContext?: string;
  companyContext?: string;
}

export interface AnalysisResults {
  summary: string;
  insights: string[];
  recommendations?: string[];
  charts?: any[];
  metadata?: {
    totalRows: number;
    qualityScore?: number;
    issuesFound?: number;
    anomaliesDetected?: string[];
  };
}

export interface EnhancedNarrative {
  introduction: string;
  situationOverview: string;
  keyFindings: Finding[];
  deepDiveInvestigation: Investigation[];
  diagnosis: Diagnosis;
  recommendations: Recommendation[];
  conclusion: string;
  nextSteps: string[];
}

export interface Finding {
  title: string;
  description: string;
  severity: 'critical' | 'important' | 'notable' | 'positive';
  impact: string;
  metrics: Record<string, any>;
}

export interface Investigation {
  question: string;
  findings: string[];
  evidence: string[];
  conclusion: string;
}

export interface Diagnosis {
  rootCauses: string[];
  contributingFactors: string[];
  patterns: string[];
  risks: string[];
  opportunities: string[];
}

export interface Recommendation {
  priority: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  title: string;
  description: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  dependencies?: string[];
}

/**
 * Benchmark library by industry and metric
 */
const BENCHMARKS = {
  logistics: {
    otif: { excellent: 95, good: 90, acceptable: 85, poor: 80 },
    on_time: { excellent: 98, good: 95, acceptable: 90, poor: 85 },
    in_full: { excellent: 98, good: 95, acceptable: 92, poor: 88 },
    lead_time_days: { excellent: 2, good: 3, acceptable: 5, poor: 7 },
    return_rate: { excellent: 1, good: 2, acceptable: 3, poor: 5 }
  },
  sales: {
    conversion_rate: { excellent: 5, good: 3, acceptable: 2, poor: 1 },
    avg_order_value: { excellent: 500, good: 300, acceptable: 200, poor: 100 },
    customer_retention: { excellent: 90, good: 80, acceptable: 70, poor: 60 },
    sales_growth_pct: { excellent: 20, good: 15, acceptable: 10, poor: 5 }
  },
  hr: {
    turnover_rate: { excellent: 5, good: 10, acceptable: 15, poor: 20 },
    employee_satisfaction: { excellent: 85, good: 75, acceptable: 65, poor: 55 },
    time_to_hire_days: { excellent: 20, good: 30, acceptable: 45, poor: 60 },
    training_completion: { excellent: 95, good: 85, acceptable: 75, poor: 65 }
  },
  financial: {
    profit_margin_pct: { excellent: 20, good: 15, acceptable: 10, poor: 5 },
    revenue_growth_pct: { excellent: 25, good: 15, acceptable: 10, poor: 5 },
    cash_flow_ratio: { excellent: 1.5, good: 1.2, acceptable: 1.0, poor: 0.8 },
    debt_to_equity: { excellent: 0.3, good: 0.5, acceptable: 0.8, poor: 1.2 }
  }
};

/**
 * Generate Manus-style narrative from analysis results
 */
export function generateManusNarrative(
  results: AnalysisResults,
  context: NarrativeContext,
  queryResults: any[]
): EnhancedNarrative {
  console.log('[NarrativeEngine] Generating Manus-style narrative');

  const introduction = createContextualizedIntroduction(context, results);
  const situationOverview = createSituationOverview(results, queryResults, context);
  const keyFindings = extractKeyFindings(results, queryResults, context);
  const investigation = conductDeepDive(keyFindings, queryResults, context);
  const diagnosis = performDiagnosis(keyFindings, investigation, context);
  const recommendations = generateActionableRecommendations(diagnosis, keyFindings, context);
  const conclusion = createConclusion(diagnosis, recommendations, context);
  const nextSteps = defineNextSteps(recommendations);

  return {
    introduction,
    situationOverview,
    keyFindings,
    deepDiveInvestigation: investigation,
    diagnosis,
    recommendations,
    conclusion,
    nextSteps
  };
}

/**
 * Create contextualized introduction (like Manus does)
 */
function createContextualizedIntroduction(
  context: NarrativeContext,
  results: AnalysisResults
): string {
  const { domain, userGoals, timeframe, metadata } = context;

  let intro = '';

  // Domain-specific opening
  const domainIntros = {
    logistics: '📦 **Análise de Performance Logística**\n\n',
    sales: '💰 **Análise de Desempenho Comercial**\n\n',
    hr: '👥 **Análise de Recursos Humanos**\n\n',
    financial: '💼 **Análise Financeira**\n\n',
    generic: '📊 **Análise de Dados**\n\n'
  };

  intro += domainIntros[domain as keyof typeof domainIntros] || domainIntros.generic;

  // Context about the analysis scope
  if (metadata?.totalRows) {
    intro += `Esta análise examinou **${metadata.totalRows.toLocaleString('pt-BR')} registros** `;
  }

  if (timeframe?.start || timeframe?.end) {
    const period = timeframe.start && timeframe.end
      ? `do período ${timeframe.start} a ${timeframe.end}`
      : timeframe.start
      ? `a partir de ${timeframe.start}`
      : `até ${timeframe.end}`;
    intro += period;
  } else {
    intro += 'do dataset completo';
  }

  intro += '.\n\n';

  // Quality context
  if (metadata?.qualityScore !== undefined) {
    if (metadata.qualityScore >= 90) {
      intro += `✅ **Qualidade dos Dados:** Excelente (${metadata.qualityScore}/100)\n`;
    } else if (metadata.qualityScore >= 70) {
      intro += `⚠️ **Qualidade dos Dados:** Boa (${metadata.qualityScore}/100) - algumas correções aplicadas\n`;
    } else {
      intro += `🔴 **Qualidade dos Dados:** Requer atenção (${metadata.qualityScore}/100) - múltiplas correções necessárias\n`;
    }
  }

  // Anomalies detected
  if (metadata?.anomaliesDetected && metadata.anomaliesDetected.length > 0) {
    intro += `\n🔍 **Anomalias Detectadas:** ${metadata.anomaliesDetected.length} problema(s) identificado(s) automaticamente\n`;
  }

  // User goals
  if (userGoals && userGoals.length > 0) {
    intro += `\n🎯 **Objetivos da Análise:**\n`;
    userGoals.forEach(goal => {
      intro += `- ${goal}\n`;
    });
  }

  return intro.trim();
}

/**
 * Create high-level situation overview
 */
function createSituationOverview(
  results: AnalysisResults,
  queryResults: any[],
  context: NarrativeContext
): string {
  let overview = '## 📋 Visão Geral da Situação\n\n';

  // Extract key metrics from query results
  const metrics = extractMainMetrics(queryResults);

  if (metrics.length === 0) {
    overview += results.summary || 'Análise processada com sucesso.';
    return overview;
  }

  // Present main metrics with context
  overview += 'Os dados revelam o seguinte panorama:\n\n';

  metrics.forEach((metric, idx) => {
    const benchmark = getBenchmark(metric.name, metric.value, context.domain);
    const emoji = benchmark.status === 'excellent' ? '🟢' :
                  benchmark.status === 'good' ? '🔵' :
                  benchmark.status === 'acceptable' ? '🟡' : '🔴';

    overview += `${emoji} **${metric.label}:** ${formatMetricValue(metric.value, metric.type)}`;

    if (benchmark.comparison) {
      overview += ` (${benchmark.comparison})`;
    }

    overview += '\n';
  });

  // Add context about performance
  const performanceLevel = assessOverallPerformance(metrics, context.domain);
  overview += `\n**Avaliação Geral:** ${performanceLevel.description}\n`;

  return overview;
}

/**
 * Extract key findings with severity and impact
 */
function extractKeyFindings(
  results: AnalysisResults,
  queryResults: any[],
  context: NarrativeContext
): Finding[] {
  const findings: Finding[] = [];

  // Extract from insights
  if (results.insights && results.insights.length > 0) {
    results.insights.forEach((insight, idx) => {
      // 🔥 FIX: Ensure insight is a string (might be object or number from LLM)
      const insightText = typeof insight === 'string' ? insight : String(insight || '');

      if (!insightText || insightText.trim().length === 0) {
        console.warn(`[extractKeyFindings] Skipping empty insight at index ${idx}`);
        return; // Skip empty insights
      }

      const severity = determineSeverity(insightText, queryResults, context);
      const impact = estimateImpact(insightText, context);

      findings.push({
        title: `Insight ${idx + 1}`,
        description: insightText,
        severity,
        impact,
        metrics: {}
      });
    });
  }

  // Add findings from anomalies
  if (results.metadata?.anomaliesDetected) {
    results.metadata.anomaliesDetected.forEach((anomaly, idx) => {
      findings.push({
        title: `Anomalia Detectada`,
        description: anomaly,
        severity: 'critical',
        impact: 'Pode distorcer análises e decisões se não corrigido',
        metrics: {}
      });
    });
  }

  return findings;
}

/**
 * Conduct deep dive investigation (Manus-style)
 */
function conductDeepDive(
  findings: Finding[],
  queryResults: any[],
  context: NarrativeContext
): Investigation[] {
  const investigations: Investigation[] = [];

  // For each critical finding, investigate deeper
  const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'important');

  criticalFindings.forEach(finding => {
    const investigation: Investigation = {
      question: `Por que ${finding.title.toLowerCase()}?`,
      findings: [],
      evidence: [],
      conclusion: ''
    };

    // Domain-specific investigation patterns
    if (context.domain === 'logistics' && finding.description.toLowerCase().includes('otif')) {
      investigation.question = 'O que está causando a baixa performance OTIF?';
      investigation.findings = [
        'Analisando componentes On-Time e In-Full separadamente',
        'Investigando padrões por transportadora',
        'Verificando tendências ao longo do tempo'
      ];
      investigation.evidence = extractEvidenceFromResults(queryResults, ['on_time', 'in_full', 'transportadora']);
      investigation.conclusion = 'A investigação indica que o problema está concentrado em [componente específico]';
    }

    if (investigation.findings.length > 0) {
      investigations.push(investigation);
    }
  });

  return investigations;
}

/**
 * Perform root cause diagnosis
 */
function performDiagnosis(
  findings: Finding[],
  investigations: Investigation[],
  context: NarrativeContext
): Diagnosis {
  const diagnosis: Diagnosis = {
    rootCauses: [],
    contributingFactors: [],
    patterns: [],
    risks: [],
    opportunities: []
  };

  // Identify root causes from critical findings
  const critical = findings.filter(f => f.severity === 'critical');
  if (critical.length > 0) {
    diagnosis.rootCauses = critical.map(f =>
      `${f.title}: ${f.description.substring(0, 100)}...`
    );
  }

  // Identify patterns
  if (findings.length > 2) {
    diagnosis.patterns.push('Múltiplos problemas identificados - pode indicar questão sistêmica');
  }

  // Domain-specific patterns
  if (context.domain === 'logistics') {
    diagnosis.patterns.push('Performance logística abaixo dos benchmarks da indústria');
  } else if (context.domain === 'sales') {
    diagnosis.patterns.push('Oportunidades de otimização no funil de vendas');
  }

  // Identify risks
  if (critical.length > 0) {
    diagnosis.risks.push('Problemas críticos podem impactar operação se não tratados');
  }

  // Identify opportunities
  const positive = findings.filter(f => f.severity === 'positive');
  if (positive.length > 0) {
    diagnosis.opportunities = positive.map(f => f.description);
  }

  return diagnosis;
}

/**
 * Generate actionable recommendations (prioritized)
 */
function generateActionableRecommendations(
  diagnosis: Diagnosis,
  findings: Finding[],
  context: NarrativeContext
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Immediate actions for critical issues
  diagnosis.rootCauses.forEach(cause => {
    recommendations.push({
      priority: 'immediate',
      title: 'Ação Corretiva Imediata',
      description: `Tratar ${cause}`,
      expectedImpact: 'Resolução de problema crítico',
      effort: 'high'
    });
  });

  // Short-term improvements
  if (context.domain === 'logistics') {
    recommendations.push({
      priority: 'short-term',
      title: 'Otimizar Processo de Entrega',
      description: 'Revisar rotas, transportadoras e processos de distribuição',
      expectedImpact: 'Melhoria de 5-10% em OTIF',
      effort: 'medium'
    });
  }

  // Medium-term strategic actions
  recommendations.push({
    priority: 'medium-term',
    title: 'Implementar Monitoramento Contínuo',
    description: 'Estabelecer dashboard com métricas-chave e alertas automáticos',
    expectedImpact: 'Detecção precoce de problemas',
    effort: 'medium'
  });

  // Long-term initiatives
  recommendations.push({
    priority: 'long-term',
    title: 'Programa de Melhoria Contínua',
    description: 'Estabelecer cultura de análise de dados e otimização contínua',
    expectedImpact: 'Excelência operacional sustentável',
    effort: 'high'
  });

  return recommendations;
}

/**
 * Create compelling conclusion
 */
function createConclusion(
  diagnosis: Diagnosis,
  recommendations: Recommendation[],
  context: NarrativeContext
): string {
  let conclusion = '## 🎯 Conclusão\n\n';

  // Summarize diagnosis
  if (diagnosis.rootCauses.length > 0) {
    conclusion += `Esta análise identificou **${diagnosis.rootCauses.length} causa(s) raiz** que requerem atenção imediata. `;
  }

  if (diagnosis.opportunities.length > 0) {
    conclusion += `Também foram identificadas **${diagnosis.opportunities.length} oportunidade(s)** de melhoria. `;
  }

  conclusion += '\n\n';

  // Call to action
  const immediateActions = recommendations.filter(r => r.priority === 'immediate');
  if (immediateActions.length > 0) {
    conclusion += `⚠️ **Ação Imediata Requerida:** ${immediateActions.length} ação(ões) crítica(s) necessita(m) de atenção urgente.\n\n`;
  }

  // Outlook
  conclusion += 'Com a implementação das recomendações propostas, espera-se:\n';
  conclusion += `- Resolução dos problemas críticos identificados\n`;
  conclusion += `- Melhoria mensurável nas métricas-chave\n`;
  conclusion += `- Estabelecimento de base sólida para crescimento sustentável\n`;

  return conclusion;
}

/**
 * Define clear next steps
 */
function defineNextSteps(recommendations: Recommendation[]): string[] {
  const steps: string[] = [];

  // Prioritize by urgency
  const sorted = [...recommendations].sort((a, b) => {
    const priority = { immediate: 0, 'short-term': 1, 'medium-term': 2, 'long-term': 3 };
    return priority[a.priority] - priority[b.priority];
  });

  sorted.slice(0, 5).forEach((rec, idx) => {
    steps.push(`${idx + 1}. **[${rec.priority.toUpperCase()}]** ${rec.title}: ${rec.description}`);
  });

  return steps;
}

// Helper functions

function extractMainMetrics(queryResults: any[]): Array<{ name: string; label: string; value: any; type: string }> {
  if (!queryResults || queryResults.length === 0) return [];

  const metrics: Array<{ name: string; label: string; value: any; type: string }> = [];
  const firstRow = queryResults[0];

  for (const [key, value] of Object.entries(firstRow)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('otif')) {
      metrics.push({ name: 'otif', label: 'OTIF', value, type: 'percentage' });
    } else if (lowerKey.includes('total') || lowerKey.includes('sum')) {
      metrics.push({ name: key, label: key, value, type: 'number' });
    } else if (lowerKey.includes('avg') || lowerKey.includes('media')) {
      metrics.push({ name: key, label: key, value, type: 'number' });
    }
  }

  return metrics.slice(0, 5); // Top 5 metrics
}

function getBenchmark(metricName: string, value: number, domain: string): {
  status: 'excellent' | 'good' | 'acceptable' | 'poor';
  comparison: string;
} {
  const benchmarks = BENCHMARKS[domain as keyof typeof BENCHMARKS];
  if (!benchmarks) return { status: 'acceptable', comparison: '' };

  const metricBenchmarks = (benchmarks as any)[metricName];
  if (!metricBenchmarks) return { status: 'acceptable', comparison: '' };

  if (value >= metricBenchmarks.excellent) {
    return { status: 'excellent', comparison: 'excelente, acima do benchmark' };
  } else if (value >= metricBenchmarks.good) {
    return { status: 'good', comparison: 'bom desempenho' };
  } else if (value >= metricBenchmarks.acceptable) {
    return { status: 'acceptable', comparison: 'aceitável, com espaço para melhoria' };
  } else {
    return { status: 'poor', comparison: 'abaixo do esperado, requer atenção' };
  }
}

function formatMetricValue(value: any, type: string): string {
  if (type === 'percentage') {
    return `${Number(value).toFixed(1)}%`;
  } else if (type === 'number') {
    return Number(value).toLocaleString('pt-BR');
  }
  return String(value);
}

function assessOverallPerformance(metrics: any[], domain: string): { level: string; description: string } {
  // Simple heuristic - can be made more sophisticated
  const excellentCount = metrics.filter(m => {
    const bench = getBenchmark(m.name, m.value, domain);
    return bench.status === 'excellent';
  }).length;

  const poorCount = metrics.filter(m => {
    const bench = getBenchmark(m.name, m.value, domain);
    return bench.status === 'poor';
  }).length;

  if (excellentCount >= metrics.length * 0.7) {
    return { level: 'excellent', description: '🟢 Performance excelente - operação está acima dos padrões da indústria' };
  } else if (poorCount >= metrics.length * 0.5) {
    return { level: 'poor', description: '🔴 Performance crítica - ação corretiva urgente necessária' };
  } else {
    return { level: 'good', description: '🟡 Performance satisfatória - oportunidades de otimização identificadas' };
  }
}

function determineSeverity(insight: string, queryResults: any[], context: NarrativeContext): 'critical' | 'important' | 'notable' | 'positive' {
  const lower = insight.toLowerCase();

  if (lower.includes('crítico') || lower.includes('urgente') || lower.includes('grave')) {
    return 'critical';
  } else if (lower.includes('importante') || lower.includes('significativo')) {
    return 'important';
  } else if (lower.includes('positivo') || lower.includes('sucesso') || lower.includes('excelente')) {
    return 'positive';
  } else {
    return 'notable';
  }
}

function estimateImpact(insight: string, context: NarrativeContext): string {
  const lower = insight.toLowerCase();

  if (lower.includes('otif') || lower.includes('entrega')) {
    return 'Impacto direto na satisfação do cliente e custos operacionais';
  } else if (lower.includes('venda') || lower.includes('receita')) {
    return 'Impacto financeiro direto no faturamento';
  } else if (lower.includes('custo') || lower.includes('despesa')) {
    return 'Impacto na margem de lucro e sustentabilidade financeira';
  } else {
    return 'Impacto operacional relevante';
  }
}

function extractEvidenceFromResults(queryResults: any[], keywords: string[]): string[] {
  const evidence: string[] = [];

  if (queryResults.length > 0) {
    const firstRow = queryResults[0];
    keywords.forEach(keyword => {
      for (const [key, value] of Object.entries(firstRow)) {
        if (key.toLowerCase().includes(keyword)) {
          evidence.push(`${key}: ${value}`);
        }
      }
    });
  }

  return evidence.length > 0 ? evidence : ['Dados processados e analisados'];
}

/**
 * Format enhanced narrative for display
 */
export function formatNarrativeForDisplay(narrative: EnhancedNarrative): string {
  let output = '';

  output += narrative.introduction + '\n\n';
  output += narrative.situationOverview + '\n\n';

  if (narrative.keyFindings.length > 0) {
    output += '## 🔍 Principais Descobertas\n\n';
    narrative.keyFindings.forEach((finding, idx) => {
      const emoji = finding.severity === 'critical' ? '🔴' :
                    finding.severity === 'important' ? '🟡' :
                    finding.severity === 'positive' ? '🟢' : '🔵';
      output += `${emoji} **${finding.title}**\n${finding.description}\n*Impacto: ${finding.impact}*\n\n`;
    });
  }

  if (narrative.deepDiveInvestigation.length > 0) {
    output += '## 🕵️ Investigação Detalhada\n\n';
    narrative.deepDiveInvestigation.forEach(inv => {
      output += `**${inv.question}**\n${inv.conclusion}\n\n`;
    });
  }

  if (narrative.diagnosis.rootCauses.length > 0 || narrative.diagnosis.opportunities.length > 0) {
    output += '## 💡 Diagnóstico\n\n';
    if (narrative.diagnosis.rootCauses.length > 0) {
      output += '**Causas Identificadas:**\n';
      narrative.diagnosis.rootCauses.forEach(cause => {
        output += `- ${cause}\n`;
      });
      output += '\n';
    }
    if (narrative.diagnosis.opportunities.length > 0) {
      output += '**Oportunidades:**\n';
      narrative.diagnosis.opportunities.forEach(opp => {
        output += `- ${opp}\n`;
      });
      output += '\n';
    }
  }

  if (narrative.recommendations.length > 0) {
    output += '## 🎯 Recomendações\n\n';
    const grouped = {
      immediate: narrative.recommendations.filter(r => r.priority === 'immediate'),
      'short-term': narrative.recommendations.filter(r => r.priority === 'short-term'),
      'medium-term': narrative.recommendations.filter(r => r.priority === 'medium-term'),
      'long-term': narrative.recommendations.filter(r => r.priority === 'long-term')
    };

    if (grouped.immediate.length > 0) {
      output += '### ⚡ Ações Imediatas\n';
      grouped.immediate.forEach(rec => {
        output += `**${rec.title}**\n${rec.description}\n*Impacto esperado: ${rec.expectedImpact}*\n\n`;
      });
    }

    if (grouped['short-term'].length > 0) {
      output += '### 📅 Curto Prazo\n';
      grouped['short-term'].forEach(rec => {
        output += `**${rec.title}**\n${rec.description}\n*Impacto esperado: ${rec.expectedImpact}*\n\n`;
      });
    }

    if (grouped['medium-term'].length > 0 || grouped['long-term'].length > 0) {
      output += '### 🔮 Médio/Longo Prazo\n';
      [...grouped['medium-term'], ...grouped['long-term']].forEach(rec => {
        output += `**${rec.title}**\n${rec.description}\n*Impacto esperado: ${rec.expectedImpact}*\n\n`;
      });
    }
  }

  output += narrative.conclusion + '\n\n';

  if (narrative.nextSteps.length > 0) {
    output += '## 📋 Próximos Passos\n\n';
    narrative.nextSteps.forEach(step => {
      output += `${step}\n`;
    });
  }

  return output;
}
