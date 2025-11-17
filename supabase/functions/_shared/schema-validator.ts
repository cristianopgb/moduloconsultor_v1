/**
 * ===================================================================
 * SCHEMA VALIDATOR - Foundation of Anti-Hallucination System
 * ===================================================================
 *
 * Validates schema compatibility with playbooks using:
 * - Advanced type detection (Excel dates, numeric normalization)
 * - Synonym dictionary mapping
 * - Column name normalization
 * - Strict compatibility scoring (threshold: 80%)
 *
 * CRITICAL: Score < 80% → reject playbook (no gray area)
 * ===================================================================
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

export interface Column {
  name: string;
  type: string;
  inferred_type?: string;
  confidence?: number;
  sample_values?: any[];
  parse_errors_pct?: number;
  normalized_name?: string;
  canonical_name?: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  score: number;
  playbook_id: string;
  missing_required: string[];
  matched_columns: Record<string, string>;
  warnings: string[];
  type_mismatches: Array<{ column: string; expected: string; actual: string }>;
}

export interface TypeDetectionResult {
  inferred_type: 'date' | 'numeric' | 'text' | 'boolean';
  confidence: number;
  parse_errors_pct: number;
  metadata: {
    is_excel_serial?: boolean;
    is_epoch?: boolean;
    has_negatives?: boolean;
    decimal_separator?: 'comma' | 'period';
    date_format?: string;
  };
}

// Excel serial date reference (1899-12-30 as day 0)
const EXCEL_DATE_MIN = 1; // 1900-01-01
const EXCEL_DATE_MAX = 60000; // ~2064
const EXCEL_BASE_DATE = new Date(1899, 11, 30);

// Invalid dates to block
const INVALID_DATES = ['1970-01-01', '0001-01-01', '1900-01-01'];

// Dictionary cache (in-memory, TTL handled by Edge)
let dictionaryCache: Map<string, any> | null = null;
let dictionaryCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load semantic dictionary with caching
 */
async function loadSemanticDictionary(): Promise<Map<string, any>> {
  const now = Date.now();

  if (dictionaryCache && (now - dictionaryCacheTime) < CACHE_TTL_MS) {
    return dictionaryCache;
  }

  const { data, error } = await supabase
    .from('semantic_dictionary')
    .select('*');

  if (error) {
    console.warn('[SchemaValidator] Dictionary load error:', error.message);
    return new Map();
  }

  const dictionary = new Map();

  (data || []).forEach(entry => {
    const canonical = normalizeString(entry.canonical_name);

    if (!dictionary.has(canonical)) {
      dictionary.set(canonical, []);
    }

    dictionary.get(canonical).push({
      canonical_name: entry.canonical_name,
      entity_type: entry.entity_type,
      synonyms: entry.synonyms || [],
    });

    // Index by synonyms
    if (entry.synonyms && Array.isArray(entry.synonyms)) {
      entry.synonyms.forEach((synonym: string) => {
        const normSynonym = normalizeString(synonym);
        if (!dictionary.has(normSynonym)) {
          dictionary.set(normSynonym, []);
        }
        dictionary.get(normSynonym).push({
          canonical_name: entry.canonical_name,
          entity_type: entry.entity_type,
          synonyms: entry.synonyms,
        });
      });
    }
  });

  dictionaryCache = dictionary;
  dictionaryCacheTime = now;

  console.log(`[SchemaValidator] Loaded ${data?.length || 0} dictionary entries`);
  return dictionary;
}

/**
 * Normalize string for comparison
 * Removes accents, extra spaces, units in parentheses
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    // Remove units like "(Unid.)", "(R$)", etc.
    .replace(/\([^)]*\)/g, '')
    // Remove special chars
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    // Remove accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Map column name to canonical name using dictionary
 */
export async function mapToCanonicalName(columnName: string): Promise<string> {
  const dictionary = await loadSemanticDictionary();
  const normalized = normalizeString(columnName);

  // Exact match
  if (dictionary.has(normalized)) {
    const entries = dictionary.get(normalized);
    return entries[0].canonical_name;
  }

  // Fuzzy match (similarity >= 0.85)
  let bestMatch = '';
  let bestScore = 0;

  for (const [key, entries] of dictionary.entries()) {
    const similarity = stringSimilarity(normalized, key);
    if (similarity > bestScore && similarity >= 0.85) {
      bestScore = similarity;
      bestMatch = entries[0].canonical_name;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  // No match - return normalized original
  return columnName;
}

/**
 * String similarity (Levenshtein-based)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const maxLen = Math.max(len1, len2);
  const distance = levenshteinDistance(s1, s2);

  return 1 - (distance / maxLen);
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Detect column type from sample values
 *
 * CRITICAL: Handles Excel dates, epoch timestamps, comma decimals
 */
export async function detectColumnIntent(
  columnName: string,
  sampleValues: any[],
  declaredType: string
): Promise<TypeDetectionResult> {

  // Filter out nulls/undefined
  const validValues = sampleValues.filter(v => v != null && v !== '');

  if (validValues.length === 0) {
    return {
      inferred_type: 'text',
      confidence: 50,
      parse_errors_pct: 0,
      metadata: {}
    };
  }

  // Quick pass: 1% sample
  const quickSample = validValues.slice(0, Math.max(10, Math.floor(validValues.length * 0.01)));

  // Try Excel serial dates
  const excelDateResult = tryParseExcelDates(quickSample);
  if (excelDateResult.success && excelDateResult.confidence >= 90) {
    console.log(`[SchemaValidator] Detected Excel serial dates in "${columnName}"`);
    return {
      inferred_type: 'date',
      confidence: excelDateResult.confidence,
      parse_errors_pct: excelDateResult.parse_errors_pct,
      metadata: { is_excel_serial: true }
    };
  }

  // Try standard dates
  const dateResult = tryParseDates(quickSample);
  if (dateResult.success && dateResult.confidence >= 85) {
    // Check for invalid dates
    const hasInvalidDates = dateResult.parsed_dates.some(d =>
      INVALID_DATES.includes(d.toISOString().split('T')[0])
    );

    if (hasInvalidDates) {
      console.warn(`[SchemaValidator] Blocked invalid dates in "${columnName}"`);
      return {
        inferred_type: 'text',
        confidence: 50,
        parse_errors_pct: 0,
        metadata: {}
      };
    }

    return {
      inferred_type: 'date',
      confidence: dateResult.confidence,
      parse_errors_pct: dateResult.parse_errors_pct,
      metadata: { date_format: dateResult.format }
    };
  }

  // Try numeric (with comma/period normalization)
  const numericResult = tryParseNumeric(quickSample);
  if (numericResult.success && numericResult.parse_errors_pct < 30) {
    return {
      inferred_type: 'numeric',
      confidence: 100 - numericResult.parse_errors_pct,
      parse_errors_pct: numericResult.parse_errors_pct,
      metadata: {
        has_negatives: numericResult.has_negatives,
        decimal_separator: numericResult.decimal_separator
      }
    };
  }

  // Boolean
  const boolResult = tryParseBoolean(quickSample);
  if (boolResult.success && boolResult.confidence >= 90) {
    return {
      inferred_type: 'boolean',
      confidence: boolResult.confidence,
      parse_errors_pct: boolResult.parse_errors_pct,
      metadata: {}
    };
  }

  // Default to text
  return {
    inferred_type: 'text',
    confidence: 80,
    parse_errors_pct: 0,
    metadata: {}
  };
}

/**
 * Try to parse values as Excel serial dates
 */
function tryParseExcelDates(values: any[]): {
  success: boolean;
  confidence: number;
  parse_errors_pct: number;
  parsed_dates: Date[];
} {
  let successCount = 0;
  const parsed: Date[] = [];

  for (const val of values) {
    const num = Number(val);

    if (!isNaN(num) && Number.isInteger(num) && num >= EXCEL_DATE_MIN && num <= EXCEL_DATE_MAX) {
      const date = new Date(EXCEL_BASE_DATE.getTime() + num * 24 * 60 * 60 * 1000);
      parsed.push(date);
      successCount++;
    }
  }

  const successRate = (successCount / values.length) * 100;

  return {
    success: successRate >= 90,
    confidence: successRate,
    parse_errors_pct: 100 - successRate,
    parsed_dates: parsed
  };
}

/**
 * Try to parse values as standard dates
 */
function tryParseDates(values: any[]): {
  success: boolean;
  confidence: number;
  parse_errors_pct: number;
  format?: string;
  parsed_dates: Date[];
} {
  let successCount = 0;
  const parsed: Date[] = [];
  const formats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'ISO'];

  for (const val of values) {
    try {
      const date = new Date(val);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
        parsed.push(date);
        successCount++;
      }
    } catch {
      // Parse failed
    }
  }

  const successRate = (successCount / values.length) * 100;

  return {
    success: successRate >= 85,
    confidence: successRate,
    parse_errors_pct: 100 - successRate,
    format: formats[0],
    parsed_dates: parsed
  };
}

/**
 * Try to parse values as numeric
 * Handles comma/period as decimal separator
 */
function tryParseNumeric(values: any[]): {
  success: boolean;
  parse_errors_pct: number;
  has_negatives: boolean;
  decimal_separator: 'comma' | 'period';
} {
  let successCount = 0;
  let hasNegatives = false;
  let commaCount = 0;
  let periodCount = 0;

  for (const val of values) {
    let str = String(val).trim();

    // Count decimal separators
    if (str.includes(',')) commaCount++;
    if (str.includes('.')) periodCount++;

    // Normalize: replace comma with period
    str = str.replace(',', '.');

    const num = Number(str);
    if (!isNaN(num)) {
      successCount++;
      if (num < 0) hasNegatives = true;
    }
  }

  const successRate = (successCount / values.length) * 100;
  const parseErrorsPct = 100 - successRate;

  return {
    success: parseErrorsPct < 30,
    parse_errors_pct: parseErrorsPct,
    has_negatives,
    decimal_separator: commaCount > periodCount ? 'comma' : 'period'
  };
}

/**
 * Try to parse values as boolean
 */
function tryParseBoolean(values: any[]): {
  success: boolean;
  confidence: number;
  parse_errors_pct: number;
} {
  let successCount = 0;

  const trueValues = ['true', 'yes', 'sim', '1', 't', 's', 'y'];
  const falseValues = ['false', 'no', 'não', 'nao', '0', 'f', 'n'];

  for (const val of values) {
    const str = String(val).toLowerCase().trim();
    if (trueValues.includes(str) || falseValues.includes(str)) {
      successCount++;
    }
  }

  const successRate = (successCount / values.length) * 100;

  return {
    success: successRate >= 90,
    confidence: successRate,
    parse_errors_pct: 100 - successRate
  };
}

/**
 * Validate playbook compatibility with schema
 *
 * CRITICAL: Threshold is 80% - below that, playbook is rejected
 */
export async function validatePlaybookCompatibility(
  schema: Column[],
  playbook: any,
  rowCount: number
): Promise<CompatibilityResult> {

  console.log(`[SchemaValidator] Validating playbook "${playbook.id}" against schema`);

  const warnings: string[] = [];
  const missingRequired: string[] = [];
  const typeMismatches: Array<{ column: string; expected: string; actual: string }> = [];
  const matchedColumns: Record<string, string> = {};

  // Enrich schema with canonical names
  const enrichedSchema = await Promise.all(
    schema.map(async col => ({
      ...col,
      canonical_name: await mapToCanonicalName(col.name),
      normalized_name: normalizeString(col.name)
    }))
  );

  // Check required columns
  const requiredColumns = playbook.required_columns || {};
  const requiredKeys = Object.keys(requiredColumns);

  for (const reqCol of requiredKeys) {
    const expectedType = requiredColumns[reqCol];

    // Find matching column (by canonical name or normalized name)
    const matchingCol = enrichedSchema.find(col =>
      normalizeString(col.canonical_name || col.name) === normalizeString(reqCol) ||
      col.normalized_name === normalizeString(reqCol)
    );

    if (!matchingCol) {
      missingRequired.push(reqCol);
      continue;
    }

    matchedColumns[reqCol] = matchingCol.name;

    // Type validation
    const actualType = matchingCol.inferred_type || matchingCol.type;

    if (!isTypeCompatible(actualType, expectedType)) {
      typeMismatches.push({
        column: matchingCol.name,
        expected: expectedType,
        actual: actualType
      });
    }
  }

  // Check guardrails
  const guardrails = playbook.guardrails || {};

  if (guardrails.min_rows && rowCount < guardrails.min_rows) {
    warnings.push(`Dataset tem ${rowCount} linhas, mas playbook requer mínimo de ${guardrails.min_rows}`);
  }

  // Calculate compatibility score
  const totalRequired = requiredKeys.length;
  const matched = totalRequired - missingRequired.length;
  const typeCorrect = matched - typeMismatches.length;

  // Score formula: (matched_columns * 50) + (type_correct * 50) / total_required
  const matchScore = totalRequired > 0 ? (matched / totalRequired) * 50 : 0;
  const typeScore = totalRequired > 0 ? (typeCorrect / totalRequired) * 50 : 0;
  const score = Math.round(matchScore + typeScore);

  const compatible = score >= 80 && missingRequired.length === 0;

  console.log(`[SchemaValidator] Playbook "${playbook.id}" score: ${score}% (threshold: 80%)`);

  if (!compatible) {
    console.log(`[SchemaValidator] Rejected: missing=${missingRequired.length}, type_mismatches=${typeMismatches.length}`);
  }

  return {
    compatible,
    score,
    playbook_id: playbook.id,
    missing_required: missingRequired,
    matched_columns: matchedColumns,
    warnings,
    type_mismatches: typeMismatches
  };
}

/**
 * Check if actual type is compatible with expected type
 */
function isTypeCompatible(actualType: string, expectedType: string): boolean {
  const actual = actualType.toLowerCase();
  const expected = expectedType.toLowerCase();

  // Exact match
  if (actual === expected) return true;

  // Numeric variations
  if (expected === 'numeric') {
    return ['numeric', 'number', 'integer', 'float', 'decimal', 'int', 'bigint'].includes(actual);
  }

  // Date variations
  if (expected === 'date') {
    return ['date', 'datetime', 'timestamp', 'time'].includes(actual);
  }

  // Text variations
  if (expected === 'text') {
    return ['text', 'string', 'varchar', 'char'].includes(actual);
  }

  return false;
}

/**
 * Enrich schema with type detection and canonical mapping
 */
export async function enrichSchema(
  schema: Column[],
  sampleRows: any[]
): Promise<Column[]> {

  console.log(`[SchemaValidator] Enriching schema with ${schema.length} columns`);

  const enriched = await Promise.all(
    schema.map(async col => {
      // Get sample values for this column
      const sampleValues = sampleRows.map(row => row[col.name]).slice(0, 100);

      // Detect type
      const typeResult = await detectColumnIntent(col.name, sampleValues, col.type);

      // Map to canonical name
      const canonicalName = await mapToCanonicalName(col.name);

      return {
        ...col,
        inferred_type: typeResult.inferred_type,
        confidence: typeResult.confidence,
        sample_values: sampleValues.slice(0, 5),
        parse_errors_pct: typeResult.parse_errors_pct,
        normalized_name: normalizeString(col.name),
        canonical_name: canonicalName,
        metadata: typeResult.metadata
      };
    })
  );

  console.log(`[SchemaValidator] Enrichment complete`);

  return enriched;
}
