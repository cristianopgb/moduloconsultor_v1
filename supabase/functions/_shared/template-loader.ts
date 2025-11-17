/**
 * ===================================================================
 * TEMPLATE LOADER
 * ===================================================================
 *
 * Loads analytics templates from models table
 * FIXED: No longer references non-existent analytics_templates table
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

export interface AnalyticsTemplate {
  id: string;
  name: string;
  description: string;
  required_columns: string[]; // Canonical names expected
  optional_columns?: string[];
  sql_template?: string;
  chart_config?: any;
  semantic_tags?: string[];
  domain?: string;
  version?: number;
}

export interface TemplateMatchResult {
  matched: boolean;
  template?: AnalyticsTemplate;
  match_score: number; // 0.0 - 1.0
  missing_columns: string[];
  available_columns: string[];
  reason?: string;
}

/**
 * Load all analytics templates from models table
 * FIXED: Uses correct table and no invalid filters
 */
export async function loadAnalyticsTemplates(): Promise<AnalyticsTemplate[]> {
  console.log('[TemplateLoader] Loading templates from models table...');

  const { data, error } = await supabase
    .from('models')
    .select('*')
    .eq('template_type', 'analytics'); // FIXED: correct filter

  if (error) {
    console.error('[TemplateLoader] Error loading templates:', error.message);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn('[TemplateLoader] No analytics templates found in models table');
    return [];
  }

  console.log(`[TemplateLoader] Loaded ${data.length} analytics templates`);

  return data.map(row => ({
    id: row.id,
    name: row.name || 'Unnamed Template',
    description: row.description || '',
    required_columns: Array.isArray(row.required_columns) ? row.required_columns : [],
    optional_columns: Array.isArray(row.optional_columns) ? row.optional_columns : [],
    sql_template: row.sql_template,
    chart_config: row.chart_config,
    semantic_tags: Array.isArray(row.semantic_tags) ? row.semantic_tags : [],
    domain: row.domain,
    version: row.version || 1,
  }));
}

/**
 * Match datacard columns against template requirements
 */
export async function matchTemplate(
  dataCard: DataCard,
  matchThreshold: number = 0.8
): Promise<TemplateMatchResult> {
  const templates = await loadAnalyticsTemplates();

  if (templates.length === 0) {
    return {
      matched: false,
      match_score: 0,
      missing_columns: [],
      available_columns: dataCard.columns.map(c => c.name),
      reason: 'No templates available',
    };
  }

  // Get available columns (use canonical names if semantic mapping was applied)
  const availableColumns = dataCard.columns.map(col => {
    const canonical = (col as any).canonical_name || col.name;
    return canonical.toLowerCase();
  });

  console.log('[TemplateLoader] Available columns (canonical):', availableColumns);

  let bestMatch: AnalyticsTemplate | undefined;
  let bestScore = 0;
  let bestMissing: string[] = [];

  for (const template of templates) {
    if (!template.required_columns || template.required_columns.length === 0) {
      continue;
    }

    const required = template.required_columns.map(c => c.toLowerCase());
    const matched = required.filter(req => availableColumns.includes(req));
    const missing = required.filter(req => !availableColumns.includes(req));
    const score = matched.length / required.length;

    console.log(`[TemplateLoader] Template "${template.name}": ${matched.length}/${required.length} columns (${(score * 100).toFixed(0)}%)`);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
      bestMissing = missing;
    }

    // Perfect match - stop searching
    if (score === 1.0) {
      break;
    }
  }

  if (bestMatch && bestScore >= matchThreshold) {
    console.log(`[TemplateLoader] ✓ Matched template "${bestMatch.name}" with score ${(bestScore * 100).toFixed(0)}%`);
    return {
      matched: true,
      template: bestMatch,
      match_score: bestScore,
      missing_columns: bestMissing,
      available_columns: availableColumns,
    };
  }

  console.log(`[TemplateLoader] ✗ No template matched (best score: ${(bestScore * 100).toFixed(0)}%, threshold: ${(matchThreshold * 100).toFixed(0)}%)`);
  return {
    matched: false,
    match_score: bestScore,
    missing_columns: bestMissing,
    available_columns: availableColumns,
    reason: bestMatch
      ? `Best template "${bestMatch.name}" missing columns: ${bestMissing.join(', ')}`
      : 'No suitable template found',
  };
}

/**
 * Get template by ID
 */
export async function getTemplateById(id: string): Promise<AnalyticsTemplate | null> {
  const { data, error } = await supabase
    .from('models')
    .select('*')
    .eq('id', id)
    .eq('template_type', 'analytics')
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name || 'Unnamed Template',
    description: data.description || '',
    required_columns: Array.isArray(data.required_columns) ? data.required_columns : [],
    optional_columns: Array.isArray(data.optional_columns) ? data.optional_columns : [],
    sql_template: data.sql_template,
    chart_config: data.chart_config,
    semantic_tags: Array.isArray(data.semantic_tags) ? data.semantic_tags : [],
    domain: data.domain,
    version: data.version || 1,
  };
}

/**
 * Filter templates by domain
 */
export async function getTemplatesByDomain(domain: string): Promise<AnalyticsTemplate[]> {
  const allTemplates = await loadAnalyticsTemplates();
  return allTemplates.filter(t => t.domain === domain);
}

/**
 * Search templates by semantic tags
 */
export async function searchTemplatesByTags(tags: string[]): Promise<AnalyticsTemplate[]> {
  const allTemplates = await loadAnalyticsTemplates();
  return allTemplates.filter(template => {
    if (!template.semantic_tags || template.semantic_tags.length === 0) {
      return false;
    }
    return tags.some(tag => template.semantic_tags!.includes(tag));
  });
}
