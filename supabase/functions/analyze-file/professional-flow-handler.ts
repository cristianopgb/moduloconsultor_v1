/**
 * PROFESSIONAL FLOW HANDLER
 *
 * Handles the 2-step professional analysis flow:
 * 1. PLAN_ONLY mode: Generate plan, save to DB, return for validation
 * 2. EXECUTE mode: Load plan, execute with infallible retry, generate narrative
 *
 * This is triggered by body.mode = 'plan_only' or 'execute'
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { profileDataEnriched } from './simple-analyzer.ts';
import { generateProfessionalAnalysisPlan } from './professional-analyst.ts';
import { executeWithInfallibleRetry } from './infallible-sql-retry.ts';
import { generateExecutiveNarrative } from './executive-narrative.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch }
});

export async function handleProfessionalFlowPlanOnly(
  rowData: any[],
  userQuestion: string,
  effectiveUserId: string,
  datasetId: string,
  conversationId: string | undefined,
  openaiApiKey: string,
  openaiModel: string
): Promise<any> {
  console.log('[ProfessionalFlow] PLAN_ONLY mode - generating analysis plan');

  // Generate enriched profile (50 rows sample + cardinality)
  const enrichedProfile = profileDataEnriched(rowData);

  console.log('[ProfessionalFlow] Enriched profile generated:', {
    totalRows: enrichedProfile.totalRows,
    columns: enrichedProfile.columns.length,
    sampleRows: enrichedProfile.sampleRows.length
  });

  // Generate professional analysis plan
  const professionalPlan = await generateProfessionalAnalysisPlan(
    rowData,
    enrichedProfile,
    userQuestion,
    openaiApiKey,
    openaiModel
  );

  console.log('[ProfessionalFlow] Professional plan generated');

  // Save plan to database
  const { data: savedPlan, error: saveError } = await supabase
    .from('analysis_plans')
    .insert({
      user_id: effectiveUserId,
      dataset_id: datasetId,
      conversation_id: conversationId,
      user_question: userQuestion,
      business_understanding: professionalPlan.business_understanding,
      analysis_approach: professionalPlan.analysis_approach,
      user_friendly_summary: professionalPlan.user_friendly_summary,
      queries_planned: professionalPlan.queries_planned,
      visualizations_planned: professionalPlan.visualizations_planned,
      needs_clarification: professionalPlan.needs_clarification,
      clarification_questions: professionalPlan.clarification_questions,
      profile_data: enrichedProfile,
      sample_rows: enrichedProfile.sampleRows,
      status: 'pending'
    })
    .select()
    .single();

  if (saveError) {
    console.error('[ProfessionalFlow] Failed to save plan:', saveError);
    throw new Error(`Failed to save analysis plan: ${saveError.message}`);
  }

  console.log('[ProfessionalFlow] Plan saved with ID:', savedPlan.id);

  // Return plan for user validation
  return {
    success: true,
    needs_validation: true,
    plan_id: savedPlan.id,
    understanding: professionalPlan.business_understanding.real_intent,
    summary: professionalPlan.user_friendly_summary,
    needs_clarification: professionalPlan.needs_clarification,
    questions: professionalPlan.clarification_questions
  };
}

export async function handleProfessionalFlowExecute(
  planId: string,
  userCorrections: string | undefined,
  openaiApiKey: string,
  openaiModel: string
): Promise<any> {
  console.log('[ProfessionalFlow] EXECUTE mode - executing plan:', planId);

  // Load plan from database
  const { data: plan, error: loadError } = await supabase
    .from('analysis_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (loadError || !plan) {
    throw new Error(`Failed to load analysis plan: ${loadError?.message || 'Plan not found'}`);
  }

  console.log('[ProfessionalFlow] Plan loaded successfully');

  // Reload full dataset
  const { data: rows, error: rowsError } = await supabase
    .from('dataset_rows')
    .select('row_data')
    .eq('dataset_id', plan.dataset_id);

  if (rowsError) {
    throw new Error(`Failed to load dataset: ${rowsError.message}`);
  }

  const rowData = rows?.map((r) => r.row_data) || [];

  console.log(`[ProfessionalFlow] Dataset loaded: ${rowData.length} rows`);

  // Execute queries with infallible retry
  const executionResults = await executeWithInfallibleRetry(
    rowData,
    plan.queries_planned,
    plan.profile_data,
    openaiApiKey,
    openaiModel
  );

  console.log('[ProfessionalFlow] Queries executed:', {
    totalQueries: executionResults.executed_queries.length,
    totalRetries: executionResults.total_retries,
    fallbackUsed: executionResults.fallback_used
  });

  // Generate executive narrative
  const narrative = await generateExecutiveNarrative(
    plan.user_question,
    plan.business_understanding,
    executionResults.executed_queries,
    openaiApiKey,
    openaiModel
  );

  console.log('[ProfessionalFlow] Executive narrative generated');

  // Save complete analysis
  const { data: analysis, error: analysisError } = await supabase
    .from('data_analyses')
    .insert({
      user_id: plan.user_id,
      analysis_plan_id: plan.id,
      file_hash: plan.dataset_id,
      user_question: plan.user_question,
      business_understanding: plan.business_understanding,
      ai_response: narrative,
      visualizations: narrative.visualizations,
      status: 'completed',
      retry_count: executionResults.total_retries,
      partial_results: executionResults.fallback_used
    })
    .select()
    .single();

  if (analysisError) {
    console.error('[ProfessionalFlow] Failed to save analysis:', analysisError);
  }

  // Update plan status
  await supabase
    .from('analysis_plans')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString()
    })
    .eq('id', planId);

  console.log('[ProfessionalFlow] Analysis complete');

  // Return executive narrative with executed queries for transparency
  return {
    success: true,
    analysis_id: analysis?.id,
    ...narrative,
    executed_queries: executionResults.executed_queries // Include raw query results for detailed view
  };
}
