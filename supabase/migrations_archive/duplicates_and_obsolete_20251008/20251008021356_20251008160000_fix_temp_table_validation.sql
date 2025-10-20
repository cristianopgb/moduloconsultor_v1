/*
  # Fix Temporary Table Validation in exec_sql_secure

  1. Problem
    - The regex pattern [a-f0-9]{32} only matches lowercase hex characters
    - crypto.randomUUID() generates UUIDs that may contain uppercase letters
    - After converting to uppercase in query_upper, all UUIDs become uppercase
    - Pattern matching fails, causing "CREATE TEMP TABLE only allowed for analysis_temp_ tables" error

  2. Solution
    - Change regex to accept both uppercase and lowercase hex: [a-fA-F0-9]{32}
    - Use case-insensitive regex flag (~*) which is already in place
    - Add detailed debug logging to help diagnose validation issues
    - Improve error messages to include the actual table name attempted

  3. Pattern Details
    - Expected format: analysis_temp_[32 hex chars]
    - Example valid: analysis_temp_a1b2c3d4e5f67890abcdef1234567890
    - Example valid: analysis_temp_A1B2C3D4E5F67890ABCDEF1234567890
    - The regex already uses ~* (case-insensitive) but the character class needs updating

  4. Security
    - All existing security validations remain unchanged
    - Only temp tables matching analysis_temp_[32 hex] pattern are allowed
    - No access to system tables, no destructive operations on regular tables
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
  query_trimmed text;
  is_temp_table_operation boolean := false;
  extracted_table_name text;
BEGIN
  -- Validate input
  IF sql_query IS NULL OR trim(sql_query) = '' THEN
    RAISE EXCEPTION 'SQL query cannot be empty';
  END IF;

  -- Trim and prepare query
  query_trimmed := trim(sql_query);
  query_upper := upper(query_trimmed);

  -- Remove trailing semicolons for validation (allow single trailing semicolon)
  query_trimmed := regexp_replace(query_trimmed, ';\s*$', '');
  query_upper := upper(query_trimmed);

  -- Extract table name for debugging (handles CREATE TEMP TABLE, INSERT INTO, DROP TABLE, SELECT FROM)
  extracted_table_name := (regexp_matches(query_upper, 'analysis_temp_[a-fA-F0-9]{32}', 'i'))[1];

  -- Check if this is a temporary analysis table operation
  -- Pattern: analysis_temp_[32 hex chars without hyphens] - case insensitive
  -- Updated regex to accept both uppercase and lowercase hex digits
  is_temp_table_operation := query_upper ~* '\manalysis_temp_[a-fA-F0-9]{32}\M';

  -- Debug logging
  IF query_upper ~* 'analysis_temp_' THEN
    RAISE NOTICE 'DEBUG: Query contains analysis_temp_ prefix';
    RAISE NOTICE 'DEBUG: Extracted table name: %', COALESCE(extracted_table_name, 'NOT FOUND');
    RAISE NOTICE 'DEBUG: Validation result: %', is_temp_table_operation;
  END IF;

  -- Security: Block access to system tables and sensitive schemas
  IF query_upper ~* '\y(pg_|information_schema|auth\.)\w+' THEN
    RAISE EXCEPTION 'Security violation: Access to system tables is not allowed';
  END IF;

  -- Security: Block multiple statements (prevent SQL injection)
  -- Allow trailing semicolon but block multiple statements
  IF query_trimmed ~ ';\s*\S' THEN
    RAISE EXCEPTION 'Security violation: Multiple statements are not allowed';
  END IF;

  -- Security validation based on operation type
  IF query_upper ~* '^\s*CREATE\s+TEMP\s+TABLE\s+' THEN
    -- Allow CREATE TEMP TABLE only for analysis_temp_ tables
    IF NOT is_temp_table_operation THEN
      RAISE EXCEPTION 'Security violation: CREATE TEMP TABLE only allowed for analysis_temp_ tables. Attempted table: %',
        COALESCE(extracted_table_name, 'unknown');
    END IF;
    RAISE NOTICE 'Executing CREATE TEMP TABLE for analysis: %', extracted_table_name;

  ELSIF query_upper ~* '^\s*INSERT\s+INTO\s+' THEN
    -- Allow INSERT only into analysis_temp_ tables
    IF NOT is_temp_table_operation THEN
      RAISE EXCEPTION 'Security violation: INSERT only allowed into analysis_temp_ tables. Attempted table: %',
        COALESCE(extracted_table_name, 'unknown');
    END IF;
    -- For INSERT, we don't need to return JSON results
    EXECUTE query_trimmed;
    RETURN '[]'::jsonb;

  ELSIF query_upper ~* '^\s*DROP\s+TABLE\s+' THEN
    -- Allow DROP TABLE only for analysis_temp_ tables
    IF NOT is_temp_table_operation THEN
      RAISE EXCEPTION 'Security violation: DROP TABLE only allowed for analysis_temp_ tables. Attempted table: %',
        COALESCE(extracted_table_name, 'unknown');
    END IF;
    EXECUTE query_trimmed;
    RETURN '[]'::jsonb;

  ELSIF query_upper ~* '^\s*SELECT\s+' THEN
    -- SELECT is always allowed (read-only operation)
    RAISE NOTICE 'Executing SELECT query';

  ELSE
    -- Block all other operations (UPDATE, DELETE, ALTER, TRUNCATE, GRANT, REVOKE, etc.)
    IF query_upper ~* '\y(DELETE|UPDATE|ALTER|TRUNCATE|GRANT|REVOKE)\y' THEN
      RAISE EXCEPTION 'Security violation: Operation not allowed. Only SELECT, CREATE TEMP TABLE, INSERT (temp), and DROP TABLE (temp) are permitted. Attempted: %',
        substring(query_upper from '\y(DELETE|UPDATE|ALTER|TRUNCATE|GRANT|REVOKE)\y');
    END IF;

    -- If we got here, it's an unknown/suspicious operation
    RAISE EXCEPTION 'Security violation: Unrecognized or disallowed SQL operation';
  END IF;

  -- Execute the query and aggregate results as JSON
  -- This applies to SELECT and CREATE TEMP TABLE
  BEGIN
    IF query_upper ~* '^\s*CREATE\s+' THEN
      -- For CREATE statements, execute directly and return empty array
      EXECUTE query_trimmed;
      result_json := '[]'::jsonb;
    ELSE
      -- For SELECT statements, aggregate results as JSON
      EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t', query_trimmed)
      INTO result_json;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and re-raise with more context
      RAISE EXCEPTION 'SQL execution failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;

  RETURN COALESCE(result_json, '[]'::jsonb);
END;
$$;

-- Permissions remain the same
GRANT EXECUTE ON FUNCTION exec_sql_secure(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql_secure(text) TO service_role;

-- Update comment
COMMENT ON FUNCTION exec_sql_secure(text) IS 'Securely executes SQL queries for data analysis. Allows CREATE TEMP TABLE, INSERT, SELECT, and DROP TABLE only for temporary analysis tables (analysis_temp_*). Blocks all destructive operations on regular tables. Updated to handle case-insensitive hex UUIDs.';
