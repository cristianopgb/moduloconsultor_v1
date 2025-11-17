/**
 * ===================================================================
 * INGEST ORCHESTRATOR - Central router for file ingestion
 * ===================================================================
 *
 * Responsibilities:
 * 1. Detect file type using file-type-detector
 * 2. Validate file size limits
 * 3. Route to appropriate adapter
 * 4. Apply final normalizations
 * 5. Return standardized result with telemetry
 * ===================================================================
 */

import { detectFileType, isSupportedType, getFileTypeName, type FileType } from './file-type-detector.ts';
import { adaptCSV } from './csv-adapter.ts';
import { adaptXLSX } from './xlsx-adapter.ts';
import { adaptJSON } from './json-adapter.ts';
import { adaptTXT } from './txt-adapter.ts';
import { adaptPDF, adaptDOCX, adaptPPTX } from './document-adapters.ts';

export interface IngestedData {
  rows: Array<Record<string, any>>;
  telemetry: {
    ingest_source: string;
    row_count: number;
    column_count: number;
    discarded_rows: number;
    file_size_bytes: number;
    detection_confidence: number;

    // Type-specific metadata
    dialect?: string;
    decimal_locale?: string;
    encoding?: string;
    sheet_name?: string;
    total_sheets?: number;
    tables_detected?: number;
    chosen_table_shape?: { rows: number; cols: number };
    detection_method?: string;
    format?: string;

    // Normalization info
    headers_original: string[];
    headers_normalized: string[];

    // Warnings and limitations
    ingest_warnings: string[];
    limitations: string[];
  };
}

/**
 * Detect column types from sample data
 */
function inferColumnTypes(rows: Array<Record<string, any>>, sampleSize = 100): Record<string, string> {
  if (rows.length === 0) return {};

  const sample = rows.slice(0, sampleSize);
  const columns = Object.keys(rows[0]);
  const types: Record<string, string> = {};

  for (const col of columns) {
    const values = sample.map(row => row[col]).filter(v => v !== null && v !== undefined);

    if (values.length === 0) {
      types[col] = 'empty';
      continue;
    }

    // Count type occurrences
    let numericCount = 0;
    let integerCount = 0;
    let dateCount = 0;
    let booleanCount = 0;

    for (const val of values) {
      if (typeof val === 'boolean') {
        booleanCount++;
      } else if (typeof val === 'number') {
        numericCount++;
        if (Number.isInteger(val)) integerCount++;
      } else if (typeof val === 'string') {
        // Try parse as number
        const num = parseFloat(val);
        if (!isNaN(num) && val.trim() === num.toString()) {
          numericCount++;
          if (Number.isInteger(num)) integerCount++;
        }
        // Try parse as date
        else if (!isNaN(Date.parse(val))) {
          dateCount++;
        }
      } else if (val instanceof Date) {
        dateCount++;
      }
    }

    const total = values.length;

    // Determine type by majority (>70%)
    if (booleanCount / total > 0.7) {
      types[col] = 'boolean';
    } else if (integerCount / total > 0.7) {
      types[col] = 'integer';
    } else if (numericCount / total > 0.7) {
      types[col] = 'numeric';
    } else if (dateCount / total > 0.7) {
      types[col] = 'date';
    } else {
      types[col] = 'text';
    }
  }

  return types;
}

/**
 * Main orchestrator function
 */
export async function ingestFile(
  file_data_base64: string,
  filename: string
): Promise<IngestedData> {

  // Step 1: Detect file type
  const detection = detectFileType(file_data_base64, filename);

  console.log('[IngestOrchestrator] File type detected:', {
    type: detection.type,
    confidence: detection.confidence,
    size_mb: (detection.size_bytes / 1024 / 1024).toFixed(2),
    within_limits: detection.within_limits
  });

  // Step 2: Validate file type is supported
  if (!isSupportedType(detection.type)) {
    throw new Error(
      `Tipo de arquivo não suportado: ${detection.extension || 'desconhecido'}. ` +
      `Formatos aceitos: CSV, Excel (.xlsx), JSON, TXT, PDF*, Word*, PowerPoint*. ` +
      `*Formatos PDF/DOCX/PPTX têm suporte limitado nesta versão.`
    );
  }

  // Step 3: Validate size limits
  if (!detection.within_limits) {
    const sizeMB = (detection.size_bytes / 1024 / 1024).toFixed(2);
    throw new Error(
      `Arquivo muito grande: ${sizeMB}MB. ` +
      `Limite para ${getFileTypeName(detection.type)}: ${detection.size_limit_mb}MB. ` +
      `Considere filtrar os dados ou dividir em arquivos menores.`
    );
  }

  const warnings = [...detection.warnings];
  const limitations: string[] = [];

  // Step 4: Route to appropriate adapter
  let rows: Array<Record<string, any>>;
  let adapterMetadata: any = {};

  try {
    switch (detection.type) {
      case 'csv': {
        const result = adaptCSV(file_data_base64);
        rows = result.rows;
        adapterMetadata = result.metadata;
        break;
      }

      case 'xlsx': {
        const result = adaptXLSX(file_data_base64);
        rows = result.rows;
        adapterMetadata = result.metadata;
        break;
      }

      case 'json': {
        const result = adaptJSON(file_data_base64);
        rows = result.rows;
        adapterMetadata = result.metadata;
        break;
      }

      case 'txt': {
        const result = adaptTXT(file_data_base64);
        rows = result.rows;
        adapterMetadata = result.metadata;
        break;
      }

      case 'pdf': {
        const result = adaptPDF(file_data_base64);
        rows = result.rows;
        adapterMetadata = result.metadata;
        limitations.push('PDF table extraction is limited in this version');
        break;
      }

      case 'docx': {
        const result = adaptDOCX(file_data_base64);
        rows = result.rows;
        adapterMetadata = result.metadata;
        limitations.push('DOCX table extraction is limited in this version');
        break;
      }

      case 'pptx': {
        const result = adaptPPTX(file_data_base64);
        rows = result.rows;
        adapterMetadata = result.metadata;
        limitations.push('PPTX table extraction is limited in this version');
        break;
      }

      default:
        throw new Error(`No adapter available for file type: ${detection.type}`);
    }
  } catch (error) {
    // Re-throw with context
    throw new Error(`Falha ao processar arquivo ${getFileTypeName(detection.type)}: ${error.message}`);
  }

  // Step 5: Merge warnings from adapter
  if (adapterMetadata.warnings) {
    warnings.push(...adapterMetadata.warnings);
  }

  // Step 6: Infer column types
  const columnTypes = inferColumnTypes(rows);

  console.log('[IngestOrchestrator] Ingestion complete:', {
    rows: rows.length,
    columns: Object.keys(rows[0] || {}).length,
    discarded: adapterMetadata.discarded_rows || 0,
    warnings: warnings.length
  });

  // Step 7: Build telemetry
  const telemetry = {
    ingest_source: detection.type,
    row_count: rows.length,
    column_count: Object.keys(rows[0] || {}).length,
    discarded_rows: adapterMetadata.discarded_rows || 0,
    file_size_bytes: detection.size_bytes,
    detection_confidence: detection.confidence,

    // Type-specific metadata
    dialect: adapterMetadata.dialect,
    decimal_locale: adapterMetadata.decimal_locale,
    encoding: adapterMetadata.encoding,
    sheet_name: adapterMetadata.sheet_name,
    total_sheets: adapterMetadata.total_sheets,
    tables_detected: adapterMetadata.tables_detected,
    chosen_table_shape: adapterMetadata.chosen_table_shape,
    detection_method: adapterMetadata.detection_method,
    format: adapterMetadata.format,

    // Headers
    headers_original: adapterMetadata.headers || [],
    headers_normalized: adapterMetadata.normalized_headers || [],

    // Warnings and limitations
    ingest_warnings: warnings,
    limitations,

    // Column types
    column_types: columnTypes
  };

  return {
    rows,
    telemetry
  };
}
