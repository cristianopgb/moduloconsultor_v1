/**
 * ===================================================================
 * PLAYBOOK REGISTRY - Central Repository for Analysis Playbooks
 * ===================================================================
 *
 * Manages 23 domain-specific playbooks for data analysis.
 * Includes in-memory cache (5-10 min TTL) for performance.
 *
 * Domains covered:
 * - Estoque (3), Vendas (1), Logística (1), RH (1), Financeiro (1)
 * - Serviços (4), Industrial (3), Comércio (3)
 * - Estatística (8), Indicadores (3)
 * ===================================================================
 */

import playbooksData from './playbooks-seed.json' assert { type: 'json' };

export interface PlaybookMetric {
  deps: string[];
  formula: string;
  optional?: boolean;
}

export interface PlaybookGuardrails {
  min_rows?: number;
  require_numeric?: string[];
  temporal_sections_require?: string[];
  top_bottom_min_group_n?: number;
  require_numeric_array?: string[];
}

export interface PlaybookSections {
  overview?: string[];
  by_category?: string[];
  by_location?: string[];
  by_group?: string[];
  by_seller?: string[];
  by_route?: string[];
  by_customer?: string[];
  by_employee?: string[];
  by_unit?: string[];
  by_segment?: string[];
  by_line?: string[];
  by_cause?: string[];
  by_phase?: string[];
  by_team?: string[];
  by_store?: string[];
  by_channel?: string[];
  by_agent?: string[];
  by_plan?: string[];
  temporal_trend?: string[];
  distribution?: string[];
  relationship?: string[];
  significance?: string[];
  methods?: string[];
  heatmap?: string[];
  forecast?: string[];
  standardization?: string[];
  limitations?: string[];
  recommendations?: string[];
}

export interface Playbook {
  id: string;
  domain: string;
  description: string;
  required_columns: Record<string, string>;
  optional_columns?: Record<string, string>;
  forbidden_terms: string[];
  metrics_map: Record<string, PlaybookMetric>;
  guardrails: PlaybookGuardrails;
  sections: PlaybookSections;
}

export interface PlaybookRegistry {
  schema_version: string;
  registry_version: string;
  playbooks: Playbook[];
}

// In-memory cache
let playbooksCache: Playbook[] | null = null;
let cacheLoadTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Load all playbooks (with caching)
 */
export function loadPlaybooks(): Playbook[] {
  const now = Date.now();

  // Return cached if still valid
  if (playbooksCache && (now - cacheLoadTime) < CACHE_TTL_MS) {
    return playbooksCache;
  }

  // Load from JSON
  const registry = playbooksData as PlaybookRegistry;
  playbooksCache = registry.playbooks;
  cacheLoadTime = now;

  console.log(`[PlaybookRegistry] Loaded ${playbooksCache.length} playbooks (v${registry.registry_version})`);

  return playbooksCache;
}

/**
 * Get playbook by ID
 */
export function getPlaybookById(id: string): Playbook | null {
  const playbooks = loadPlaybooks();
  return playbooks.find(p => p.id === id) || null;
}

/**
 * Find matching playbooks by domain
 */
export function findPlaybooksByDomain(domain: string): Playbook[] {
  const playbooks = loadPlaybooks();
  return playbooks.filter(p => p.domain === domain);
}

/**
 * Find all compatible playbooks above minimum score threshold
 *
 * CRITICAL: Default threshold is 60% (relaxed for type-based matching)
 */
export async function findCompatiblePlaybooks(
  schema: any[],
  compatibilityResults: Map<string, any>,
  minScore: number = 60
): Promise<Playbook[]> {

  const playbooks = loadPlaybooks();
  const compatible: Playbook[] = [];

  for (const playbook of playbooks) {
    const result = compatibilityResults.get(playbook.id);

    if (result && result.compatible && result.score >= minScore) {
      compatible.push(playbook);
    }
  }

  console.log(`[PlaybookRegistry] Found ${compatible.length} compatible playbooks (threshold: ${minScore}%)`);

  return compatible;
}

/**
 * Get all playbooks (for batch validation)
 */
export function getAllPlaybooks(): Playbook[] {
  return loadPlaybooks();
}

/**
 * Get playbook metadata
 */
export function getPlaybookMetadata(): {
  total_playbooks: number;
  domains: string[];
  registry_version: string;
} {
  const playbooks = loadPlaybooks();
  const registry = playbooksData as PlaybookRegistry;

  const domains = [...new Set(playbooks.map(p => p.domain))];

  return {
    total_playbooks: playbooks.length,
    domains,
    registry_version: registry.registry_version
  };
}

/**
 * Search playbooks by keyword (in description or domain)
 */
export function searchPlaybooks(keyword: string): Playbook[] {
  const playbooks = loadPlaybooks();
  const lowerKeyword = keyword.toLowerCase();

  return playbooks.filter(p =>
    p.description.toLowerCase().includes(lowerKeyword) ||
    p.domain.toLowerCase().includes(lowerKeyword) ||
    p.id.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Get recommended playbook for common scenarios
 */
export function getRecommendedPlaybookForScenario(scenario: string): Playbook | null {
  const scenarios: Record<string, string> = {
    'inventory_divergence': 'pb_estoque_divergencias_v1',
    'stock_divergence': 'pb_estoque_divergencias_v1',
    'sales': 'pb_vendas_basico_v1',
    'otif': 'pb_logistica_otif_v1',
    'logistics': 'pb_logistica_otif_v1',
    'hr_performance': 'pb_rh_performance_v1',
    'cashflow': 'pb_financeiro_cashflow_v1',
    'oee': 'pb_industrial_oee_basico_v1',
    'pareto': 'pb_pareto_abc_generico_v1',
    'abc': 'pb_pareto_abc_generico_v1'
  };

  const playbookId = scenarios[scenario.toLowerCase()];
  return playbookId ? getPlaybookById(playbookId) : null;
}

/**
 * Validate that playbook has all required fields
 */
export function validatePlaybookStructure(playbook: Playbook): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!playbook.id) errors.push('Missing id');
  if (!playbook.domain) errors.push('Missing domain');
  if (!playbook.description) errors.push('Missing description');
  if (!playbook.required_columns) errors.push('Missing required_columns');
  if (!playbook.metrics_map) errors.push('Missing metrics_map');
  if (!playbook.guardrails) errors.push('Missing guardrails');
  if (!playbook.sections) errors.push('Missing sections');

  // Validate required_columns types
  if (playbook.required_columns) {
    for (const [col, type] of Object.entries(playbook.required_columns)) {
      const validTypes = ['numeric', 'date', 'text', 'boolean', 'numeric_array'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type "${type}" for column "${col}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get playbook statistics
 */
export function getPlaybookStats(): {
  by_domain: Record<string, number>;
  total: number;
  avg_required_columns: number;
  avg_optional_columns: number;
} {
  const playbooks = loadPlaybooks();

  const byDomain: Record<string, number> = {};
  let totalRequiredCols = 0;
  let totalOptionalCols = 0;

  for (const playbook of playbooks) {
    // Count by domain
    if (!byDomain[playbook.domain]) {
      byDomain[playbook.domain] = 0;
    }
    byDomain[playbook.domain]++;

    // Count columns
    totalRequiredCols += Object.keys(playbook.required_columns).length;
    totalOptionalCols += Object.keys(playbook.optional_columns || {}).length;
  }

  return {
    by_domain: byDomain,
    total: playbooks.length,
    avg_required_columns: Math.round(totalRequiredCols / playbooks.length * 10) / 10,
    avg_optional_columns: Math.round(totalOptionalCols / playbooks.length * 10) / 10
  };
}

/**
 * Clear cache (useful for tests or updates)
 */
export function clearCache(): void {
  playbooksCache = null;
  cacheLoadTime = 0;
  console.log('[PlaybookRegistry] Cache cleared');
}
