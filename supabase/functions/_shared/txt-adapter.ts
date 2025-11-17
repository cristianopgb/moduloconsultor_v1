/**
 * ===================================================================
 * TXT ADAPTER - Attempts to extract tabular data from text files
 * ===================================================================
 *
 * Strategy:
 * 1. Try delimiter detection (comma, semicolon, tab, pipe)
 * 2. Try fixed-width columns detection
 * 3. If both fail, return clear error with guidance
 * ===================================================================
 */

import { adaptCSV, type CSVAdapterResult } from './csv-adapter.ts';

export interface TXTAdapterResult {
  rows: Array<Record<string, any>>;
  metadata: {
    row_count: number;
    column_count: number;
    discarded_rows: number;
    detection_method: 'delimited' | 'fixed_width' | 'failed';
    dialect?: string;
    headers: string[];
    normalized_headers: string[];
    warnings: string[];
  };
}

/**
 * Detect if text has delimiter pattern
 */
function detectDelimiterPattern(text: string): { found: boolean; delimiter?: string; confidence: number } {
  const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 20);
  if (lines.length < 2) return { found: false, confidence: 0 };

  const delimiters = [
    { char: ',', name: 'comma' },
    { char: ';', name: 'semicolon' },
    { char: '\t', name: 'tab' },
    { char: '|', name: 'pipe' }
  ];

  let bestDelimiter: string | undefined;
  let bestScore = 0;

  for (const { char } of delimiters) {
    const counts = lines.map(line => (line.match(new RegExp(`\\${char}`, 'g')) || []).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.map(c => Math.abs(c - avg)).reduce((a, b) => a + b, 0) / counts.length;

    const score = avg > 0 ? (avg * 10) / (1 + variance) : 0;

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = char;
    }
  }

  const confidence = Math.min(100, bestScore * 5);

  if (confidence >= 40) {
    return { found: true, delimiter: bestDelimiter, confidence };
  }

  return { found: false, confidence };
}

/**
 * Normalize text for column name
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Attempt to detect fixed-width columns
 * Uses heuristic: consistent spacing across multiple lines
 */
function detectFixedWidthColumns(text: string): {
  found: boolean;
  columns?: Array<{ start: number; end: number; header: string }>;
} {
  const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 20);
  if (lines.length < 3) return { found: false };

  const firstLine = lines[0];
  const minLength = Math.min(...lines.map(l => l.length));

  // Look for consistent spacing patterns (2+ spaces)
  const spacingPattern: number[] = [];

  for (let i = 0; i < minLength; i++) {
    const charsAtPosition = lines.slice(0, 10).map(l => l[i]);
    const allSpaces = charsAtPosition.every(c => c === ' ');
    if (allSpaces) {
      spacingPattern.push(i);
    }
  }

  // Find column boundaries (sequences of spaces)
  const boundaries: number[] = [0];
  let inSpace = false;
  let spaceStart = -1;

  for (let i = 0; i < spacingPattern.length; i++) {
    const pos = spacingPattern[i];
    if (!inSpace) {
      inSpace = true;
      spaceStart = pos;
    }

    // Check if space sequence ends
    if (i === spacingPattern.length - 1 || spacingPattern[i + 1] !== pos + 1) {
      // Space sequence of at least 2
      if (pos - spaceStart >= 1) {
        boundaries.push(pos + 1);
      }
      inSpace = false;
    }
  }

  if (boundaries.length < 2) return { found: false };

  // Extract column headers and data
  const columns: Array<{ start: number; end: number; header: string }> = [];

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = i < boundaries.length - 1 ? boundaries[i + 1] : firstLine.length;
    const header = firstLine.substring(start, end).trim();

    if (header) {
      columns.push({ start, end, header });
    }
  }

  // Validate: must have at least 2 columns
  if (columns.length < 2) return { found: false };

  return { found: true, columns };
}

/**
 * Parse fixed-width format
 */
function parseFixedWidth(
  text: string,
  columns: Array<{ start: number; end: number; header: string }>
): TXTAdapterResult {
  const warnings: string[] = [];
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  const rawHeaders = columns.map(c => c.header);
  const normalizedHeaders: string[] = [];
  const counts = new Map<string, number>();

  for (const h of rawHeaders) {
    const normalized = normalizeText(h || 'column');
    const count = counts.get(normalized) || 0;
    counts.set(normalized, count + 1);
    normalizedHeaders.push(count === 0 ? normalized : `${normalized}_${count + 1}`);
  }

  const rows: Array<Record<string, any>> = [];
  let discardedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const rowObj: Record<string, any> = {};
    let hasNonNullValue = false;

    for (let j = 0; j < columns.length; j++) {
      const col = columns[j];
      const value = line.substring(col.start, col.end).trim();
      const normalized = value === '' || value.toUpperCase() === 'NA' || value.toUpperCase() === 'N/A' ? null : value;

      rowObj[normalizedHeaders[j]] = normalized;
      if (normalized !== null) hasNonNullValue = true;
    }

    if (!hasNonNullValue) {
      discardedRows++;
      continue;
    }

    rows.push(rowObj);
  }

  return {
    rows,
    metadata: {
      row_count: rows.length,
      column_count: normalizedHeaders.length,
      discarded_rows: discardedRows,
      detection_method: 'fixed_width',
      headers: rawHeaders,
      normalized_headers: normalizedHeaders,
      warnings
    }
  };
}

/**
 * Main TXT adapter function
 */
export function adaptTXT(file_data_base64: string): TXTAdapterResult {
  const warnings: string[] = [];

  // Decode base64
  let text: string;
  try {
    text = atob(file_data_base64);
  } catch (error) {
    throw new Error(`Failed to decode text file: ${error.message}`);
  }

  if (!text.trim()) {
    throw new Error('Text file is empty');
  }

  // Strategy 1: Try delimiter detection
  const delimiterResult = detectDelimiterPattern(text);

  if (delimiterResult.found && delimiterResult.confidence >= 40) {
    warnings.push(`Detected as delimited file (delimiter: ${delimiterResult.delimiter}, confidence: ${delimiterResult.confidence.toFixed(0)}%)`);

    try {
      // Use CSV adapter
      const csvResult: CSVAdapterResult = adaptCSV(file_data_base64);

      return {
        rows: csvResult.rows,
        metadata: {
          ...csvResult.metadata,
          detection_method: 'delimited'
        }
      };
    } catch (error) {
      warnings.push(`Delimiter parsing failed: ${error.message}. Trying fixed-width detection...`);
    }
  }

  // Strategy 2: Try fixed-width columns
  const fixedWidthResult = detectFixedWidthColumns(text);

  if (fixedWidthResult.found && fixedWidthResult.columns) {
    warnings.push(`Detected as fixed-width format with ${fixedWidthResult.columns.length} columns`);

    try {
      const result = parseFixedWidth(text, fixedWidthResult.columns);
      result.metadata.warnings = [...warnings, ...result.metadata.warnings];
      return result;
    } catch (error) {
      warnings.push(`Fixed-width parsing failed: ${error.message}`);
    }
  }

  // Strategy 3: Both failed
  throw new Error(
    'Não foi possível identificar estrutura tabular no arquivo TXT. ' +
    'Nenhum delimitador consistente (,;|\\t) nem colunas de largura fixa foram detectados. ' +
    'Para prosseguir, padronize o arquivo como CSV com delimitador explícito (vírgula ou ponto-e-vírgula).'
  );
}
