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
 * FIXED: Removed is_active filter (column doesn't exist), using correct schema
 */
async function loadSemanticDictionary(context?: SemanticContext): Promise<Map<string, any>> {
  const { data, error } = await supabase
    .from('semantic_dictionary')
    .select('*');

  if (error) {
    console.warn('[SemanticLayer] Error loading dictionary:', error.message);
    return new Map();
  }

  if (!data || data.length === 0) {
    console.warn('[SemanticLayer] Dictionary is empty - semantic mapping will fall back to raw names');
    return new Map();
  }

  const dictionary = new Map();

  (data || []).forEach(entry => {
    // Use canonical_name as the base for matching
    const canonical = normalizeString(entry.canonical_name);

    if (!dictionary.has(canonical)) {
      dictionary.set(canonical, []);
    }

    dictionary.get(canonical).push({
      canonical_name: entry.canonical_name,
      entity_type: entry.entity_type,
      tenant_id: entry.tenant_id,
      synonyms: entry.synonyms || [],
      description: entry.description,
      version: entry.version,
    });

    // Also index by synonyms for lookup
    if (entry.synonyms && Array.isArray(entry.synonyms)) {
      entry.synonyms.forEach((synonym: string) => {
        const normSynonym = normalizeString(synonym);
        if (!dictionary.has(normSynonym)) {
          dictionary.set(normSynonym, []);
        }
        dictionary.get(normSynonym).push({
          canonical_name: entry.canonical_name,
          entity_type: entry.entity_type,
          tenant_id: entry.tenant_id,
          synonyms: entry.synonyms,
          description: entry.description,
          version: entry.version,
        });
      });
    }
  });

  console.log(`[SemanticLayer] Loaded ${data.length} entries from semantic_dictionary`);
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

  // 2. Synonym match (now indexed, so should hit in step 1)
  // This is kept for backwards compatibility but should rarely execute
  for (const [key, entries] of dictionary.entries()) {
    for (const entry of entries) {
      if (entry.synonyms && Array.isArray(entry.synonyms)) {
        const matchedSynonym = entry.synonyms.find(
          (synonym: string) => normalizeString(synonym) === normalized
        );
        if (matchedSynonym) {
          console.log(`[SemanticLayer] Matched via synonym: "${rawName}" → "${entry.canonical_name}"`);
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
 * Prioritizes: tenant-specific > global, with version tiebreaker
 */
function selectBestEntry(entries: any[], context?: SemanticContext): any {
  if (entries.length === 1) return entries[0];

  // Prefer tenant-specific entries (not NULL tenant_id)
  const tenantSpecific = entries.filter(e => e.tenant_id !== null);
  if (tenantSpecific.length > 0) {
    return tenantSpecific.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
  }

  // Fall back to global (NULL tenant_id), highest version
  return entries.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
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
 * Get all canonical entities
 * FIXED: Removed is_active filter and domain filter (not in schema)
 */
export async function getCanonicalEntities(
  entityType?: 'column' | 'metric'
): Promise<string[]> {
  let query = supabase
    .from('semantic_dictionary')
    .select('canonical_name');

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[SemanticLayer] Error fetching entities:', error.message);
    return [];
  }

  const uniqueEntities = new Set((data || []).map(d => d.canonical_name));
  return Array.from(uniqueEntities);
}
