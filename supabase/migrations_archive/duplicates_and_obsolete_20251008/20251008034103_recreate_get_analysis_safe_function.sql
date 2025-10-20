/*
  # Recreate get_analysis_safe Function for New data_analyses Table

  ## Purpose
  Replaces the old get_analysis_safe function to work with data_analyses table.
  The old function returned data from 'analyses' table, but Analytics V2 uses 'data_analyses'.

  ## Changes
  - Drop old function (was returning wrong table structure)
  - Create new function that queries data_analyses
  - Return all columns from data_analyses table
  - Maintain same security model (user must own the analysis)

  ## Security
  - SECURITY DEFINER to bypass RLS
  - But checks auth.uid() = user_id manually
  - Only returns data if user owns the analysis
*/

-- Drop old function
DROP FUNCTION IF EXISTS get_analysis_safe(uuid);

-- Create new function for data_analyses table
CREATE OR REPLACE FUNCTION get_analysis_safe(aid uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  conversation_id uuid,
  message_id uuid,
  file_hash text,
  file_metadata jsonb,
  parsed_schema jsonb,
  sample_data jsonb,
  user_question text,
  llm_reasoning text,
  generated_sql text,
  full_dataset_rows integer,
  query_results jsonb,
  interpretation jsonb,
  charts_config jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    da.id,
    da.user_id,
    da.conversation_id,
    da.message_id,
    da.file_hash,
    da.file_metadata,
    da.parsed_schema,
    da.sample_data,
    da.user_question,
    da.llm_reasoning,
    da.generated_sql,
    da.full_dataset_rows,
    da.query_results,
    da.interpretation,
    da.charts_config,
    da.created_at
  FROM data_analyses da
  WHERE da.id = aid
    AND da.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION get_analysis_safe(uuid) TO authenticated;

COMMENT ON FUNCTION get_analysis_safe(uuid) IS 
'Safely loads analysis data from data_analyses table. Only returns data if user owns the analysis. Used when reopening conversations to restore analysis results.';