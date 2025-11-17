/**
 * ===================================================================
 * NARRATIVE ADAPTER - Schema-Aware Narrative Generation
 * ===================================================================
 *
 * Wraps the narrative-engine with schema-aware validation.
 * Ensures generated text only references columns that exist.
 *
 * CRITICAL: Fail-hard on violations (better to error than hallucinate)
 * ===================================================================
 */

import type { Column } from './schema-validator.ts';
import type { GuardrailsResult } from './guardrails-engine.ts';

export interface NarrativeContext {
  available_columns: Column[];
  forbidden_terms: string[];
  active_sections: string[];
  disabled_sections: Array<{
    section: string;
    reason: string;
    missing_requirement: string;
    call_to_action: string;
  }>;
  metrics_map: Record<string, any>;
}

export interface InsightWithTracking {
  text: string;
  columns_used: string[];
  confidence: number;
  section: string;
}

export interface NarrativeOutput {
  executive_summary: InsightWithTracking[];
  key_findings: InsightWithTracking[];
  recommendations: InsightWithTracking[];
  limitations: string;
  column_usage_summary: Record<string, number>;
  validation_errors: string[];
}

/**
 * Generate narrative with schema-aware validation
 */
export async function generateSchemaAwareNarrative(
  analysisResults: any,
  context: NarrativeContext,
  playbookId: string
): Promise<NarrativeOutput> {

  console.log('[NarrativeAdapter] Generating schema-aware narrative');
  console.log(`[NarrativeAdapter] Available columns: ${context.available_columns.length}`);
  console.log(`[NarrativeAdapter] Forbidden terms: ${context.forbidden_terms.length}`);
  console.log(`[NarrativeAdapter] Active sections: ${context.active_sections.length}`);

  const output: NarrativeOutput = {
    executive_summary: [],
    key_findings: [],
    recommendations: [],
    limitations: '',
    column_usage_summary: {},
    validation_errors: []
  };

  // Build column name map for validation
  const columnNames = new Set(
    context.available_columns.map(col => col.name.toLowerCase())
  );

  const canonicalNames = new Set(
    context.available_columns.map(col => (col.canonical_name || col.name).toLowerCase())
  );

  // Track column usage
  const columnUsage = new Map<string, number>();

  try {
    // Generate Executive Summary
    if (context.active_sections.includes('overview')) {
      const summaryInsights = await generateOverviewInsights(
        analysisResults,
        context,
        columnNames,
        canonicalNames
      );

      for (const insight of summaryInsights) {
        // Validate insight
        const validation = validateInsight(insight, context);
        if (!validation.valid) {
          output.validation_errors.push(`Summary: ${validation.error}`);
          continue; // Skip invalid insight
        }

        output.executive_summary.push(insight);

        // Track column usage
        insight.columns_used.forEach(col => {
          columnUsage.set(col, (columnUsage.get(col) || 0) + 1);
        });
      }
    }

    // Generate Key Findings (by section)
    for (const section of context.active_sections) {
      if (section === 'overview' || section === 'limitations' || section === 'recommendations') {
        continue; // Already handled or will handle separately
      }

      const sectionInsights = await generateSectionInsights(
        analysisResults,
        section,
        context,
        columnNames,
        canonicalNames
      );

      for (const insight of sectionInsights) {
        const validation = validateInsight(insight, context);
        if (!validation.valid) {
          output.validation_errors.push(`${section}: ${validation.error}`);
          continue;
        }

        output.key_findings.push(insight);

        insight.columns_used.forEach(col => {
          columnUsage.set(col, (columnUsage.get(col) || 0) + 1);
        });
      }
    }

    // Generate Recommendations
    if (context.active_sections.includes('recommendations')) {
      const recommendations = await generateRecommendations(
        analysisResults,
        context,
        columnNames,
        canonicalNames
      );

      for (const rec of recommendations) {
        const validation = validateInsight(rec, context);
        if (!validation.valid) {
          output.validation_errors.push(`Recommendation: ${validation.error}`);
          continue;
        }

        output.recommendations.push(rec);

        rec.columns_used.forEach(col => {
          columnUsage.set(col, (columnUsage.get(col) || 0) + 1);
        });
      }
    }

    // Generate Limitations section (always present)
    output.limitations = generateLimitationsSection(context);

    // Build column usage summary
    columnUsage.forEach((count, col) => {
      output.column_usage_summary[col] = count;
    });

    console.log(`[NarrativeAdapter] Generated ${output.executive_summary.length} summary insights`);
    console.log(`[NarrativeAdapter] Generated ${output.key_findings.length} key findings`);
    console.log(`[NarrativeAdapter] Generated ${output.recommendations.length} recommendations`);
    console.log(`[NarrativeAdapter] Validation errors: ${output.validation_errors.length}`);

  } catch (error) {
    console.error('[NarrativeAdapter] Error generating narrative:', error);
    throw new Error(`Narrative generation failed: ${error.message}`);
  }

  return output;
}

/**
 * Generate overview insights
 */
async function generateOverviewInsights(
  analysisResults: any,
  context: NarrativeContext,
  columnNames: Set<string>,
  canonicalNames: Set<string>
): Promise<InsightWithTracking[]> {

  const insights: InsightWithTracking[] = [];

  // Extract key metrics from results
  const data = analysisResults.data || [];
  const rowCount = data.length;

  // Basic insight: dataset size
  insights.push({
    text: `Dataset contém ${rowCount} registros analisados.`,
    columns_used: [],
    confidence: 100,
    section: 'overview'
  });

  // Identify numeric columns for statistics
  const numericCols = context.available_columns.filter(col =>
    col.inferred_type === 'numeric' || col.type === 'numeric'
  );

  if (numericCols.length > 0) {
    const mainMetric = numericCols[0];

    // Calculate basic stats
    const values = data.map((row: any) => Number(row[mainMetric.name])).filter((v: number) => !isNaN(v));
    if (values.length > 0) {
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      insights.push({
        text: `${mainMetric.name}: média de ${avg.toFixed(2)}, variando de ${min.toFixed(2)} a ${max.toFixed(2)}.`,
        columns_used: [mainMetric.name],
        confidence: 95,
        section: 'overview'
      });
    }
  }

  return insights;
}

/**
 * Generate section-specific insights
 */
async function generateSectionInsights(
  analysisResults: any,
  section: string,
  context: NarrativeContext,
  columnNames: Set<string>,
  canonicalNames: Set<string>
): Promise<InsightWithTracking[]> {

  const insights: InsightWithTracking[] = [];

  // Example: by_category section
  if (section === 'by_category' || section.startsWith('by_')) {
    const groupByCol = findGroupByColumn(section, context.available_columns);

    if (groupByCol) {
      const data = analysisResults.data || [];
      const groups = new Map<string, number>();

      data.forEach((row: any) => {
        const groupVal = row[groupByCol.name];
        if (groupVal) {
          groups.set(groupVal, (groups.get(groupVal) || 0) + 1);
        }
      });

      if (groups.size > 0) {
        const topGroups = Array.from(groups.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        const topGroupsText = topGroups.map(([name, count]) => `${name} (${count})`).join(', ');

        insights.push({
          text: `Top 3 por ${groupByCol.name}: ${topGroupsText}.`,
          columns_used: [groupByCol.name],
          confidence: 90,
          section
        });
      }
    }
  }

  return insights;
}

/**
 * Find group-by column for section
 */
function findGroupByColumn(section: string, columns: Column[]): Column | null {
  const sectionMap: Record<string, string[]> = {
    'by_category': ['categoria', 'category', 'tipo'],
    'by_location': ['rua', 'endereco', 'localizacao', 'location'],
    'by_group': ['grupo', 'group', 'segmento'],
    'by_seller': ['vendedor', 'seller', 'representante'],
    'by_customer': ['cliente', 'customer'],
    'by_product': ['produto', 'product', 'item']
  };

  const patterns = sectionMap[section] || [];

  for (const pattern of patterns) {
    const col = columns.find(c =>
      c.name.toLowerCase().includes(pattern) ||
      (c.canonical_name || '').toLowerCase().includes(pattern)
    );
    if (col) return col;
  }

  return null;
}

/**
 * Generate recommendations
 */
async function generateRecommendations(
  analysisResults: any,
  context: NarrativeContext,
  columnNames: Set<string>,
  canonicalNames: Set<string>
): Promise<InsightWithTracking[]> {

  const recommendations: InsightWithTracking[] = [];

  // Generic recommendation based on data quality
  const data = analysisResults.data || [];

  if (data.length < 100) {
    recommendations.push({
      text: 'Considere coletar mais dados para aumentar a confiabilidade estatística da análise.',
      columns_used: [],
      confidence: 80,
      section: 'recommendations'
    });
  }

  // Recommendation based on missing columns
  if (!context.available_columns.some(c => c.inferred_type === 'date')) {
    recommendations.push({
      text: 'Adicione uma coluna de data para habilitar análise de tendências temporais e sazonalidade.',
      columns_used: [],
      confidence: 85,
      section: 'recommendations'
    });
  }

  return recommendations;
}

/**
 * Generate limitations section
 */
function generateLimitationsSection(context: NarrativeContext): string {
  if (context.disabled_sections.length === 0) {
    return '✅ **Todas as seções de análise estão disponíveis para este dataset.**\n\n' +
           'Não foram identificadas limitações significativas nos dados fornecidos.';
  }

  let output = '## ⚠️ Limitações da Análise\n\n';
  output += 'As seguintes análises não puderam ser realizadas devido a requisitos não atendidos:\n\n';

  context.disabled_sections.forEach((ds, idx) => {
    const sectionName = formatSectionName(ds.section);
    output += `**${idx + 1}. ${sectionName}**\n`;
    output += `- **Motivo:** ${ds.reason}\n`;
    output += `- **Requisito faltante:** ${ds.missing_requirement}\n`;
    output += `- ${ds.call_to_action}\n\n`;
  });

  output += '---\n\n';
  output += '💡 **Sugestão:** Enriqueça seu dataset com as colunas sugeridas acima para obter análises mais completas.\n';

  return output;
}

/**
 * Format section name for display
 */
function formatSectionName(section: string): string {
  const names: Record<string, string> = {
    'temporal_trend': 'Análise Temporal',
    'relationship': 'Análise de Correlação',
    'by_category': 'Análise por Categoria',
    'by_location': 'Análise por Localização',
    'by_group': 'Análise por Grupo',
    'overview': 'Visão Geral',
    'distribution': 'Análise de Distribuição',
    'significance': 'Análise de Significância Estatística'
  };

  return names[section] || section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Validate insight for forbidden terms and column references
 */
function validateInsight(
  insight: InsightWithTracking,
  context: NarrativeContext
): { valid: boolean; error?: string } {

  const text = insight.text.toLowerCase();

  // Check forbidden terms
  for (const term of context.forbidden_terms) {
    if (text.includes(term.toLowerCase())) {
      return {
        valid: false,
        error: `Insight contains forbidden term: "${term}"`
      };
    }
  }

  // Check that all columns_used exist
  const availableNames = new Set(
    context.available_columns.map(col => col.name.toLowerCase())
  );

  for (const colUsed of insight.columns_used) {
    if (!availableNames.has(colUsed.toLowerCase())) {
      return {
        valid: false,
        error: `Insight references non-existent column: "${colUsed}"`
      };
    }
  }

  // Check metrics dependencies
  for (const metricName in context.metrics_map) {
    const metric = context.metrics_map[metricName];
    if (text.includes(metricName.toLowerCase())) {
      // Verify dependencies are satisfied
      const deps = metric.deps || [];
      for (const dep of deps) {
        if (!availableNames.has(dep.toLowerCase())) {
          return {
            valid: false,
            error: `Metric "${metricName}" depends on missing column: "${dep}"`
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Format narrative output for final delivery
 */
export function formatNarrativeOutput(output: NarrativeOutput): string {
  let formatted = '';

  // Executive Summary
  if (output.executive_summary.length > 0) {
    formatted += '## 📊 Sumário Executivo\n\n';
    output.executive_summary.forEach(insight => {
      formatted += `- ${insight.text}\n`;
    });
    formatted += '\n';
  }

  // Key Findings
  if (output.key_findings.length > 0) {
    formatted += '## 🔍 Achados-Chave\n\n';
    output.key_findings.forEach(insight => {
      formatted += `- ${insight.text}\n`;
    });
    formatted += '\n';
  }

  // Recommendations
  if (output.recommendations.length > 0) {
    formatted += '## 💡 Recomendações\n\n';
    output.recommendations.forEach(rec => {
      formatted += `- ${rec.text}\n`;
    });
    formatted += '\n';
  }

  // Limitations
  formatted += output.limitations;

  // Column Usage Audit
  formatted += '\n\n---\n\n';
  formatted += '## 📋 Auditoria de Colunas\n\n';
  formatted += `**Colunas utilizadas na análise:** ${Object.keys(output.column_usage_summary).length}\n\n`;

  if (Object.keys(output.column_usage_summary).length > 0) {
    formatted += '| Coluna | Menções |\n';
    formatted += '|--------|--------|\n';
    Object.entries(output.column_usage_summary)
      .sort((a, b) => b[1] - a[1])
      .forEach(([col, count]) => {
        formatted += `| ${col} | ${count} |\n`;
      });
  }

  // Validation errors (if any)
  if (output.validation_errors.length > 0) {
    formatted += '\n\n---\n\n';
    formatted += '## ⚠️ Avisos de Validação\n\n';
    output.validation_errors.forEach(err => {
      formatted += `- ${err}\n`;
    });
  }

  return formatted;
}
