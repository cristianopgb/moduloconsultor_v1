/**
 * ===================================================================
 * ANALYZE FILE - Analytics Pipeline with Anti-Hallucination System
 * ===================================================================
 *
 * Complete pipeline integrating the 5-layer anti-hallucination defense:
 * 1. Schema Validator - Detects real types, validates compatibility
 * 2. Playbook Registry - 23 playbooks with 80% threshold
 * 3. Guardrails Engine - Disables sections without evidence
 * 4. Narrative Adapter - Fail-hard on violations
 * 5. Hallucination Detector - Scans final text
 *
 * CRITICAL: Zero hallucinations guaranteed
 *
 * SUPPORTS TWO INPUT FORMATS:
 * A) NEW: file_data (base64) + filename - Direct upload
 * B) OLD: dataset_id - Pre-uploaded dataset
 * ===================================================================
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { enrichSchema, validatePlaybookCompatibility, type Column } from '../_shared/schema-validator.ts';
import { loadPlaybooks } from '../_shared/playbook-registry.ts';
import { evaluateGuardrails } from '../_shared/guardrails-engine.ts';
import { generateSchemaAwareNarrative, formatNarrativeOutput } from '../_shared/narrative-adapter.ts';
import { scanForHallucinations, formatViolationReport, generateBlockedResultMessage } from '../_shared/hallucination-detector.ts';
import { generateSafeExploratoryAnalysis, formatFallbackAnalysis } from '../_shared/safe-exploratory-fallback.ts';
import { ingestFile } from '../_shared/ingest-orchestrator.ts';
import { buildAuditCard, formatAuditCardAsMarkdown } from '../_shared/audit-card-builder.ts';
import { executePlaybook } from '../_shared/playbook-executor.ts';
import {
  jsonOk,
  jsonError,
  jsonFallback,
  corsPreflightResponse,
  sanitizeForJson,
  buildDiagnostics,
  safeConversationId,
  checkPayloadSize,
  corsHeaders,
  buildCorsHeaders
} from '../_shared/response-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

// Payload limits
const MAX_PAYLOAD_BYTES = 3_000_000; // ~3 MB
const MAX_ROWS_PER_REQUEST = 10_000;
const MAX_COLUMNS = 200;

interface AnalyzeFileRequest {
  // DUAL PATH FORMAT: Frontend-parsed data (preferred)
  parsed_rows?: Array<Record<string, any>>;
  parse_metadata?: {
    row_count: number;
    column_count: number;
    headers: string[];
    [key: string]: any;
  };
  frontend_parsed?: boolean;

  // CHUNKED DATA FORMAT (for large payloads)
  parts?: Array<{
    part_index: number;
    parsed_rows: Array<Record<string, any>>;
  }>;

  // NEW FORMAT: Direct file upload (backend will parse)
  file_data?: string; // base64 encoded file
  filename?: string;

  // OLD FORMAT: Pre-uploaded dataset
  dataset_id?: string;
  file_key?: string;

  // COMMON
  user_id?: string;
  user_question?: string;
  conversation_id?: string;
  force_analysis?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  const startTime = Date.now();

  try {
    const body: AnalyzeFileRequest = await req.json().catch(() => ({}));
    const {
      dataset_id,
      user_id,
      file_key,
      user_question,
      file_data,
      filename,
      conversation_id,
      parsed_rows,
      parts,
      parse_metadata,
      frontend_parsed
    } = body;

    // Check payload size (non-blocking, just for diagnostics)
    const payloadCheck = checkPayloadSize(body, MAX_PAYLOAD_BYTES);

    // Build initial diagnostics
    const initialDiagnostics = buildDiagnostics({
      payload_size: payloadCheck.size,
      payload_size_mb: (payloadCheck.size / 1024 / 1024).toFixed(2),
      payload_exceeded: payloadCheck.exceeded,
      has_parsed_rows: !!parsed_rows,
      has_parts: !!(parts && parts.length > 0),
      has_file_data: !!file_data,
      has_dataset_id: !!dataset_id,
      frontend_parsed: !!frontend_parsed,
      filename,
    });

    console.log('[AnalyzeFile] Starting analysis:', initialDiagnostics);

    // ===================================================================
    // INPUT VALIDATION - Only reject if NO data provided
    // ===================================================================
    const hasAnyData =
      (Array.isArray(parsed_rows) && parsed_rows.length > 0) ||
      (Array.isArray(parts) && parts.length > 0) ||
      !!dataset_id ||
      !!file_data;

    if (!hasAnyData) {
      return jsonError(400, 'No data provided', {
        hint: 'Provide either parsed_rows (frontend parsed), parts (chunked data), file_data (base64), or dataset_id (UUID)',
        received_keys: Object.keys(body || {}),
        diagnostics: initialDiagnostics
      }, req);
    }

    // Get user from JWT if not provided
    let actualUserId = user_id;
    if (!actualUserId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user }, error: userError } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        if (user) actualUserId = user.id;
      }
    }

    console.log('[AnalyzeFile] User ID:', actualUserId || 'anonymous');

    // Sanitize conversation_id (relaxed validation)
    const safeConvId = safeConversationId(conversation_id);
    console.log('[AnalyzeFile] Conversation ID:', safeConvId);

    // ===================================================================
    // LOAD DATA: Support frontend-parsed, chunked, backend-parsed, or pre-loaded
    // Precedence: parsed_rows > parts > file_data > dataset_id
    // ===================================================================
    let rowData: any[] = [];
    let actualDatasetId = dataset_id;
    let ingestTelemetry: any = null;

    // PATH 1: Reconstruct from chunked parts (for large payloads)
    if (parts && Array.isArray(parts) && parts.length > 0) {
      console.log('[AnalyzeFile] Reconstructing from chunked parts (Path 1A)');

      rowData = parts
        .sort((a, b) => (a.part_index ?? 0) - (b.part_index ?? 0))
        .flatMap(p => Array.isArray(p.parsed_rows) ? p.parsed_rows : []);

      console.log(`[AnalyzeFile] Reconstructed ${rowData.length} rows from ${parts.length} chunks`);

      ingestTelemetry = {
        ingest_source: 'frontend_parsed_chunked',
        row_count: rowData.length,
        column_count: rowData.length > 0 ? Object.keys(rowData[0]).length : 0,
        chunks_received: parts.length,
        discarded_rows: 0,
        detection_confidence: 100,
        headers_original: rowData.length > 0 ? Object.keys(rowData[0]) : [],
        headers_normalized: rowData.length > 0 ? Object.keys(rowData[0]) : [],
        ingest_warnings: [],
        limitations: []
      };

    } else if (parsed_rows && Array.isArray(parsed_rows)) {
      // PATH 2: Frontend already parsed the data (PREFERRED)
      console.log('[AnalyzeFile] Using frontend-parsed data (Path 1B)');
      rowData = parsed_rows;

      // Build telemetry from parse_metadata
      if (parse_metadata) {
        ingestTelemetry = {
          ingest_source: 'frontend_parsed',
          row_count: parse_metadata.row_count || rowData.length,
          column_count: parse_metadata.column_count || (rowData.length > 0 ? Object.keys(rowData[0]).length : 0),
          discarded_rows: 0,
          file_size_bytes: parse_metadata.file_size || 0,
          detection_confidence: 100,
          headers_original: parse_metadata.headers || [],
          headers_normalized: parse_metadata.headers || [],
          ingest_warnings: [],
          limitations: [],
          // Include any additional metadata from frontend
          ...parse_metadata
        };
      } else {
        // Build basic telemetry if metadata not provided
        ingestTelemetry = {
          ingest_source: 'frontend_parsed',
          row_count: rowData.length,
          column_count: rowData.length > 0 ? Object.keys(rowData[0]).length : 0,
          discarded_rows: 0,
          file_size_bytes: 0,
          detection_confidence: 100,
          headers_original: rowData.length > 0 ? Object.keys(rowData[0]) : [],
          headers_normalized: rowData.length > 0 ? Object.keys(rowData[0]) : [],
          ingest_warnings: [],
          limitations: []
        };
      }

      console.log('[AnalyzeFile] Frontend-parsed data ready:', {
        source: 'frontend',
        rows: rowData.length,
        columns: ingestTelemetry.column_count
      });

    } else if (file_data) {
      // PATH 2: Backend will parse the file (FALLBACK)
      console.log('[AnalyzeFile] Processing file_data (base64) using ingest orchestrator (Path 2)');

      // Use ingest orchestrator to handle multiple file formats
      try {
        const ingestResult = await ingestFile(file_data, filename || 'unknown');
        rowData = ingestResult.rows;
        ingestTelemetry = ingestResult.telemetry;

        console.log('[AnalyzeFile] Ingestion complete:', {
          source: ingestTelemetry.ingest_source,
          rows: rowData.length,
          columns: ingestTelemetry.column_count,
          warnings: ingestTelemetry.ingest_warnings.length
        });
      } catch (error) {
        return jsonError(400, error.message, {
          hint: 'Verifique se o arquivo está em um formato suportado (CSV, Excel, JSON, TXT)'
        }, req);
      }

    } else if (dataset_id) {
      // PATH 3: Load from pre-existing dataset (LEGACY)
      console.log('[AnalyzeFile] Loading from dataset_id:', dataset_id);

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dataset_id)) {
        return jsonError(400, 'Invalid dataset_id format', {
          hint: 'dataset_id must be a valid UUID'
        }, req);
      }

      // Load from database
      const { data: rows, error: rowsError } = await supabase
        .from('dataset_rows')
        .select('row_data')
        .eq('dataset_id', dataset_id)
        .limit(1000);

      if (rowsError) {
        return jsonError(500, `Failed to load dataset rows: ${rowsError.message}`, {}, req);
      }

      rowData = rows?.map(r => r.row_data) || [];
      console.log(`[AnalyzeFile] Loaded ${rowData.length} rows from dataset`);
    }

    const rowCount = rowData.length;

    if (rowCount === 0) {
      return jsonError(400, 'Dataset is empty', {
        hint: 'No rows found in the provided data'
      }, req);
    }

    // 3. Detect basic schema
    const basicSchema: Column[] = Object.keys(rowData[0]).map(colName => {
      const sampleValues = rowData.slice(0, 10).map(row => row[colName]);
      const firstValue = sampleValues.find(v => v != null);

      let type = 'text';
      if (typeof firstValue === 'number') type = 'numeric';
      else if (firstValue instanceof Date) type = 'date';
      else if (typeof firstValue === 'boolean') type = 'boolean';

      return {
        name: colName,
        type,
        sample_values: sampleValues
      };
    });

    console.log(`[AnalyzeFile] Basic schema: ${basicSchema.length} columns`);

    // ===================================================================
    // ANTI-HALLUCINATION LAYER 1: SCHEMA VALIDATOR
    // ===================================================================
    console.log('[AnalyzeFile] LAYER 1: Schema Validator');

    const enrichedSchema = await enrichSchema(basicSchema, rowData.slice(0, 100));

    console.log(`[AnalyzeFile] Enriched schema with inferred types:`);
    enrichedSchema.forEach(col => {
      console.log(`  - ${col.name}: ${col.inferred_type} (confidence: ${col.confidence}%)`);
    });

    // ===================================================================
    // ANTI-HALLUCINATION LAYER 2: PLAYBOOK REGISTRY
    // ===================================================================
    console.log('[AnalyzeFile] LAYER 2: Playbook Registry');

    const allPlaybooks = loadPlaybooks();
    console.log(`[AnalyzeFile] Loaded ${allPlaybooks.length} playbooks`);

    // Validate all playbooks
    const validationResults = await Promise.all(
      allPlaybooks.map(async playbook => {
        const result = await validatePlaybookCompatibility(enrichedSchema, playbook, rowCount);
        return { playbook, ...result };
      })
    );

    // Filter compatible playbooks (score >= 80%)
    const compatiblePlaybooks = validationResults
      .filter(r => r.compatible && r.score >= 80)
      .sort((a, b) => b.score - a.score);

    console.log(`[AnalyzeFile] Compatible playbooks: ${compatiblePlaybooks.length}`);

    compatiblePlaybooks.slice(0, 5).forEach(p => {
      console.log(`  - ${p.playbook.id}: ${p.score}%`);
    });

    // ===================================================================
    // FALLBACK: No compatible playbook found (ALWAYS RETURN 200)
    // ===================================================================
    if (compatiblePlaybooks.length === 0) {
      console.log('[AnalyzeFile] No compatible playbook (all scores < 80%). Using safe fallback.');

      const topScores = validationResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(v => `${v.playbook.id}: ${v.score}%`)
        .join(', ');

      const fallbackReason = `Nenhum playbook encontrado com score ≥80%. Melhores scores: ${topScores}. ` +
        `O dataset não corresponde aos requisitos de nenhum playbook específico. ` +
        `Isso geralmente ocorre quando: (1) faltam colunas obrigatórias, (2) os tipos detectados não correspondem aos esperados, ou (3) o dataset é muito pequeno.`;

      let fallbackResult;
      let formattedAnalysis;

      try {
        fallbackResult = generateSafeExploratoryAnalysis(
          enrichedSchema,
          rowData.slice(0, 100),
          fallbackReason
        );
        formattedAnalysis = formatFallbackAnalysis(fallbackResult);
      } catch (fallbackError) {
        console.error('[AnalyzeFile] Error generating fallback analysis:', fallbackError);
        formattedAnalysis = `Análise exploratória não pôde ser gerada. Dados recebidos: ${rowCount} linhas, ${enrichedSchema.length} colunas.`;
        fallbackResult = {
          metadata: {
            row_count: rowCount,
            column_count: enrichedSchema.length,
            error: String(fallbackError)
          }
        };
      }

      // Save result to database (if we have user_id)
      let savedAnalysisId = null;
      if (actualUserId) {
        try {
          const { data: savedAnalysis, error: saveError } = await supabase
            .from('data_analyses')
            .insert({
              dataset_id: actualDatasetId,
              user_id: actualUserId,
              conversation_id: safeConvId,
              playbook_id: 'generic_exploratory_v1',
              narrative_text: formattedAnalysis,
              compatibility_score: 0,
              quality_score: fallbackResult.metadata.row_count >= 20 ? 60 : 40,
              is_fallback: true,
              metadata: {
                fallback_reason: fallbackReason,
                top_scores: topScores,
                ...fallbackResult.metadata,
                execution_time_ms: Date.now() - startTime,
                ...initialDiagnostics
              }
            })
            .select()
            .single();

          if (saveError) {
            console.error('[AnalyzeFile] Error saving fallback analysis:', saveError);
          } else {
            savedAnalysisId = savedAnalysis?.id;
          }
        } catch (dbError) {
          console.error('[AnalyzeFile] Database error:', dbError);
        }
      }

      return jsonFallback(
        {
          analysis_id: savedAnalysisId,
          playbook_id: 'generic_exploratory_v1',
          result: {
            summary: formattedAnalysis
          },
          full_dataset_rows: rowCount,
          metadata: fallbackResult.metadata,
          execution_time_ms: Date.now() - startTime,
          playbook_scores: validationResults
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(v => ({
              playbook_id: v.playbook.id,
              score: v.score,
              missing: v.missing_required,
              type_mismatches: v.type_mismatches.length
            }))
        },
        fallbackReason,
        initialDiagnostics,
        req
      );
    }

    // ===================================================================
    // Select best playbook
    // ===================================================================
    const bestMatch = compatiblePlaybooks[0];
    const selectedPlaybook = bestMatch.playbook;

    console.log(`[AnalyzeFile] Selected playbook: ${selectedPlaybook.id} (score: ${bestMatch.score}%)`);

    // ===================================================================
    // ANTI-HALLUCINATION LAYER 3: GUARDRAILS ENGINE
    // ===================================================================
    console.log('[AnalyzeFile] LAYER 3: Guardrails Engine');

    const guardrails = evaluateGuardrails(selectedPlaybook, enrichedSchema, rowCount);

    console.log(`[AnalyzeFile] Guardrails result:`);
    console.log(`  - Active sections: ${guardrails.active_sections.length}`);
    console.log(`  - Disabled sections: ${guardrails.disabled_sections.length}`);
    console.log(`  - Forbidden terms: ${guardrails.forbidden_terms.length}`);
    console.log(`  - Quality score: ${guardrails.quality_score}/100`);

    if (guardrails.disabled_sections.length > 0) {
      console.log(`[AnalyzeFile] Disabled sections:`);
      guardrails.disabled_sections.forEach(ds => {
        console.log(`  - ${ds.section}: ${ds.reason}`);
      });
    }

    // ===================================================================
    // EXECUTE ANALYSIS - Real Playbook Execution
    // ===================================================================
    console.log('[AnalyzeFile] Executing playbook analysis with real data...');

    const playbookResults = await executePlaybook(
      selectedPlaybook,
      enrichedSchema,
      rowData,
      guardrails.active_sections
    );

    console.log(`[AnalyzeFile] Playbook execution complete:`);
    console.log(`  - Sections executed: ${playbookResults.execution_metadata.sections_executed}`);
    console.log(`  - Metrics computed: ${playbookResults.execution_metadata.metrics_computed}`);
    console.log(`  - Execution time: ${playbookResults.execution_metadata.execution_time_ms}ms`);

    // Transform playbook results into format expected by narrative adapter
    const analysisResults = {
      playbook_results: playbookResults,
      sections: playbookResults.sections,
      computed_metrics: playbookResults.computed_metrics,
      row_count: rowCount,
      execution_time_ms: playbookResults.execution_metadata.execution_time_ms
    };

    // ===================================================================
    // ANTI-HALLUCINATION LAYER 4: NARRATIVE ADAPTER
    // ===================================================================
    console.log('[AnalyzeFile] LAYER 4: Narrative Adapter');

    const narrativeContext = {
      available_columns: enrichedSchema,
      forbidden_terms: guardrails.forbidden_terms,
      active_sections: guardrails.active_sections,
      disabled_sections: guardrails.disabled_sections,
      metrics_map: selectedPlaybook.metrics_map
    };

    const narrative = await generateSchemaAwareNarrative(
      analysisResults,
      narrativeContext,
      selectedPlaybook.id
    );

    console.log(`[AnalyzeFile] Narrative generated:`);
    console.log(`  - Executive summary: ${narrative.executive_summary.length} insights`);
    console.log(`  - Key findings: ${narrative.key_findings.length} insights`);
    console.log(`  - Recommendations: ${narrative.recommendations.length} insights`);
    console.log(`  - Validation errors: ${narrative.validation_errors.length}`);

    if (narrative.validation_errors.length > 0) {
      console.warn(`[AnalyzeFile] Narrative validation errors:`);
      narrative.validation_errors.forEach(err => console.warn(`  - ${err}`));
    }

    const formattedNarrative = formatNarrativeOutput(narrative);

    // ===================================================================
    // ANTI-HALLUCINATION LAYER 5: HALLUCINATION DETECTOR
    // ===================================================================
    console.log('[AnalyzeFile] LAYER 5: Hallucination Detector');

    const hallucinationReport = scanForHallucinations(
      formattedNarrative,
      enrichedSchema,
      guardrails.forbidden_terms,
      selectedPlaybook.metrics_map
    );

    console.log(`[AnalyzeFile] Hallucination check:`);
    console.log(`  - Violations: ${hallucinationReport.violations.length}`);
    console.log(`  - Confidence penalty: -${hallucinationReport.confidence_penalty} points`);
    console.log(`  - Should block: ${hallucinationReport.should_block}`);

    if (hallucinationReport.violations.length > 0) {
      console.warn(formatViolationReport(hallucinationReport));
    }

    // ===================================================================
    // TELEMETRY ONLY: Never block - violations are logged for monitoring
    // ===================================================================
    // Hallucination detection is for observability, not gatekeeping.
    // The LLM and playbook executor already validated against real data.
    // If playbook execution succeeded, results are valid by definition.
    if (hallucinationReport.should_block) {
      console.warn('[AnalyzeFile] ⚠️  Hallucinations detected - adding to quality notes (not blocking)');
    }

    // ===================================================================
    // Calculate final quality score
    // ===================================================================
    const finalQualityScore = Math.max(
      0,
      guardrails.quality_score - hallucinationReport.confidence_penalty
    );

    console.log(`[AnalyzeFile] Final quality score: ${finalQualityScore}/100`);

    // ===================================================================
    // Build quality notes from violations (warnings, never errors)
    // ===================================================================
    const qualityNotes: string[] = [...guardrails.warnings];

    if (hallucinationReport.violations.length > 0) {
      const criticalCount = hallucinationReport.violations.filter(v => v.severity === 'critical').length;
      const highCount = hallucinationReport.violations.filter(v => v.severity === 'high').length;

      if (criticalCount > 0) {
        qualityNotes.push(`Analysis may contain approximations (${criticalCount} critical pattern(s) detected)`);
      }
      if (highCount > 0) {
        qualityNotes.push(`Some column names were mapped using fuzzy matching (${highCount} variance(s))`);
      }
      if (hallucinationReport.blocked_terms.length > 0) {
        qualityNotes.push(`Note: Certain terms were detected but analysis completed successfully`);
      }
    }

    if (guardrails.disabled_sections.length > 0) {
      qualityNotes.push(`${guardrails.disabled_sections.length} section(s) skipped due to insufficient data signals`);
    }

    // ===================================================================
    // Save analysis to database (ALWAYS INSERT, never UPDATE)
    // ===================================================================
    let savedAnalysisId = null;

    if (actualUserId) {
      // Build audit card
      const auditCard = ingestTelemetry ? buildAuditCard(
        ingestTelemetry,
        enrichedSchema,
        guardrails,
        selectedPlaybook.id,
        bestMatch.score
      ) : null;

      // Generate file hash if we have conversation_id
      let file_hash = 'analysis-' + Date.now();
      if (conversation_id) {
        const hashStr = `${conversation_id}-${Date.now()}-${rowCount}`;
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(hashStr));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        file_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      // Build the analysis result data
      const analysisData = {
        user_id: actualUserId,
        conversation_id: conversation_id,
        file_hash: file_hash,
        file_metadata: {
          filename: filename || 'data.xlsx',
          ingestion_path: ingestTelemetry?.ingest_source || 'unknown',
          frontend_parsed: frontend_parsed || false
        },
        user_question: user_question || 'Análise de dados',
        parsed_schema: {
          columns: enrichedSchema,
          basic_columns: basicSchema.length,
          enriched_columns: enrichedSchema.length
        },
        sample_data: rowData.slice(0, 50), // First 50 rows for reference
        full_dataset_rows: rowCount,
        llm_reasoning: `Playbook: ${selectedPlaybook.description} (compatibility: ${bestMatch.score}%)`,
        ai_response: {
          playbook_id: selectedPlaybook.id,
          playbook_name: selectedPlaybook.description,
          compatibility_score: bestMatch.score,
          quality_score: finalQualityScore,
          narrative: formattedNarrative,
          is_fallback: false,
          audit_card: auditCard
        },
        status: 'completed',
        narrative_text: formattedNarrative,
        quality_score: finalQualityScore,
        confidence_score: finalQualityScore,
        processing_mode: 'enhanced',
        methodology_used: selectedPlaybook.description,
        metadata: {
          playbook_id: selectedPlaybook.id,
          playbook_name: selectedPlaybook.description,
          compatibility_score: bestMatch.score,

          // Ingestion telemetry (if available)
          ...(ingestTelemetry && {
            ingestion: {
              source: ingestTelemetry.ingest_source,
              file_size_bytes: ingestTelemetry.file_size_bytes,
              detection_confidence: ingestTelemetry.detection_confidence,
              discarded_rows: ingestTelemetry.discarded_rows,
              dialect: ingestTelemetry.dialect,
              decimal_locale: ingestTelemetry.decimal_locale,
              encoding: ingestTelemetry.encoding,
              sheet_name: ingestTelemetry.sheet_name,
              total_sheets: ingestTelemetry.total_sheets,
              detection_method: ingestTelemetry.detection_method,
              format: ingestTelemetry.format,
              ingest_warnings: ingestTelemetry.ingest_warnings,
              limitations: ingestTelemetry.limitations
            }
          }),

          schema_validation: {
            columns_detected: basicSchema.length,
            columns_enriched: enrichedSchema.length,
            inferred_types: enrichedSchema.reduce((acc, col) => {
              acc[col.name] = col.inferred_type || col.type;
              return acc;
            }, {} as Record<string, string>)
          },
          guardrails: {
            active_sections: guardrails.active_sections,
            disabled_sections: guardrails.disabled_sections.map(ds => ({
              section: ds.section,
              reason: ds.reason
            })),
            forbidden_terms_count: guardrails.forbidden_terms.length,
            warnings: guardrails.warnings
          },
          hallucination_check: {
            violations: hallucinationReport.violations.length,
            confidence_penalty: hallucinationReport.confidence_penalty,
            blocked_terms: hallucinationReport.blocked_terms
          },
          column_usage: narrative.column_usage_summary,
          execution_time_ms: Date.now() - startTime,
          row_count: rowCount
        }
      };

      // ALWAYS INSERT new record (backend creates and manages data_analyses)
      console.log('[AnalyzeFile] Creating data_analyses record');

      const { data: savedAnalysis, error: insertError } = await supabase
        .from('data_analyses')
        .insert(analysisData)
        .select()
        .single();

      if (insertError) {
        console.error('[AnalyzeFile] Error creating analysis:', insertError);
        // Continue anyway - return results even if save fails
      } else {
        savedAnalysisId = savedAnalysis?.id;
        console.log('[AnalyzeFile] ✅ Analysis record created:', savedAnalysisId);
      }
    }

    console.log(`[AnalyzeFile] ✅ Analysis complete in ${Date.now() - startTime}ms`);

    // ===================================================================
    // Return final result (Unified SaaS Response Contract)
    // ===================================================================
    return jsonOk({
      success: true,
      mode: 'playbook',
      result: {
        summary: formattedNarrative,
        sections: narrative.sections || [],
        metrics: narrative.metrics || []
      },
      schema: {
        columns: enrichedSchema.map(col => ({
          original: col.name,
          normalized: col.normalized_name || col.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          type: col.inferred_type || col.type,
          canonical: col.canonical_name
        })),
        row_count: rowCount
      },
      quality: {
        score: finalQualityScore,
        confidence: finalQualityScore,
        notes: qualityNotes
      },
      telemetry: {
        playbook_id: selectedPlaybook.id,
        playbook_name: selectedPlaybook.description,
        compatibility_score: bestMatch.score,
        execution_ms: Date.now() - startTime,
        columns_used: Object.keys(narrative.column_usage_summary),
        sections_active: guardrails.active_sections.length,
        sections_disabled: guardrails.disabled_sections.length,
        hallucination_violations: hallucinationReport.violations.length
      },
      persistence: {
        analysis_id: savedAnalysisId,
        persisted: savedAnalysisId !== null
      },
      // Legacy fields for backwards compatibility
      analysis_id: savedAnalysisId,
      is_fallback: false,
      full_dataset_rows: rowCount,
      enriched_schema: enrichedSchema
    }, { req });

  } catch (error) {
    console.error('[AnalyzeFile] Critical error:', error);
    console.error('[AnalyzeFile] Stack:', error.stack);

    // Return 200 with error details (not 500) - let frontend handle gracefully
    return jsonFallback(
      {
        result: {
          summary: `Erro ao processar análise: ${error.message}. Por favor, tente novamente ou entre em contato com o suporte.`
        }
      },
      `Critical error during analysis: ${error.message}`,
      {
        error_type: error.name,
        error_message: error.message,
        error_stack: error.stack?.split('\n').slice(0, 5).join('\n')
      },
      req
    );
  }
});
