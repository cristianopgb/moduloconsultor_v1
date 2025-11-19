/**
 * ANALYZE FILE - SMART ENABLED
 *
 * LLM + SQL Pipeline (Fallback: Simple) - Funciona com qualquer dataset
 */ import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ingestFile } from '../_shared/ingest-orchestrator.ts';
import { analyzeSimple } from './simple-analyzer.ts';
import { analyzeSmart } from './smart-analyzer.ts'; // 🆕 Importação nova
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  },
  global: {
    fetch
  }
});
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  const startTime = Date.now();
  try {
    const body = await req.json().catch(()=>({}));
    const { parsed_rows, parse_metadata, file_data, filename, dataset_id, user_id, user_question = 'Analise este dataset e me dê insights relevantes', conversation_id } = body;
    console.log('[AnalyzeFile] Request received:', {
      has_parsed_rows: !!parsed_rows,
      has_file_data: !!file_data,
      has_dataset_id: !!dataset_id,
      user_question
    });
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing authorization token'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const effectiveUserId = user_id || user.id;
    // ===================================================================
    // STEP 1: GET DATA
    // ===================================================================
    let rowData = [];
    if (parsed_rows && parsed_rows.length > 0) {
      console.log('[AnalyzeFile] Using frontend-parsed data');
      rowData = parsed_rows;
    } else if (file_data) {
      console.log('[AnalyzeFile] Parsing file on backend');
      try {
        const ingestResult = await ingestFile(file_data, filename || 'unknown');
        rowData = ingestResult.rows;
        console.log(`[AnalyzeFile] Ingested ${rowData.length} rows`);
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: `File parsing failed: ${error.message}`,
          hint: 'Supported formats: CSV, Excel, JSON, TXT'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    } else if (dataset_id) {
      console.log('[AnalyzeFile] Loading from dataset_id');
      const { data: rows, error: rowsError } = await supabase.from('dataset_rows').select('row_data').eq('dataset_id', dataset_id).limit(10000);
      if (rowsError) {
        return new Response(JSON.stringify({
          success: false,
          error: `Database error: ${rowsError.message}`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      rowData = rows?.map((r)=>r.row_data) || [];
      console.log(`[AnalyzeFile] Loaded ${rowData.length} rows from database`);
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'No data provided',
        hint: 'Provide parsed_rows, file_data, or dataset_id'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (rowData.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dataset is empty'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`[AnalyzeFile] Dataset ready: ${rowData.length} rows`);
    // ===================================================================
    // STEP 2: ANALYZE
    // ===================================================================
    console.log('[AnalyzeFile] Starting analysis pipeline...');
    // 🔁 Troque para false se quiser voltar à versão antiga
    const useSmart = true;
    const analysisResult = useSmart ? await analyzeSmart(rowData, user_question) : await analyzeSimple(rowData, user_question);
    if (!analysisResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: analysisResult.error || 'Analysis failed'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ===================================================================
    // STEP 3: SAVE TO DATABASE
    // ===================================================================
    console.log('[AnalyzeFile] Saving analysis to database...');
    try {
      const { data: analysisRecord, error: insertError } = await supabase.from('data_analyses').insert({
        user_id: effectiveUserId,
        file_hash: dataset_id || 'inline',
        file_metadata: {
          filename: filename || 'inline-data.xlsx',
          size: parsed_rows ? parsed_rows.length : 0
        },
        parsed_schema: {
          columns: parse_metadata?.headers || [],
          types: {}
        },
        sample_data: parsed_rows ? parsed_rows.slice(0, 5) : [],
        user_question,
        llm_reasoning: analysisResult.sql_queries?.map((q)=>q.purpose).join('; ') || '',
        generated_sql: analysisResult.sql_queries?.map((q)=>q.sql).join(';\n') || '',
        full_dataset_rows: parsed_rows ? parsed_rows.length : 0,
        query_results: analysisResult.sql_queries?.map((q)=>({
            sql: q.sql,
            results: q.results
          })) || [],
        ai_response: {
          summary: analysisResult.summary,
          insights: analysisResult.insights,
          calculations: analysisResult.calculations,
          recommendations: analysisResult.recommendations
        },
        visualizations: analysisResult.charts || [],
        status: 'completed'
      }).select('id').single();
      if (insertError) {
        console.error('[AnalyzeFile] Failed to save analysis:', insertError);
      } else {
        console.log('[AnalyzeFile] Analysis saved:', analysisRecord?.id);
      }
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
          validation_passed: analysisResult.validation_passed
        },
        metadata: {
          total_rows: rowData.length,
          total_columns: rowData.length > 0 ? Object.keys(rowData[0]).length : 0,
          execution_time_ms: Date.now() - startTime,
          sql_queries_executed: analysisResult.sql_queries?.length || 0
        }
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (dbError) {
      console.error('[AnalyzeFile] Database error:', dbError);
      return new Response(JSON.stringify({
        success: true,
        executed_query: true,
        message: analysisResult.summary,
        result: {
          summary: analysisResult.summary,
          insights: analysisResult.insights,
          calculations: analysisResult.calculations,
          charts: analysisResult.charts,
          recommendations: analysisResult.recommendations,
          validation_passed: analysisResult.validation_passed
        },
        warning: 'Analysis completed but not saved to database'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('[AnalyzeFile] Unhandled error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
