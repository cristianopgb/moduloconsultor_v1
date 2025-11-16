/**
 * ===================================================================
 * CHAT-ANALYZE V2 - Analytics Integration
 * ===================================================================
 *
 * Unified analytics endpoint with two modes:
 * 1. LEGACY MODE: Uses existing pipeline for backward compatibility
 * 2. GOVERNED MODE: Uses new orchestrator with semantic layer + policies
 *
 * Selection via query param: ?mode=governed or ?mode=legacy
 * Default: governed
 * ===================================================================
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { analyzeDataset, quickAnalysis } from '../_shared/analytics-orchestrator.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
  global: { fetch },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

interface RequestBody {
  conversation_id: string;
  question: string;
  attachments: Array<{ type: string; dataset_id: string }>;
  mode?: 'governed' | 'legacy' | 'quick';
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

function httpJson(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

/**
 * Governed mode: Uses new orchestrator
 */
async function handleGovernedMode(
  body: RequestBody,
  userId: string
): Promise<any> {
  console.log('[chat-analyze-v2] Running in GOVERNED mode');

  const datasetAttachment = body.attachments.find(a => a.type === 'dataset');
  if (!datasetAttachment) {
    throw new Error('No dataset attachment found');
  }

  const response = await analyzeDataset({
    dataset_id: datasetAttachment.dataset_id,
    user_question: body.question,
    user_id: userId,
    conversation_id: body.conversation_id,
    options: {
      domain: body.options?.domain,
      enableSemantics: body.options?.enableSemantics ?? true,
      autoSuggestMetrics: body.options?.autoSuggestMetrics ?? true,
      enforcePolicies: body.options?.enforcePolicies ?? true,
      includeVisualizations: body.options?.includeVisualizations ?? true,
      includeNarrative: body.options?.includeNarrative ?? true,
      llm_model: body.options?.llm_model || 'gpt-4o-mini',
    },
  });

  // Save to analyses table
  const { data: analysisRecord } = await supabase
    .from('analyses')
    .insert({
      user_id: userId,
      dataset_id: datasetAttachment.dataset_id,
      conversation_id: body.conversation_id,
      model: response.metadata.llm_calls > 0 ? body.options?.llm_model || 'gpt-4o-mini' : 'governed',
      prompt: body.question,
      result_json: {
        execution: response.execution,
        plan: response.plan,
        visualizations: response.visualizations,
        narrative: response.narrative,
      },
      llm_response: response.narrative || { summary: 'Analysis completed' },
      charts_config: response.visualizations || [],
      status: 'completed',
    })
    .select('id')
    .single();

  return {
    success: true,
    mode: 'governed',
    executed_query: true,
    message: response.narrative?.title || 'Analysis completed with governance',
    analysis_id: analysisRecord?.id,
    result: {
      summary: response.narrative?.title || 'Analysis completed',
      data: response.execution.data,
      insights: response.narrative?.sections || [],
      visualizations: response.visualizations || [],
      warnings: response.warnings,
      metadata: {
        confidence: response.metadata.confidence,
        quality_score: response.plan.semantic_context.known_entities / response.plan.semantic_context.total_columns,
        policies_applied: response.plan.policies_context.policies_applied,
        llm_calls: response.metadata.llm_calls,
        cost_usd: response.metadata.llm_cost_usd,
        execution_time_ms: response.metadata.total_time_ms,
      },
    },
  };
}

/**
 * Quick mode: Simplified interface
 */
async function handleQuickMode(
  body: RequestBody,
  userId: string
): Promise<any> {
  console.log('[chat-analyze-v2] Running in QUICK mode');

  const datasetAttachment = body.attachments.find(a => a.type === 'dataset');
  if (!datasetAttachment) {
    throw new Error('No dataset attachment found');
  }

  const response = await quickAnalysis(
    datasetAttachment.dataset_id,
    body.question,
    userId
  );

  // Save to analyses table
  const { data: analysisRecord } = await supabase
    .from('analyses')
    .insert({
      user_id: userId,
      dataset_id: datasetAttachment.dataset_id,
      conversation_id: body.conversation_id,
      model: 'gpt-4o-mini-quick',
      prompt: body.question,
      result_json: { data: response.data, insights: response.insights },
      llm_response: { summary: response.insights.join('. ') },
      charts_config: [],
      status: 'completed',
    })
    .select('id')
    .single();

  return {
    success: true,
    mode: 'quick',
    executed_query: true,
    message: 'Quick analysis completed',
    analysis_id: analysisRecord?.id,
    result: {
      summary: response.insights.join('. '),
      data: response.data,
      insights: response.insights.map(i => ({ type: 'insight', content: i })),
    },
  };
}

/**
 * Legacy mode: Uses old pipeline (imported from original index.ts)
 */
async function handleLegacyMode(
  body: RequestBody,
  userId: string
): Promise<any> {
  console.log('[chat-analyze-v2] Running in LEGACY mode');

  // Import legacy function
  const { runAnalysisPipeline } = await import('./index.ts');

  const datasetAttachment = body.attachments.find(a => a.type === 'dataset');
  if (!datasetAttachment) {
    throw new Error('No dataset attachment found');
  }

  return await runAnalysisPipeline(
    datasetAttachment.dataset_id,
    body.question,
    userId,
    body.conversation_id
  );
}

/**
 * Main HTTP handler
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let step = 'initialization';

  try {
    console.log('[chat-analyze-v2] ===== REQUEST START =====');

    step = 'auth_check';
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return httpJson({ success: false, error: 'Authorization token required', step }, 401);
    }

    step = 'token_extraction';
    const token = authHeader.split(' ')[1];

    step = 'get_user';
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return httpJson(
        { success: false, error: 'User not authenticated', step, authError: authError?.message },
        401
      );
    }

    console.log('[chat-analyze-v2] User authenticated:', user.id);

    step = 'parse_body';
    const body: RequestBody = await req.json();
    console.log('[chat-analyze-v2] Body received:', JSON.stringify(body, null, 2));

    step = 'validate_conversation_id';
    if (!isUUID(body.conversation_id)) {
      return httpJson(
        {
          success: false,
          error: "A valid 'conversation_id' is required",
          step,
          received: body.conversation_id,
        },
        400
      );
    }

    step = 'validate_question';
    if (!body.question || typeof body.question !== 'string' || body.question.trim().length < 3) {
      return httpJson(
        { success: false, error: "A valid 'question' is required", step, received: body.question },
        400
      );
    }

    step = 'validate_attachments';
    if (!body.attachments || !Array.isArray(body.attachments) || body.attachments.length === 0) {
      return httpJson(
        {
          success: false,
          error: 'Attachments are required for analysis',
          step,
          received: body.attachments,
        },
        400
      );
    }

    step = 'determine_mode';
    const mode = body.mode || 'governed';
    console.log(`[chat-analyze-v2] Mode selected: ${mode}`);

    step = 'execute_analysis';
    let result;

    if (mode === 'quick') {
      result = await handleQuickMode(body, user.id);
    } else if (mode === 'governed') {
      result = await handleGovernedMode(body, user.id);
    } else if (mode === 'legacy') {
      result = await handleLegacyMode(body, user.id);
    } else {
      return httpJson({ success: false, error: `Invalid mode: ${mode}`, step }, 400);
    }

    console.log('[chat-analyze-v2] ===== REQUEST COMPLETE =====');
    return httpJson(result);
  } catch (error: any) {
    console.error('[chat-analyze-v2] ERROR:', error);
    return httpJson(
      {
        success: false,
        error: error.message || 'Unknown error',
        step,
        stack: error.stack,
      },
      500
    );
  }
});
