-- Analytics Governance System - Phase 1
-- Creates tables for semantic dictionary, metrics registry, and lineage tracking

-- ===================== SEMANTIC DICTIONARY =====================

CREATE TABLE IF NOT EXISTS semantic_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('dimension', 'measure')),
  canonical_name text NOT NULL,
  synonyms jsonb DEFAULT '[]'::jsonb,
  description text,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, canonical_name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_semantic_dict_tenant ON semantic_dictionary(tenant_id);
CREATE INDEX IF NOT EXISTS idx_semantic_dict_canonical ON semantic_dictionary(canonical_name);
CREATE INDEX IF NOT EXISTS idx_semantic_dict_synonyms ON semantic_dictionary USING gin(synonyms);

ALTER TABLE semantic_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read system-wide semantic dictionary"
  ON semantic_dictionary FOR SELECT
  TO authenticated
  USING (tenant_id IS NULL);

CREATE POLICY "Users can read own tenant semantic dictionary"
  ON semantic_dictionary FOR SELECT
  TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Masters can manage semantic dictionary"
  ON semantic_dictionary FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- ===================== METRICS REGISTRY =====================

CREATE TABLE IF NOT EXISTS metrics_registry (
  metric_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  formula_template text NOT NULL,
  required_columns jsonb DEFAULT '[]'::jsonb,
  dependencies jsonb DEFAULT '[]'::jsonb,
  fallback_rules jsonb DEFAULT '[]'::jsonb,
  granularity text NOT NULL CHECK (granularity IN ('row', 'group', 'aggregate')),
  domain text CHECK (domain IN ('logistics', 'sales', 'hr', 'financial', 'generic')),
  unit text,
  format text CHECK (format IN ('number', 'percentage', 'currency', 'duration')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics_registry(name);
CREATE INDEX IF NOT EXISTS idx_metrics_domain ON metrics_registry(domain);

ALTER TABLE metrics_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read metrics registry"
  ON metrics_registry FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Masters can manage metrics registry"
  ON metrics_registry FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- ===================== EXECUTION LINEAGE =====================

CREATE TABLE IF NOT EXISTS execution_lineage (
  exec_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exec_spec_hash text NOT NULL,
  exec_spec jsonb NOT NULL,
  data_card_summary jsonb,
  result_summary jsonb,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('success', 'error', 'cached')),
  execution_time_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_lineage_hash ON execution_lineage(exec_spec_hash);
CREATE INDEX IF NOT EXISTS idx_exec_lineage_user ON execution_lineage(user_id);
CREATE INDEX IF NOT EXISTS idx_exec_lineage_conversation ON execution_lineage(conversation_id);
CREATE INDEX IF NOT EXISTS idx_exec_lineage_created ON execution_lineage(created_at DESC);

ALTER TABLE execution_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own execution lineage"
  ON execution_lineage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own execution lineage"
  ON execution_lineage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access to execution_lineage"
  ON execution_lineage FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ===================== LINEAGE ARTIFACTS =====================

CREATE TABLE IF NOT EXISTS lineage_artifacts (
  artifact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exec_id uuid REFERENCES execution_lineage(exec_id) ON DELETE CASCADE,
  artifact_type text NOT NULL CHECK (artifact_type IN ('chart', 'table', 'metric', 'narrative')),
  artifact_spec jsonb NOT NULL,
  position_in_report integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lineage_artifacts_exec ON lineage_artifacts(exec_id);
CREATE INDEX IF NOT EXISTS idx_lineage_artifacts_type ON lineage_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_lineage_artifacts_position ON lineage_artifacts(position_in_report);

ALTER TABLE lineage_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read artifacts from own executions"
  ON lineage_artifacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM execution_lineage
      WHERE execution_lineage.exec_id = lineage_artifacts.exec_id
      AND execution_lineage.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert artifacts for own executions"
  ON lineage_artifacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM execution_lineage
      WHERE execution_lineage.exec_id = lineage_artifacts.exec_id
      AND execution_lineage.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to lineage_artifacts"
  ON lineage_artifacts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ===================== ANALYTICS PERFORMANCE LOG =====================

CREATE TABLE IF NOT EXISTS analytics_performance_log (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  plan_time_ms integer DEFAULT 0,
  exec_time_ms integer DEFAULT 0,
  total_time_ms integer DEFAULT 0,
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  had_refinement boolean DEFAULT false,
  token_cost_estimated integer DEFAULT 0,
  success boolean DEFAULT true,
  error_details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_perf_user ON analytics_performance_log(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_perf_conversation ON analytics_performance_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_analytics_perf_created ON analytics_performance_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_perf_success ON analytics_performance_log(success);

ALTER TABLE analytics_performance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own performance logs"
  ON analytics_performance_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own performance logs"
  ON analytics_performance_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Masters can read all performance logs"
  ON analytics_performance_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

CREATE POLICY "Service role full access to analytics_performance_log"
  ON analytics_performance_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
