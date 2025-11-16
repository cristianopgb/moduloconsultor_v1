/**
 * ===================================================================
 * INTELLIGENT PLANNER
 * ===================================================================
 *
 * Orchestrates semantic layer, metrics calculator, and policies engine
 * to create optimal analysis plans
 *
 * Flow:
 *   1. Resolve column names via semantic layer
 *   2. Suggest metrics based on available data
 *   3. Enforce policies and generate warnings
 *   4. Return enriched ExecSpec with lineage metadata
 * ===================================================================
 */

import type { ExecSpec, DataCard, Plan, Warning } from './analytics-contracts.ts';
import { resolveDataCard, isKnownEntity } from './semantic-layer.ts';
import {
  suggestMetrics,
  canCalculateMetric,
  enrichExecSpecWithMetrics,
  getMetricDefinition,
} from './metrics-calculator.ts';
import {
  enforceAnalyticsPolicies,
  getPolicyRecommendations,
  type PolicyConfig,
} from './policies-engine.ts';

export interface PlanningOptions {
  enableSemantics?: boolean;
  autoSuggestMetrics?: boolean;
  enforcePolicies?: boolean;
  policyConfig?: PolicyConfig;
  domain?: 'logistics' | 'sales' | 'hr' | 'financial' | 'generic';
}

export interface EnrichedPlan extends Plan {
  enriched_spec: ExecSpec;
  semantic_context: {
    resolved_columns: Record<string, string>;
    known_entities: number;
    total_columns: number;
  };
  metrics_context: {
    suggested_metrics: string[];
    calculable_metrics: string[];
    missing_dependencies: Record<string, string[]>;
  };
  policies_context: {
    policies_applied: number;
    warnings: Warning[];
    recommendations: string[];
  };
}

const DEFAULT_OPTIONS: PlanningOptions = {
  enableSemantics: true,
  autoSuggestMetrics: true,
  enforcePolicies: true,
  policyConfig: {},
};

/**
 * Main intelligent planning function
 */
export async function createIntelligentPlan(
  baseExecSpec: ExecSpec,
  dataCard: DataCard,
  options: PlanningOptions = {}
): Promise<EnrichedPlan> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log('[IntelligentPlanner] Creating intelligent plan...');

  let enrichedDataCard = dataCard;
  const semanticContext = {
    resolved_columns: {} as Record<string, string>,
    known_entities: 0,
    total_columns: dataCard.columns.length,
  };

  // Step 1: Semantic Layer Resolution
  if (opts.enableSemantics) {
    console.log('[IntelligentPlanner] Applying semantic layer...');
    enrichedDataCard = await resolveDataCard(dataCard, { domain: opts.domain });

    enrichedDataCard.columns.forEach(col => {
      const canonical = (col as any).canonical_name || col.name;
      semanticContext.resolved_columns[col.name] = canonical;
      if ((col as any).mapping_confidence >= 0.85) {
        semanticContext.known_entities++;
      }
    });

    console.log(
      `[IntelligentPlanner] Resolved ${semanticContext.known_entities}/${semanticContext.total_columns} columns to known entities`
    );
  }

  // Step 2: Metrics Suggestion
  const metricsContext = {
    suggested_metrics: [] as string[],
    calculable_metrics: [] as string[],
    missing_dependencies: {} as Record<string, string[]>,
  };

  if (opts.autoSuggestMetrics) {
    console.log('[IntelligentPlanner] Suggesting metrics...');
    metricsContext.suggested_metrics = await suggestMetrics(enrichedDataCard);

    for (const metric of metricsContext.suggested_metrics) {
      const canCalc = await canCalculateMetric(metric, enrichedDataCard);
      if (canCalc.can) {
        metricsContext.calculable_metrics.push(metric);
      } else if (canCalc.missing.length > 0) {
        metricsContext.missing_dependencies[metric] = canCalc.missing;
      }
    }

    console.log(
      `[IntelligentPlanner] Can calculate ${metricsContext.calculable_metrics.length}/${metricsContext.suggested_metrics.length} metrics`
    );
  }

  // Step 3: Enrich ExecSpec with metrics (if requested)
  let enrichedSpec = { ...baseExecSpec };

  if (metricsContext.calculable_metrics.length > 0 && baseExecSpec.measures.length === 0) {
    console.log('[IntelligentPlanner] Enriching spec with suggested metrics...');
    enrichedSpec = await enrichExecSpecWithMetrics(
      enrichedSpec,
      enrichedDataCard,
      metricsContext.calculable_metrics.slice(0, 3)
    );
  }

  // Step 4: Policy Enforcement
  const policiesContext = {
    policies_applied: 0,
    warnings: [] as Warning[],
    recommendations: [] as string[],
  };

  if (opts.enforcePolicies) {
    console.log('[IntelligentPlanner] Enforcing policies...');
    const policyResult = enforceAnalyticsPolicies(
      enrichedSpec,
      enrichedDataCard,
      opts.policyConfig
    );

    if (!policyResult.shouldProceed) {
      console.warn('[IntelligentPlanner] Policies blocked execution');
    }

    enrichedSpec = policyResult.adjustedSpec;
    policiesContext.policies_applied = policyResult.policiesApplied.length;
    policiesContext.warnings = policyResult.warnings;
    policiesContext.recommendations = getPolicyRecommendations(enrichedDataCard);

    console.log(
      `[IntelligentPlanner] Applied ${policiesContext.policies_applied} policies, ${policiesContext.warnings.length} warnings`
    );
  }

  // Step 5: Generate confidence score
  const confidence = calculatePlanConfidence(
    semanticContext,
    metricsContext,
    policiesContext
  );

  console.log(`[IntelligentPlanner] Plan confidence: ${(confidence * 100).toFixed(0)}%`);

  // Step 6: Build enriched plan
  const enrichedPlan: EnrichedPlan = {
    plan_id: crypto.randomUUID(),
    steps: generatePlanSteps(enrichedSpec, enrichedDataCard),
    exec_spec: enrichedSpec,
    enriched_spec: enrichedSpec,
    estimated_cost: estimateCost(enrichedSpec, enrichedDataCard),
    confidence,
    needs_escalation: confidence < 0.7,
    preconditions: generatePreconditions(enrichedDataCard),
    semantic_context: semanticContext,
    metrics_context: metricsContext,
    policies_context: policiesContext,
  };

  return enrichedPlan;
}

/**
 * Calculate plan confidence score
 */
function calculatePlanConfidence(
  semanticContext: any,
  metricsContext: any,
  policiesContext: any
): number {
  let score = 1.0;

  const semanticScore =
    semanticContext.total_columns > 0
      ? semanticContext.known_entities / semanticContext.total_columns
      : 0.5;
  score *= 0.4 + semanticScore * 0.6;

  if (policiesContext.warnings.some((w: Warning) => w.severity === 'error')) {
    score *= 0.3;
  } else if (policiesContext.warnings.some((w: Warning) => w.severity === 'warning')) {
    score *= 0.7;
  }

  if (Object.keys(metricsContext.missing_dependencies).length > 0) {
    score *= 0.8;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Generate plan steps
 */
function generatePlanSteps(execSpec: ExecSpec, dataCard: DataCard): string[] {
  const steps: string[] = [];

  if (execSpec.filters && execSpec.filters.length > 0) {
    steps.push(`Filter data: ${execSpec.filters.length} condition(s)`);
  }

  if (execSpec.dimensions.length > 0) {
    steps.push(`Group by: ${execSpec.dimensions.join(', ')}`);
  }

  if (execSpec.measures.length > 0) {
    steps.push(`Calculate ${execSpec.measures.length} measure(s)`);
  }

  if (execSpec.orderBy && execSpec.orderBy.length > 0) {
    steps.push(`Order by: ${execSpec.orderBy.map(o => o.column).join(', ')}`);
  }

  if (execSpec.limit) {
    steps.push(`Limit to ${execSpec.limit} rows`);
  }

  return steps;
}

/**
 * Estimate execution cost
 */
function estimateCost(execSpec: ExecSpec, dataCard: DataCard): number {
  let cost = 0;

  cost += dataCard.totalRows * 0.001;

  cost += execSpec.dimensions.length * 10;
  cost += execSpec.measures.length * 20;

  if (execSpec.filters && execSpec.filters.length > 0) {
    cost += execSpec.filters.length * 5;
  }

  return Math.round(cost);
}

/**
 * Generate preconditions
 */
function generatePreconditions(dataCard: DataCard): string[] {
  const preconditions: string[] = [];

  if (dataCard.qualityScore < 70) {
    preconditions.push(`Dataset quality score: ${dataCard.qualityScore}/100`);
  }

  const highNullColumns = dataCard.columns.filter(col => col.nullable_pct > 30);
  if (highNullColumns.length > 0) {
    preconditions.push(`${highNullColumns.length} column(s) with >30% NULL values`);
  }

  if (dataCard.totalRows < 100) {
    preconditions.push(`Small dataset: only ${dataCard.totalRows} rows`);
  }

  return preconditions;
}

/**
 * Validate if a plan can be executed
 */
export function validatePlan(plan: EnrichedPlan, dataCard: DataCard): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (plan.confidence < 0.5) {
    errors.push(`Plan confidence too low: ${(plan.confidence * 100).toFixed(0)}%`);
  }

  const hasBlockingWarnings = plan.policies_context.warnings.some(
    w => w.severity === 'error'
  );
  if (hasBlockingWarnings) {
    errors.push('Plan has blocking policy violations');
  }

  const availableColumns = new Set(dataCard.columns.map(c => c.name.toLowerCase()));
  plan.enriched_spec.dimensions.forEach(dim => {
    if (!availableColumns.has(dim.toLowerCase())) {
      errors.push(`Dimension column not found: ${dim}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
