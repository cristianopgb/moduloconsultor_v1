/*
  # Create Analysis Plans and Debug Logs Tables

  1. New Tables
    - `analysis_plans`
      - Stores analysis plans awaiting user validation
      - Contains business understanding, queries, and user-friendly summaries
    - `query_debug_logs`
      - Logs all query execution attempts for debugging
      - Tracks retry attempts and errors

  2. Updates
    - `data_analyses` table gets new fields for plan tracking

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Create analysis_plans table
CREATE TABLE IF NOT EXISTS analysis_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  dataset_id UUID,
  conversation_id UUID,

  -- Context
  user_question TEXT NOT NULL,
  business_understanding JSONB,

  -- Analysis plan
  analysis_approach TEXT,
  user_friendly_summary TEXT,
  queries_planned JSONB,
  visualizations_planned JSONB,

  -- Status
  needs_clarification BOOLEAN DEFAULT false,
  clarification_questions JSONB,
  status TEXT DEFAULT 'pending',

  -- Dataset info
  profile_data JSONB,
  sample_rows JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_plans_user ON analysis_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_plans_status ON analysis_plans(status);
CREATE INDEX IF NOT EXISTS idx_analysis_plans_created ON analysis_plans(created_at DESC);

-- Enable RLS
ALTER TABLE analysis_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analysis_plans
CREATE POLICY "Users can view own analysis plans"
  ON analysis_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own analysis plans"
  ON analysis_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis plans"
  ON analysis_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to analysis plans"
  ON analysis_plans FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create query_debug_logs table
CREATE TABLE IF NOT EXISTS query_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  dataset_id UUID,
  analysis_plan_id UUID REFERENCES analysis_plans,

  user_question TEXT,

  -- Execution attempts
  attempts JSONB,

  -- Final result
  final_status TEXT,
  total_attempts INTEGER,
  success_on_attempt INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_debug_logs_user ON query_debug_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_query_debug_logs_status ON query_debug_logs(final_status);
CREATE INDEX IF NOT EXISTS idx_query_debug_logs_plan ON query_debug_logs(analysis_plan_id);
CREATE INDEX IF NOT EXISTS idx_query_debug_logs_created ON query_debug_logs(created_at DESC);

-- Enable RLS
ALTER TABLE query_debug_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for query_debug_logs
CREATE POLICY "Users can view own query debug logs"
  ON query_debug_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own query debug logs"
  ON query_debug_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to query debug logs"
  ON query_debug_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update data_analyses table with new fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'analysis_plan_id'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN analysis_plan_id UUID REFERENCES analysis_plans;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'business_understanding'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN business_understanding JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'partial_results'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN partial_results BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_analyses_plan ON data_analyses(analysis_plan_id);
