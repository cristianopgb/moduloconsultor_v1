/**
 * ===================================================================
 * CSV ADAPTER - Transforms CSV files to normalized tabular format
 * ===================================================================
 *
 * Features:
 * - Auto-detect delimiter (comma, semicolon, tab, pipe)
 * - Auto-detect encoding (UTF-8, Latin1, Windows-1252)
 * - Normalize decimal separators (comma → dot)
 * - Normalize column names (snake_case, no accents, deduplicate)
 * - Handle null values (empty, NA, N/A, null)
 * - Discard empty rows
 * ===================================================================
 */

export interface CSVAdapterResult {
  rows: Array<Record<string, any>>;
  metadata: {
    row_count: number;
    column_count: number;
    discarded_rows: number;
    dialect: string; // comma | semicolon | tab | pipe
    encoding: string;
    decimal_locale: string; // comma | dot
    headers: string[];
    normalized_headers: string[];
    warnings: string[];
  };
}

/**
 * Normalize text: remove accents, convert to snake_case
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9_\s]/g, '') // Remove special chars except underscore
    .replace(/\s+/g, '_') // Spaces to underscores
    .replace(/_+/g, '_') // Multiple underscores to single
    .replace(/^_|_$/g, ''); // Trim underscores
}

/**
 * Deduplicate column names by appending _2, _3, etc.
 */
function deduplicateHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map(h => {
    const normalized = normalizeText(h || 'column');
    const count = counts.get(normalized) || 0;
    counts.set(normalized, count + 1);
    return count === 0 ? normalized : `${normalized}_${count + 1}`;
  });
}

/**
 * Detect delimiter by analyzing frequency across lines
 */
function detectDelimiter(text: string): { delimiter: string; confidence: number } {
  const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 20);
  if (lines.length < 2) return { delimiter: ',', confidence: 0 };

  const delimiters = [
    { char: ',', name: 'comma' },
    { char: ';', name: 'semicolon' },
    { char: '\t', name: 'tab' },
    { char: '|', name: 'pipe' }
  ];

  let bestDelimiter = ',';
  let bestScore = 0;

  for (const { char, name } of delimiters) {
    const counts = lines.map(line => (line.match(new RegExp(`\\${char}`, 'g')) || []).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.map(c => Math.abs(c - avg)).reduce((a, b) => a + b, 0) / counts.length;

    // Score based on: high average count + low variance
    const score = avg > 0 ? (avg * 10) / (1 + variance) : 0;

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = char;
    }
  }

  const confidence = Math.min(100, bestScore * 5);
  return { delimiter: bestDelimiter, confidence };
}

/**
 * Try to detect encoding
 */
function detectEncoding(bytes: Uint8Array): string {
  // Check for BOM
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'UTF-8-BOM';
  }

  // Try UTF-8 decode
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return 'UTF-8';
  } catch {
    // Fallback to Latin1
    return 'Latin1';
  }
}

/**
 * Parse CSV line respecting quoted values
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (!inQuotes && char === delimiter) {
      result.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  result.push(current.trim());
  return result;
}

/**
 * Normalize value: handle nulls, decimals, trim
 */
function normalizeValue(value: string, decimalLocale: 'comma' | 'dot'): any {
  const trimmed = value.trim();

  // Handle null values
  if (trimmed === '' || trimmed.toUpperCase() === 'NA' || trimmed.toUpperCase() === 'N/A' || trimmed.toLowerCase() === 'null') {
    return null;
  }

  // Try to convert to number (handle comma decimals)
  if (decimalLocale === 'comma') {
    // Check if looks like a number with comma decimal
    if (/^-?\d+,\d+$/.test(trimmed)) {
      const normalized = trimmed.replace(',', '.');
      const num = parseFloat(normalized);
      if (!isNaN(num)) return num;
    }
  }

  // Try standard number parse
  const num = parseFloat(trimmed);
  if (!isNaN(num) && /^-?\d+\.?\d*$/.test(trimmed)) {
    return num;
  }

  return trimmed;
}

/**
 * Detect if CSV uses comma as decimal separator
 */
function detectDecimalLocale(rows: string[][], delimiter: string): 'comma' | 'dot' {
  let commaDecimalCount = 0;
  let dotDecimalCount = 0;

  for (const row of rows.slice(0, 10)) {
    for (const cell of row) {
      // If delimiter is comma, can't use comma as decimal
      if (delimiter === ',') return 'dot';

      // Check for comma decimal pattern: digits,digits
      if (/^\d+,\d+$/.test(cell.trim())) {
        commaDecimalCount++;
      }
      // Check for dot decimal pattern
      if (/^\d+\.\d+$/.test(cell.trim())) {
        dotDecimalCount++;
      }
    }
  }

  return commaDecimalCount > dotDecimalCount ? 'comma' : 'dot';
}

/**
 * Main CSV adapter function
 */
export function adaptCSV(file_data_base64: string): CSVAdapterResult {
  const warnings: string[] = [];

  // Decode base64
  let bytes: Uint8Array;
  try {
    const binaryString = atob(file_data_base64);
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  } catch (error) {
    throw new Error(`Failed to decode CSV file: ${error.message}`);
  }

  // Detect encoding
  const encoding = detectEncoding(bytes);
  let text: string;
  try {
    if (encoding === 'UTF-8' || encoding === 'UTF-8-BOM') {
      text = new TextDecoder('utf-8').decode(bytes);
      // Remove BOM if present
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
    } else {
      text = new TextDecoder('latin1').decode(bytes);
    }
  } catch (error) {
    throw new Error(`Failed to decode CSV with encoding ${encoding}: ${error.message}`);
  }

  // Detect delimiter
  const { delimiter, confidence } = detectDelimiter(text);
  if (confidence < 30) {
    warnings.push(`Low confidence (${confidence.toFixed(0)}%) in delimiter detection`);
  }

  const dialectName =
    delimiter === ',' ? 'comma' :
    delimiter === ';' ? 'semicolon' :
    delimiter === '\t' ? 'tab' :
    delimiter === '|' ? 'pipe' : 'unknown';

  // Split into lines
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  if (lines.length === 1) {
    throw new Error('CSV file has only header row (no data rows)');
  }

  // Parse header
  const rawHeaders = parseCSVLine(lines[0], delimiter);
  if (rawHeaders.length === 0 || rawHeaders.every(h => !h.trim())) {
    throw new Error('CSV file has no valid header');
  }

  const normalizedHeaders = deduplicateHeaders(rawHeaders);

  // Parse data rows
  const rawRows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delimiter);
    // Skip completely empty rows
    if (cells.every(c => c.trim() === '')) continue;
    rawRows.push(cells);
  }

  // Detect decimal locale
  const decimalLocale = detectDecimalLocale(rawRows, delimiter);

  // Convert to objects
  const rows: Array<Record<string, any>> = [];
  let discardedRows = 0;

  for (const rawRow of rawRows) {
    // Pad row if too short
    while (rawRow.length < normalizedHeaders.length) {
      rawRow.push('');
    }

    // Truncate if too long
    if (rawRow.length > normalizedHeaders.length) {
      warnings.push(`Row has more columns than header (${rawRow.length} vs ${normalizedHeaders.length}) - truncating`);
      rawRow.splice(normalizedHeaders.length);
    }

    const rowObj: Record<string, any> = {};
    let hasNonNullValue = false;

    for (let i = 0; i < normalizedHeaders.length; i++) {
      const value = normalizeValue(rawRow[i], decimalLocale);
      rowObj[normalizedHeaders[i]] = value;
      if (value !== null) hasNonNullValue = true;
    }

    // Discard rows with all null values
    if (!hasNonNullValue) {
      discardedRows++;
      continue;
    }

    rows.push(rowObj);
  }

  if (rows.length === 0) {
    throw new Error('No valid data rows after parsing (all rows empty)');
  }

  return {
    rows,
    metadata: {
      row_count: rows.length,
      column_count: normalizedHeaders.length,
      discarded_rows: discardedRows,
      dialect: dialectName,
      encoding,
      decimal_locale: decimalLocale,
      headers: rawHeaders,
      normalized_headers: normalizedHeaders,
      warnings
    }
  };
}
