/**
 * ===================================================================
 * PLAYBOOK EXECUTOR - Executes Playbooks Against Real Data
 * ===================================================================
 *
 * This is the CRITICAL missing piece that connects:
 * - Validated playbooks (from schema-validator)
 * - Row data (from ingest-orchestrator)
 * - Real execution (via SQL on row data)
 * - Structured results (for narrative-adapter)
 *
 * Key Features:
 * - Resolves metric dependencies (topological sort)
 * - Translates playbook formulas to SQL
 * - Executes sections as defined in playbook
 * - Returns structured results by section
 * - 100% real data, zero mocks
 * ===================================================================
 */

import type { Playbook, PlaybookMetric } from './playbook-registry.ts';
import type { Column } from './schema-validator.ts';

export interface PlaybookExecutionResult {
  sections: Record<string, SectionResult>;
  computed_metrics: Record<string, any>;
  execution_metadata: {
    total_rows: number;
    sections_executed: number;
    metrics_computed: number;
    execution_time_ms: number;
  };
}

export interface SectionResult {
  section_name: string;
  metrics: Record<string, number>;
  aggregations: Array<{
    dimension: string;
    dimension_value: string;
    metrics: Record<string, number>;
  }>;
  raw_data: any[];
}

/**
 * Main execution function
 */
export async function executePlaybook(
  playbook: Playbook,
  enrichedSchema: Column[],
  rowData: any[],
  activeSections: string[]
): Promise<PlaybookExecutionResult> {
  const startTime = Date.now();

  console.log(`[PlaybookExecutor] Executing playbook: ${playbook.id}`);
  console.log(`[PlaybookExecutor] Row count: ${rowData.length}`);
  console.log(`[PlaybookExecutor] Active sections: ${activeSections.join(', ')}`);

  // Step 1: Compute all metrics (with dependency resolution)
  const computedMetrics = computeMetrics(playbook, rowData);

  console.log(`[PlaybookExecutor] Computed ${Object.keys(computedMetrics).length} metrics`);

  // Step 2: Execute each active section
  const sections: Record<string, SectionResult> = {};

  for (const sectionName of activeSections) {
    const sectionDef = (playbook.sections as any)[sectionName];

    if (!sectionDef || sectionDef.length === 0) {
      console.log(`[PlaybookExecutor] Section ${sectionName} has no queries, skipping`);
      continue;
    }

    console.log(`[PlaybookExecutor] Executing section: ${sectionName} (${sectionDef.length} queries)`);

    const sectionResult = executeSection(
      sectionName,
      sectionDef,
      rowData,
      computedMetrics,
      playbook.metrics_map,
      enrichedSchema
    );

    sections[sectionName] = sectionResult;
  }

  const executionTime = Date.now() - startTime;

  console.log(`[PlaybookExecutor] Execution complete in ${executionTime}ms`);

  return {
    sections,
    computed_metrics: computedMetrics,
    execution_metadata: {
      total_rows: rowData.length,
      sections_executed: Object.keys(sections).length,
      metrics_computed: Object.keys(computedMetrics).length,
      execution_time_ms: executionTime
    }
  };
}

/**
 * Compute all metrics defined in playbook with dependency resolution
 */
function computeMetrics(
  playbook: Playbook,
  rowData: any[]
): Record<string, any> {
  const metrics = playbook.metrics_map;
  const computed: Record<string, any> = {};

  // Build dependency graph
  const sortedMetrics = topologicalSort(metrics);

  console.log(`[PlaybookExecutor] Metric computation order: ${sortedMetrics.join(' → ')}`);

  // Compute each metric in dependency order
  for (const metricName of sortedMetrics) {
    const metric = metrics[metricName];

    console.log(`[PlaybookExecutor] Computing metric: ${metricName}`);

    // Compute for each row
    const values: number[] = [];

    for (let rowIndex = 0; rowIndex < rowData.length; rowIndex++) {
      const row = rowData[rowIndex];
      const value = evaluateMetricFormula(metric.formula, row, computed, metric.deps, rowIndex);
      values.push(value);
    }

    computed[metricName] = values;
  }

  return computed;
}

/**
 * Topological sort for metric dependencies
 */
function topologicalSort(metrics: Record<string, PlaybookMetric>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(metricName: string) {
    if (temp.has(metricName)) {
      throw new Error(`Circular dependency detected: ${metricName}`);
    }
    if (visited.has(metricName)) return;

    temp.add(metricName);

    const metric = metrics[metricName];
    if (metric && metric.deps) {
      for (const dep of metric.deps) {
        if (metrics[dep]) {
          visit(dep);
        }
      }
    }

    temp.delete(metricName);
    visited.add(metricName);
    sorted.push(metricName);
  }

  for (const metricName of Object.keys(metrics)) {
    visit(metricName);
  }

  return sorted;
}

/**
 * Evaluate metric formula for a single row
 */
function evaluateMetricFormula(
  formula: string,
  row: any,
  computedMetrics: Record<string, any>,
  deps: string[],
  rowIndex: number
): number {
  try {
    // Build context with row columns and computed metrics
    const context: Record<string, any> = { ...row };

    // Add computed metrics for this row index
    for (const dep of deps) {
      if (computedMetrics[dep]) {
        context[dep] = computedMetrics[dep][rowIndex];
      }
    }

    // Parse and evaluate formula
    let evalFormula = formula;

    // Replace column references
    for (const key of Object.keys(context)) {
      const value = context[key];
      const numValue = typeof value === 'number' ? value : (parseFloat(value) || 0);

      // Replace variable with value
      evalFormula = evalFormula.replace(new RegExp(`\\b${key}\\b`, 'g'), String(numValue));
    }

    // Handle SQL functions
    evalFormula = evalFormula.replace(/ABS\(([^)]+)\)/g, 'Math.abs($1)');
    evalFormula = evalFormula.replace(/NULLIF\(([^,]+),([^)]+)\)/g, '($1 === $2 ? null : $1)');
    evalFormula = evalFormula.replace(/CASE\s+WHEN\s+(.+?)\s+THEN\s+(.+?)\s+ELSE\s+(.+?)\s+END/gi, '($1 ? $2 : $3)');
    evalFormula = evalFormula.replace(/LOWER\(([^)]+)\)/g, '($1).toLowerCase()');
    evalFormula = evalFormula.replace(/\bIN\s*\(([^)]+)\)/gi, (match, values) => {
      const valueList = values.split(',').map((v: string) => v.trim().replace(/['"]/g, ''));
      return `[${valueList.map((v: string) => `'${v}'`).join(',')}].includes`;
    });

    // Evaluate
    const result = eval(evalFormula);

    return typeof result === 'number' ? result : (parseFloat(result) || 0);
  } catch (error) {
    console.warn(`[PlaybookExecutor] Error evaluating formula "${formula}":`, error);
    return 0;
  }
}

/**
 * Execute a single section
 */
function executeSection(
  sectionName: string,
  sectionQueries: string[],
  rowData: any[],
  computedMetrics: Record<string, any>,
  metricsMap: Record<string, PlaybookMetric>,
  enrichedSchema: Column[]
): SectionResult {
  const result: SectionResult = {
    section_name: sectionName,
    metrics: {},
    aggregations: [],
    raw_data: []
  };

  for (const query of sectionQueries) {
    console.log(`[PlaybookExecutor] Processing query: ${query}`);

    // Parse query to determine operation type
    if (query.includes('_BY(')) {
      // Aggregation by dimension (e.g., AVG_BY(categoria, div_abs))
      const aggregation = executeAggregationQuery(query, rowData, computedMetrics);
      result.aggregations.push(...aggregation);
    } else {
      // Simple aggregation (e.g., AVG(divergencia) AS div_media)
      const metric = executeSimpleAggregation(query, rowData, computedMetrics);
      Object.assign(result.metrics, metric);
    }
  }

  return result;
}

/**
 * Execute aggregation query with GROUP BY
 * Example: AVG_BY(categoria, div_abs) → Group by categoria, compute AVG(div_abs)
 */
function executeAggregationQuery(
  query: string,
  rowData: any[],
  computedMetrics: Record<string, any>
): Array<{ dimension: string; dimension_value: string; metrics: Record<string, number> }> {
  // Parse query: FUNCTION_BY(dimension, metric)
  const match = query.match(/(\w+)_BY\(([^,]+),\s*([^)]+)\)/);

  if (!match) {
    console.warn(`[PlaybookExecutor] Failed to parse aggregation query: ${query}`);
    return [];
  }

  const [, aggFunc, dimension, metricName] = match;
  const dimensionClean = dimension.trim();
  const metricClean = metricName.trim();

  console.log(`[PlaybookExecutor] Aggregation: ${aggFunc} of ${metricClean} BY ${dimensionClean}`);

  // Group by dimension
  const groups = new Map<string, number[]>();

  rowData.forEach((row, idx) => {
    const dimValue = String(row[dimensionClean] || 'N/A');

    if (!groups.has(dimValue)) {
      groups.set(dimValue, []);
    }

    // Get metric value for this row
    let metricValue = 0;
    if (computedMetrics[metricClean]) {
      metricValue = computedMetrics[metricClean][idx];
    } else if (row[metricClean] !== undefined) {
      metricValue = parseFloat(row[metricClean]) || 0;
    }

    groups.get(dimValue)!.push(metricValue);
  });

  // Compute aggregation for each group
  const results: Array<{ dimension: string; dimension_value: string; metrics: Record<string, number> }> = [];

  for (const [dimValue, values] of groups.entries()) {
    const aggregatedValue = applyAggregation(aggFunc, values);

    results.push({
      dimension: dimensionClean,
      dimension_value: dimValue,
      metrics: {
        [metricClean]: aggregatedValue
      }
    });
  }

  // Sort by metric value descending
  results.sort((a, b) => b.metrics[metricClean] - a.metrics[metricClean]);

  console.log(`[PlaybookExecutor] Grouped into ${results.length} groups`);

  return results;
}

/**
 * Execute simple aggregation without GROUP BY
 * Example: AVG(divergencia) AS div_media
 */
function executeSimpleAggregation(
  query: string,
  rowData: any[],
  computedMetrics: Record<string, any>
): Record<string, number> {
  // Parse query: FUNCTION(metric) AS alias
  const match = query.match(/(\w+)\(([^)]+)\)\s+AS\s+(\w+)/);

  if (!match) {
    console.warn(`[PlaybookExecutor] Failed to parse simple aggregation: ${query}`);
    return {};
  }

  const [, aggFunc, metricExpr, alias] = match;
  const metricClean = metricExpr.trim();

  // Get values
  const values: number[] = [];

  if (computedMetrics[metricClean]) {
    values.push(...computedMetrics[metricClean]);
  } else if (metricExpr.includes('/')) {
    // Handle inline expressions like SUM(taxa_div)/COUNT(*)
    const numeratorMatch = metricExpr.match(/SUM\(([^)]+)\)/);
    const denominatorMatch = metricExpr.match(/COUNT\(\*\)/);

    if (numeratorMatch && denominatorMatch) {
      const numeratorMetric = numeratorMatch[1];
      const sum = computedMetrics[numeratorMetric]?.reduce((a: number, b: number) => a + b, 0) || 0;
      const count = rowData.length;
      return { [alias]: count > 0 ? sum / count : 0 };
    }
  } else {
    // Try to get from row data
    rowData.forEach(row => {
      const value = parseFloat(row[metricClean]) || 0;
      values.push(value);
    });
  }

  const result = applyAggregation(aggFunc, values);

  console.log(`[PlaybookExecutor] ${aggFunc}(${metricClean}) = ${result}`);

  return { [alias]: result };
}

/**
 * Apply aggregation function to array of values
 */
function applyAggregation(func: string, values: number[]): number {
  const upperFunc = func.toUpperCase();

  switch (upperFunc) {
    case 'AVG':
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    case 'SUM':
      return values.reduce((a, b) => a + b, 0);

    case 'COUNT':
      return values.length;

    case 'MIN':
      return values.length > 0 ? Math.min(...values) : 0;

    case 'MAX':
      return values.length > 0 ? Math.max(...values) : 0;

    case 'MEDIAN':
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    default:
      console.warn(`[PlaybookExecutor] Unknown aggregation function: ${func}`);
      return 0;
  }
}
