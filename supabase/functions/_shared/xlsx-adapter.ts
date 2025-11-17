/**
 * ===================================================================
 * XLSX ADAPTER - Transforms Excel files to normalized tabular format
 * ===================================================================
 *
 * Features:
 * - Parse XLSX using SheetJS library
 * - Process first sheet by default
 * - Detect and handle multiple sheets
 * - Convert Excel serial dates to ISO format
 * - Ignore merged cells (use first cell value)
 * - Normalize column names (snake_case, no accents, deduplicate)
 * - Handle null values and empty rows
 * ===================================================================
 */

import * as XLSX from 'npm:xlsx@0.18.5';

export interface XLSXAdapterResult {
  rows: Array<Record<string, any>>;
  metadata: {
    row_count: number;
    column_count: number;
    discarded_rows: number;
    sheet_name: string;
    total_sheets: number;
    sheet_names: string[];
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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Deduplicate column names
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
 * Convert Excel serial date to JavaScript Date
 * Excel serial dates: days since 1900-01-01 (or 1904-01-01 on Mac)
 */
function excelDateToJSDate(serial: number): Date | null {
  // Excel incorrectly treats 1900 as a leap year
  const excelEpoch = new Date(1899, 11, 30);
  const days = Math.floor(serial);
  const milliseconds = Math.round((serial - days) * 86400000);

  const date = new Date(excelEpoch.getTime() + days * 86400000 + milliseconds);

  // Validate reasonable date range (1900-2100)
  if (date.getFullYear() < 1900 || date.getFullYear() > 2100) {
    return null;
  }

  return date;
}

/**
 * Normalize cell value
 */
function normalizeCellValue(cell: any): any {
  if (cell === undefined || cell === null) return null;

  // Handle cell object from SheetJS
  if (typeof cell === 'object' && 'v' in cell) {
    const value = cell.v;
    const type = cell.t;

    // Null/empty
    if (value === undefined || value === null || value === '') return null;

    // Date type
    if (type === 'd') {
      return value instanceof Date ? value.toISOString() : value;
    }

    // Number type - check if it's an Excel date serial
    if (type === 'n') {
      // Excel dates are typically between 1 (1900-01-01) and 50000 (2036)
      if (value > 1 && value < 50000 && Number.isInteger(value)) {
        // Could be a date - try to convert
        const date = excelDateToJSDate(value);
        if (date) {
          // Check if SheetJS already formatted it as date
          if (cell.w && /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cell.w)) {
            return date.toISOString();
          }
        }
      }
      return value;
    }

    // Boolean
    if (type === 'b') {
      return Boolean(value);
    }

    // String/other
    const str = String(value).trim();
    if (str.toUpperCase() === 'NA' || str.toUpperCase() === 'N/A' || str.toLowerCase() === 'null') {
      return null;
    }
    return str;
  }

  // Handle direct values
  if (typeof cell === 'string') {
    const trimmed = cell.trim();
    if (trimmed === '' || trimmed.toUpperCase() === 'NA' || trimmed.toUpperCase() === 'N/A' || trimmed.toLowerCase() === 'null') {
      return null;
    }
    return trimmed;
  }

  if (typeof cell === 'number') {
    return cell;
  }

  if (typeof cell === 'boolean') {
    return cell;
  }

  return cell;
}

/**
 * Main XLSX adapter function
 */
export function adaptXLSX(file_data_base64: string): XLSXAdapterResult {
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
    throw new Error(`Failed to decode Excel file: ${error.message}`);
  }

  // Parse Excel file
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel file contains no sheets');
  }

  const sheetNames = workbook.SheetNames;
  const totalSheets = sheetNames.length;

  // Use first sheet by default
  const sheetName = sheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }

  if (totalSheets > 1) {
    warnings.push(`Excel file has ${totalSheets} sheets. Using first sheet: "${sheetName}". Other sheets: ${sheetNames.slice(1).join(', ')}`);
  }

  // Convert sheet to JSON (array of arrays)
  let rawData: any[][];
  try {
    rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Return array of arrays
      defval: null,
      blankrows: false,
      raw: false // Get formatted values
    });
  } catch (error) {
    throw new Error(`Failed to convert Excel sheet to JSON: ${error.message}`);
  }

  if (rawData.length === 0) {
    throw new Error(`Sheet "${sheetName}" is empty`);
  }

  if (rawData.length === 1) {
    throw new Error(`Sheet "${sheetName}" has only header row (no data)`);
  }

  // First row is header
  const rawHeaders = rawData[0].map(h => String(h || '').trim());
  if (rawHeaders.every(h => !h)) {
    throw new Error('Excel sheet has no valid headers in first row');
  }

  const normalizedHeaders = deduplicateHeaders(rawHeaders);
  const columnCount = normalizedHeaders.length;

  // Process data rows
  const rows: Array<Record<string, any>> = [];
  let discardedRows = 0;

  for (let i = 1; i < rawData.length; i++) {
    const rawRow = rawData[i];

    // Pad row if too short
    while (rawRow.length < columnCount) {
      rawRow.push(null);
    }

    // Build row object
    const rowObj: Record<string, any> = {};
    let hasNonNullValue = false;

    for (let j = 0; j < columnCount; j++) {
      const cellValue = normalizeCellValue(rawRow[j]);
      rowObj[normalizedHeaders[j]] = cellValue;
      if (cellValue !== null) hasNonNullValue = true;
    }

    // Discard rows with all null values
    if (!hasNonNullValue) {
      discardedRows++;
      continue;
    }

    rows.push(rowObj);
  }

  if (rows.length === 0) {
    throw new Error('No valid data rows in Excel sheet (all rows empty)');
  }

  // Check for merged cells (warning only)
  if (worksheet['!merges'] && worksheet['!merges'].length > 0) {
    warnings.push(`Sheet contains ${worksheet['!merges'].length} merged cell ranges - using first cell value only`);
  }

  return {
    rows,
    metadata: {
      row_count: rows.length,
      column_count: columnCount,
      discarded_rows: discardedRows,
      sheet_name: sheetName,
      total_sheets: totalSheets,
      sheet_names: sheetNames,
      headers: rawHeaders,
      normalized_headers: normalizedHeaders,
      warnings
    }
  };
}
