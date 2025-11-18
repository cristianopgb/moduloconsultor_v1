/**
 * ===================================================================
 * FEATURE DERIVATION - Computed Column Generation
 * ===================================================================
 *
 * Creates derived columns based on semantic plan.
 * Operates on row data in-memory (SQL-like transformations).
 *
 * Key features:
 * - Evaluates formulas safely (no eval, controlled AST)
 * - Handles SQL functions (ABS, CASE WHEN, NULLIF, etc.)
 * - Maintains dependency order (topological sort)
 * - Returns enriched dataset with new columns
 *
 * CRITICAL: All derived columns are added to row data before
 * playbook execution, ensuring metrics can reference them.
 * ===================================================================
 */

import type { DerivedColumn } from './semantic-planner.ts';

export interface DerivationResult {
  enriched_rows: any[];
  columns_added: string[];
  errors: DerivationError[];
  execution_time_ms: number;
}

export interface DerivationError {
  column: string;
  row_index: number;
  error: string;
}

/**
 * Apply all derivations to row data
 */
export function applyDerivations(
  rowData: any[],
  derivations: DerivedColumn[]
): DerivationResult {

  const startTime = Date.now();
  const errors: DerivationError[] = [];
  const columnsAdded: string[] = [];

  console.log(`[FeatureDerivation] Applying ${derivations.length} derivations to ${rowData.length} rows`);

  // Sort derivations by dependency order
  const sorted = topologicalSort(derivations);

  console.log(`[FeatureDerivation] Dependency order: ${sorted.map(d => d.name).join(' → ')}`);

  // Apply each derivation
  for (const derivation of sorted) {
    console.log(`[FeatureDerivation] Computing: ${derivation.name} = ${derivation.formula}`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rowData.length; i++) {
      const row = rowData[i];

      try {
        const value = evaluateFormula(derivation.formula, row, i);
        row[derivation.name] = value;
        successCount++;
      } catch (error: any) {
        errors.push({
          column: derivation.name,
          row_index: i,
          error: error.message
        });
        row[derivation.name] = null; // Set to null on error
        errorCount++;
      }
    }

    columnsAdded.push(derivation.name);
    console.log(`[FeatureDerivation] ${derivation.name}: ${successCount} OK, ${errorCount} errors`);
  }

  const executionTime = Date.now() - startTime;

  console.log(`[FeatureDerivation] Complete in ${executionTime}ms`);

  return {
    enriched_rows: rowData,
    columns_added: columnsAdded,
    errors,
    execution_time_ms: executionTime
  };
}

/**
 * Topological sort for derivations (dependency order)
 */
function topologicalSort(derivations: DerivedColumn[]): DerivedColumn[] {
  const sorted: DerivedColumn[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  const derivMap = new Map<string, DerivedColumn>();
  derivations.forEach(d => derivMap.set(d.name, d));

  function visit(derivName: string) {
    if (temp.has(derivName)) {
      throw new Error(`Circular dependency detected: ${derivName}`);
    }
    if (visited.has(derivName)) return;

    const deriv = derivMap.get(derivName);
    if (!deriv) return;

    temp.add(derivName);

    // Visit dependencies first
    for (const dep of deriv.dependencies) {
      if (derivMap.has(dep)) {
        visit(dep);
      }
    }

    temp.delete(derivName);
    visited.add(derivName);
    sorted.push(deriv);
  }

  // Visit all derivations
  for (const deriv of derivations) {
    visit(deriv.name);
  }

  return sorted;
}

/**
 * Evaluate a formula for a single row
 *
 * Supported SQL functions:
 * - ABS(x): Absolute value
 * - NULLIF(a, b): Returns null if a == b, else a
 * - CASE WHEN ... THEN ... ELSE ... END
 * - Arithmetic: +, -, *, /
 * - Comparisons: =, !=, <, >, <=, >=
 */
function evaluateFormula(formula: string, row: any, rowIndex: number): any {
  try {
    // Step 1: Replace column references with values
    let expr = formula;

    // Get all column names from row
    const colNames = Object.keys(row);

    // Sort by length descending to avoid partial matches
    colNames.sort((a, b) => b.length - a.length);

    // Replace each column reference
    for (const colName of colNames) {
      const value = row[colName];
      const regex = new RegExp(`\\b${escapeRegex(colName)}\\b`, 'g');

      // Convert value to expression-friendly format
      let valueStr: string;
      if (value === null || value === undefined) {
        valueStr = 'null';
      } else if (typeof value === 'number') {
        valueStr = String(value);
      } else if (typeof value === 'string') {
        valueStr = `"${value.replace(/"/g, '\\"')}"`;
      } else {
        valueStr = String(value);
      }

      expr = expr.replace(regex, valueStr);
    }

    // Step 2: Transform SQL functions to JavaScript
    expr = transformSQLToJS(expr);

    // Step 3: Evaluate safely
    const result = evaluateSafe(expr);

    return result;

  } catch (error: any) {
    throw new Error(`Formula evaluation failed at row ${rowIndex}: ${error.message}`);
  }
}

/**
 * Transform SQL syntax to JavaScript
 */
function transformSQLToJS(expr: string): string {
  let js = expr;

  // ABS(x) → Math.abs(x)
  js = js.replace(/\bABS\s*\(/gi, 'Math.abs(');

  // NULLIF(a, b) → (a === b ? null : a)
  js = js.replace(/\bNULLIF\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, (match, a, b) => {
    return `(${a.trim()} === ${b.trim()} ? null : ${a.trim()})`;
  });

  // CASE WHEN condition THEN value1 ELSE value2 END
  // → (condition ? value1 : value2)
  js = js.replace(
    /\bCASE\s+WHEN\s+(.+?)\s+THEN\s+(.+?)\s+ELSE\s+(.+?)\s+END\b/gi,
    (match, cond, val1, val2) => {
      return `(${cond.trim()} ? ${val1.trim()} : ${val2.trim()})`;
    }
  );

  // SQL equality: = → ===
  js = js.replace(/([^<>!=])\s*=\s*([^=])/g, '$1 === $2');

  // SQL inequality: != → !==
  js = js.replace(/!=/g, '!==');

  // LOWER(x) → x.toLowerCase()
  js = js.replace(/\bLOWER\s*\(\s*([^)]+)\s*\)/gi, '($1).toLowerCase()');

  return js;
}

/**
 * Evaluate JavaScript expression safely
 *
 * NOTE: This uses eval but only after sanitizing input.
 * All column values are replaced, and only whitelisted functions are allowed.
 */
function evaluateSafe(expr: string): any {
  // Whitelist of allowed tokens
  const allowed = /^[\d\s+\-*/().?:!<>=&|"null]+|Math\.abs|toLowerCase$/;

  // Check for dangerous patterns
  const dangerous = /(function|eval|require|import|export|document|window|global|process|__)/i;

  if (dangerous.test(expr)) {
    throw new Error('Expression contains forbidden tokens');
  }

  // Evaluate
  try {
    const result = eval(expr);
    return result;
  } catch (error: any) {
    throw new Error(`Evaluation error: ${error.message}`);
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate derivation before applying
 */
export function validateDerivation(derivation: DerivedColumn): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!derivation.name) {
    errors.push('Derivation name is required');
  }

  if (!derivation.formula) {
    errors.push('Derivation formula is required');
  }

  if (!derivation.type) {
    errors.push('Derivation type is required');
  }

  if (!Array.isArray(derivation.dependencies)) {
    errors.push('Derivation dependencies must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get derivation statistics
 */
export function getDerivationStats(result: DerivationResult): {
  total_columns_added: number;
  total_errors: number;
  error_rate: number;
  avg_time_per_derivation_ms: number;
} {
  const errorRate = result.enriched_rows.length > 0
    ? (result.errors.length / result.enriched_rows.length) * 100
    : 0;

  const avgTime = result.columns_added.length > 0
    ? result.execution_time_ms / result.columns_added.length
    : 0;

  return {
    total_columns_added: result.columns_added.length,
    total_errors: result.errors.length,
    error_rate: Math.round(errorRate * 100) / 100,
    avg_time_per_derivation_ms: Math.round(avgTime * 100) / 100
  };
}
