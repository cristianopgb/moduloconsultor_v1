/**
 * ===================================================================
 * ANALYTICS ORCHESTRATOR V2 - COMPLETE 5-STAGE PIPELINE
 * ===================================================================
 *
 * Implements the deterministic analytics engine with:
 * 1. Schema detection
 * 2. Semantic mapping
 * 3. Template matching
 * 4. Execution (template or fallback)
 * 5. Observability logging
 *
 * FIXED: No more RAG dependency, always returns useful results
 * ===================================================================
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { DataCard, ExecResult } from './analytics-contracts.ts';
import { buildDataCard } from './datacard-builder.ts';
import { resolveDataCard } from './semantic-layer.ts';
import { matchTemplate } from './template-loader.ts';
import { executeFallback, canAnalyze, suggestFallbackStrategy } from './universal-fallback.ts';
import { execute } from './executor/index.ts';
import { getConfig, logConfig, validateConfig } from './analytics-config.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

export interface AnalysisRequestV2 {
  dataset_id: string;
  user_question: string;
  user_id?: string;
  conversation_id?: string;
  analysis_id?: string;
}

export interface AnalysisResponseV2 {
  success: boolean;
  result: ExecResult;
  metadata: {
    pipeline_stage_completed: string; // 'schema' | 'semantic' | 'template' | 'fallback'
    template_matched: boolean;
    template_used?: string;
    fallback_strategy?: string;
    semantic_mappings_applied: number;
    semantic_confidence_avg: number;
    total_time_ms: number;
    flags_active: Record<string, boolean>;
  };
  warnings: string[];
}

/**
 * Main V2 orchestration - 5-stage deterministic pipeline
 */
export async function analyzeDatasetV2(
  request: AnalysisRequestV2
): Promise<AnalysisResponseV2> {
  const startTime = Date.now();
  const config = getConfig();
  const warnings: string[] = [];

  // Validate config
  const configValidation = validateConfig(config);
  if (!configValidation.valid) {
    throw new Error(`Invalid configuration: ${configValidation.errors.join(', ')}`);
  }

  if (config.verbose_logging) {
    logConfig(config);
  }

  console.log(`[OrchestratorV2] Starting 5-stage pipeline for dataset ${request.dataset_id}`);

  // ==================== STAGE 1: SCHEMA DETECTION ====================
  console.log('[OrchestratorV2] STAGE 1/5: Detecting schema...');
  const schemaStartTime = Date.now();

  let dataCard: DataCard;
  try {
    dataCard = await buildDataCard(request.dataset_id);
    console.log(`[OrchestratorV2] Schema detected: ${dataCard.columns.length} columns, ${dataCard.totalRows} rows, quality ${dataCard.qualityScore}/100`);
  } catch (error: any) {
    return {
      success: false,
      result: {
        exec_id: crypto.randomUUID(),
        success: false,
        data: [],
        warnings: [
          {
            type: 'data_quality',
            severity: 'error',
            message: `Failed to detect schema: ${error.message}`,
          },
        ],
        execution_time_ms: Date.now() - startTime,
        rows_processed: 0,
        rows_returned: 0,
        created_at: new Date().toISOString(),
      },
      metadata: {
        pipeline_stage_completed: 'schema',
        template_matched: false,
        semantic_mappings_applied: 0,
        semantic_confidence_avg: 0,
        total_time_ms: Date.now() - startTime,
        flags_active: extractActiveFlags(config),
      },
      warnings: [`Schema detection failed: ${error.message}`],
    };
  }

  const schemaTime = Date.now() - schemaStartTime;

  // Check if dataset is analyzable
  const analyzability = canAnalyze(dataCard);
  if (!analyzability.can) {
    warnings.push(`Dataset cannot be analyzed: ${analyzability.reason}`);
    return {
      success: false,
      result: {
        exec_id: crypto.randomUUID(),
        success: false,
        data: [],
        warnings: [
          {
            type: 'data_quality',
            severity: 'error',
            message: analyzability.reason || 'Dataset unsuitable for analysis',
          },
        ],
        execution_time_ms: Date.now() - startTime,
        rows_processed: 0,
        rows_returned: 0,
        created_at: new Date().toISOString(),
      },
      metadata: {
        pipeline_stage_completed: 'schema',
        template_matched: false,
        semantic_mappings_applied: 0,
        semantic_confidence_avg: 0,
        total_time_ms: Date.now() - startTime,
        flags_active: extractActiveFlags(config),
      },
      warnings,
    };
  }

  // ==================== STAGE 2: SEMANTIC MAPPING ====================
  console.log('[OrchestratorV2] STAGE 2/5: Applying semantic mapping...');
  const semanticStartTime = Date.now();

  let enrichedDataCard = dataCard;
  let semanticMappingsApplied = 0;
  let semanticConfidenceAvg = 0;

  if (config.enable_semantic_mapping) {
    try {
      enrichedDataCard = await resolveDataCard(dataCard, {
        domain: dataCard.detected_domain,
      });

      // Calculate semantic stats
      enrichedDataCard.columns.forEach(col => {
        const confidence = (col as any).mapping_confidence || 0;
        if (confidence >= config.semantic_confidence_threshold) {
          semanticMappingsApplied++;
          semanticConfidenceAvg += confidence;
        }
      });

      if (semanticMappingsApplied > 0) {
        semanticConfidenceAvg /= semanticMappingsApplied;
      }

      console.log(`[OrchestratorV2] Semantic mapping: ${semanticMappingsApplied}/${dataCard.columns.length} columns mapped (avg confidence: ${(semanticConfidenceAvg * 100).toFixed(0)}%)`);
    } catch (error: any) {
      warnings.push(`Semantic mapping failed: ${error.message}, falling back to raw names`);
      console.warn('[OrchestratorV2] Semantic mapping error:', error);
    }
  } else {
    console.log('[OrchestratorV2] Semantic mapping disabled');
  }

  const semanticTime = Date.now() - semanticStartTime;

  // ==================== STAGE 3: TEMPLATE MATCHING ====================
  console.log('[OrchestratorV2] STAGE 3/5: Matching templates...');
  const templateStartTime = Date.now();

  let templateMatchResult;
  let useTemplate = false;

  if (config.load_templates_from_models) {
    try {
      templateMatchResult = await matchTemplate(enrichedDataCard, config.template_match_threshold);

      if (templateMatchResult.matched && templateMatchResult.template) {
        useTemplate = true;
        console.log(`[OrchestratorV2] ✓ Template matched: "${templateMatchResult.template.name}" (score: ${(templateMatchResult.match_score * 100).toFixed(0)}%)`);
      } else {
        console.log(`[OrchestratorV2] ✗ No template matched (reason: ${templateMatchResult.reason})`);
        warnings.push(`No template matched: ${templateMatchResult.reason}`);
      }
    } catch (error: any) {
      warnings.push(`Template matching failed: ${error.message}`);
      console.warn('[OrchestratorV2] Template matching error:', error);
    }
  } else {
    console.log('[OrchestratorV2] Template matching disabled');
  }

  const templateTime = Date.now() - templateStartTime;

  // ==================== STAGE 4: EXECUTION (TEMPLATE OR FALLBACK) ====================
  console.log('[OrchestratorV2] STAGE 4/5: Executing analysis...');
  const executionStartTime = Date.now();

  let result: ExecResult;
  let fallbackStrategy: string | undefined;

  if (useTemplate && templateMatchResult?.template) {
    // Execute template
    console.log(`[OrchestratorV2] Executing template: ${templateMatchResult.template.name}`);

    // TODO: Convert template to ExecSpec and execute
    // For now, fall back (template execution will be implemented next)
    console.warn('[OrchestratorV2] Template execution not yet implemented, using fallback');
    result = await executeFallback(enrichedDataCard, request.user_question);
    fallbackStrategy = suggestFallbackStrategy(enrichedDataCard);
    warnings.push('Template execution not yet implemented, used fallback');
  } else {
    // Execute fallback
    if (!config.fallback_enabled) {
      throw new Error('No template matched and fallback is disabled');
    }

    console.log('[OrchestratorV2] Executing fallback analysis...');
    result = await executeFallback(enrichedDataCard, request.user_question);
    fallbackStrategy = suggestFallbackStrategy(enrichedDataCard);
  }

  const executionTime = Date.now() - executionStartTime;

  // ==================== STAGE 5: OBSERVABILITY LOGGING ====================
  console.log('[OrchestratorV2] STAGE 5/5: Logging observability...');
  const loggingStartTime = Date.now();

  if (config.log_performance) {
    await logPerformance({
      user_id: request.user_id,
      analysis_id: request.analysis_id,
      dataset_id: request.dataset_id,
      schema_time_ms: schemaTime,
      semantic_time_ms: semanticTime,
      template_time_ms: templateTime,
      execution_time_ms: executionTime,
      total_time_ms: Date.now() - startTime,
      template_matched: useTemplate,
      template_name: templateMatchResult?.template?.name,
      fallback_strategy: fallbackStrategy,
      semantic_mappings: semanticMappingsApplied,
      flags_active: config,
    });
  }

  if (config.log_lineage) {
    await logLineage({
      exec_id: result.exec_id,
      dataset_id: request.dataset_id,
      user_id: request.user_id,
      schema_detected: dataCard.columns.map(c => ({ name: c.name, type: c.type })),
      semantic_mappings: enrichedDataCard.semantic_mapping || {},
      template_matched: useTemplate,
      template_id: templateMatchResult?.template?.id,
      fallback_used: !useTemplate,
      result_rows: result.data.length,
    });
  }

  const loggingTime = Date.now() - loggingStartTime;

  const totalTime = Date.now() - startTime;

  console.log(`[OrchestratorV2] ✓ Pipeline complete in ${totalTime}ms (schema: ${schemaTime}ms, semantic: ${semanticTime}ms, template: ${templateTime}ms, execution: ${executionTime}ms, logging: ${loggingTime}ms)`);

  // Add all result warnings to response warnings
  warnings.push(...result.warnings.map(w => w.message));

  return {
    success: result.success,
    result,
    metadata: {
      pipeline_stage_completed: 'complete',
      template_matched: useTemplate,
      template_used: templateMatchResult?.template?.name,
      fallback_strategy: fallbackStrategy,
      semantic_mappings_applied: semanticMappingsApplied,
      semantic_confidence_avg: semanticConfidenceAvg,
      total_time_ms: totalTime,
      flags_active: extractActiveFlags(config),
    },
    warnings,
  };
}

/**
 * Extract active flags for metadata
 */
function extractActiveFlags(config: any): Record<string, boolean> {
  return {
    quote_identifiers: config.quote_identifiers,
    enable_generic_pivot_fallback: config.enable_generic_pivot_fallback,
    template_registry_strict_mode: config.template_registry_strict_mode,
    use_snake_case_columns: config.use_snake_case_columns,
    enable_semantic_mapping: config.enable_semantic_mapping,
    load_templates_from_models: config.load_templates_from_models,
    fallback_enabled: config.fallback_enabled,
  };
}

/**
 * Log performance to analytics_performance_log
 */
async function logPerformance(data: any): Promise<void> {
  try {
    await supabase.from('analytics_performance_log').insert({
      user_id: data.user_id,
      analysis_id: data.analysis_id,
      dataset_id: data.dataset_id,
      execution_time_ms: data.total_time_ms,
      metadata: {
        schema_time_ms: data.schema_time_ms,
        semantic_time_ms: data.semantic_time_ms,
        template_time_ms: data.template_time_ms,
        execution_time_ms: data.execution_time_ms,
        template_matched: data.template_matched,
        template_name: data.template_name,
        fallback_strategy: data.fallback_strategy,
        semantic_mappings: data.semantic_mappings,
        flags: data.flags_active,
      },
    });
  } catch (error: any) {
    console.error('[OrchestratorV2] Failed to log performance:', error.message);
  }
}

/**
 * Log lineage to execution_lineage
 */
async function logLineage(data: any): Promise<void> {
  try {
    await supabase.from('execution_lineage').insert({
      exec_id: data.exec_id,
      dataset_id: data.dataset_id,
      user_id: data.user_id,
      metadata: {
        schema_detected: data.schema_detected,
        semantic_mappings: data.semantic_mappings,
        template_matched: data.template_matched,
        template_id: data.template_id,
        fallback_used: data.fallback_used,
        result_rows: data.result_rows,
      },
    });
  } catch (error: any) {
    console.error('[OrchestratorV2] Failed to log lineage:', error.message);
  }
}
