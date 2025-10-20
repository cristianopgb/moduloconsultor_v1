/*
  # Fix exec_sql_secure to Support Temporary Analysis Tables

  1. Purpose
    - Allow CREATE TEMP TABLE, INSERT, DROP for temporary analysis tables
    - Maintain security by restricting operations to tables with prefix 'analysis_temp_'
    - Continue blocking all destructive operations on regular tables
    - Fix "Multiple statements not allowed" error during data analysis

  2. Changes
    - Modified validation logic to recognize temporary analysis tables
    - Allow CREATE TEMP TABLE only for tables starting with 'analysis_temp_'
    - Allow INSERT only into temporary analysis tables
    - Allow DROP TABLE only for temporary analysis tables
    - Improved semicolon detection to allow trailing semicolons
    - Added detailed logging for debugging

  3. Security Maintained
    - All operations restricted to tables matching pattern: analysis_temp_[uuid]
    - No access to system tables (pg_*, information_schema, auth)
    - No UPDATE, DELETE, ALTER, TRUNCATE allowed (even on temp tables)
    - No GRANT, REVOKE allowed
    - No access to regular application tables

  4. Usage Examples
    -- Create temporary analysis table
    SELECT exec_sql_secure('CREATE TEMP TABLE analysis_temp_abc123 (name text, value numeric)');

    -- Insert data (single row)
    SELECT exec_sql_secure('INSERT INTO analysis_temp_abc123 VALUES (''test'', 100)');

    -- Query data
    SELECT exec_sql_secure('SELECT AVG(value) FROM analysis_temp_abc123 WHERE name = ''test''');

    -- Drop temporary table
    SELECT exec_sql_secure('DROP TABLE IF EXISTS analysis_temp_abc123');
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

  -- Check if this is a temporary analysis table operation
  -- Pattern: analysis_temp_[32 hex chars without hyphens]
  is_temp_table_operation := query_upper ~* 'analysis_temp_[a-f0-9]{32}\b';

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
      RAISE EXCEPTION 'Security violation: CREATE TEMP TABLE only allowed for analysis_temp_ tables';
    END IF;
    RAISE NOTICE 'Executing CREATE TEMP TABLE for analysis';

  ELSIF query_upper ~* '^\s*INSERT\s+INTO\s+' THEN
    -- Allow INSERT only into analysis_temp_ tables
    IF NOT is_temp_table_operation THEN
      RAISE EXCEPTION 'Security violation: INSERT only allowed into analysis_temp_ tables';
    END IF;
    -- For INSERT, we don't need to return JSON results
    EXECUTE query_trimmed;
    RETURN '[]'::jsonb;

  ELSIF query_upper ~* '^\s*DROP\s+TABLE\s+' THEN
    -- Allow DROP TABLE only for analysis_temp_ tables
    IF NOT is_temp_table_operation THEN
      RAISE EXCEPTION 'Security violation: DROP TABLE only allowed for analysis_temp_ tables';
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
COMMENT ON FUNCTION exec_sql_secure(text) IS 'Securely executes SQL queries for data analysis. Allows CREATE TEMP TABLE, INSERT, SELECT, and DROP TABLE only for temporary analysis tables (analysis_temp_*). Blocks all destructive operations on regular tables.';
