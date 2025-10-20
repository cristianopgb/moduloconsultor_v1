/*
  # Create get_analysis_safe Function (Corrected Version)

  ## Purpose
  Safely loads analysis data from data_analyses table.
  This is the corrected version that matches the actual table structure.

  ## Changes from Archived Version
  - Removed columns that don't exist: `interpretation`, `charts_config`
  - Added columns that do exist: `status`, `error_message`, `updated_at`
  - Returns proper structure matching data_analyses table

  ## Security
  - SECURITY DEFINER to bypass RLS
  - Checks auth.uid() = user_id manually
  - Only returns data if user owns the analysis

  ## Usage
  Called by ChatPage.tsx when loading conversation history with analyses
*/

-- Drop old function if exists
DROP FUNCTION IF EXISTS get_analysis_safe(uuid);

-- Create corrected function for data_analyses table
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
  ai_response jsonb,
  status text,
  error_message text,
  created_at timestamptz,
  updated_at timestamptz
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
    da.ai_response,
    da.status,
    da.error_message,
    da.created_at,
    da.updated_at
  FROM data_analyses da
  WHERE da.id = aid
    AND da.user_id = auth.uid();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_analysis_safe(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_analysis_safe(uuid) IS
'Safely loads analysis data from data_analyses table. Only returns data if user owns the analysis. Used when reopening conversations to restore analysis results. Returns all columns from data_analyses table.';
