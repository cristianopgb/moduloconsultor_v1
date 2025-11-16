/**
 * ===================================================================
 * ANALYTICS CONTRACTS - Formal JSON Contracts for Analytics System
 * ===================================================================
 *
 * Central definitions for all I/O between Analytics layers:
 * - DataCard: Dataset metadata and quality profile
 * - Plan: Analysis plan with steps and confidence
 * - ExecSpec: Execution specification (DSL, not SQL)
 * - ExecResult: Execution results with lineage
 * - ValidationReport: Data quality assessment
 * - VizSpec: Chart/visualization specification
 * - NarrativeDoc: Structured narrative report
 *
 * Purpose: Enable separation of cognition (LLM) from execution (deterministic),
 * facilitate auditing, enable reproducibility.
 * ===================================================================
 */

// ==================== DATA CARD ====================

export interface DataCard {
  dataset_id: string;
  columns: ColumnMetadata[];
  totalRows: number;
  qualityScore: number; // 0-100
  sampleRows: any[]; // Stratified sample
  stats: DataStats;
  semantic_mapping?: Record<string, string>; // raw column → canonical entity
  detected_domain?: 'logistics' | 'sales' | 'hr' | 'financial' | 'generic';
  timeframe?: { start?: string; end?: string };
  created_at: string;
}

export interface ColumnMetadata {
  name: string;
  normalized_name: string;
  type: 'text' | 'numeric' | 'date' | 'boolean' | 'empty';
  nullable_pct: number; // 0-100
  cardinality: number;
  unique_values_sample?: any[];
  stats?: {
    min?: number;
    max?: number;
    avg?: number;
    median?: number;
    stddev?: number;
  };
  is_candidate_key?: boolean;
}

export interface DataStats {
  size_category: 'small' | 'medium' | 'large'; // <10k, 10k-100k, >100k
  completeness_pct: number; // avg % non-null across columns
  consistency_issues: number;
  outliers_detected: number;
  duplicates_detected: number;
}

// ==================== PLAN ====================

export interface Plan {
  objective: string;
  steps: PlanStep[];
  preconditions: string[];
  dependencies: string[];
  confidence: number; // 0-100
  needs_escalation: boolean;
  estimated_complexity: 'simple' | 'medium' | 'complex';
  limitations_detected?: string[];
  created_at: string;
}

export interface PlanStep {
  step_number: number;
  description: string;
  required_columns: string[];
  expected_output: string;
  risks?: string[];
}

// ==================== EXEC SPEC (DSL) ====================

export interface ExecSpec {
  operations: Operation[];
  dimensions: string[]; // group by columns
  measures: Measure[];
  filters?: Filter[];
  aggregations?: Aggregation[];
  topN?: TopNSpec;
  windowFunctions?: WindowFunction[];
  cohorts?: CohortSpec[];
  joins?: JoinSpec[];
  orderBy?: OrderSpec[];
  limit?: number;
  metadata?: {
    created_by: 'planner' | 'user';
    intent_summary: string;
  };
}

export interface Operation {
  op: 'clean' | 'derive' | 'aggregate' | 'topN' | 'window' | 'cohort' | 'join' | 'filter' | 'pivot';
  params: Record<string, any>;
  output_columns?: string[];
}

export interface Measure {
  name: string;
  metric_id?: string; // reference to metrics_registry
  formula?: string; // if custom
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'stddev';
  column?: string;
}

export interface Filter {
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in' | 'like' | 'between' | 'is_null' | 'is_not_null';
  value: any;
}

export interface Aggregation {
  column: string;
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';
  alias: string;
}

export interface TopNSpec {
  n: number;
  orderBy: string;
  direction: 'asc' | 'desc';
  include_others: boolean;
}

export interface WindowFunction {
  function: 'row_number' | 'rank' | 'dense_rank' | 'lag' | 'lead' | 'moving_avg';
  partitionBy?: string[];
  orderBy: string;
  alias: string;
}

export interface CohortSpec {
  cohort_column: string;
  cohort_definition: string;
  time_column: string;
}

export interface JoinSpec {
  type: 'inner' | 'left' | 'right' | 'full';
  with_table: string;
  on_columns: { left: string; right: string }[];
}

export interface OrderSpec {
  column: string;
  direction: 'asc' | 'desc';
}

// ==================== EXEC RESULT ====================

export interface ExecResult {
  exec_id: string; // unique hash for lineage
  success: boolean;
  data: any[]; // result rows
  metrics?: Record<string, any>; // calculated metrics
  coverage_pct?: number; // % of data used (after applying policies)
  warnings: Warning[];
  execution_time_ms: number;
  rows_processed: number;
  rows_returned: number;
  policies_applied?: PolicyApplication[];
  created_at: string;
}

export interface Warning {
  type: 'data_quality' | 'policy_applied' | 'performance' | 'calculation';
  severity: 'info' | 'warning' | 'error';
  message: string;
  affected_count?: number;
  details?: Record<string, any>;
}

export interface PolicyApplication {
  policy_name: string;
  applied: boolean;
  reason: string;
  impact: string;
}

// ==================== VALIDATION REPORT ====================

export interface ValidationReport {
  overall_pass: boolean;
  overall_score: number; // 0-100
  checks: ValidationCheck[];
  corrected_data?: any[];
  summary: string;
  recommendations: string[];
  created_at: string;
}

export interface ValidationCheck {
  check_name: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  affected_rows?: number[];
  affected_count?: number;
  suggested_action: 'exclude' | 'flag' | 'ignore' | 'manual_review';
  details?: Record<string, any>;
}

// ==================== VIZ SPEC ====================

export interface VizSpec {
  viz_id: string;
  exec_id_ref: string; // lineage reference
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter' | 'gauge' | 'table' | 'pareto';
  title: string;
  description: string;
  data: any[];
  config: VizConfig;
  insights: string[];
  position_in_report: number;
  created_at: string;
}

export interface VizConfig {
  xAxis?: string;
  yAxis?: string | string[];
  series?: string[];
  colors?: Record<string, string>;
  thresholds?: Record<string, number>;
  showTrend?: boolean;
  showBenchmark?: boolean;
  horizontal?: boolean;
  stacked?: boolean;
  format?: {
    xAxis?: 'date' | 'number' | 'text' | 'percentage';
    yAxis?: 'date' | 'number' | 'text' | 'percentage';
    decimals?: number;
    prefix?: string;
    suffix?: string;
  };
}

// ==================== NARRATIVE DOC ====================

export interface NarrativeDoc {
  doc_id: string;
  sections: NarrativeSection[];
  exec_ids_used: string[]; // all exec_ids referenced
  metadata: NarrativeMetadata;
  created_at: string;
}

export interface NarrativeSection {
  section_id: string;
  type: 'introduction' | 'situation_overview' | 'key_findings' | 'investigation' | 'diagnosis' | 'recommendations' | 'conclusion' | 'next_steps';
  title: string;
  content: string;
  exec_ids_ref?: string[]; // lineage: which executions support this section
  subsections?: NarrativeSection[];
  order: number;
}

export interface NarrativeMetadata {
  domain: 'logistics' | 'sales' | 'hr' | 'financial' | 'generic';
  user_goals?: string[];
  benchmarks_used?: Record<string, number>;
  quality_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  limitations: string[];
}

// ==================== SEMANTIC LAYER ====================

export interface SemanticMapping {
  raw_column: string;
  canonical_entity: string;
  confidence: number; // 0-100
  synonyms: string[];
  entity_type: 'dimension' | 'measure';
}

export interface SemanticResolution {
  mappings: SemanticMapping[];
  unresolved_columns: string[];
  suggestions: {
    column: string;
    suggested_entity: string;
    confidence: number;
  }[];
}

// ==================== METRICS ====================

export interface Metric {
  metric_id: string;
  name: string;
  display_name: string;
  formula_template: string;
  required_columns: string[];
  dependencies?: string[]; // other metric_ids
  fallback_rules?: FallbackRule[];
  granularity: 'row' | 'group' | 'aggregate';
  domain?: 'logistics' | 'sales' | 'hr' | 'financial' | 'generic';
  unit?: string;
  format?: 'number' | 'percentage' | 'currency' | 'duration';
}

export interface FallbackRule {
  condition: string;
  fallback_metric_id?: string;
  warning_message: string;
}

export interface MetricCalculationResult {
  metric_id: string;
  value: any;
  coverage_pct: number;
  warnings: string[];
  calculation_method: string;
}

// ==================== POLICIES ====================

export interface PolicyResult {
  policies_applied: PolicyApplication[];
  warnings: Warning[];
  adjustments: {
    original_request: string;
    adjusted_request: string;
    reason: string;
  }[];
  coverage_impact: {
    original_coverage_pct: number;
    adjusted_coverage_pct: number;
  };
}

// ==================== LINEAGE ====================

export interface LineageTrace {
  exec_id: string;
  exec_spec: ExecSpec;
  data_card_summary: {
    dataset_id: string;
    columns_used: string[];
    rows_processed: number;
  };
  sql_generated?: string;
  result_summary: {
    rows_returned: number;
    metrics_calculated: string[];
  };
  execution_time_ms: number;
  created_at: string;
}

export interface ArtifactLineage {
  artifact_id: string;
  artifact_type: 'chart' | 'table' | 'metric' | 'narrative';
  exec_id: string;
  artifact_spec: VizSpec | any;
  position_in_report: number;
  created_at: string;
}

// ==================== UTILITY TYPES ====================

export interface AnalyticsError {
  error_code: string;
  message: string;
  step: string;
  details?: any;
  recoverable: boolean;
  suggested_action?: string;
}

export interface AnalyticsPerformanceLog {
  request_id: string;
  user_id: string;
  conversation_id: string;
  plan_time_ms: number;
  exec_time_ms: number;
  total_time_ms: number;
  confidence_score: number;
  had_refinement: boolean;
  token_cost_estimated: number;
  success: boolean;
  error?: AnalyticsError;
  created_at: string;
}

// ==================== VALIDATION HELPERS ====================

export function validateDataCard(data: any): data is DataCard {
  return (
    typeof data === 'object' &&
    typeof data.dataset_id === 'string' &&
    Array.isArray(data.columns) &&
    typeof data.totalRows === 'number' &&
    typeof data.qualityScore === 'number' &&
    Array.isArray(data.sampleRows)
  );
}

export function validateExecSpec(data: any): data is ExecSpec {
  return (
    typeof data === 'object' &&
    Array.isArray(data.operations) &&
    Array.isArray(data.dimensions) &&
    Array.isArray(data.measures)
  );
}

export function validateExecResult(data: any): data is ExecResult {
  return (
    typeof data === 'object' &&
    typeof data.exec_id === 'string' &&
    typeof data.success === 'boolean' &&
    Array.isArray(data.data) &&
    Array.isArray(data.warnings)
  );
}
