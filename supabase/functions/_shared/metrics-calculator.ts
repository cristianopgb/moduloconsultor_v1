/**
 * ===================================================================
 * METRICS CALCULATOR
 * ===================================================================
 *
 * Calculates standard business metrics using the metrics registry
 * Examples:
 *   - ROI = (Receita - Investimento) / Investimento * 100
 *   - Margem% = (Receita - Custo) / Receita * 100
 *   - OTIF = (Entregas no prazo E completas) / Total de entregas * 100
 *
 * Handles missing dependencies with intelligent fallbacks
 * ===================================================================
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { ExecSpec, DataCard } from './analytics-contracts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

export interface MetricDefinition {
  metric_name: string;
  formula: string;
  required_columns: string[];
  optional_columns?: string[];
  fallback_formula?: string;
  category: 'financial' | 'sales' | 'logistics' | 'hr' | 'generic';
  unit?: 'percentage' | 'currency' | 'number' | 'days';
  description: string;
}

export interface CalculatedMetric {
  metric_name: string;
  value: number;
  formula_used: string;
  missing_dependencies: string[];
  used_fallback: boolean;
  confidence: number;
}

export interface MetricCalculationResult {
  success: boolean;
  metrics: CalculatedMetric[];
  warnings: string[];
  available_columns: string[];
}

/**
 * Load metrics registry from database
 */
async function loadMetricsRegistry(category?: string): Promise<Map<string, MetricDefinition>> {
  let query = supabase
    .from('metrics_registry')
    .select('*')
    .eq('is_active', true);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[MetricsCalculator] Error loading metrics registry:', error.message);
    return new Map();
  }

  const registry = new Map<string, MetricDefinition>();

  (data || []).forEach(metric => {
    registry.set(metric.metric_name, {
      metric_name: metric.metric_name,
      formula: metric.formula,
      required_columns: metric.required_columns || [],
      optional_columns: metric.optional_columns || [],
      fallback_formula: metric.fallback_formula,
      category: metric.category,
      unit: metric.unit,
      description: metric.description,
    });
  });

  return registry;
}

/**
 * Check if all required columns are available
 */
function checkColumnAvailability(
  required: string[],
  available: string[]
): { hasAll: boolean; missing: string[] } {
  const availableSet = new Set(available.map(c => c.toLowerCase()));
  const missing: string[] = [];

  for (const col of required) {
    if (!availableSet.has(col.toLowerCase())) {
      missing.push(col);
    }
  }

  return {
    hasAll: missing.length === 0,
    missing,
  };
}

/**
 * Parse formula and extract column references
 */
function parseFormulaColumns(formula: string): string[] {
  const columnPattern = /\{(\w+)\}/g;
  const matches = [...formula.matchAll(columnPattern)];
  return matches.map(m => m[1]);
}

/**
 * Substitute column placeholders in formula
 */
function substituteFormula(formula: string, columnMapping: Record<string, string>): string {
  let substituted = formula;

  for (const [placeholder, columnName] of Object.entries(columnMapping)) {
    const pattern = new RegExp(`\\{${placeholder}\\}`, 'g');
    substituted = substituted.replace(pattern, `(data->>'${columnName}')::numeric`);
  }

  return substituted;
}

/**
 * Calculate a single metric
 */
export async function calculateMetric(
  metricName: string,
  dataCard: DataCard,
  data?: any[]
): Promise<CalculatedMetric> {
  const registry = await loadMetricsRegistry();
  const metricDef = registry.get(metricName);

  if (!metricDef) {
    throw new Error(`Metric "${metricName}" not found in registry`);
  }

  console.log(`[MetricsCalculator] Calculating metric: ${metricName}`);

  const availableColumns = dataCard.columns.map(c =>
    (c as any).canonical_name || c.name
  );

  const availability = checkColumnAvailability(
    metricDef.required_columns,
    availableColumns
  );

  let formulaToUse = metricDef.formula;
  let usedFallback = false;
  let confidence = 1.0;

  if (!availability.hasAll) {
    console.log(
      `[MetricsCalculator] Missing columns for ${metricName}:`,
      availability.missing
    );

    if (metricDef.fallback_formula) {
      console.log(`[MetricsCalculator] Using fallback formula`);
      formulaToUse = metricDef.fallback_formula;
      usedFallback = true;
      confidence = 0.7;
    } else {
      return {
        metric_name: metricName,
        value: 0,
        formula_used: metricDef.formula,
        missing_dependencies: availability.missing,
        used_fallback: false,
        confidence: 0,
      };
    }
  }

  const columnMapping: Record<string, string> = {};
  const formulaColumns = parseFormulaColumns(formulaToUse);

  for (const placeholder of formulaColumns) {
    const matchingCol = availableColumns.find(
      ac => ac.toLowerCase() === placeholder.toLowerCase()
    );
    if (matchingCol) {
      columnMapping[placeholder] = matchingCol;
    }
  }

  const substitutedFormula = substituteFormula(formulaToUse, columnMapping);

  console.log(`[MetricsCalculator] Formula: ${substitutedFormula}`);

  return {
    metric_name: metricName,
    value: 0,
    formula_used: substitutedFormula,
    missing_dependencies: availability.missing,
    used_fallback: usedFallback,
    confidence,
  };
}

/**
 * Calculate multiple metrics for a dataset
 */
export async function calculateMetrics(
  metricNames: string[],
  dataCard: DataCard
): Promise<MetricCalculationResult> {
  const warnings: string[] = [];
  const metrics: CalculatedMetric[] = [];
  const availableColumns = dataCard.columns.map(c =>
    (c as any).canonical_name || c.name
  );

  for (const metricName of metricNames) {
    try {
      const calculated = await calculateMetric(metricName, dataCard);
      metrics.push(calculated);

      if (calculated.missing_dependencies.length > 0) {
        warnings.push(
          `Metric "${metricName}" missing: ${calculated.missing_dependencies.join(', ')}`
        );
      }

      if (calculated.used_fallback) {
        warnings.push(
          `Metric "${metricName}" used fallback formula (confidence: ${(calculated.confidence * 100).toFixed(0)}%)`
        );
      }
    } catch (error: any) {
      warnings.push(`Failed to calculate "${metricName}": ${error.message}`);
    }
  }

  return {
    success: true,
    metrics,
    warnings,
    available_columns: availableColumns,
  };
}

/**
 * Suggest metrics based on available columns
 */
export async function suggestMetrics(dataCard: DataCard): Promise<string[]> {
  const registry = await loadMetricsRegistry();
  const availableColumns = dataCard.columns.map(c =>
    (c as any).canonical_name || c.name
  );

  const suggestions: Array<{ metric: string; score: number }> = [];

  for (const [metricName, metricDef] of registry.entries()) {
    const availability = checkColumnAvailability(
      metricDef.required_columns,
      availableColumns
    );

    if (availability.hasAll) {
      suggestions.push({ metric: metricName, score: 1.0 });
    } else if (metricDef.fallback_formula) {
      const fallbackColumns = parseFormulaColumns(metricDef.fallback_formula);
      const fallbackAvailability = checkColumnAvailability(
        fallbackColumns,
        availableColumns
      );

      if (fallbackAvailability.hasAll) {
        suggestions.push({ metric: metricName, score: 0.7 });
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  console.log(`[MetricsCalculator] Suggested ${suggestions.length} metrics for dataset`);

  return suggestions.map(s => s.metric);
}

/**
 * Get metric definition
 */
export async function getMetricDefinition(metricName: string): Promise<MetricDefinition | null> {
  const registry = await loadMetricsRegistry();
  return registry.get(metricName) || null;
}

/**
 * Add metric calculation to ExecSpec
 */
export async function enrichExecSpecWithMetrics(
  execSpec: ExecSpec,
  dataCard: DataCard,
  requestedMetrics: string[]
): Promise<ExecSpec> {
  const enrichedSpec = { ...execSpec };

  if (!enrichedSpec.measures) {
    enrichedSpec.measures = [];
  }

  for (const metricName of requestedMetrics) {
    const metricDef = await getMetricDefinition(metricName);
    if (!metricDef) continue;

    const availability = checkColumnAvailability(
      metricDef.required_columns,
      dataCard.columns.map(c => (c as any).canonical_name || c.name)
    );

    if (availability.hasAll) {
      const columnMapping: Record<string, string> = {};
      const formulaColumns = parseFormulaColumns(metricDef.formula);

      for (const placeholder of formulaColumns) {
        const matchingCol = dataCard.columns.find(
          c => ((c as any).canonical_name || c.name).toLowerCase() === placeholder.toLowerCase()
        );
        if (matchingCol) {
          columnMapping[placeholder] = (matchingCol as any).canonical_name || matchingCol.name;
        }
      }

      const substitutedFormula = substituteFormula(metricDef.formula, columnMapping);

      enrichedSpec.measures.push({
        name: metricName,
        aggregation: 'custom' as any,
        formula: substitutedFormula,
      });

      console.log(`[MetricsCalculator] Added metric "${metricName}" to ExecSpec`);
    }
  }

  return enrichedSpec;
}

/**
 * Get all metrics by category
 */
export async function getMetricsByCategory(category: string): Promise<string[]> {
  const registry = await loadMetricsRegistry(category);
  return Array.from(registry.keys());
}

/**
 * Validate if a dataset can calculate a specific metric
 */
export async function canCalculateMetric(
  metricName: string,
  dataCard: DataCard
): Promise<{ can: boolean; missing: string[]; canUseFallback: boolean }> {
  const metricDef = await getMetricDefinition(metricName);

  if (!metricDef) {
    return { can: false, missing: [], canUseFallback: false };
  }

  const availableColumns = dataCard.columns.map(c =>
    (c as any).canonical_name || c.name
  );

  const availability = checkColumnAvailability(
    metricDef.required_columns,
    availableColumns
  );

  if (availability.hasAll) {
    return { can: true, missing: [], canUseFallback: false };
  }

  if (metricDef.fallback_formula) {
    const fallbackColumns = parseFormulaColumns(metricDef.fallback_formula);
    const fallbackAvailability = checkColumnAvailability(
      fallbackColumns,
      availableColumns
    );

    if (fallbackAvailability.hasAll) {
      return { can: true, missing: availability.missing, canUseFallback: true };
    }
  }

  return { can: false, missing: availability.missing, canUseFallback: false };
}
