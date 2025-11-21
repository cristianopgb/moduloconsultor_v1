/*
  # Add Analysis Visualizations and KPIs Tables

  1. New Tables
    - `analysis_visualizations`
      - Stores all generated visualizations (charts, tables, etc.)
      - Links to data_analyses via analysis_id
      - Includes config for Chart.js rendering

    - `analysis_kpis`
      - Stores KPI cards for quick metric display
      - Links to data_analyses via analysis_id

  2. Changes
    - Add columns to `data_analyses` for enhanced narrative structure

  3. Security
    - Enable RLS on both tables
    - Users can read their own visualizations
    - Service role can insert visualizations
*/

-- Create analysis_visualizations table
CREATE TABLE IF NOT EXISTS analysis_visualizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES data_analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viz_type text NOT NULL CHECK (viz_type IN ('bar', 'line', 'pie', 'scatter', 'table', 'kpi', 'heatmap', 'gauge')),
  title text NOT NULL,
  description text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  interpretation text,
  insights text[] DEFAULT ARRAY[]::text[],
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create analysis_kpis table
CREATE TABLE IF NOT EXISTS analysis_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES data_analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  trend text,
  comparison text,
  icon text,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_visualizations_analysis_id
  ON analysis_visualizations(analysis_id);

CREATE INDEX IF NOT EXISTS idx_analysis_visualizations_user_id
  ON analysis_visualizations(user_id);

CREATE INDEX IF NOT EXISTS idx_analysis_kpis_analysis_id
  ON analysis_kpis(analysis_id);

CREATE INDEX IF NOT EXISTS idx_analysis_kpis_user_id
  ON analysis_kpis(user_id);

-- Enable RLS
ALTER TABLE analysis_visualizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analysis_visualizations
CREATE POLICY "Users can view own visualizations"
  ON analysis_visualizations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert visualizations"
  ON analysis_visualizations
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can delete own visualizations"
  ON analysis_visualizations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for analysis_kpis
CREATE POLICY "Users can view own KPIs"
  ON analysis_kpis
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert KPIs"
  ON analysis_kpis
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can delete own KPIs"
  ON analysis_kpis
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add enhanced narrative columns to data_analyses (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'executive_headline'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN executive_headline text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'executive_summary_text'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN executive_summary_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'business_recommendations'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN business_recommendations jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'next_questions'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN next_questions text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;