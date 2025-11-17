/**
 * ===================================================================
 * ANALYTICS CONFIGURATION & FLAGS
 * ===================================================================
 *
 * Central configuration for the Analytics V2 deterministic engine
 * Controls pipeline behavior, fallback strategies, and observability
 * ===================================================================
 */

export interface AnalyticsConfig {
  // PIPELINE FLAGS
  quote_identifiers: boolean; // Prevent 42703 errors by quoting column names
  enable_generic_pivot_fallback: boolean; // Always return something useful
  template_registry_strict_mode: boolean; // Validate template shape before execution
  use_snake_case_columns: boolean; // Convert to snake_case (false in prod)
  retry_llm_after_deterministic: boolean; // Retry with LLM if deterministic fails

  // SEMANTIC LAYER
  enable_semantic_mapping: boolean; // Use semantic_dictionary for column resolution
  semantic_confidence_threshold: number; // Min confidence to accept mapping (0.0-1.0)
  fallback_to_raw_names: boolean; // Use raw names if semantic mapping fails

  // TEMPLATE MATCHING
  load_templates_from_models: boolean; // Load from models table (vs legacy sources)
  template_match_threshold: number; // Min % of required_columns that must match
  allow_partial_template_match: boolean; // Execute template with missing columns

  // FALLBACK BEHAVIOR
  fallback_enabled: boolean; // Execute fallback if no template matches
  fallback_strategy: 'top_n' | 'time_series' | 'pivot' | 'smart'; // Fallback type
  fallback_max_rows: number; // Max rows to return in fallback

  // TIME POLICIES
  apply_time_window_only_if_date_exists: boolean; // Don't invent date columns
  default_time_window_days: number; // Default to last N days (if date column exists)

  // OBSERVABILITY
  log_performance: boolean; // Log to analytics_performance_log
  log_lineage: boolean; // Log to execution_lineage
  log_semantic_mappings: boolean; // Log all semantic resolutions
  log_template_matches: boolean; // Log which template was chosen (or why fallback)
  verbose_logging: boolean; // Extra debug logs
}

/**
 * Environment profiles
 */
export const PROFILES: Record<string, AnalyticsConfig> = {
  dev_relaxed: {
    quote_identifiers: true,
    enable_generic_pivot_fallback: true,
    template_registry_strict_mode: false, // Permissive
    use_snake_case_columns: true,
    retry_llm_after_deterministic: true,

    enable_semantic_mapping: true,
    semantic_confidence_threshold: 0.7, // Lower threshold
    fallback_to_raw_names: true,

    load_templates_from_models: true,
    template_match_threshold: 0.6, // Lower threshold
    allow_partial_template_match: true,

    fallback_enabled: true,
    fallback_strategy: 'smart',
    fallback_max_rows: 100,

    apply_time_window_only_if_date_exists: true,
    default_time_window_days: 90,

    log_performance: true,
    log_lineage: true,
    log_semantic_mappings: true,
    log_template_matches: true,
    verbose_logging: true,
  },

  staging_strict: {
    quote_identifiers: true,
    enable_generic_pivot_fallback: true,
    template_registry_strict_mode: true, // Strict validation
    use_snake_case_columns: false, // Respect original names
    retry_llm_after_deterministic: false,

    enable_semantic_mapping: true,
    semantic_confidence_threshold: 0.85,
    fallback_to_raw_names: true,

    load_templates_from_models: true,
    template_match_threshold: 0.8,
    allow_partial_template_match: false,

    fallback_enabled: true,
    fallback_strategy: 'smart',
    fallback_max_rows: 50,

    apply_time_window_only_if_date_exists: true,
    default_time_window_days: 90,

    log_performance: true,
    log_lineage: true,
    log_semantic_mappings: true,
    log_template_matches: true,
    verbose_logging: false,
  },

  prod_strict: {
    quote_identifiers: true, // CRITICAL: prevents 42703
    enable_generic_pivot_fallback: true, // CRITICAL: always return something
    template_registry_strict_mode: true,
    use_snake_case_columns: false, // Respect client's original column names
    retry_llm_after_deterministic: false, // Only deterministic in prod

    enable_semantic_mapping: true,
    semantic_confidence_threshold: 0.85,
    fallback_to_raw_names: true,

    load_templates_from_models: true, // FIXED: use models table
    template_match_threshold: 0.8,
    allow_partial_template_match: false,

    fallback_enabled: true, // CRITICAL: never block execution
    fallback_strategy: 'smart',
    fallback_max_rows: 50,

    apply_time_window_only_if_date_exists: true, // CRITICAL: neutral policies
    default_time_window_days: 90,

    log_performance: true,
    log_lineage: true,
    log_semantic_mappings: false, // Reduce noise in prod
    log_template_matches: true,
    verbose_logging: false,
  },
};

/**
 * Get configuration for current environment
 */
export function getConfig(): AnalyticsConfig {
  const env = Deno.env.get('ANALYTICS_ENV') || 'prod_strict';

  if (env in PROFILES) {
    console.log(`[AnalyticsConfig] Using profile: ${env}`);
    return PROFILES[env];
  }

  console.warn(`[AnalyticsConfig] Unknown profile "${env}", defaulting to prod_strict`);
  return PROFILES.prod_strict;
}

/**
 * Override specific flags (for testing)
 */
export function getConfigWithOverrides(overrides: Partial<AnalyticsConfig>): AnalyticsConfig {
  const base = getConfig();
  return { ...base, ...overrides };
}

/**
 * Validate configuration
 */
export function validateConfig(config: AnalyticsConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.semantic_confidence_threshold < 0 || config.semantic_confidence_threshold > 1) {
    errors.push('semantic_confidence_threshold must be between 0 and 1');
  }

  if (config.template_match_threshold < 0 || config.template_match_threshold > 1) {
    errors.push('template_match_threshold must be between 0 and 1');
  }

  if (config.fallback_max_rows < 1 || config.fallback_max_rows > 1000) {
    errors.push('fallback_max_rows must be between 1 and 1000');
  }

  if (config.default_time_window_days < 1 || config.default_time_window_days > 3650) {
    errors.push('default_time_window_days must be between 1 and 3650');
  }

  if (!config.fallback_enabled && !config.load_templates_from_models) {
    errors.push('At least one of fallback_enabled or load_templates_from_models must be true');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Log configuration (for debugging)
 */
export function logConfig(config: AnalyticsConfig): void {
  console.log('[AnalyticsConfig] Current configuration:');
  console.log('  Pipeline:');
  console.log(`    - quote_identifiers: ${config.quote_identifiers}`);
  console.log(`    - enable_generic_pivot_fallback: ${config.enable_generic_pivot_fallback}`);
  console.log(`    - template_registry_strict_mode: ${config.template_registry_strict_mode}`);
  console.log('  Semantic:');
  console.log(`    - enable_semantic_mapping: ${config.enable_semantic_mapping}`);
  console.log(`    - semantic_confidence_threshold: ${config.semantic_confidence_threshold}`);
  console.log('  Templates:');
  console.log(`    - load_templates_from_models: ${config.load_templates_from_models}`);
  console.log(`    - template_match_threshold: ${config.template_match_threshold}`);
  console.log('  Fallback:');
  console.log(`    - fallback_enabled: ${config.fallback_enabled}`);
  console.log(`    - fallback_strategy: ${config.fallback_strategy}`);
}
