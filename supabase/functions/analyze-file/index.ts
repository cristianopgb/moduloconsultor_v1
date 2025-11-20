/**
 * ANALYZE FILE - INTELLIGENT DIALOGUE-DRIVEN PIPELINE
 *
 * Architecture:
 * 1. Profile data (schema + sample)
 * 2. Intelligent dialogue evaluation (should we ask questions?)
 * 3. If ready: semantic reflection + SQL generation
 * 4. Iterative execution with validation
 * 5. Narrative generation from real results
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ingestFile } from '../_shared/ingest-orchestrator.ts';
import { profileData } from './simple-analyzer.ts';
import { evaluateReadinessIntelligent } from './intelligent-dialogue-manager.ts';
import { analyzeWithSemanticReflection } from './semantic-reflection-analyzer.ts';
import { handleProfessionalFlowPlanOnly, handleProfessionalFlowExecute } from './professional-flow-handler.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const OPENAI_MODEL = 'gpt-4o-mini';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const {
      parsed_rows,
      parse_metadata,
      file_data,
      filename,
      dataset_id,
      user_id,
      user_question = 'Analise este dataset e me dê insights relevantes',
      conversation_id,
      dialogue_state_id, // ID do estado de diálogo persistido
      is_followup = false, // Se é resposta a perguntas do sistema
      mode, // NEW: 'plan_only' or 'execute' for professional flow
      plan_id, // NEW: For execute mode
      user_corrections // NEW: User feedback on plan
    } = body;

    console.log('[AnalyzeFile] Request received:', {
      has_parsed_rows: !!parsed_rows,
      has_file_data: !!file_data,
      has_dataset_id: !!dataset_id,
      user_question,
      is_followup,
      dialogue_state_id,
      mode,
      plan_id
    });

    // ===================================================================
    // AUTHENTICATION
    // ===================================================================
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing authorization token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const effectiveUserId = user_id || user.id;

    // ===================================================================
    // PROFESSIONAL FLOW - EXECUTE MODE (no need to load full data again)
    // ===================================================================
    if (mode === 'execute' && plan_id) {
      console.log('[AnalyzeFile] Professional flow: EXECUTE mode');

      try {
        const result = await handleProfessionalFlowExecute(
          plan_id,
          user_corrections,
          OPENAI_API_KEY,
          OPENAI_MODEL
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        console.error('[AnalyzeFile] Execute failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ===================================================================
    // STEP 1: GET DATA
    // ===================================================================
    let rowData: any[] = [];

    if (parsed_rows && parsed_rows.length > 0) {
      console.log('[AnalyzeFile] Using frontend-parsed data');
      rowData = parsed_rows;
    } else if (file_data) {
      console.log('[AnalyzeFile] Parsing file on backend');
      try {
        const ingestResult = await ingestFile(file_data, filename || 'unknown');
        rowData = ingestResult.rows;
        console.log(`[AnalyzeFile] Ingested ${rowData.length} rows`);
      } catch (error: any) {
        return new Response(JSON.stringify({
          success: false,
          error: `File parsing failed: ${error.message}`,
          hint: 'Supported formats: CSV, Excel, JSON, TXT'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (dataset_id) {
      console.log('[AnalyzeFile] Loading from dataset_id');
      const { data: rows, error: rowsError } = await supabase
        .from('dataset_rows')
        .select('row_data')
        .eq('dataset_id', dataset_id);
        // REMOVED .limit(10000) - now loads ALL rows

      if (rowsError) {
        return new Response(JSON.stringify({
          success: false,
          error: `Database error: ${rowsError.message}`
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      rowData = rows?.map((r) => r.row_data) || [];
      console.log(`[AnalyzeFile] Loaded ${rowData.length} rows from database`);
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'No data provided',
        hint: 'Provide parsed_rows, file_data, or dataset_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rowData.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dataset is empty'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AnalyzeFile] Dataset ready: ${rowData.length} rows`);

    // ===================================================================
    // PROFESSIONAL FLOW - PLAN_ONLY MODE
    // ===================================================================
    if (mode === 'plan_only') {
      console.log('[AnalyzeFile] Professional flow: PLAN_ONLY mode');

      try {
        const result = await handleProfessionalFlowPlanOnly(
          rowData,
          user_question,
          effectiveUserId,
          dataset_id,
          conversation_id,
          OPENAI_API_KEY,
          OPENAI_MODEL
        );

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        console.error('[AnalyzeFile] Plan generation failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ===================================================================
    // STEP 2: PROFILE DATA (get schema + statistics)
    // ===================================================================
    console.log('[AnalyzeFile] Profiling dataset...');
    const profile = profileData(rowData);

    const schema = profile.columns.map(col => ({
      name: col,
      type: profile.columnTypes[col] || 'unknown',
      sample_values: profile.stats[col]?.sampleValues ||
                     (profile.stats[col] ? [profile.stats[col].min, profile.stats[col].max, profile.stats[col].avg] : [])
    }));

    const sampleRows = profile.sampleRows || rowData.slice(0, 10);

    console.log('[AnalyzeFile] Profile complete:', {
      columns: profile.columns.length,
      rows: profile.totalRows,
      types: profile.columnTypes
    });

    // ===================================================================
    // STEP 3: INTELLIGENT DIALOGUE EVALUATION
    // ===================================================================
    console.log('[AnalyzeFile] Evaluating readiness for analysis...');

    // Load existing dialogue context if this is a follow-up
    let existingContext = undefined;
    if (dialogue_state_id) {
      const { data: dialogueState } = await supabase
        .from('dialogue_states')
        .select('*')
        .eq('id', dialogue_state_id)
        .single();

      if (dialogueState) {
        existingContext = {
          userId: effectiveUserId,
          conversationId: conversation_id,
          ...dialogueState.context,
          questions_history: dialogueState.questions_history || []
        };
      }
    }

    const dialogueEval = await evaluateReadinessIntelligent(
      schema,
      sampleRows,
      user_question,
      OPENAI_API_KEY,
      OPENAI_MODEL,
      existingContext
    );

    console.log('[AnalyzeFile] Dialogue evaluation:', {
      shouldAnalyze: dialogueEval.shouldAnalyze,
      needsCriticalInfo: dialogueEval.needsCriticalInfo,
      completeness: dialogueEval.context.completeness
    });

    // ===================================================================
    // STEP 4: DECISION POINT - Ask questions or proceed?
    // ===================================================================
    if (dialogueEval.needsCriticalInfo && dialogueEval.missingInfo.length > 0) {
      console.log('[AnalyzeFile] Need more information from user');

      // Save dialogue state to database
      const { data: savedDialogueState, error: saveError } = await supabase
        .from('dialogue_states')
        .insert({
          user_id: effectiveUserId,
          conversation_id: conversation_id || null,
          context: dialogueEval.context,
          missing_info: dialogueEval.missingInfo,
          questions_history: [
            ...(existingContext?.questions_history || []),
            {
              questions: dialogueEval.missingInfo,
              asked_at: new Date().toISOString(),
              answered: false
            }
          ],
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (saveError) {
        console.error('[AnalyzeFile] Failed to save dialogue state:', saveError);
      }

      // Return conversational response asking for clarification
      return new Response(JSON.stringify({
        success: true,
        needs_dialogue: true,
        dialogue_state_id: savedDialogueState?.id,
        message: dialogueEval.message,
        context_summary: dialogueEval.contextSummary,
        missing_info: dialogueEval.missingInfo,
        enrichment_suggestions: dialogueEval.enrichmentSuggestions,
        completeness: dialogueEval.context.completeness
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===================================================================
    // STEP 5: PROCEED WITH SEMANTIC REFLECTION + ANALYSIS
    // ===================================================================
    console.log('[AnalyzeFile] Ready for analysis - starting semantic reflection...');

    let analysisResult;
    try {
      analysisResult = await analyzeWithSemanticReflection(
        rowData,
        user_question,
        profile,
        OPENAI_API_KEY,
        OPENAI_MODEL
      );
    } catch (error: any) {
      console.error('[AnalyzeFile] Analysis failed:', error);

      // Return conversational fallback instead of error
      return new Response(JSON.stringify({
        success: true,
        needs_dialogue: true,
        message: `Encontrei dificuldades para analisar seus dados. ${dialogueEval.contextSummary}\n\nVocê poderia reformular sua pergunta ou dar mais detalhes sobre o que gostaria de ver?`,
        context_summary: dialogueEval.contextSummary,
        error_details: error.message
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!analysisResult.success) {
      // Conversational fallback
      return new Response(JSON.stringify({
        success: true,
        needs_dialogue: true,
        message: `Não consegui processar sua análise completamente. ${dialogueEval.contextSummary}\n\nPoderia esclarecer o que você gostaria de analisar especificamente?`,
        context_summary: dialogueEval.contextSummary,
        error_details: analysisResult.error
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===================================================================
    // STEP 6: SAVE TO DATABASE
    // ===================================================================
    console.log('[AnalyzeFile] Saving analysis to database...');

    const { data: analysisRecord, error: insertError } = await supabase
      .from('data_analyses')
      .insert({
        user_id: effectiveUserId,
        file_hash: dataset_id || 'inline',
        file_metadata: {
          filename: filename || 'inline-data.xlsx',
          size: rowData.length
        },
        parsed_schema: {
          columns: profile.columns,
          types: profile.columnTypes
        },
        sample_data: sampleRows.slice(0, 5),
        user_question,
        llm_reasoning: analysisResult.semantic_reflection || '',
        generated_sql: analysisResult.sql_queries?.map((q: any) => q.sql).join(';\n') || '',
        full_dataset_rows: rowData.length,
        query_results: analysisResult.sql_queries || [],
        ai_response: {
          summary: analysisResult.summary,
          insights: analysisResult.insights,
          calculations: analysisResult.calculations,
          recommendations: analysisResult.recommendations
        },
        visualizations: analysisResult.charts || [],
        status: 'completed'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[AnalyzeFile] Failed to save analysis:', insertError);
    } else {
      console.log('[AnalyzeFile] Analysis saved:', analysisRecord?.id);
    }

    // Update dialogue state as completed if it exists
    if (dialogue_state_id) {
      await supabase
        .from('dialogue_states')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', dialogue_state_id);
    }

    // ===================================================================
    // STEP 7: RETURN SUCCESS
    // ===================================================================
    const response = {
      success: true,
      executed_query: true,
      message: analysisResult.summary,
      analysis_id: analysisRecord?.id,
      result: {
        summary: analysisResult.summary,
        insights: analysisResult.insights,
        calculations: analysisResult.calculations,
        charts: analysisResult.charts,
        recommendations: analysisResult.recommendations,
        semantic_reflection: analysisResult.semantic_reflection,
        validation_passed: analysisResult.validation_passed
      },
      metadata: {
        total_rows: rowData.length,
        total_columns: profile.columns.length,
        execution_time_ms: Date.now() - startTime,
        sql_queries_executed: analysisResult.sql_queries?.length || 0,
        confidence: analysisResult.confidence || 100
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[AnalyzeFile] Unhandled error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
