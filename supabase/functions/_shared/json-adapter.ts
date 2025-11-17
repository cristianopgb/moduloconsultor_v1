/**
 * ===================================================================
 * JSON ADAPTER - Transforms JSON files to normalized tabular format
 * ===================================================================
 *
 * Supports:
 * - Direct array: [{...}, {...}]
 * - Wrapped format: {data: [{...}], metadata: {...}}
 * - Validates structure consistency
 * - Normalizes column names
 * ===================================================================
 */

export interface JSONAdapterResult {
  rows: Array<Record<string, any>>;
  metadata: {
    row_count: number;
    column_count: number;
    format: 'direct_array' | 'wrapped_object';
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
 * Normalize null-like values
 */
function normalizeValue(value: any): any {
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toUpperCase() === 'NA' || trimmed.toUpperCase() === 'N/A' || trimmed.toLowerCase() === 'null') {
      return null;
    }
    return trimmed;
  }

  return value;
}

/**
 * Extract all unique keys from array of objects
 */
function extractAllKeys(objects: Array<Record<string, any>>): string[] {
  const keysSet = new Set<string>();
  for (const obj of objects) {
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => keysSet.add(key));
    }
  }
  return Array.from(keysSet);
}

/**
 * Main JSON adapter function
 */
export function adaptJSON(file_data_base64: string): JSONAdapterResult {
  const warnings: string[] = [];

  // Decode base64
  let text: string;
  try {
    text = atob(file_data_base64);
  } catch (error) {
    throw new Error(`Failed to decode JSON file: ${error.message}`);
  }

  // Parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON format: ${error.message}`);
  }

  let dataArray: Array<any>;
  let format: 'direct_array' | 'wrapped_object';

  // Detect format
  if (Array.isArray(parsed)) {
    // Direct array format
    dataArray = parsed;
    format = 'direct_array';
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Wrapped object format
    if ('data' in parsed && Array.isArray(parsed.data)) {
      dataArray = parsed.data;
      format = 'wrapped_object';

      if ('metadata' in parsed) {
        warnings.push('JSON contains metadata field (will be ignored)');
      }
    } else {
      throw new Error('JSON object must contain a "data" array field. Expected format: {data: [{...}]} or [{...}]');
    }
  } else {
    throw new Error('JSON must be an array or object with data array. Expected format: [{...}] or {data: [{...}]}');
  }

  if (dataArray.length === 0) {
    throw new Error('JSON data array is empty');
  }

  // Validate that array contains objects
  const nonObjects = dataArray.filter(item => typeof item !== 'object' || item === null || Array.isArray(item));
  if (nonObjects.length > 0) {
    throw new Error(`JSON array must contain only objects. Found ${nonObjects.length} non-object items. Expected format: [{col1: val1, col2: val2}, ...]`);
  }

  // Extract all unique keys across all objects
  const rawHeaders = extractAllKeys(dataArray);

  if (rawHeaders.length === 0) {
    throw new Error('JSON objects have no keys (all objects are empty)');
  }

  const normalizedHeaders = deduplicateHeaders(rawHeaders);

  // Check for inconsistent structure
  const keyCounts = dataArray.map(obj => Object.keys(obj).length);
  const minKeys = Math.min(...keyCounts);
  const maxKeys = Math.max(...keyCounts);

  if (maxKeys - minKeys > 3) {
    warnings.push(`Inconsistent object structure: some objects have ${minKeys} keys, others have ${maxKeys} keys. Missing keys will be filled with null.`);
  }

  // Normalize rows
  const rows: Array<Record<string, any>> = [];

  for (let i = 0; i < dataArray.length; i++) {
    const obj = dataArray[i];
    const normalizedRow: Record<string, any> = {};

    // Map original keys to normalized keys
    const keyMapping = new Map<string, string>();
    Object.keys(obj).forEach(originalKey => {
      const normalized = normalizeText(originalKey);
      keyMapping.set(originalKey, normalized);
    });

    // Build row with all columns
    for (const normalizedHeader of normalizedHeaders) {
      // Find original key that maps to this normalized header
      let value = null;
      for (const [originalKey, normalizedKey] of keyMapping.entries()) {
        if (normalizedKey === normalizedHeader.replace(/_\d+$/, '')) {
          // Handle deduplicated keys (column_2, column_3, etc.)
          value = obj[originalKey];
          break;
        }
      }

      normalizedRow[normalizedHeader] = normalizeValue(value);
    }

    rows.push(normalizedRow);
  }

  return {
    rows,
    metadata: {
      row_count: rows.length,
      column_count: normalizedHeaders.length,
      format,
      headers: rawHeaders,
      normalized_headers: normalizedHeaders,
      warnings
    }
  };
}
