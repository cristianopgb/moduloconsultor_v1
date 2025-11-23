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

/**
 * Persist dataset rows to database for later execution
 */
async function persistDatasetRows(
  datasetId: string,
  rowData: any[],
  userId: string,
  filename: string,
  conversationId?: string
): Promise<void> {
  console.log(`[ProfessionalFlow] Persisting ${rowData.length} rows to dataset_rows...`);

  if (!datasetId) {
    throw new Error('dataset_id is required to persist rows');
  }

  if (rowData.length === 0) {
    throw new Error('Cannot persist empty dataset');
  }

  // Step 1: Check if dataset record already exists
  console.log(`[ProfessionalFlow] Checking if dataset record exists: ${datasetId}`);

  const { data: existingDataset, error: checkError } = await supabase
    .from('datasets')
    .select('id, storage_path, storage_bucket')
    .eq('id', datasetId)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check dataset: ${checkError.message}`);
  }

  if (existingDataset) {
    console.log(`[ProfessionalFlow] ✅ Dataset record already exists with storage: ${existingDataset.storage_bucket}/${existingDataset.storage_path}`);

    // Only update row counts, do NOT overwrite storage_path
    const { error: updateError } = await supabase
      .from('datasets')
      .update({
        row_count: rowData.length,
        column_count: Object.keys(rowData[0] || {}).length,
        processing_status: 'completed',
        has_queryable_data: true
      })
      .eq('id', datasetId);

    if (updateError) {
      console.warn('[ProfessionalFlow] Could not update dataset counts:', updateError.message);
    }
  } else {
    console.warn(`[ProfessionalFlow] ⚠️ Dataset ${datasetId} not found. This should have been created by frontend with correct storage_path!`);
    // Do NOT create a fake dataset with memory:// path
    throw new Error('Dataset must be created by frontend with correct storage information before analysis');
  }

  // Step 2: Insert rows
  const rowsToInsert = rowData.map((data, index) => ({
    dataset_id: datasetId,
    row_number: index + 1,
    data: data
  }));

  // Delete existing rows for this dataset (idempotent)
  const { error: deleteError } = await supabase
    .from('dataset_rows')
    .delete()
    .eq('dataset_id', datasetId);

  if (deleteError) {
    console.warn('[ProfessionalFlow] Could not delete existing rows:', deleteError.message);
  }

  // Insert new rows in batches of 1000
  for (let i = 0; i < rowsToInsert.length; i += 1000) {
    const batch = rowsToInsert.slice(i, i + 1000);
    const { error: insertError } = await supabase
      .from('dataset_rows')
      .insert(batch);

    if (insertError) {
      throw new Error(`Failed to persist dataset rows (batch ${Math.floor(i / 1000) + 1}): ${insertError.message}`);
    }

    console.log(`[ProfessionalFlow] Persisted batch ${Math.floor(i / 1000) + 1}: ${batch.length} rows`);
  }

  console.log(`[ProfessionalFlow] ✅ Successfully persisted ${rowData.length} total rows`);
}

export async function handleProfessionalFlowPlanOnly(
  rowData: any[],
  userQuestion: string,
  effectiveUserId: string,
  datasetId: string,
  conversationId: string | undefined,
  openaiApiKey: string,
  openaiModel: string,
  filename: string,
  fileMetadata: any = {}
): Promise<any> {
  console.log('[ProfessionalFlow] PLAN_ONLY mode - generating analysis plan');

  // 🔥 CRITICAL: Persist data to database BEFORE generating plan
  await persistDatasetRows(datasetId, rowData, effectiveUserId, filename, conversationId);

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
      file_metadata: { filename, ...fileMetadata },
      status: 'pending'
    })
    .select()
    .single();

  if (saveError) {
    console.error('[ProfessionalFlow] Failed to save plan:', saveError);
    throw new Error(`Failed to save analysis plan: ${saveError.message}`);
  }

  console.log('[ProfessionalFlow] Plan saved with ID:', savedPlan.id);

  // 🔥 NEW: Persist plan summary as assistant message for dialogue history
  if (conversationId) {
    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: effectiveUserId,
        role: 'assistant',
        content: professionalPlan.user_friendly_summary,
        message_type: 'analysis_plan',
        analysis_id: null // Will be linked after execution
      });
      console.log('[ProfessionalFlow] ✅ Plan message persisted to conversation');
    } catch (error: any) {
      console.warn('[ProfessionalFlow] Could not persist plan message:', error.message);
    }
  }

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
  console.log(`[ProfessionalFlow] Loading dataset with ID: ${plan.dataset_id}`);
  const { data: rows, error: rowsError } = await supabase
    .from('dataset_rows')
    .select('row_data')
    .eq('dataset_id', plan.dataset_id);

  if (rowsError) {
    throw new Error(`Failed to load dataset: ${rowsError.message}`);
  }

  const rowData = rows?.map((r) => r.row_data) || [];

  console.log(`[ProfessionalFlow] Dataset loaded: ${rowData.length} rows`);

  // 🔥 CRITICAL: Validate that data was actually loaded
  if (rowData.length === 0) {
    throw new Error(
      `No data found in dataset_rows for dataset_id: ${plan.dataset_id}. ` +
      `Data may not have been persisted during plan generation.`
    );
  }

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

  // Save complete analysis with enhanced fields
  const { data: analysis, error: analysisError } = await supabase
    .from('data_analyses')
    .insert({
      user_id: plan.user_id,
      analysis_plan_id: plan.id,
      dataset_id: plan.dataset_id,
      file_hash: plan.dataset_id,
      conversation_id: plan.conversation_id,
      file_metadata: plan.file_metadata || {},
      user_question: plan.user_question,
      business_understanding: plan.business_understanding,
      executive_headline: narrative.headline,
      executive_summary_text: narrative.executive_summary,
      ai_response: {
        ...narrative,
        key_insights: narrative.key_insights,
        visualizations: narrative.visualizations
      },
      business_recommendations: narrative.business_recommendations || [],
      next_questions: narrative.next_questions || [],
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

  const analysisId = analysis?.id;

  if (analysisId) {
    // Persist KPI cards to database
    if (narrative.kpi_cards && narrative.kpi_cards.length > 0) {
      console.log(`[ProfessionalFlow] Persisting ${narrative.kpi_cards.length} KPI cards...`);

      const kpiRecords = narrative.kpi_cards.map((kpi, index) => ({
        analysis_id: analysisId,
        user_id: plan.user_id,
        label: kpi.label,
        value: kpi.value,
        trend: kpi.trend || null,
        comparison: kpi.comparison || null,
        icon: kpi.icon || null,
        position: index
      }));

      const { error: kpiError } = await supabase
        .from('analysis_kpis')
        .insert(kpiRecords);

      if (kpiError) {
        console.error('[ProfessionalFlow] Failed to save KPI cards:', kpiError);
      } else {
        console.log('[ProfessionalFlow] ✅ KPI cards saved successfully');
      }
    }

    // Persist visualizations to database
    if (narrative.visualizations && narrative.visualizations.length > 0) {
      console.log(`[ProfessionalFlow] Persisting ${narrative.visualizations.length} visualizations...`);

      const vizRecords = narrative.visualizations.map((viz, index) => ({
        analysis_id: analysisId,
        user_id: plan.user_id,
        viz_type: viz.type,
        title: viz.title,
        description: viz.interpretation || null,
        data: viz.data || {},
        config: viz.config || {},
        interpretation: viz.interpretation || null,
        insights: viz.insights || [],
        position: index
      }));

      const { error: vizError } = await supabase
        .from('analysis_visualizations')
        .insert(vizRecords);

      if (vizError) {
        console.error('[ProfessionalFlow] Failed to save visualizations:', vizError);
      } else {
        console.log('[ProfessionalFlow] ✅ Visualizations saved successfully');
      }
    }
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

  // 🔥 NEW: Persist executive summary as assistant message for dialogue history
  if (plan.conversation_id && analysis?.id) {
    try {
      await supabase.from('messages').insert({
        conversation_id: plan.conversation_id,
        user_id: plan.user_id,
        role: 'assistant',
        content: narrative.executive_summary,
        message_type: 'analysis_result',
        analysis_id: analysis.id
      });
      console.log('[ProfessionalFlow] ✅ Executive summary persisted to conversation');
    } catch (error: any) {
      console.warn('[ProfessionalFlow] Could not persist executive summary:', error.message);
    }
  }

  // Return executive narrative with executed queries for transparency
  return {
    success: true,
    analysis_id: analysis?.id,
    ...narrative,
    executed_queries: executionResults.executed_queries // Include raw query results for detailed view
  };
}
