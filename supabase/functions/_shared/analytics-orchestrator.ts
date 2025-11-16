/**
 * ===================================================================
 * ANALYTICS ORCHESTRATOR
 * ===================================================================
 *
 * High-level orchestrator that combines:
 * - LLM Router (for calling LLMs)
 * - Intelligent Planner (semantic + metrics + policies)
 * - Executor (runs ExecSpec)
 * - Lineage Logger (tracks everything)
 *
 * This is the main entry point for analytics requests
 * ===================================================================
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import type {
  DataCard,
  ExecSpec,
  ExecResult,
  Plan,
  VizSpec,
  NarrativeDoc,
} from './analytics-contracts.ts';
import { buildDataCard } from './datacard-builder.ts';
import { createIntelligentPlan, type EnrichedPlan } from './intelligent-planner.ts';
import { execute } from './executor/index.ts';
import {
  logExecution,
  logVisualization,
  logNarrative,
} from './lineage-logger.ts';
import { callLLM, extractJSON, type LLMRequest } from './llm-router.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

export interface AnalysisRequest {
  dataset_id: string;
  user_question: string;
  user_id?: string;
  conversation_id?: string;
  options?: {
    domain?: 'logistics' | 'sales' | 'hr' | 'financial' | 'generic';
    enableSemantics?: boolean;
    autoSuggestMetrics?: boolean;
    enforcePolicies?: boolean;
    includeVisualizations?: boolean;
    includeNarrative?: boolean;
    llm_model?: 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';
  };
}

export interface AnalysisResponse {
  success: boolean;
  plan: EnrichedPlan;
  execution: ExecResult;
  visualizations?: VizSpec[];
  narrative?: NarrativeDoc;
  warnings: string[];
  metadata: {
    total_time_ms: number;
    llm_calls: number;
    llm_cost_usd: number;
    confidence: number;
  };
}

/**
 * Main orchestration function
 */
export async function analyzeDataset(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  const startTime = Date.now();
  const warnings: string[] = [];
  let llmCalls = 0;
  let llmCostUsd = 0;

  console.log(
    `[AnalyticsOrchestrator] Starting analysis for dataset ${request.dataset_id}`
  );

  // Step 1: Build DataCard
  console.log('[AnalyticsOrchestrator] Step 1: Building DataCard...');
  const dataCard = await buildDataCard(request.dataset_id);

  if (dataCard.qualityScore < 50) {
    warnings.push(
      `Dataset quality score is low (${dataCard.qualityScore}/100). Results may be unreliable.`
    );
  }

  // Step 2: Generate base ExecSpec using LLM
  console.log('[AnalyticsOrchestrator] Step 2: Generating ExecSpec via LLM...');
  const llmRequest: LLMRequest = {
    model: request.options?.llm_model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: buildAnalysisSystemPrompt(dataCard, request.options?.domain),
      },
      {
        role: 'user',
        content: request.user_question,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  };

  const llmResponse = await callLLM(llmRequest, {
    maxRetries: 3,
    timeout: 60000,
  });

  llmCalls++;
  llmCostUsd += llmResponse.usage.estimated_cost_usd;

  const baseExecSpec = extractJSON<ExecSpec>(llmResponse.content);

  console.log(
    `[AnalyticsOrchestrator] LLM generated ExecSpec with ${baseExecSpec.dimensions.length} dimensions, ${baseExecSpec.measures.length} measures`
  );

  // Step 3: Create intelligent plan (semantic + metrics + policies)
  console.log('[AnalyticsOrchestrator] Step 3: Creating intelligent plan...');
  const plan = await createIntelligentPlan(baseExecSpec, dataCard, {
    enableSemantics: request.options?.enableSemantics ?? true,
    autoSuggestMetrics: request.options?.autoSuggestMetrics ?? true,
    enforcePolicies: request.options?.enforcePolicies ?? true,
    domain: request.options?.domain,
  });

  if (plan.needs_escalation) {
    warnings.push(
      `Plan confidence is low (${(plan.confidence * 100).toFixed(0)}%). Consider reviewing the analysis.`
    );
  }

  warnings.push(...plan.policies_context.warnings.map(w => w.message));

  // Step 4: Execute the enriched plan
  console.log('[AnalyticsOrchestrator] Step 4: Executing plan...');
  const execution = await execute(plan.enriched_spec, dataCard, {
    enableCache: true,
    timeout_ms: 30000,
  });

  if (!execution.success) {
    throw new Error(`Execution failed: ${execution.error}`);
  }

  warnings.push(...execution.warnings.map(w => w.message));

  // Step 5: Log execution lineage
  console.log('[AnalyticsOrchestrator] Step 5: Logging lineage...');
  await logExecution(
    plan.enriched_spec,
    dataCard,
    execution,
    request.user_id,
    request.conversation_id
  );

  // Step 6: Generate visualizations (optional)
  let visualizations: VizSpec[] | undefined;
  if (request.options?.includeVisualizations) {
    console.log('[AnalyticsOrchestrator] Step 6: Generating visualizations...');
    visualizations = await generateVisualizations(
      execution,
      dataCard,
      request.user_question,
      request.options?.llm_model
    );

    llmCalls++;
    llmCostUsd += 0.001;

    for (const viz of visualizations) {
      await logVisualization(viz, execution.exec_id);
    }
  }

  // Step 7: Generate narrative (optional)
  let narrative: NarrativeDoc | undefined;
  if (request.options?.includeNarrative) {
    console.log('[AnalyticsOrchestrator] Step 7: Generating narrative...');
    narrative = await generateNarrative(
      execution,
      dataCard,
      plan,
      request.user_question,
      request.options?.llm_model
    );

    llmCalls++;
    llmCostUsd += 0.002;

    await logNarrative(narrative, [execution.exec_id]);
  }

  const totalTimeMs = Date.now() - startTime;

  console.log(
    `[AnalyticsOrchestrator] Analysis complete in ${totalTimeMs}ms, ${llmCalls} LLM calls, $${llmCostUsd.toFixed(4)}`
  );

  return {
    success: true,
    plan,
    execution,
    visualizations,
    narrative,
    warnings,
    metadata: {
      total_time_ms: totalTimeMs,
      llm_calls: llmCalls,
      llm_cost_usd: llmCostUsd,
      confidence: plan.confidence,
    },
  };
}

/**
 * Build system prompt for analysis
 */
function buildAnalysisSystemPrompt(
  dataCard: DataCard,
  domain?: string
): string {
  const columnsList = dataCard.columns
    .map(
      col =>
        `- ${col.name} (${col.type}, cardinality: ${col.cardinality}, nulls: ${col.nullable_pct}%)`
    )
    .join('\n');

  const semanticMapping = dataCard.semantic_mapping
    ? '\n\nSemantic mappings:\n' +
      Object.entries(dataCard.semantic_mapping)
        .map(([raw, canonical]) => `- ${raw} → ${canonical}`)
        .join('\n')
    : '';

  return `You are an expert data analyst. Generate an ExecSpec (structured query plan) for the user's question.

Dataset information:
- Total rows: ${dataCard.totalRows}
- Quality score: ${dataCard.qualityScore}/100
- Domain: ${domain || dataCard.detected_domain || 'generic'}

Available columns:
${columnsList}
${semanticMapping}

ExecSpec format (JSON):
{
  "dimensions": ["column1", "column2"],
  "measures": [
    { "name": "metric_name", "aggregation": "sum|avg|count|min|max", "column": "column_name" }
  ],
  "filters": [
    { "column": "column_name", "operator": "=|!=|>|<|>=|<=|in|like|between|is_null|is_not_null", "value": any }
  ],
  "orderBy": [
    { "column": "column_name", "direction": "asc|desc" }
  ],
  "limit": 100
}

Rules:
1. Use semantic canonical names when available
2. Choose appropriate aggregations based on data types
3. Add filters to handle NULL values when necessary
4. Limit results to reasonable amounts (10-100 rows)
5. Return ONLY valid JSON, no markdown or explanations

Generate the ExecSpec now:`;
}

/**
 * Generate visualizations from execution results
 */
async function generateVisualizations(
  execution: ExecResult,
  dataCard: DataCard,
  userQuestion: string,
  model?: string
): Promise<VizSpec[]> {
  const llmRequest: LLMRequest = {
    model: (model as any) || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a data visualization expert. Suggest 1-3 appropriate charts for the analysis results.

Chart types available: bar, line, pie, scatter, heatmap, table

Return JSON array:
[
  {
    "chart_type": "bar|line|pie|scatter|heatmap|table",
    "title": "Chart title",
    "x_axis": "column_name",
    "y_axis": "column_name",
    "config": { "stacked": boolean, "showLegend": boolean }
  }
]`,
      },
      {
        role: 'user',
        content: `Question: ${userQuestion}\n\nData columns: ${execution.data.length > 0 ? Object.keys(execution.data[0]).join(', ') : 'none'}\n\nSuggest charts:`,
      },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  };

  const response = await callLLM(llmRequest);
  const charts = extractJSON<any>(response.content);

  return (charts.charts || []).map((chart: any) => ({
    chart_type: chart.chart_type,
    title: chart.title,
    x_axis: chart.x_axis,
    y_axis: chart.y_axis,
    config: chart.config || {},
    exec_id_ref: execution.exec_id,
  }));
}

/**
 * Generate narrative from execution results
 */
async function generateNarrative(
  execution: ExecResult,
  dataCard: DataCard,
  plan: EnrichedPlan,
  userQuestion: string,
  model?: string
): Promise<NarrativeDoc> {
  const dataPreview = execution.data
    .slice(0, 5)
    .map(row => JSON.stringify(row))
    .join('\n');

  const llmRequest: LLMRequest = {
    model: (model as any) || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a data storytelling expert. Create a structured narrative document with sections.

Return JSON:
{
  "title": "Analysis title",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Section content (can use markdown)",
      "section_type": "summary|insight|warning|recommendation|methodology"
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `Question: ${userQuestion}

Data sample:
${dataPreview}

Total rows: ${execution.data.length}
Quality score: ${dataCard.qualityScore}/100
Confidence: ${(plan.confidence * 100).toFixed(0)}%

Policies applied: ${plan.policies_context.policies_applied}
Warnings: ${plan.policies_context.warnings.length}

Create narrative:`,
      },
    ],
    temperature: 0.7,
  };

  const response = await callLLM(llmRequest);
  const narrative = extractJSON<NarrativeDoc>(response.content);

  return {
    ...narrative,
    exec_ids_used: [execution.exec_id],
    metadata: {
      generated_at: new Date().toISOString(),
      model_used: response.model,
      confidence: plan.confidence,
    },
  };
}

/**
 * Quick analysis (simplified interface)
 */
export async function quickAnalysis(
  datasetId: string,
  question: string,
  userId?: string
): Promise<{ data: any[]; insights: string[] }> {
  const response = await analyzeDataset({
    dataset_id: datasetId,
    user_question: question,
    user_id: userId,
    options: {
      enableSemantics: true,
      autoSuggestMetrics: true,
      enforcePolicies: true,
      includeVisualizations: false,
      includeNarrative: false,
      llm_model: 'gpt-4o-mini',
    },
  });

  const insights = [
    `Analysis confidence: ${(response.metadata.confidence * 100).toFixed(0)}%`,
    `Returned ${response.execution.data.length} rows`,
    ...response.warnings.slice(0, 3),
  ];

  return {
    data: response.execution.data,
    insights,
  };
}
