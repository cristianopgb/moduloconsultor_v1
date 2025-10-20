/**
 * SQL SANITIZER AND VALIDATION MODULE
 *
 * Provides robust SQL sanitization, validation, and correction
 * to prevent injection attacks and syntax errors.
 */

export interface SQLValidationResult {
  valid: boolean;
  sanitizedSQL?: string;
  errors: string[];
  warnings: string[];
  correctionApplied: boolean;
}

/**
 * Sanitize a single SQL value for safe insertion
 * Handles strings, numbers, booleans, dates, and null values
 */
export function sanitizeValue(value: any, targetType: 'text' | 'numeric' | 'date' | 'boolean' = 'text'): string {
  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }

  // Handle numeric types
  if (targetType === 'numeric') {
    const cleaned = String(value).replace(/[R$\s]/g, '').replace(/\./g, '').replace(/,/g, '.');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 'NULL';
    return String(num);
  }

  // Handle boolean types
  if (targetType === 'boolean') {
    const str = String(value).toLowerCase();
    if (['true', 'sim', '1', 't', 'yes'].includes(str)) return 'true';
    if (['false', 'não', 'nao', '0', 'f', 'no'].includes(str)) return 'false';
    return 'NULL';
  }

  // Handle date types
  if (targetType === 'date') {
    const parsed = Date.parse(String(value));
    if (isNaN(parsed)) return 'NULL';
    const date = new Date(parsed);
    return `'${date.toISOString().split('T')[0]}'`;
  }

  // Handle text types (default)
  let str = String(value);

  // Truncate very long text (optimization for large datasets)
  if (str.length > 500) {
    str = str.substring(0, 500) + '...';
  }

  // Escape single quotes by doubling them (PostgreSQL standard)
  str = str.replace(/'/g, "''");

  // Remove problematic characters that can break JSON or SQL
  str = str.replace(/\\/g, '\\\\'); // Escape backslashes
  str = str.replace(/\n/g, ' '); // Replace newlines with spaces
  str = str.replace(/\r/g, ''); // Remove carriage returns
  str = str.replace(/\t/g, ' '); // Replace tabs with spaces
  str = str.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

  return `'${str}'`;
}

/**
 * Normalize column name to be SQL-safe
 * Handles case-sensitivity, special characters, and reserved words
 */
export function normalizeColumnName(columnName: string): string {
  let normalized = String(columnName || '').trim();

  // Remove quotes if already present
  normalized = normalized.replace(/^["'`]+|["'`]+$/g, '');

  // Check if contains special characters or spaces
  const needsQuoting = /[\s\-\.\/\\,;:()\[\]{}!@#$%^&*+=<>?|~`]/.test(normalized) ||
                       /^[0-9]/.test(normalized) || // Starts with number
                       normalized.toLowerCase() !== normalized; // Has uppercase

  // List of PostgreSQL reserved words that MUST be quoted
  const reservedWords = new Set([
    'user', 'order', 'group', 'table', 'select', 'from', 'where', 'insert',
    'update', 'delete', 'create', 'drop', 'alter', 'index', 'view', 'join',
    'left', 'right', 'inner', 'outer', 'on', 'as', 'and', 'or', 'not', 'in',
    'exists', 'between', 'like', 'is', 'null', 'true', 'false', 'case', 'when',
    'then', 'else', 'end', 'distinct', 'all', 'any', 'some', 'union', 'except',
    'intersect', 'limit', 'offset', 'primary', 'key', 'foreign', 'references',
    'check', 'default', 'unique', 'constraint', 'grant', 'revoke', 'commit',
    'rollback', 'transaction', 'begin', 'end', 'function', 'procedure'
  ]);

  const isReserved = reservedWords.has(normalized.toLowerCase());

  if (needsQuoting || isReserved) {
    // Escape double quotes inside the name
    normalized = normalized.replace(/"/g, '""');
    return `"${normalized}"`;
  }

  return normalized;
}

/**
 * Create case-insensitive column mapping for datasets
 * Helps match user queries with actual column names
 */
export function createColumnMap(columns: string[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const col of columns) {
    const lower = col.toLowerCase();
    const normalized = normalizeColumnName(col);

    // Store multiple variants
    map.set(lower, normalized); // Lowercase key
    map.set(col, normalized); // Original key
    map.set(normalized.toLowerCase().replace(/["'`]/g, ''), normalized); // Unquoted lowercase
  }

  return map;
}

/**
 * Fix SQL query to use correct column names from schema
 * Replaces column references with normalized, case-corrected versions
 */
export function fixColumnCasing(sql: string, columnMap: Map<string, string>): string {
  let fixed = sql;

  // Find all identifiers that might be column names
  // Pattern: word boundaries, not in strings, common SQL contexts
  const patterns = [
    /\bSELECT\s+([\w\s,.*()]+?)\s+FROM/gi,
    /\bWHERE\s+([\w\s=<>!,()]+?)(?:\s+(?:GROUP|ORDER|LIMIT|$))/gi,
    /\bGROUP\s+BY\s+([\w\s,()]+?)(?:\s+(?:HAVING|ORDER|LIMIT|$))/gi,
    /\bORDER\s+BY\s+([\w\s,()]+?)(?:\s+(?:LIMIT|$))/gi,
    /\b([\w]+)\s*=\s*/gi,
    /\b([\w]+)\s*<>/gi,
    /\b([\w]+)\s*>/gi,
    /\b([\w]+)\s*</gi,
  ];

  for (const [key, normalized] of columnMap.entries()) {
    // Case-insensitive replacement
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    fixed = fixed.replace(regex, (match) => {
      // Don't replace if it's in a string literal
      const beforeMatch = fixed.substring(0, fixed.indexOf(match));
      const singleQuotes = (beforeMatch.match(/'/g) || []).length;
      const doubleQuotes = (beforeMatch.match(/"/g) || []).length;

      // If odd number of quotes before, we're inside a string
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        return match;
      }

      return normalized;
    });
  }

  return fixed;
}

/**
 * Validate SQL before execution
 * Checks for common syntax errors, security issues, and logical problems
 */
export function validateSQL(sql: string, tempTableName: string, columns: string[]): SQLValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let correctionApplied = false;
  let sanitizedSQL = sql;

  // 1. Check for empty SQL
  if (!sql || sql.trim().length === 0) {
    errors.push('SQL está vazio');
    return { valid: false, errors, warnings, correctionApplied };
  }

  // 2. Must be a SELECT query
  if (!/^\s*SELECT\s+/i.test(sql)) {
    errors.push('SQL deve começar com SELECT');
  }

  // 3. Security checks (already done by exec_sql_secure, but double-check)
  const dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
  for (const keyword of dangerous) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(sql)) {
      errors.push(`Operação '${keyword}' não permitida em análises`);
    }
  }

  // 4. Must reference the temp table
  if (!sql.includes(tempTableName)) {
    errors.push(`SQL deve referenciar a tabela temporária '${tempTableName}'`);
  }

  // 5. Check for unquoted column names that might need quoting
  for (const col of columns) {
    const normalized = normalizeColumnName(col);
    if (sql.includes(col) && col !== normalized) {
      sanitizedSQL = sanitizedSQL.replace(new RegExp(`\\b${col}\\b`, 'g'), normalized);
      correctionApplied = true;
      warnings.push(`Coluna '${col}' foi normalizada para ${normalized}`);
    }
  }

  // 6. Check for common syntax errors
  if (sql.includes(',,')) {
    errors.push('Vírgulas duplas detectadas no SQL');
  }

  if ((sql.match(/\(/g) || []).length !== (sql.match(/\)/g) || []).length) {
    errors.push('Parênteses não balanceados');
  }

  // 7. Check for suspicious patterns
  if (/FROM\s+FROM/i.test(sql)) {
    errors.push('Palavra-chave FROM duplicada');
  }

  if (/SELECT\s*$/i.test(sql)) {
    errors.push('SELECT sem colunas especificadas');
  }

  // 8. Warn about potential performance issues
  if (!sql.includes('LIMIT') && !sql.includes('COUNT') && !sql.includes('GROUP BY')) {
    warnings.push('Query sem LIMIT pode retornar muitos resultados');
  }

  return {
    valid: errors.length === 0,
    sanitizedSQL: correctionApplied ? sanitizedSQL : sql,
    errors,
    warnings,
    correctionApplied
  };
}

/**
 * Auto-fix common SQL errors
 */
export function autoFixSQL(sql: string, tempTableName: string, columns: string[]): string {
  let fixed = sql;

  // Fix 1: Remove duplicate commas
  fixed = fixed.replace(/,\s*,/g, ',');

  // Fix 2: Remove trailing commas before FROM
  fixed = fixed.replace(/,\s+FROM/gi, ' FROM');

  // Fix 3: Ensure space after SELECT
  fixed = fixed.replace(/SELECT(\S)/gi, 'SELECT $1');

  // Fix 4: Ensure space before FROM
  fixed = fixed.replace(/(\S)FROM/gi, '$1 FROM');

  // Fix 5: Fix column casing
  const columnMap = createColumnMap(columns);
  fixed = fixColumnCasing(fixed, columnMap);

  // Fix 6: Add table alias if missing in complex queries
  if (fixed.includes('JOIN') && !fixed.includes(' AS ')) {
    // This is a heuristic - might need refinement
    fixed = fixed.replace(new RegExp(tempTableName, 'g'), `${tempTableName} AS t`);
  }

  return fixed;
}
