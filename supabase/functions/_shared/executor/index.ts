/**
 * ===================================================================
 * EXECUTOR - Decoupled Execution Engine for Analytics
 * ===================================================================
 *
 * Purpose:
 * - Receives ExecSpec (DSL) and executes against dataset
 * - Generates unique exec_id for lineage tracking
 * - Applies policies and validations before execution
 * - Returns ExecResult with lineage metadata
 *
 * Key Features:
 * - Deterministic: Same ExecSpec → Same SQL → Same Results
 * - Traceable: Every execution logged with exec_id
 * - Cacheable: Hash-based caching for repeated queries
 * - Safe: Pre-validation before execution
 * ===================================================================
 */

import type { ExecSpec, ExecResult, DataCard, Warning, PolicyApplication } from '../analytics-contracts.ts';
import { execSpecToSQL } from './execspec-to-sql.ts';
import { checkCache, saveToCache } from './cache.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

/**
 * Main executor function
 */
export async function execute(
  execSpec: ExecSpec,
  dataCard: DataCard,
  options: {
    enableCache?: boolean;
    timeout_ms?: number;
    max_rows?: number;
  } = {}
): Promise<ExecResult> {
  const startTime = Date.now();

  const config = {
    enableCache: options.enableCache ?? true,
    timeout_ms: options.timeout_ms ?? 30000,
    max_rows: options.max_rows ?? 100000,
  };

  try {
    // 1. Generate exec_id (UUID v4)
    const exec_id = crypto.randomUUID();

    console.log(`[Executor] Starting execution ${exec_id}`);

    // 2. Check cache if enabled
    if (config.enableCache) {
      const cached = await checkCache(execSpec, dataCard.dataset_id);
      if (cached) {
        console.log(`[Executor] Cache hit for exec_id ${cached.exec_id}`);
        return {
          ...cached,
          exec_id: cached.exec_id,
          execution_time_ms: Date.now() - startTime,
        };
      }
    }

    // 3. Validate ExecSpec against DataCard
    const validation = validateExecSpec(execSpec, dataCard);
    if (!validation.valid) {
      return createErrorResult(
        exec_id,
        `ExecSpec validation failed: ${validation.errors.join(', ')}`,
        startTime
      );
    }

    // 4. Apply policies
    const { adjustedSpec, policiesApplied } = applyPolicies(execSpec, dataCard);

    // 5. Translate ExecSpec → SQL
    const sql = execSpecToSQL(adjustedSpec, dataCard.dataset_id);

    console.log(`[Executor] Generated SQL:`, sql.substring(0, 200) + '...');

    // 6. Execute SQL with timeout
    const { data, error, rowCount } = await executeSQL(sql, config.timeout_ms);

    if (error) {
      return createErrorResult(exec_id, `SQL execution failed: ${error}`, startTime);
    }

    // 7. Check row limit
    const warnings: Warning[] = [];
    let resultData = data || [];

    if (rowCount > config.max_rows) {
      warnings.push({
        type: 'performance',
        severity: 'warning',
        message: `Query returned ${rowCount} rows, truncated to ${config.max_rows}`,
        affected_count: rowCount - config.max_rows,
      });
      resultData = resultData.slice(0, config.max_rows);
    }

    // 8. Add policy warnings
    policiesApplied.forEach(policy => {
      warnings.push({
        type: 'policy_applied',
        severity: 'info',
        message: policy.reason,
      });
    });

    // 9. Create result
    const result: ExecResult = {
      exec_id,
      success: true,
      data: resultData,
      warnings,
      execution_time_ms: Date.now() - startTime,
      rows_processed: rowCount,
      rows_returned: resultData.length,
      policies_applied: policiesApplied,
      created_at: new Date().toISOString(),
    };

    // 10. Save to cache if enabled
    if (config.enableCache) {
      await saveToCache(execSpec, dataCard.dataset_id, result);
    }

    console.log(`[Executor] Completed ${exec_id} in ${result.execution_time_ms}ms`);

    return result;

  } catch (error: any) {
    console.error('[Executor] Critical error:', error);
    return createErrorResult(
      crypto.randomUUID(),
      `Unexpected error: ${error.message}`,
      startTime
    );
  }
}

/**
 * Validate ExecSpec against DataCard
 */
function validateExecSpec(
  execSpec: ExecSpec,
  dataCard: DataCard
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if required columns exist
  const availableColumns = new Set(dataCard.columns.map(c => c.name.toLowerCase()));

  execSpec.dimensions.forEach(dim => {
    if (!availableColumns.has(dim.toLowerCase())) {
      errors.push(`Dimension column '${dim}' not found in dataset`);
    }
  });

  execSpec.measures.forEach(measure => {
    if (measure.column && !availableColumns.has(measure.column.toLowerCase())) {
      errors.push(`Measure column '${measure.column}' not found in dataset`);
    }
  });

  if (execSpec.filters) {
    execSpec.filters.forEach(filter => {
      if (!availableColumns.has(filter.column.toLowerCase())) {
        errors.push(`Filter column '${filter.column}' not found in dataset`);
      }
    });
  }

  // Check if operations are supported
  const supportedOps = ['clean', 'derive', 'aggregate', 'topN', 'window', 'filter'];
  execSpec.operations.forEach(op => {
    if (!supportedOps.includes(op.op)) {
      errors.push(`Operation '${op.op}' is not supported`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Apply policies to ExecSpec
 */
function applyPolicies(
  execSpec: ExecSpec,
  dataCard: DataCard
): { adjustedSpec: ExecSpec; policiesApplied: PolicyApplication[] } {
  const adjustedSpec = { ...execSpec };
  const policiesApplied: PolicyApplication[] = [];

  // Policy 1: Add default LIMIT if not present
  if (!adjustedSpec.limit && !execSpec.operations.some(op => op.op === 'aggregate')) {
    adjustedSpec.limit = 10000;
    policiesApplied.push({
      policy_name: 'default_limit',
      applied: true,
      reason: 'No LIMIT specified, added default of 10000 rows',
      impact: 'Query performance improved',
    });
  }

  // Policy 2: TopN default
  if (adjustedSpec.topN && !adjustedSpec.topN.n) {
    adjustedSpec.topN.n = 10;
    policiesApplied.push({
      policy_name: 'default_topn',
      applied: true,
      reason: 'No Top-N specified, defaulting to Top 10',
      impact: 'Result set limited to top 10 items',
    });
  }

  // Policy 3: Order by for TopN
  if (adjustedSpec.topN && !adjustedSpec.orderBy) {
    adjustedSpec.orderBy = [{
      column: adjustedSpec.topN.orderBy,
      direction: adjustedSpec.topN.direction,
    }];
    policiesApplied.push({
      policy_name: 'topn_ordering',
      applied: true,
      reason: 'Added ORDER BY for Top-N query',
      impact: 'Ensures correct ranking',
    });
  }

  return { adjustedSpec, policiesApplied };
}

/**
 * Execute SQL via RPC with timeout
 */
async function executeSQL(
  sql: string,
  timeout_ms: number
): Promise<{ data: any[] | null; error: string | null; rowCount: number }> {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeout_ms)
    );

    const queryPromise = supabase.rpc('exec_sql_secure', { sql_query: sql });

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    if (error) {
      return { data: null, error: error.message, rowCount: 0 };
    }

    // Extract rows from result
    let rows = [];
    if (Array.isArray(data)) {
      rows = data;
    } else if (data && typeof data === 'object' && data.result) {
      rows = Array.isArray(data.result) ? data.result : [data.result];
    }

    return {
      data: rows,
      error: null,
      rowCount: rows.length,
    };

  } catch (error: any) {
    return {
      data: null,
      error: error.message || 'Unknown execution error',
      rowCount: 0,
    };
  }
}

/**
 * Create error result
 */
function createErrorResult(
  exec_id: string,
  errorMessage: string,
  startTime: number
): ExecResult {
  return {
    exec_id,
    success: false,
    data: [],
    warnings: [{
      type: 'calculation',
      severity: 'error',
      message: errorMessage,
    }],
    execution_time_ms: Date.now() - startTime,
    rows_processed: 0,
    rows_returned: 0,
    created_at: new Date().toISOString(),
  };
}

/**
 * Execute with retry logic (for LLM refinement)
 */
export async function executeWithRetry(
  execSpec: ExecSpec,
  dataCard: DataCard,
  maxRetries: number = 2
): Promise<ExecResult> {
  let lastResult: ExecResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await execute(execSpec, dataCard);

    if (result.success) {
      return result;
    }

    lastResult = result;

    // If max retries reached, return the error
    if (attempt === maxRetries) {
      break;
    }

    console.log(`[Executor] Attempt ${attempt + 1} failed, retrying...`);
  }

  return lastResult!;
}
