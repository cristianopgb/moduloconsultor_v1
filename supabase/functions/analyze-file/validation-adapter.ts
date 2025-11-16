/**
 * VALIDATION ADAPTER
 * Converts data-validator.ts output to ValidationReport contract
 */

import type { ValidationReport, ValidationCheck } from '../_shared/analytics-contracts.ts';

/**
 * Legacy validation result from data-validator.ts
 */
export interface LegacyValidationResult {
  overallScore: number;
  issues: LegacyIssue[];
  recommendations: string[];
  correctedData?: any[];
  summary: string;
}

export interface LegacyIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'outlier' | 'impossible_value' | 'inconsistency';
  column: string;
  rowIndices: number[];
  description: string;
  affectedCount: number;
  suggestedAction: 'exclude' | 'flag' | 'ignore';
  details?: Record<string, any>;
}

/**
 * Convert legacy validation result to ValidationReport contract
 */
export function toValidationReport(
  legacy: LegacyValidationResult
): ValidationReport {
  const checks: ValidationCheck[] = legacy.issues.map(issue => ({
    check_name: `${issue.type}_${issue.column}`,
    passed: false, // issues are failures
    severity: issue.severity,
    message: issue.description,
    affected_rows: issue.rowIndices,
    affected_count: issue.affectedCount,
    suggested_action: issue.suggestedAction,
    details: issue.details,
  }));

  // Add overall validation check
  const overallPassed = legacy.overallScore >= 70;
  checks.push({
    check_name: 'overall_quality',
    passed: overallPassed,
    severity: overallPassed ? 'info' : legacy.overallScore >= 50 ? 'warning' : 'critical',
    message: overallPassed
      ? `Data quality is good (${legacy.overallScore}/100)`
      : `Data quality needs attention (${legacy.overallScore}/100)`,
    suggested_action: overallPassed ? 'ignore' : 'manual_review',
  });

  return {
    overall_pass: overallPassed,
    overall_score: legacy.overallScore,
    checks,
    corrected_data: legacy.correctedData,
    summary: legacy.summary,
    recommendations: legacy.recommendations,
    created_at: new Date().toISOString(),
  };
}

/**
 * Create validation report from data-validator.ts validateDataset function
 */
export async function createValidationReport(
  rows: any[],
  columns: string[],
  schema: any[],
  config?: any
): Promise<ValidationReport> {
  // Import the actual validator
  const { validateDataset } = await import('./data-validator.ts');

  const legacyResult = await validateDataset(rows, columns, schema, config);

  return toValidationReport(legacyResult);
}

/**
 * Extract anomalies for DataCard metadata
 */
export function extractAnomalies(report: ValidationReport): string[] {
  return report.checks
    .filter(check => !check.passed && check.severity === 'critical')
    .map(check => check.message)
    .slice(0, 5); // Top 5 critical issues
}

/**
 * Calculate quality score suitable for DataCard
 */
export function extractQualityScore(report: ValidationReport): number {
  return report.overall_score;
}
