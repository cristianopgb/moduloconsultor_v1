/**
 * ===================================================================
 * SAFE EXPLORATORY FALLBACK - Narrative-Based Analysis
 * ===================================================================
 *
 * Provides a safe fallback when no playbook is compatible (score < 80%).
 * Generates basic exploratory analysis without making assumptions.
 *
 * This is the safety net that prevents empty results.
 * ===================================================================
 */

import type { Column } from './schema-validator.ts';

export interface FallbackAnalysisResult {
  playbook_id: 'generic_exploratory_v1';
  fallback_reason: string;
  analysis: {
    executive_summary: string;
    key_findings: string;
    recommendations: string;
    limitations: string;
  };
  metadata: {
    row_count: number;
    column_count: number;
    numeric_columns: number;
    date_columns: number;
    text_columns: number;
  };
}

/**
 * Generate safe exploratory analysis
 */
export function generateSafeExploratoryAnalysis(
  schema: Column[],
  sampleData: any[],
  fallbackReason: string
): FallbackAnalysisResult {

  console.log('[SafeExploratoryFallback] Generating safe exploratory analysis');
  console.log(`[SafeExploratoryFallback] Reason: ${fallbackReason}`);

  const metadata = analyzeSchema(schema, sampleData);

  const analysis = {
    executive_summary: generateExecutiveSummary(metadata, sampleData),
    key_findings: generateKeyFindings(schema, sampleData, metadata),
    recommendations: generateRecommendations(schema, metadata),
    limitations: generateLimitations(fallbackReason)
  };

  return {
    playbook_id: 'generic_exploratory_v1',
    fallback_reason,
    analysis,
    metadata
  };
}

/**
 * Analyze schema metadata
 */
function analyzeSchema(schema: Column[], sampleData: any[]): {
  row_count: number;
  column_count: number;
  numeric_columns: number;
  date_columns: number;
  text_columns: number;
  boolean_columns: number;
} {

  const numericCols = schema.filter(col =>
    col.inferred_type === 'numeric' || col.type === 'numeric'
  ).length;

  const dateCols = schema.filter(col =>
    col.inferred_type === 'date' || col.type === 'date'
  ).length;

  const textCols = schema.filter(col =>
    col.inferred_type === 'text' || col.type === 'text'
  ).length;

  const booleanCols = schema.filter(col =>
    col.inferred_type === 'boolean' || col.type === 'boolean'
  ).length;

  return {
    row_count: sampleData.length,
    column_count: schema.length,
    numeric_columns: numericCols,
    date_columns: dateCols,
    text_columns: textCols,
    boolean_columns: booleanCols
  };
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(
  metadata: any,
  sampleData: any[]
): string {

  let summary = '## 📊 Sumário Executivo\n\n';
  summary += `Esta é uma análise exploratória básica do dataset fornecido.\n\n`;

  summary += `**Visão Geral dos Dados:**\n`;
  summary += `- Total de registros: ${metadata.row_count}\n`;
  summary += `- Total de colunas: ${metadata.column_count}\n`;
  summary += `- Colunas numéricas: ${metadata.numeric_columns}\n`;
  summary += `- Colunas de data: ${metadata.date_columns}\n`;
  summary += `- Colunas de texto: ${metadata.text_columns}\n\n`;

  if (metadata.row_count < 20) {
    summary += `⚠️ **Atenção:** O dataset tem apenas ${metadata.row_count} registros. `;
    summary += `Para análises mais robustas, recomenda-se no mínimo 20 registros.\n\n`;
  }

  if (metadata.numeric_columns === 0) {
    summary += `ℹ️ Não foram encontradas colunas numéricas. Análises quantitativas não estão disponíveis.\n\n`;
  }

  if (metadata.date_columns === 0) {
    summary += `ℹ️ Não foram encontradas colunas de data. Análises temporais não estão disponíveis.\n\n`;
  }

  return summary;
}

/**
 * Generate key findings
 */
function generateKeyFindings(
  schema: Column[],
  sampleData: any[],
  metadata: any
): string {

  let findings = '## 🔍 Achados-Chave\n\n';

  // Analyze numeric columns
  const numericCols = schema.filter(col =>
    col.inferred_type === 'numeric' || col.type === 'numeric'
  );

  if (numericCols.length > 0) {
    findings += '### Colunas Numéricas\n\n';

    numericCols.slice(0, 5).forEach(col => {
      const values = sampleData
        .map(row => Number(row[col.name]))
        .filter(v => !isNaN(v) && v !== null);

      if (values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const stdDev = calculateStdDev(values);

        findings += `**${col.name}:**\n`;
        findings += `- Média: ${avg.toFixed(2)}\n`;
        findings += `- Mínimo: ${min.toFixed(2)}\n`;
        findings += `- Máximo: ${max.toFixed(2)}\n`;
        findings += `- Desvio padrão: ${stdDev.toFixed(2)}\n`;
        findings += `- Valores únicos: ${new Set(values).size}\n\n`;
      }
    });
  }

  // Analyze text columns (categoricals)
  const textCols = schema.filter(col =>
    col.inferred_type === 'text' || col.type === 'text'
  );

  if (textCols.length > 0) {
    findings += '### Colunas Categóricas\n\n';

    textCols.slice(0, 3).forEach(col => {
      const values = sampleData
        .map(row => row[col.name])
        .filter(v => v !== null && v !== undefined && v !== '');

      const uniqueCount = new Set(values).size;
      const cardinality = values.length > 0 ? (uniqueCount / values.length) : 0;

      findings += `**${col.name}:**\n`;
      findings += `- Valores únicos: ${uniqueCount}\n`;
      findings += `- Cardinalidade: ${(cardinality * 100).toFixed(1)}%\n`;

      // Show top values if low cardinality
      if (uniqueCount <= 10 && uniqueCount > 0) {
        const freq = new Map<string, number>();
        values.forEach(v => {
          const key = String(v);
          freq.set(key, (freq.get(key) || 0) + 1);
        });

        const topValues = Array.from(freq.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        findings += `- Top valores: ${topValues.map(([v, c]) => `${v} (${c})`).join(', ')}\n`;
      }

      findings += '\n';
    });
  }

  return findings;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Generate recommendations
 */
function generateRecommendations(schema: Column[], metadata: any): string {
  let recommendations = '## 💡 Recomendações\n\n';

  const suggestions: string[] = [];

  // Check for missing date columns
  if (metadata.date_columns === 0) {
    suggestions.push(
      '📅 **Adicione uma coluna de data** para habilitar análises de tendências temporais, ' +
      'sazonalidade e evolução ao longo do tempo.'
    );
  }

  // Check for missing numeric columns
  if (metadata.numeric_columns < 2) {
    suggestions.push(
      '📊 **Adicione mais colunas numéricas** para habilitar análises de correlação ' +
      'e comparações quantitativas entre variáveis.'
    );
  }

  // Check for low row count
  if (metadata.row_count < 50) {
    suggestions.push(
      `📈 **Colete mais dados** (atual: ${metadata.row_count} registros). Para análises ` +
      'estatisticamente significativas, recomenda-se no mínimo 50-100 registros.'
    );
  }

  // Check for high cardinality text columns
  const highCardinalityCols = schema.filter(col => {
    if (col.inferred_type !== 'text') return false;
    const sampleCount = (col.sample_values || []).length;
    const uniqueCount = new Set(col.sample_values).size;
    return sampleCount > 0 && (uniqueCount / sampleCount) > 0.9;
  });

  if (highCardinalityCols.length > 0) {
    suggestions.push(
      `🏷️ **Normalize colunas categóricas**: As colunas [${highCardinalityCols.map(c => c.name).join(', ')}] ` +
      'têm cardinalidade muito alta. Considere agrupá-las em categorias para análises mais significativas.'
    );
  }

  if (suggestions.length === 0) {
    recommendations += 'O dataset está adequado para análises exploratórias básicas. ';
    recommendations += 'Para análises mais avançadas, consulte a seção de Limitações abaixo.\n\n';
  } else {
    recommendations += 'Para obter análises mais completas e insights profundos:\n\n';
    suggestions.forEach((suggestion, idx) => {
      recommendations += `${idx + 1}. ${suggestion}\n\n`;
    });
  }

  return recommendations;
}

/**
 * Generate limitations
 */
function generateLimitations(fallbackReason: string): string {
  let limitations = '## ⚠️ Limitações & Próximos Passos\n\n';

  limitations += `**Por que esta análise é exploratória?**\n\n`;
  limitations += `${fallbackReason}\n\n`;

  limitations += `**Análises não disponíveis neste momento:**\n\n`;
  limitations += `- Análises específicas de domínio (estoque, vendas, logística, etc.)\n`;
  limitations += `- Modelos preditivos e forecasting\n`;
  limitations += `- Análises estatísticas avançadas\n`;
  limitations += `- Benchmarking e comparações setoriais\n\n`;

  limitations += `**Como desbloquear análises avançadas:**\n\n`;
  limitations += `1. Certifique-se de que seu dataset contém as colunas necessárias para o tipo de análise desejado\n`;
  limitations += `2. Verifique os tipos de dados (datas devem estar no formato correto, números não devem conter texto)\n`;
  limitations += `3. Forneça um dataset com pelo menos 20-50 registros para análises robustas\n`;
  limitations += `4. Consulte a documentação de playbooks disponíveis para ver os requisitos específicos\n\n`;

  limitations += `💡 **Dica:** Esta análise exploratória serve como ponto de partida. `;
  limitations += `Enriqueça seu dataset seguindo as recomendações acima para obter insights mais profundos.\n`;

  return limitations;
}

/**
 * Format fallback analysis for output
 */
export function formatFallbackAnalysis(analysis: FallbackAnalysisResult): string {
  let output = '';

  output += analysis.analysis.executive_summary + '\n\n';
  output += analysis.analysis.key_findings + '\n\n';
  output += analysis.analysis.recommendations + '\n\n';
  output += analysis.analysis.limitations + '\n\n';

  output += '---\n\n';
  output += `**Tipo de Análise:** Exploratória Genérica (Fallback)\n`;
  output += `**Playbook:** ${analysis.playbook_id}\n`;
  output += `**Motivo do Fallback:** ${analysis.fallback_reason}\n`;

  return output;
}
