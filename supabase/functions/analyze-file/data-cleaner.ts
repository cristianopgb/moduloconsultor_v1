/**
 * ===================================================================
 * DATA CLEANER - Robust Data Cleaning for Messy Spreadsheets
 * ===================================================================
 *
 * Handles:
 * - Merged cells and multi-line headers
 * - Misaligned data (logos, titles, summaries at top/bottom)
 * - Empty columns and rows
 * - Inconsistent data types
 * - Duplicate columns
 * - Special characters and formatting issues
 * - Multiple date and number formats
 * ===================================================================
 */

export interface CleanedDataset {
  rows: any[];
  columns: string[];
  totalRows: number;
  transformations: string[];
}

export interface CleaningOptions {
  skipEmptyRows?: boolean;
  skipEmptyColumns?: boolean;
  normalizeHeaders?: boolean;
  detectHeaderRow?: boolean;
  removeDuplicateColumns?: boolean;
  trimWhitespace?: boolean;
  normalizeTypes?: boolean;
}

const DEFAULT_OPTIONS: CleaningOptions = {
  skipEmptyRows: true,
  skipEmptyColumns: false, // DISABLED: Don't remove columns that might have sparse data
  normalizeHeaders: true,
  detectHeaderRow: true,
  removeDuplicateColumns: false, // DISABLED: Columns with same name might have different business meaning
  trimWhitespace: true,
  normalizeTypes: true,
};

/**
 * Main cleaning function - applies all cleaning steps
 */
export function cleanAndNormalizeData(
  rawRows: any[],
  rawColumns: string[],
  options: CleaningOptions = {}
): CleanedDataset {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const transformations: string[] = [];

  let rows = [...rawRows];
  let columns = [...rawColumns];

  console.log(`[DataCleaner] Starting with ${rows.length} rows and ${columns.length} columns`);

  // Step 1: Detect and skip header rows (logos, titles, etc.)
  if (opts.detectHeaderRow) {
    const result = detectAndSkipHeaderRows(rows, columns);
    rows = result.rows;
    if (result.skippedRows > 0) {
      console.log(`[DataCleaner] ⚠️ Skipped ${result.skippedRows} non-data rows at the top`);
      transformations.push(`Skipped ${result.skippedRows} non-data rows at the top`);
    }
  }

  // Step 2: Normalize column names
  if (opts.normalizeHeaders) {
    const result = normalizeColumnNames(columns);
    columns = result.columns;
    if (result.changes > 0) {
      console.log(`[DataCleaner] ✓ Normalized ${result.changes} column names`);
      transformations.push(`Normalized ${result.changes} column names`);
    }
  }

  // Step 3: Remove duplicate columns (CONSERVATIVE MODE)
  if (opts.removeDuplicateColumns) {
    const result = removeDuplicateColumns(rows, columns);
    const removed = result.removed;
    if (removed > 0) {
      console.log(`[DataCleaner] ⚠️ WOULD REMOVE ${removed} duplicate columns (SKIPPED IN CONSERVATIVE MODE)`);
      // Don't actually remove in conservative mode
    }
    // rows = result.rows;
    // columns = result.columns;
  }

  // Step 4: Remove empty columns (CONSERVATIVE MODE - only 100% empty)
  if (opts.skipEmptyColumns) {
    const result = removeEmptyColumns(rows, columns);
    const removed = result.removed;
    if (removed > 0) {
      console.log(`[DataCleaner] ⚠️ WOULD REMOVE ${removed} empty columns (SKIPPED IN CONSERVATIVE MODE)`);
      // Don't actually remove in conservative mode
    }
    // rows = result.rows;
    // columns = result.columns;
  }

  // Step 5: Remove empty rows
  if (opts.skipEmptyRows) {
    const before = rows.length;
    rows = removeEmptyRows(rows);
    const removed = before - rows.length;
    if (removed > 0) {
      transformations.push(`Removed ${removed} empty rows`);
    }
  }

  // Step 6: Trim whitespace from all values
  if (opts.trimWhitespace) {
    rows = trimAllValues(rows);
    transformations.push('Trimmed whitespace from all values');
  }

  // Step 7: Normalize data types (dates, numbers)
  if (opts.normalizeTypes) {
    const result = normalizeDataTypes(rows, columns);
    rows = result.rows;
    if (result.normalized > 0) {
      transformations.push(`Normalized ${result.normalized} values`);
    }
  }

  console.log(`[DataCleaner] Finished with ${rows.length} rows and ${columns.length} columns`);
  console.log(`[DataCleaner] Transformations applied:`, transformations);

  return {
    rows,
    columns,
    totalRows: rows.length,
    transformations,
  };
}

/**
 * Detect and skip non-data rows at the top (logos, titles, etc.)
 * Strategy: Find the row with the most non-empty values
 */
function detectAndSkipHeaderRows(rows: any[], columns: string[]): { rows: any[]; skippedRows: number } {
  if (rows.length === 0) return { rows, skippedRows: 0 };

  // Calculate non-empty cell count for each row
  const rowScores = rows.map((row, idx) => {
    const nonEmptyCells = columns.filter(col => {
      const val = row[col];
      return val !== null && val !== undefined && String(val).trim() !== '';
    }).length;

    return { idx, score: nonEmptyCells };
  });

  // Find first row with significant data (at least 50% filled)
  const threshold = columns.length * 0.5;
  const firstDataRow = rowScores.findIndex(r => r.score >= threshold);

  if (firstDataRow > 0) {
    console.log(`[detectHeaderRows] Skipping ${firstDataRow} rows at the top`);
    return {
      rows: rows.slice(firstDataRow),
      skippedRows: firstDataRow,
    };
  }

  return { rows, skippedRows: 0 };
}

/**
 * Normalize column names (remove special chars, spaces, etc.)
 */
function normalizeColumnNames(columns: string[]): { columns: string[]; changes: number } {
  let changes = 0;
  const seen = new Set<string>();

  const normalized = columns.map((col, idx) => {
    let clean = String(col || '')
      .trim()
      .replace(/[^\w\s]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!clean) {
      clean = `Column_${idx + 1}`;
    }

    // Handle duplicates
    let finalName = clean;
    let suffix = 1;
    while (seen.has(finalName.toLowerCase())) {
      finalName = `${clean}_${suffix}`;
      suffix++;
    }
    seen.add(finalName.toLowerCase());

    if (finalName !== col) changes++;

    return finalName;
  });

  return { columns: normalized, changes };
}

/**
 * Remove duplicate columns (same name or same values)
 */
function removeDuplicateColumns(rows: any[], columns: string[]): {
  rows: any[];
  columns: string[];
  removed: number;
} {
  const columnData = columns.map(col => ({
    name: col,
    values: rows.map(row => row[col]),
  }));

  const uniqueColumns: string[] = [];
  const toKeep = new Set<string>();

  for (let i = 0; i < columnData.length; i++) {
    const current = columnData[i];
    let isDuplicate = false;

    for (let j = 0; j < i; j++) {
      const other = columnData[j];

      // Check if values are identical
      const valuesMatch = current.values.every((val, idx) => val === other.values[idx]);

      if (valuesMatch) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueColumns.push(current.name);
      toKeep.add(current.name);
    }
  }

  const newRows = rows.map(row => {
    const newRow: any = {};
    uniqueColumns.forEach(col => {
      newRow[col] = row[col];
    });
    return newRow;
  });

  return {
    rows: newRows,
    columns: uniqueColumns,
    removed: columns.length - uniqueColumns.length,
  };
}

/**
 * Remove columns that are completely empty
 */
function removeEmptyColumns(rows: any[], columns: string[]): {
  rows: any[];
  columns: string[];
  removed: number;
} {
  const nonEmptyColumns = columns.filter(col => {
    return rows.some(row => {
      const val = row[col];
      return val !== null && val !== undefined && String(val).trim() !== '';
    });
  });

  const newRows = rows.map(row => {
    const newRow: any = {};
    nonEmptyColumns.forEach(col => {
      newRow[col] = row[col];
    });
    return newRow;
  });

  return {
    rows: newRows,
    columns: nonEmptyColumns,
    removed: columns.length - nonEmptyColumns.length,
  };
}

/**
 * Remove rows that are completely empty
 */
function removeEmptyRows(rows: any[]): any[] {
  return rows.filter(row => {
    return Object.values(row).some(val => {
      return val !== null && val !== undefined && String(val).trim() !== '';
    });
  });
}

/**
 * Trim whitespace from all string values
 */
function trimAllValues(rows: any[]): any[] {
  return rows.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => {
      const val = row[key];
      newRow[key] = typeof val === 'string' ? val.trim() : val;
    });
    return newRow;
  });
}

/**
 * Normalize data types (dates, numbers with different formats)
 */
function normalizeDataTypes(rows: any[], columns: string[]): {
  rows: any[];
  normalized: number;
} {
  let normalized = 0;

  const newRows = rows.map(row => {
    const newRow: any = {};

    columns.forEach(col => {
      let val = row[col];

      if (val === null || val === undefined || val === '') {
        newRow[col] = val;
        return;
      }

      const strVal = String(val).trim();

      // Try to normalize numbers (Brazilian/US formats)
      if (/^[R$\s]*[\d.,]+$/.test(strVal)) {
        // Remove currency symbols and spaces
        let cleaned = strVal.replace(/[R$\s]/g, '');

        // Brazilian format: 1.234,56 -> 1234.56
        if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
          const num = Number(cleaned);
          if (!isNaN(num)) {
            newRow[col] = cleaned;
            normalized++;
            return;
          }
        }
        // US format: 1,234.56 -> 1234.56
        else if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
          cleaned = cleaned.replace(/,/g, '');
          const num = Number(cleaned);
          if (!isNaN(num)) {
            newRow[col] = cleaned;
            normalized++;
            return;
          }
        }
      }

      // Try to normalize dates
      const datePatterns = [
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,  // DD/MM/YYYY or MM/DD/YYYY
        /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,    // YYYY-MM-DD
      ];

      for (const pattern of datePatterns) {
        if (pattern.test(strVal)) {
          const parsed = new Date(strVal);
          if (!isNaN(parsed.getTime())) {
            // Keep in ISO format for consistency
            newRow[col] = parsed.toISOString().split('T')[0];
            normalized++;
            return;
          }
        }
      }

      newRow[col] = val;
    });

    return newRow;
  });

  return { rows: newRows, normalized };
}
