/*
  # Analytics V2 - Complete Setup (Consolidated Migration)

  ## Purpose
  This migration consolidates all necessary setup for the Analytics V2 system.
  It's designed to be idempotent and can be run multiple times safely.

  ## What This Creates

  1. **data_analyses table** - Single source of truth for analysis results
     - Stores complete analysis lifecycle
     - Uses JSONB for flexibility
     - Tracks full dataset size vs sample sent to LLM

  2. **exec_sql_secure function** - Secure SQL execution for analysis
     - Allows SELECT-only queries
     - Prevents SQL injection
     - Used by analyze-file Edge Function

  3. **All necessary RLS policies** - Security and access control

  ## Architecture

  The system works as follows:
  - User uploads file (CSV, XLSX, JSON) with 10,000 rows
  - System parses 100% of file (all 10,000 rows)
  - LLM receives 50-row sample to understand structure
  - LLM generates SQL query based on sample
  - PostgreSQL executes SQL on ALL 10,000 rows (accurate results)
  - LLM interprets real results and creates insights

  ## Safety
  - Uses IF NOT EXISTS for all CREATE statements
  - Drops existing policies before recreating (idempotent)
  - No destructive operations (no DROP TABLE)
*/

-- ============================================================================
-- PART 1: CREATE data_analyses TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,

  -- File identification and caching
  file_hash text NOT NULL,
  file_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Data structure (schema detected from full dataset)
  parsed_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_data jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Analysis request and strategy
  user_question text NOT NULL,
  llm_reasoning text,
  generated_sql text,

  -- CRITICAL: This tracks the FULL dataset size
  -- The analysis runs on ALL rows, not just the sample
  full_dataset_rows integer NOT NULL DEFAULT 0,

  -- Results from execution on COMPLETE data
  query_results jsonb DEFAULT '[]'::jsonb,
  ai_response jsonb DEFAULT '{}'::jsonb,

  -- Status tracking
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS data_analyses_user_id_idx ON data_analyses(user_id);
CREATE INDEX IF NOT EXISTS data_analyses_conversation_id_idx ON data_analyses(conversation_id);
CREATE INDEX IF NOT EXISTS data_analyses_file_hash_idx ON data_analyses(file_hash);
CREATE INDEX IF NOT EXISTS data_analyses_status_idx ON data_analyses(status);
CREATE INDEX IF NOT EXISTS data_analyses_user_created_idx ON data_analyses(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE data_analyses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can read own analyses" ON data_analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON data_analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON data_analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON data_analyses;

-- RLS Policies: Users can only access their own analyses
CREATE POLICY "Users can read own analyses"
  ON data_analyses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON data_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON data_analyses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON data_analyses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_data_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS update_data_analyses_updated_at_trigger ON data_analyses;
CREATE TRIGGER update_data_analyses_updated_at_trigger
  BEFORE UPDATE ON data_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_data_analyses_updated_at();

-- Add helpful comments
COMMENT ON TABLE data_analyses IS 'Analytics V2: LLM receives sample_data (50 rows) for structure, but SQL executes on full_dataset_rows (all data) for accurate results';
COMMENT ON COLUMN data_analyses.sample_data IS 'Small sample (50 rows) sent to LLM for context - NOT used for calculations';
COMMENT ON COLUMN data_analyses.full_dataset_rows IS 'CRITICAL: Total rows in original file - SQL executes on 100% of this data';
COMMENT ON COLUMN data_analyses.query_results IS 'Results from SQL execution on COMPLETE dataset (all rows)';

-- ============================================================================
-- PART 2: CREATE exec_sql_secure FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION exec_sql_secure(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_json jsonb;
  query_upper text;
BEGIN
  -- Validate input
  IF sql_query IS NULL OR trim(sql_query) = '' THEN
    RAISE EXCEPTION 'SQL query cannot be empty';
  END IF;

  -- Convert to uppercase for case-insensitive checks
  query_upper := upper(sql_query);

  -- Security: Block all destructive operations
  IF query_upper ~* '\y(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\y' THEN
    RAISE EXCEPTION 'Security violation: Only SELECT queries are allowed. Attempted operation: %',
      substring(query_upper from '\y(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\y');
  END IF;

  -- Security: Block access to system tables and sensitive schemas
  IF query_upper ~* '\y(pg_|information_schema|auth\.)\w+' THEN
    RAISE EXCEPTION 'Security violation: Access to system tables is not allowed';
  END IF;

  -- Security: Block multiple statements (prevent SQL injection via semicolons)
  IF sql_query ~ ';\s*\S' THEN
    RAISE EXCEPTION 'Security violation: Multiple statements are not allowed';
  END IF;

  -- Execute the query and aggregate results as JSON
  BEGIN
    EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t', sql_query)
    INTO result_json;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'SQL execution failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;

  RETURN COALESCE(result_json, '[]'::jsonb);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION exec_sql_secure(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql_secure(text) TO service_role;

-- Add comment
COMMENT ON FUNCTION exec_sql_secure(text) IS 'Analytics V2: Securely executes SELECT-only SQL. Used by analyze-file to run LLM-generated SQL on temp tables. Blocks all destructive operations.';

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================

-- After running this migration, verify with:
-- 1. SELECT * FROM data_analyses LIMIT 1;
-- 2. SELECT exec_sql_secure('SELECT 1 as test');
-- Both should work without errors.
