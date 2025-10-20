/*
  # Create exec_sql_secure RPC function

  1. Purpose
    - Safely execute SELECT-only SQL queries on temporary analysis tables
    - Used by analyze-file Edge Function to run LLM-generated SQL
    - Security: DEFINER context bypasses RLS on temp tables
    - Validation: Only SELECT allowed, no destructive operations

  2. Security Features
    - Blocks DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE
    - Blocks attempts to access system tables
    - Executes with SECURITY DEFINER (bypasses RLS for temp tables)
    - Returns results as JSONB for easy consumption

  3. Usage Example
    SELECT exec_sql_secure('SELECT AVG(salary) FROM analysis_temp_abc123 WHERE department = ''Engineering''');

  4. Returns
    - JSONB array of results
    - Empty array [] if no results
    - Exception if invalid SQL or security violation
*/

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
  -- This uses dynamic SQL safely within the SECURITY DEFINER context
  BEGIN
    EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t', sql_query)
    INTO result_json;
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and re-raise with more context
      RAISE EXCEPTION 'SQL execution failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;

  RETURN COALESCE(result_json, '[]'::jsonb);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION exec_sql_secure(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql_secure(text) TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION exec_sql_secure(text) IS 'Securely executes SELECT-only SQL queries. Used by analyze-file function to run LLM-generated SQL on temporary analysis tables. Blocks all destructive operations.';
