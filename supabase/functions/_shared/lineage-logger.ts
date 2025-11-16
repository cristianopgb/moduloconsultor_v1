/**
 * ===================================================================
 * LINEAGE LOGGER
 * ===================================================================
 *
 * Tracks execution lineage for full auditability and reproducibility
 *
 * Features:
 * - Logs every execution with ExecSpec, DataCard summary, and results
 * - Links artifacts (charts, tables, narratives) to executions
 * - Enables drill-down from any artifact to source data/query
 * - Supports performance analytics
 * ===================================================================
 */

import type {
  ExecSpec,
  ExecResult,
  DataCard,
  VizSpec,
  NarrativeDoc,
  LineageTrace,
  ArtifactLineage,
} from './analytics-contracts.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateCacheKey } from './executor/cache.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

/**
 * Log execution to lineage table
 */
export async function logExecution(
  execSpec: ExecSpec,
  dataCard: DataCard,
  result: ExecResult,
  user_id: string | null,
  conversation_id: string | null,
  sql_generated?: string
): Promise<void> {
  try {
    const exec_spec_hash = await generateCacheKey(execSpec, dataCard.dataset_id);

    const lineageRecord = {
      exec_id: result.exec_id,
      exec_spec_hash,
      exec_spec: execSpec as any,
      data_card_summary: {
        dataset_id: dataCard.dataset_id,
        columns_used: [
          ...execSpec.dimensions,
          ...execSpec.measures.map(m => m.column).filter(Boolean),
        ],
        rows_processed: result.rows_processed,
      },
      result_summary: {
        rows_returned: result.rows_returned,
        metrics_calculated: execSpec.measures.map(m => m.name),
        sql_generated,
      },
      user_id,
      conversation_id,
      status: result.success ? 'success' : 'error',
      execution_time_ms: result.execution_time_ms,
    };

    const { error } = await supabase
      .from('execution_lineage')
      .insert(lineageRecord);

    if (error) {
      console.error('[Lineage] Error logging execution:', error.message);
    } else {
      console.log(`[Lineage] Logged execution ${result.exec_id}`);
    }

  } catch (error: any) {
    console.error('[Lineage] Exception during logging:', error.message);
  }
}

/**
 * Log visualization artifact
 */
export async function logVisualization(
  vizSpec: VizSpec,
  exec_id: string
): Promise<void> {
  try {
    const artifact = {
      artifact_id: vizSpec.viz_id,
      exec_id,
      artifact_type: 'chart',
      artifact_spec: vizSpec as any,
      position_in_report: vizSpec.position_in_report,
    };

    const { error } = await supabase
      .from('lineage_artifacts')
      .insert(artifact);

    if (error) {
      console.error('[Lineage] Error logging visualization:', error.message);
    } else {
      console.log(`[Lineage] Logged visualization ${vizSpec.viz_id}`);
    }

  } catch (error: any) {
    console.error('[Lineage] Exception during viz logging:', error.message);
  }
}

/**
 * Log narrative artifact
 */
export async function logNarrative(
  narrative: NarrativeDoc,
  exec_ids: string[]
): Promise<void> {
  try {
    // Log one artifact for the entire narrative, but reference all exec_ids
    const artifact = {
      artifact_id: narrative.doc_id,
      exec_id: exec_ids[0], // Primary execution
      artifact_type: 'narrative',
      artifact_spec: {
        ...narrative,
        all_exec_ids: exec_ids, // Store all related executions
      } as any,
      position_in_report: 0,
    };

    const { error } = await supabase
      .from('lineage_artifacts')
      .insert(artifact);

    if (error) {
      console.error('[Lineage] Error logging narrative:', error.message);
    } else {
      console.log(`[Lineage] Logged narrative ${narrative.doc_id}`);
    }

  } catch (error: any) {
    console.error('[Lineage] Exception during narrative logging:', error.message);
  }
}

/**
 * Log table artifact
 */
export async function logTable(
  data: any[],
  exec_id: string,
  position: number = 1
): Promise<string> {
  try {
    const artifact_id = crypto.randomUUID();

    const artifact = {
      artifact_id,
      exec_id,
      artifact_type: 'table',
      artifact_spec: {
        data: data.slice(0, 100), // Store first 100 rows
        total_rows: data.length,
      } as any,
      position_in_report: position,
    };

    const { error } = await supabase
      .from('lineage_artifacts')
      .insert(artifact);

    if (error) {
      console.error('[Lineage] Error logging table:', error.message);
    } else {
      console.log(`[Lineage] Logged table ${artifact_id}`);
    }

    return artifact_id;

  } catch (error: any) {
    console.error('[Lineage] Exception during table logging:', error.message);
    return '';
  }
}

/**
 * Get lineage trace for an execution
 */
export async function getLineageTrace(exec_id: string): Promise<LineageTrace | null> {
  try {
    const { data, error } = await supabase
      .from('execution_lineage')
      .select('*')
      .eq('exec_id', exec_id)
      .maybeSingle();

    if (error || !data) {
      console.error('[Lineage] Error fetching lineage:', error?.message);
      return null;
    }

    const trace: LineageTrace = {
      exec_id: data.exec_id,
      exec_spec: data.exec_spec,
      data_card_summary: data.data_card_summary,
      sql_generated: data.result_summary?.sql_generated,
      result_summary: data.result_summary,
      execution_time_ms: data.execution_time_ms,
      created_at: data.created_at,
    };

    return trace;

  } catch (error: any) {
    console.error('[Lineage] Exception fetching lineage:', error.message);
    return null;
  }
}

/**
 * Get all artifacts for an execution
 */
export async function getArtifacts(exec_id: string): Promise<ArtifactLineage[]> {
  try {
    const { data, error } = await supabase
      .from('lineage_artifacts')
      .select('*')
      .eq('exec_id', exec_id)
      .order('position_in_report');

    if (error) {
      console.error('[Lineage] Error fetching artifacts:', error.message);
      return [];
    }

    return data.map(row => ({
      artifact_id: row.artifact_id,
      artifact_type: row.artifact_type,
      exec_id: row.exec_id,
      artifact_spec: row.artifact_spec,
      position_in_report: row.position_in_report,
      created_at: row.created_at,
    }));

  } catch (error: any) {
    console.error('[Lineage] Exception fetching artifacts:', error.message);
    return [];
  }
}

/**
 * Log performance metrics
 */
export async function logPerformance(
  user_id: string,
  conversation_id: string,
  plan_time_ms: number,
  exec_time_ms: number,
  confidence_score: number,
  had_refinement: boolean,
  token_cost: number,
  success: boolean,
  error_details?: any
): Promise<void> {
  try {
    const performanceLog = {
      user_id,
      conversation_id,
      plan_time_ms,
      exec_time_ms,
      total_time_ms: plan_time_ms + exec_time_ms,
      confidence_score,
      had_refinement,
      token_cost_estimated: token_cost,
      success,
      error_details: error_details ? error_details : null,
    };

    const { error } = await supabase
      .from('analytics_performance_log')
      .insert(performanceLog);

    if (error) {
      console.error('[Lineage] Error logging performance:', error.message);
    } else {
      console.log('[Lineage] Performance logged');
    }

  } catch (error: any) {
    console.error('[Lineage] Exception during performance logging:', error.message);
  }
}

/**
 * Get performance stats for a user
 */
export async function getUserPerformanceStats(user_id: string): Promise<{
  total_analyses: number;
  avg_execution_time_ms: number;
  success_rate: number;
  total_token_cost: number;
}> {
  try {
    const { data, error } = await supabase
      .from('analytics_performance_log')
      .select('*')
      .eq('user_id', user_id);

    if (error || !data) {
      return {
        total_analyses: 0,
        avg_execution_time_ms: 0,
        success_rate: 0,
        total_token_cost: 0,
      };
    }

    const total = data.length;
    const successCount = data.filter(d => d.success).length;
    const avgTime = data.reduce((sum, d) => sum + d.total_time_ms, 0) / total;
    const totalCost = data.reduce((sum, d) => sum + (d.token_cost_estimated || 0), 0);

    return {
      total_analyses: total,
      avg_execution_time_ms: Math.round(avgTime),
      success_rate: Math.round((successCount / total) * 100),
      total_token_cost: totalCost,
    };

  } catch (error: any) {
    console.error('[Lineage] Exception fetching stats:', error.message);
    return {
      total_analyses: 0,
      avg_execution_time_ms: 0,
      success_rate: 0,
      total_token_cost: 0,
    };
  }
}
