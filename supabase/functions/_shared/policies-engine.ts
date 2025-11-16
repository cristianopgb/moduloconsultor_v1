/**
 * ===================================================================
 * POLICIES ENGINE
 * ===================================================================
 *
 * Automatic policy enforcement for analytics queries
 *
 * Policies:
 *   1. Missing Data: Handle nulls, empty strings, invalid values
 *   2. Outlier Detection: Identify and handle statistical outliers
 *   3. Performance Limits: Row limits, timeout guards
 *   4. Data Quality: Minimum quality score requirements
 *   5. Semantic Fallbacks: Alternative columns when primary is missing
 * ===================================================================
 */

import type { ExecSpec, DataCard, Warning, PolicyApplication } from './analytics-contracts.ts';

export interface PolicyConfig {
  enforceQualityMinimum?: number;
  maxRowsDefault?: number;
  outlierThresholdStdDev?: number;
  minSampleSize?: number;
  allowAutoFallbacks?: boolean;
}

export interface PolicyEnforcementResult {
  adjustedSpec: ExecSpec;
  policiesApplied: PolicyApplication[];
  warnings: Warning[];
  shouldProceed: boolean;
}

const DEFAULT_CONFIG: PolicyConfig = {
  enforceQualityMinimum: 50,
  maxRowsDefault: 10000,
  outlierThresholdStdDev: 3,
  minSampleSize: 10,
  allowAutoFallbacks: true,
};

/**
 * Main policy enforcement function
 */
export function enforceAnalyticsPolicies(
  execSpec: ExecSpec,
  dataCard: DataCard,
  config: PolicyConfig = {}
): PolicyEnforcementResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const adjustedSpec = { ...execSpec };
  const policiesApplied: PolicyApplication[] = [];
  const warnings: Warning[] = [];

  console.log('[PoliciesEngine] Enforcing analytics policies...');

  // Policy 1: Data Quality Check
  const qualityCheck = enforceQualityPolicy(dataCard, finalConfig);
  if (qualityCheck.blocked) {
    warnings.push({
      type: 'quality',
      severity: 'error',
      message: qualityCheck.reason!,
    });
    return {
      adjustedSpec,
      policiesApplied,
      warnings,
      shouldProceed: false,
    };
  }

  // Policy 2: Row Limit
  const rowLimitPolicy = enforceRowLimitPolicy(adjustedSpec, finalConfig);
  if (rowLimitPolicy.applied) {
    adjustedSpec.limit = rowLimitPolicy.limit!;
    policiesApplied.push({
      policy_name: 'row_limit',
      applied: true,
      reason: `Applied default row limit of ${rowLimitPolicy.limit}`,
      impact: 'Query performance improved',
    });
  }

  // Policy 3: Missing Data Handling
  const missingDataPolicy = enforceMissingDataPolicy(adjustedSpec, dataCard);
  if (missingDataPolicy.adjusted) {
    Object.assign(adjustedSpec, missingDataPolicy.spec);
    policiesApplied.push({
      policy_name: 'missing_data_handling',
      applied: true,
      reason: missingDataPolicy.reason!,
      impact: 'Added NULL filtering to improve data quality',
    });
  }

  // Policy 4: Outlier Detection
  const outlierPolicy = enforceOutlierPolicy(adjustedSpec, dataCard, finalConfig);
  if (outlierPolicy.detected) {
    warnings.push({
      type: 'quality',
      severity: 'warning',
      message: outlierPolicy.message!,
      affected_count: outlierPolicy.affectedColumns?.length,
    });
  }

  // Policy 5: Semantic Fallbacks
  const fallbackPolicy = enforceSemanticFallbacks(adjustedSpec, dataCard, finalConfig);
  if (fallbackPolicy.applied) {
    Object.assign(adjustedSpec, fallbackPolicy.spec);
    policiesApplied.push({
      policy_name: 'semantic_fallback',
      applied: true,
      reason: fallbackPolicy.reason!,
      impact: 'Used alternative column for missing data',
    });
    warnings.push({
      type: 'semantic',
      severity: 'info',
      message: fallbackPolicy.reason!,
    });
  }

  // Policy 6: Aggregation Safety
  const aggSafetyPolicy = enforceAggregationSafety(adjustedSpec, dataCard);
  if (aggSafetyPolicy.applied) {
    Object.assign(adjustedSpec, aggSafetyPolicy.spec);
    policiesApplied.push({
      policy_name: 'aggregation_safety',
      applied: true,
      reason: aggSafetyPolicy.reason!,
      impact: 'Prevented invalid aggregation',
    });
  }

  console.log(`[PoliciesEngine] Applied ${policiesApplied.length} policies`);

  return {
    adjustedSpec,
    policiesApplied,
    warnings,
    shouldProceed: true,
  };
}

/**
 * Policy 1: Data Quality Enforcement
 */
function enforceQualityPolicy(
  dataCard: DataCard,
  config: PolicyConfig
): { blocked: boolean; reason?: string } {
  if (dataCard.qualityScore < config.enforceQualityMinimum!) {
    return {
      blocked: true,
      reason: `Dataset quality score (${dataCard.qualityScore}) below minimum threshold (${config.enforceQualityMinimum})`,
    };
  }

  if (dataCard.totalRows < config.minSampleSize!) {
    return {
      blocked: true,
      reason: `Dataset has only ${dataCard.totalRows} rows, minimum required is ${config.minSampleSize}`,
    };
  }

  return { blocked: false };
}

/**
 * Policy 2: Row Limit Enforcement
 */
function enforceRowLimitPolicy(
  execSpec: ExecSpec,
  config: PolicyConfig
): { applied: boolean; limit?: number } {
  if (!execSpec.limit || execSpec.limit > config.maxRowsDefault!) {
    return {
      applied: true,
      limit: config.maxRowsDefault,
    };
  }

  return { applied: false };
}

/**
 * Policy 3: Missing Data Handling
 */
function enforceMissingDataPolicy(
  execSpec: ExecSpec,
  dataCard: DataCard
): { adjusted: boolean; spec?: ExecSpec; reason?: string } {
  const highNullColumns = dataCard.columns
    .filter(col => col.nullable_pct > 50)
    .map(col => col.name);

  if (highNullColumns.length === 0) {
    return { adjusted: false };
  }

  const affectedMeasures = execSpec.measures.filter(m =>
    m.column && highNullColumns.includes(m.column)
  );

  if (affectedMeasures.length === 0) {
    return { adjusted: false };
  }

  const adjustedSpec = { ...execSpec };

  if (!adjustedSpec.filters) {
    adjustedSpec.filters = [];
  }

  affectedMeasures.forEach(measure => {
    if (measure.column) {
      adjustedSpec.filters!.push({
        column: measure.column,
        operator: 'is_not_null',
        value: null,
      });
    }
  });

  return {
    adjusted: true,
    spec: adjustedSpec,
    reason: `Added NULL filters for columns with >50% missing data: ${highNullColumns.join(', ')}`,
  };
}

/**
 * Policy 4: Outlier Detection
 */
function enforceOutlierPolicy(
  execSpec: ExecSpec,
  dataCard: DataCard,
  config: PolicyConfig
): { detected: boolean; message?: string; affectedColumns?: string[] } {
  const numericColumns = dataCard.columns.filter(col => col.type === 'numeric');
  const outlierColumns: string[] = [];

  numericColumns.forEach(col => {
    const stats = dataCard.stats[col.name];
    if (!stats || !stats.mean || !stats.std_dev) return;

    const threshold = config.outlierThresholdStdDev! * stats.std_dev;
    const lowerBound = stats.mean - threshold;
    const upperBound = stats.mean + threshold;

    if (stats.min < lowerBound || stats.max > upperBound) {
      outlierColumns.push(col.name);
    }
  });

  if (outlierColumns.length > 0) {
    return {
      detected: true,
      message: `Potential outliers detected in columns: ${outlierColumns.join(', ')}. Consider filtering extreme values.`,
      affectedColumns: outlierColumns,
    };
  }

  return { detected: false };
}

/**
 * Policy 5: Semantic Fallbacks
 */
function enforceSemanticFallbacks(
  execSpec: ExecSpec,
  dataCard: DataCard,
  config: PolicyConfig
): { applied: boolean; spec?: ExecSpec; reason?: string } {
  if (!config.allowAutoFallbacks) {
    return { applied: false };
  }

  const availableColumns = new Set(dataCard.columns.map(c => c.name.toLowerCase()));
  const missingDimensions = execSpec.dimensions.filter(
    dim => !availableColumns.has(dim.toLowerCase())
  );

  if (missingDimensions.length === 0) {
    return { applied: false };
  }

  const fallbacks = getFallbackColumns(missingDimensions[0], dataCard);

  if (fallbacks.length === 0) {
    return { applied: false };
  }

  const adjustedSpec = { ...execSpec };
  adjustedSpec.dimensions = adjustedSpec.dimensions.map(dim =>
    missingDimensions.includes(dim) ? fallbacks[0] : dim
  );

  return {
    applied: true,
    spec: adjustedSpec,
    reason: `Column "${missingDimensions[0]}" not found, using fallback "${fallbacks[0]}"`,
  };
}

/**
 * Get fallback columns for a missing column
 */
function getFallbackColumns(missingColumn: string, dataCard: DataCard): string[] {
  const normalized = missingColumn.toLowerCase();
  const fallbacks: string[] = [];

  const similarColumns = dataCard.columns.filter(col => {
    const colNorm = col.name.toLowerCase();
    return (
      colNorm.includes(normalized) ||
      normalized.includes(colNorm) ||
      levenshteinDistance(normalized, colNorm) <= 3
    );
  });

  return similarColumns.map(c => c.name);
}

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }

  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Policy 6: Aggregation Safety
 */
function enforceAggregationSafety(
  execSpec: ExecSpec,
  dataCard: DataCard
): { applied: boolean; spec?: ExecSpec; reason?: string } {
  const hasAggregation = execSpec.measures.some(m => m.aggregation);

  if (!hasAggregation) {
    return { applied: false };
  }

  const hasDimensions = execSpec.dimensions.length > 0;

  if (!hasDimensions) {
    const adjustedSpec = { ...execSpec };

    const firstTextColumn = dataCard.columns.find(c => c.type === 'text');
    if (firstTextColumn) {
      adjustedSpec.dimensions = [firstTextColumn.name];

      return {
        applied: true,
        spec: adjustedSpec,
        reason: `Added dimension "${firstTextColumn.name}" for aggregation safety`,
      };
    }
  }

  return { applied: false };
}

/**
 * Validate that a policy application is safe
 */
export function validatePolicyApplication(
  policy: PolicyApplication,
  execSpec: ExecSpec,
  dataCard: DataCard
): { valid: boolean; reason?: string } {
  switch (policy.policy_name) {
    case 'row_limit':
      return { valid: true };

    case 'missing_data_handling':
      const filters = execSpec.filters || [];
      const hasNullFilters = filters.some(f => f.operator === 'is_not_null');
      return {
        valid: hasNullFilters,
        reason: hasNullFilters ? undefined : 'NULL filters not applied correctly',
      };

    case 'semantic_fallback':
      return { valid: true };

    case 'aggregation_safety':
      return {
        valid: execSpec.dimensions.length > 0,
        reason: execSpec.dimensions.length > 0 ? undefined : 'Missing GROUP BY dimensions',
      };

    default:
      return { valid: true };
  }
}

/**
 * Get policy recommendations for a dataset
 */
export function getPolicyRecommendations(dataCard: DataCard): string[] {
  const recommendations: string[] = [];

  if (dataCard.qualityScore < 70) {
    recommendations.push(
      `Dataset quality score is ${dataCard.qualityScore}. Consider data cleaning before analysis.`
    );
  }

  const highNullColumns = dataCard.columns.filter(col => col.nullable_pct > 30);
  if (highNullColumns.length > 0) {
    recommendations.push(
      `Columns with high NULL rates: ${highNullColumns.map(c => c.name).join(', ')}. Add explicit NULL filters.`
    );
  }

  const lowCardinalityColumns = dataCard.columns.filter(
    col => col.cardinality < 10 && col.cardinality > 0
  );
  if (lowCardinalityColumns.length > 0) {
    recommendations.push(
      `Low cardinality columns suitable for grouping: ${lowCardinalityColumns.map(c => c.name).join(', ')}`
    );
  }

  if (dataCard.totalRows < 100) {
    recommendations.push(
      `Dataset has only ${dataCard.totalRows} rows. Statistical analyses may be unreliable.`
    );
  }

  return recommendations;
}
