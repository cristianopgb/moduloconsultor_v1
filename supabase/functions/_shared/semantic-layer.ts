/**
 * ===================================================================
 * SEMANTIC LAYER
 * ===================================================================
 *
 * Resolves column name synonyms to canonical entities
 * Examples:
 *   - "Rep", "Vendedor", "Sales Rep" → "Vendedor"
 *   - "Valor", "Preço", "Price" → "Preço"
 *   - "Qtd", "Quantidade", "Quantity" → "Quantidade"
 *
 * Uses semantic_dictionary table populated with domain knowledge
 * ===================================================================
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { DataCard } from './analytics-contracts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

export interface SemanticMapping {
  raw_name: string;
  canonical_name: string;
  entity_type: 'dimension' | 'measure';
  confidence: number;
  matched_via: 'exact' | 'alias' | 'fuzzy' | 'fallback';
}

export interface SemanticContext {
  domain?: 'logistics' | 'sales' | 'hr' | 'financial' | 'generic';
  language?: 'pt' | 'en' | 'es';
}

/**
 * Load semantic dictionary from database
 */
async function loadSemanticDictionary(context?: SemanticContext): Promise<Map<string, any>> {
  const { data, error } = await supabase
    .from('semantic_dictionary')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.warn('[SemanticLayer] Error loading dictionary:', error.message);
    return new Map();
  }

  const dictionary = new Map();

  (data || []).forEach(entry => {
    const normalized = normalizeString(entry.raw_name);

    if (!dictionary.has(normalized)) {
      dictionary.set(normalized, []);
    }

    dictionary.get(normalized).push({
      canonical_name: entry.canonical_name,
      entity_type: entry.entity_type,
      domain: entry.domain,
      language: entry.language,
      confidence: entry.confidence,
      aliases: entry.aliases || [],
    });
  });

  return dictionary;
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Calculate string similarity (Levenshtein-based)
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

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }

  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

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
 * Resolve a single column name to canonical entity
 */
export async function resolveColumnName(
  rawName: string,
  context?: SemanticContext
): Promise<SemanticMapping> {
  const dictionary = await loadSemanticDictionary(context);
  const normalized = normalizeString(rawName);

  console.log(`[SemanticLayer] Resolving: "${rawName}" → normalized: "${normalized}"`);

  // 1. Exact match
  if (dictionary.has(normalized)) {
    const entries = dictionary.get(normalized);
    const bestMatch = selectBestEntry(entries, context);

    return {
      raw_name: rawName,
      canonical_name: bestMatch.canonical_name,
      entity_type: bestMatch.entity_type,
      confidence: 1.0,
      matched_via: 'exact',
    };
  }

  // 2. Alias match
  for (const [key, entries] of dictionary.entries()) {
    for (const entry of entries) {
      if (entry.aliases) {
        const matchedAlias = entry.aliases.find(
          (alias: string) => normalizeString(alias) === normalized
        );
        if (matchedAlias) {
          return {
            raw_name: rawName,
            canonical_name: entry.canonical_name,
            entity_type: entry.entity_type,
            confidence: 0.95,
            matched_via: 'alias',
          };
        }
      }
    }
  }

  // 3. Fuzzy match (similarity > 0.85)
  let bestSimilarity = 0;
  let bestEntry: any = null;

  for (const [key, entries] of dictionary.entries()) {
    const similarity = stringSimilarity(normalized, key);
    if (similarity > bestSimilarity && similarity >= 0.85) {
      bestSimilarity = similarity;
      bestEntry = selectBestEntry(entries, context);
    }
  }

  if (bestEntry) {
    return {
      raw_name: rawName,
      canonical_name: bestEntry.canonical_name,
      entity_type: bestEntry.entity_type,
      confidence: bestSimilarity,
      matched_via: 'fuzzy',
    };
  }

  // 4. Fallback: Use raw name as-is
  console.log(`[SemanticLayer] No match found for "${rawName}", using as-is`);

  return {
    raw_name: rawName,
    canonical_name: rawName,
    entity_type: 'dimension',
    confidence: 0.5,
    matched_via: 'fallback',
  };
}

/**
 * Select best entry based on context
 */
function selectBestEntry(entries: any[], context?: SemanticContext): any {
  if (entries.length === 1) return entries[0];

  if (context?.domain) {
    const domainMatch = entries.find(e => e.domain === context.domain);
    if (domainMatch) return domainMatch;
  }

  if (context?.language) {
    const langMatch = entries.find(e => e.language === context.language);
    if (langMatch) return langMatch;
  }

  return entries.sort((a, b) => b.confidence - a.confidence)[0];
}

/**
 * Resolve all columns in a DataCard
 */
export async function resolveDataCard(
  dataCard: DataCard,
  context?: SemanticContext
): Promise<DataCard> {
  console.log(`[SemanticLayer] Resolving DataCard with ${dataCard.columns.length} columns`);

  const semanticMapping: Record<string, string> = {};
  const resolvedColumns = [];

  for (const col of dataCard.columns) {
    const mapping = await resolveColumnName(col.name, context);
    semanticMapping[col.name] = mapping.canonical_name;

    resolvedColumns.push({
      ...col,
      canonical_name: mapping.canonical_name,
      mapping_confidence: mapping.confidence,
    });

    console.log(
      `[SemanticLayer]   "${col.name}" → "${mapping.canonical_name}" (${mapping.matched_via}, conf: ${mapping.confidence.toFixed(2)})`
    );
  }

  return {
    ...dataCard,
    semantic_mapping: semanticMapping,
    columns: resolvedColumns as any,
  };
}

/**
 * Get canonical name for a raw column name
 */
export async function getCanonicalName(
  rawName: string,
  context?: SemanticContext
): Promise<string> {
  const mapping = await resolveColumnName(rawName, context);
  return mapping.canonical_name;
}

/**
 * Check if a column represents a known entity
 */
export async function isKnownEntity(
  rawName: string,
  context?: SemanticContext
): Promise<boolean> {
  const mapping = await resolveColumnName(rawName, context);
  return mapping.matched_via !== 'fallback' && mapping.confidence >= 0.85;
}

/**
 * Get all canonical entities for a domain
 */
export async function getCanonicalEntities(
  entityType?: 'dimension' | 'measure',
  domain?: string
): Promise<string[]> {
  let query = supabase
    .from('semantic_dictionary')
    .select('canonical_name')
    .eq('is_active', true);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  if (domain) {
    query = query.eq('domain', domain);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[SemanticLayer] Error fetching entities:', error.message);
    return [];
  }

  const uniqueEntities = new Set((data || []).map(d => d.canonical_name));
  return Array.from(uniqueEntities);
}
