/**
 * ANALYTICS INTEGRATION MODULE
 * Provides backward-compatible wrapper for chat-analyze to use new contracts
 * Allows gradual migration without breaking existing functionality
 */

import type { DataCard, ValidationReport, NarrativeDoc, VizSpec } from './analytics-contracts.ts';
import { buildDataCard, detectDomain, enrichDataCardWithValidation } from './datacard-builder.ts';
import { createValidationReport, extractQualityScore, extractAnomalies } from '../analyze-file/validation-adapter.ts';
import { toNarrativeDoc, formatNarrativeDocForDisplay } from '../analyze-file/narrative-adapter.ts';
import { toVizSpecArray, toLegacyChartFormat } from '../analyze-file/visualization-adapter.ts';

/**
 * Enhanced data profiling that returns DataCard
 */
export async function profileDataset(
  dataset_id: string,
  sampleRows: any[],
  columns: string[],
  totalRows: number,
  columnTypes: Record<string, string>,
  stats: Record<string, any>
): Promise<DataCard> {
  // Build base DataCard from legacy format
  const legacySample = {
    columns,
    sample_rows: sampleRows,
    total_rows: totalRows,
    column_types: columnTypes,
    stats,
  };

  let dataCard = buildDataCard(dataset_id, legacySample);

  // Detect domain
  dataCard.detected_domain = detectDomain(dataCard.columns);

  // Run validation if sample is large enough
  if (sampleRows.length >= 10) {
    try {
      const schema = dataCard.columns.map(col => ({
        name: col.name,
        type: col.type,
      }));

      const validationReport = await createValidationReport(
        sampleRows,
        columns,
        schema
      );

      const qualityScore = extractQualityScore(validationReport);
      const anomalies = extractAnomalies(validationReport);
      const issuesCount = validationReport.checks.filter(c => !c.passed).length;
      const outliersCount = validationReport.checks.filter(c =>
        c.check_name.includes('outlier')
      ).length;

      dataCard = enrichDataCardWithValidation(
        dataCard,
        qualityScore,
        issuesCount,
        outliersCount
      );

      // Store anomalies in DataCard (will be used in narrative)
      (dataCard as any).detected_anomalies = anomalies;
    } catch (error) {
      console.warn('[Analytics] Validation failed:', error);
      // Continue without validation
    }
  }

  return dataCard;
}

/**
 * Convert analysis results to structured contracts
 */
export function structureAnalysisResults(
  interpretation: any,
  dataCard: DataCard,
  exec_id: string
): {
  narrative: NarrativeDoc;
  vizSpecs: VizSpec[];
  legacyFormat: any; // For backward compatibility
} {
  // Convert narrative (reuse existing narrative-engine output)
  let narrative: NarrativeDoc;

  try {
    // Check if interpretation has enhanced narrative structure
    if (interpretation.enhancedNarrative) {
      narrative = toNarrativeDoc(
        interpretation.enhancedNarrative,
        [exec_id],
        dataCard.detected_domain || 'generic',
        dataCard.qualityScore
      );
    } else {
      // Create simple narrative from legacy format
      narrative = createSimpleNarrative(
        interpretation,
        [exec_id],
        dataCard.detected_domain || 'generic',
        dataCard.qualityScore
      );
    }
  } catch (error) {
    console.warn('[Analytics] Narrative conversion failed:', error);
    narrative = createFallbackNarrative(interpretation, exec_id);
  }

  // Convert visualizations
  let vizSpecs: VizSpec[] = [];

  try {
    if (interpretation.charts && Array.isArray(interpretation.charts)) {
      vizSpecs = toVizSpecArray(interpretation.charts, exec_id);
    }
  } catch (error) {
    console.warn('[Analytics] Visualization conversion failed:', error);
  }

  // Maintain legacy format for backward compatibility
  const legacyFormat = {
    summary: interpretation.summary,
    insights: interpretation.insights || [],
    calculations: interpretation.calculations || [],
    charts: vizSpecs.map(toLegacyChartFormat),
    recommendations: interpretation.recommendations || [],
  };

  return {
    narrative,
    vizSpecs,
    legacyFormat,
  };
}

/**
 * Create simple narrative from legacy interpretation
 */
function createSimpleNarrative(
  interpretation: any,
  exec_ids: string[],
  domain: 'logistics' | 'sales' | 'hr' | 'financial' | 'generic',
  qualityScore: number
): NarrativeDoc {
  const { v4: uuidv4 } = await import('https://esm.sh/uuid@9.0.0');

  const sections = [];
  let order = 0;

  if (interpretation.summary) {
    sections.push({
      section_id: uuidv4(),
      type: 'introduction' as const,
      title: 'Resumo',
      content: interpretation.summary,
      exec_ids_ref: exec_ids,
      order: order++,
    });
  }

  if (interpretation.insights && interpretation.insights.length > 0) {
    const insightsContent = interpretation.insights
      .map((insight: any, idx: number) => `${idx + 1}. ${insight}`)
      .join('\n');

    sections.push({
      section_id: uuidv4(),
      type: 'key_findings' as const,
      title: 'Principais Insights',
      content: insightsContent,
      exec_ids_ref: exec_ids,
      order: order++,
    });
  }

  if (interpretation.recommendations && interpretation.recommendations.length > 0) {
    const recsContent = interpretation.recommendations
      .map((rec: any, idx: number) => `${idx + 1}. ${rec}`)
      .join('\n');

    sections.push({
      section_id: uuidv4(),
      type: 'recommendations' as const,
      title: 'Recomendações',
      content: recsContent,
      order: order++,
    });
  }

  return {
    doc_id: uuidv4(),
    sections,
    exec_ids_used: exec_ids,
    metadata: {
      domain,
      quality_score: qualityScore,
      confidence_level: qualityScore >= 85 ? 'high' : qualityScore >= 70 ? 'medium' : 'low',
      limitations: [],
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * Create fallback narrative when conversion fails
 */
function createFallbackNarrative(interpretation: any, exec_id: string): NarrativeDoc {
  const { v4: uuidv4 } = await import('https://esm.sh/uuid@9.0.0');

  return {
    doc_id: uuidv4(),
    sections: [{
      section_id: uuidv4(),
      type: 'introduction',
      title: 'Análise',
      content: JSON.stringify(interpretation, null, 2),
      order: 0,
    }],
    exec_ids_used: [exec_id],
    metadata: {
      domain: 'generic',
      quality_score: 50,
      confidence_level: 'low',
      limitations: ['Erro na conversão de narrativa'],
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * Get DataCard quality summary for user display
 */
export function getDataCardSummary(dataCard: DataCard): string {
  const score = dataCard.qualityScore;
  const emoji = score >= 90 ? '✅' : score >= 70 ? '⚠️' : '🔴';

  let summary = `${emoji} **Qualidade dos Dados:** ${score}/100\n`;
  summary += `📊 **Total de Linhas:** ${dataCard.totalRows.toLocaleString('pt-BR')}\n`;
  summary += `📋 **Colunas:** ${dataCard.columns.length}\n`;
  summary += `🎯 **Completude:** ${dataCard.stats.completeness_pct}%\n`;

  if (dataCard.detected_domain) {
    const domainNames = {
      logistics: 'Logística',
      sales: 'Vendas',
      hr: 'Recursos Humanos',
      financial: 'Financeiro',
      generic: 'Genérico',
    };
    summary += `🏷️ **Domínio:** ${domainNames[dataCard.detected_domain]}\n`;
  }

  if ((dataCard as any).detected_anomalies?.length > 0) {
    summary += `\n⚠️ **Anomalias Detectadas:**\n`;
    (dataCard as any).detected_anomalies.slice(0, 3).forEach((anomaly: string) => {
      summary += `- ${anomaly}\n`;
    });
  }

  return summary;
}
