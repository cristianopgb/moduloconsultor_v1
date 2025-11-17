/**
 * ===================================================================
 * GUARDRAILS ENGINE - Section-Level Validation & Forbidden Terms
 * ===================================================================
 *
 * Evaluates playbook guardrails and determines which sections can be
 * safely activated based on data availability and quality.
 *
 * Standardized thresholds:
 * - temporal_trend: requires date column + n ≥ 24
 * - correlation: n ≥ 30 + 2+ numeric columns
 * - top/bottom: groups with n ≥ 10
 *
 * Dynamically generates forbidden_terms based on missing columns.
 * ===================================================================
 */

import type { Playbook, PlaybookGuardrails } from './playbook-registry.ts';
import type { Column } from './schema-validator.ts';

export interface GuardrailsResult {
  active_sections: string[];
  disabled_sections: DisabledSection[];
  forbidden_terms: string[];
  warnings: string[];
  quality_score: number;
}

export interface DisabledSection {
  section: string;
  reason: string;
  missing_requirement: string;
  call_to_action: string;
}

// Standardized thresholds
const THRESHOLDS = {
  MIN_ROWS_DEFAULT: 20,
  TEMPORAL_MIN_ROWS: 24, // 2 years of monthly data
  CORRELATION_MIN_ROWS: 30,
  CORRELATION_MIN_NUMERIC_COLS: 2,
  TOP_BOTTOM_MIN_GROUP_N: 10,
};

// Forbidden terms mapping (PT/EN)
const FORBIDDEN_TERMS_MAP: Record<string, string[]> = {
  // Financial terms (require 'valor' or 'preco' column)
  no_valor: [
    'faturamento', 'receita', 'ticket médio', 'ticket medio', 'lucro',
    'margem', 'revenue', 'sales', 'profit', 'margin', 'price', 'pricing'
  ],

  // Temporal terms (require 'data' column)
  no_date: [
    'tendência', 'tendencia', 'sazonalidade', 'crescimento', 'evolução',
    'evolucao', 'trend', 'seasonality', 'growth', 'evolution', 'temporal',
    'ao longo do tempo', 'over time', 'mês a mês', 'month over month'
  ],

  // Volume terms (require 'quantidade' column)
  no_quantidade: [
    'volume', 'unidades vendidas', 'itens vendidos', 'quantity sold',
    'units sold', 'items sold'
  ],

  // Customer terms (require 'cliente' column)
  no_cliente: [
    'por cliente', 'by customer', 'churn de cliente', 'customer churn',
    'retenção de cliente', 'customer retention'
  ],

  // Product terms (require 'produto' column)
  no_produto: [
    'por produto', 'by product', 'mix de produtos', 'product mix'
  ],
};

/**
 * Evaluate all guardrails for a playbook
 */
export function evaluateGuardrails(
  playbook: Playbook,
  schema: Column[],
  rowCount: number
): GuardrailsResult {

  console.log(`[GuardrailsEngine] Evaluating guardrails for playbook "${playbook.id}"`);
  console.log(`[GuardrailsEngine] Dataset: ${rowCount} rows, ${schema.length} columns`);

  const warnings: string[] = [];
  const disabledSections: DisabledSection[] = [];
  const activeSections: string[] = [];
  const forbiddenTerms: string[] = [];

  const guardrails = playbook.guardrails || {};
  const sections = playbook.sections || {};

  // Build column availability map
  const availableColumns = new Map<string, Column>();
  schema.forEach(col => {
    const normalizedName = col.normalized_name || col.name.toLowerCase();
    availableColumns.set(normalizedName, col);
  });

  // Check minimum rows
  const minRows = guardrails.min_rows || THRESHOLDS.MIN_ROWS_DEFAULT;
  if (rowCount < minRows) {
    warnings.push(
      `Dataset tem apenas ${rowCount} linhas. Recomendado mínimo de ${minRows} para resultados confiáveis.`
    );
  }

  // Check required numeric columns
  if (guardrails.require_numeric) {
    for (const colName of guardrails.require_numeric) {
      const col = findColumn(colName, availableColumns);
      if (!col) {
        warnings.push(`Coluna numérica "${colName}" não encontrada`);
      } else if (col.inferred_type !== 'numeric') {
        warnings.push(`Coluna "${colName}" deveria ser numérica mas é ${col.inferred_type}`);
      }
    }
  }

  // Check temporal sections requirements
  const hasDateColumn = Array.from(availableColumns.values()).some(
    col => col.inferred_type === 'date'
  );

  if (!hasDateColumn) {
    forbiddenTerms.push(...FORBIDDEN_TERMS_MAP.no_date);
  }

  // Check if temporal sections are required but missing date
  if (guardrails.temporal_sections_require && guardrails.temporal_sections_require.length > 0) {
    const hasAllDates = guardrails.temporal_sections_require.every(dateCol =>
      findColumn(dateCol, availableColumns)?.inferred_type === 'date'
    );

    if (!hasAllDates || rowCount < THRESHOLDS.TEMPORAL_MIN_ROWS) {
      if (sections.temporal_trend) {
        disabledSections.push({
          section: 'temporal_trend',
          reason: hasAllDates
            ? `Amostra insuficiente (${rowCount} < ${THRESHOLDS.TEMPORAL_MIN_ROWS})`
            : 'Coluna de data não encontrada ou tipo incorreto',
          missing_requirement: guardrails.temporal_sections_require.join(', '),
          call_to_action: hasAllDates
            ? `💡 Adicione mais linhas (mínimo ${THRESHOLDS.TEMPORAL_MIN_ROWS} para análise temporal robusta)`
            : '💡 Adicione coluna de data para habilitar análise de tendências e sazonalidade'
        });
      }
    } else {
      if (sections.temporal_trend) {
        activeSections.push('temporal_trend');
      }
    }
  }

  // Check correlation requirements
  const numericColumns = Array.from(availableColumns.values()).filter(
    col => col.inferred_type === 'numeric'
  );

  if (numericColumns.length < THRESHOLDS.CORRELATION_MIN_NUMERIC_COLS || rowCount < THRESHOLDS.CORRELATION_MIN_ROWS) {
    if (sections.relationship) {
      disabledSections.push({
        section: 'relationship',
        reason: numericColumns.length < 2
          ? `Apenas ${numericColumns.length} coluna(s) numérica(s) (mínimo 2)`
          : `Amostra insuficiente (${rowCount} < ${THRESHOLDS.CORRELATION_MIN_ROWS})`,
        missing_requirement: 'Mínimo 2 colunas numéricas + 30 linhas',
        call_to_action: numericColumns.length < 2
          ? '💡 Adicione mais colunas numéricas para análise de correlação'
          : '💡 Adicione mais linhas para correlação estatisticamente significativa'
      });
    }
  } else {
    if (sections.relationship) {
      activeSections.push('relationship');
    }
  }

  // Check top/bottom requirements
  const minGroupN = guardrails.top_bottom_min_group_n || THRESHOLDS.TOP_BOTTOM_MIN_GROUP_N;

  // Generate forbidden terms based on missing columns
  const requiredColumns = playbook.required_columns || {};

  // Check for value/price column
  const hasValueColumn = hasColumnLike(['valor', 'preco', 'price', 'amount'], availableColumns);
  if (!hasValueColumn) {
    forbiddenTerms.push(...FORBIDDEN_TERMS_MAP.no_valor);
  }

  // Check for quantity column
  const hasQuantityColumn = hasColumnLike(['quantidade', 'qtd', 'quantity', 'qty'], availableColumns);
  if (!hasQuantityColumn) {
    forbiddenTerms.push(...FORBIDDEN_TERMS_MAP.no_quantidade);
  }

  // Check for customer column
  const hasCustomerColumn = hasColumnLike(['cliente', 'customer', 'client'], availableColumns);
  if (!hasCustomerColumn) {
    forbiddenTerms.push(...FORBIDDEN_TERMS_MAP.no_cliente);
  }

  // Check for product column
  const hasProductColumn = hasColumnLike(['produto', 'product', 'item'], availableColumns);
  if (!hasProductColumn) {
    forbiddenTerms.push(...FORBIDDEN_TERMS_MAP.no_produto);
  }

  // Add static forbidden terms from playbook
  if (playbook.forbidden_terms && playbook.forbidden_terms.length > 0) {
    forbiddenTerms.push(...playbook.forbidden_terms);
  }

  // Deduplicate forbidden terms
  const uniqueForbiddenTerms = [...new Set(forbiddenTerms)];

  // Activate sections that are not disabled
  const allSections = Object.keys(sections);
  const disabledSectionNames = new Set(disabledSections.map(d => d.section));

  for (const section of allSections) {
    if (!disabledSectionNames.has(section) && !activeSections.includes(section)) {
      activeSections.push(section);
    }
  }

  // Calculate quality score
  const qualityScore = calculateQualityScore(
    rowCount,
    schema.length,
    warnings.length,
    disabledSections.length,
    minRows
  );

  console.log(`[GuardrailsEngine] Result: ${activeSections.length} active, ${disabledSections.length} disabled`);
  console.log(`[GuardrailsEngine] Forbidden terms: ${uniqueForbiddenTerms.length}`);
  console.log(`[GuardrailsEngine] Quality score: ${qualityScore}/100`);

  return {
    active_sections: activeSections,
    disabled_sections: disabledSections,
    forbidden_terms: uniqueForbiddenTerms,
    warnings,
    quality_score: qualityScore
  };
}

/**
 * Find column by name (fuzzy matching)
 */
function findColumn(name: string, availableColumns: Map<string, Column>): Column | undefined {
  const normalized = name.toLowerCase().trim();

  // Exact match
  if (availableColumns.has(normalized)) {
    return availableColumns.get(normalized);
  }

  // Fuzzy match
  for (const [key, col] of availableColumns.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return col;
    }
  }

  return undefined;
}

/**
 * Check if any column matches a list of patterns
 */
function hasColumnLike(patterns: string[], availableColumns: Map<string, Column>): boolean {
  for (const pattern of patterns) {
    if (findColumn(pattern, availableColumns)) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate overall quality score
 */
function calculateQualityScore(
  rowCount: number,
  columnCount: number,
  warningsCount: number,
  disabledSectionsCount: number,
  minRows: number
): number {

  let score = 100;

  // Penalty for low row count
  if (rowCount < minRows) {
    const rowPenalty = Math.min(30, ((minRows - rowCount) / minRows) * 30);
    score -= rowPenalty;
  }

  // Penalty for warnings
  score -= Math.min(20, warningsCount * 5);

  // Penalty for disabled sections
  score -= Math.min(30, disabledSectionsCount * 10);

  // Bonus for rich schema
  if (columnCount >= 10) {
    score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate user-friendly explanation of limitations
 */
export function formatLimitationsSection(disabledSections: DisabledSection[]): string {
  if (disabledSections.length === 0) {
    return '✅ **Todas as seções de análise estão disponíveis para este dataset.**';
  }

  let output = '## ⚠️ Limitações da Análise\n\n';
  output += 'As seguintes seções não puderam ser geradas devido a requisitos não atendidos:\n\n';

  disabledSections.forEach((ds, idx) => {
    output += `**${idx + 1}. ${formatSectionName(ds.section)}**\n`;
    output += `- **Motivo:** ${ds.reason}\n`;
    output += `- **Requisito faltante:** ${ds.missing_requirement}\n`;
    output += `- ${ds.call_to_action}\n\n`;
  });

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
 * Check if a text contains forbidden terms
 */
export function containsForbiddenTerms(text: string, forbiddenTerms: string[]): {
  found: boolean;
  matches: string[];
} {
  const lowerText = text.toLowerCase();
  const matches: string[] = [];

  for (const term of forbiddenTerms) {
    if (lowerText.includes(term.toLowerCase())) {
      matches.push(term);
    }
  }

  return {
    found: matches.length > 0,
    matches
  };
}

/**
 * Generate call-to-action for improving dataset
 */
export function generateDataImprovementSuggestions(
  disabledSections: DisabledSection[],
  schema: Column[]
): string[] {
  const suggestions: string[] = [];

  const hasDate = schema.some(col => col.inferred_type === 'date');
  const numericCount = schema.filter(col => col.inferred_type === 'numeric').length;

  if (!hasDate) {
    suggestions.push('📅 Adicione uma coluna de data para habilitar análise de tendências temporais');
  }

  if (numericCount < 2) {
    suggestions.push('📊 Adicione mais colunas numéricas para habilitar análise de correlação');
  }

  disabledSections.forEach(ds => {
    if (!suggestions.includes(ds.call_to_action)) {
      suggestions.push(ds.call_to_action);
    }
  });

  return suggestions.slice(0, 5); // Top 5 suggestions
}
