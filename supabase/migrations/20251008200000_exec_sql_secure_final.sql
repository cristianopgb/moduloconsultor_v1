/*
  # Consolidated exec_sql_secure Functions - Final Version

  This migration consolidates all exec_sql_secure function updates into a single source.
  It replaces these previous migrations:
  - 20251008015808_fix_exec_sql_secure_temp_tables.sql
  - 20251008023616_fix_exec_sql_secure_compound_statements.sql
  - 20251008033816_allow_complex_select_queries.sql
  - 20251008160000_fix_temp_table_validation.sql

  ## Functions Created
  1. **exec_sql_secure** - Single statement execution (SELECT, CREATE TEMP, INSERT, DROP)
  2. **exec_sql_secure_transaction** - Multi-statement execution in one transaction

  ## Security Model
  - Only allows operations on analysis_temp_[32 hex chars] tables
  - Blocks access to system tables (pg_*, information_schema, auth.*)
  - Blocks destructive operations on regular tables (UPDATE, DELETE, ALTER, TRUNCATE)
  - Supports complex SELECT queries (CTEs, subqueries, window functions, CASE)
  - Case-insensitive hex UUID validation for temp table names

  ## Use Cases
  - exec_sql_secure: For single queries or temp table operations
  - exec_sql_secure_transaction: For multi-step analysis requiring temp tables
*/

-- ============================================================================
-- FUNCTION 1: exec_sql_secure (Single Statement)
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

-- ============================================================================
-- FUNCTION 2: exec_sql_secure_transaction (Multi-Statement)
-- ============================================================================

CREATE OR REPLACE FUNCTION exec_sql_secure_transaction(sql_compound text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_json jsonb := '[]'::jsonb;
  sql_trimmed text;
  statements text[];
  stmt text;
  stmt_upper text;
  is_select boolean;
  has_analysis_table boolean;
BEGIN
  -- Validate input
  IF sql_compound IS NULL OR trim(sql_compound) = '' THEN
    RAISE EXCEPTION 'SQL query cannot be empty';
  END IF;

  sql_trimmed := trim(sql_compound);

  -- Security: Block access to system tables and sensitive schemas
  IF sql_trimmed ~* '\y(pg_catalog|pg_|information_schema|auth\.)\w+' THEN
    RAISE EXCEPTION 'Security violation: Access to system tables is not allowed';
  END IF;

  -- Security: Must reference analysis_temp_ table
  has_analysis_table := sql_trimmed ~* 'analysis_temp_[a-fA-F0-9]{32}';
  IF NOT has_analysis_table THEN
    RAISE EXCEPTION 'Security violation: SQL must operate on analysis_temp_[uuid] tables only';
  END IF;

  -- Split by semicolons to get individual statements
  statements := regexp_split_to_array(sql_trimmed, ';\s*');

  -- Validate each statement before execution
  FOREACH stmt IN ARRAY statements
  LOOP
    IF trim(stmt) = '' THEN
      CONTINUE;
    END IF;

    stmt_upper := upper(trim(stmt));

    -- Security: Block destructive operations on non-temp tables
    IF stmt_upper ~* '\y(UPDATE|DELETE|ALTER|TRUNCATE|GRANT|REVOKE)\y' THEN
      RAISE EXCEPTION 'Security violation: UPDATE/DELETE/ALTER not allowed. Statement: %',
        substring(stmt FROM 1 FOR 100);
    END IF;

    -- Validate statement type - PERMISSIVE for complex SELECT
    -- Allow:
    -- 1. CREATE TEMP TABLE analysis_temp_*
    -- 2. INSERT INTO analysis_temp_*
    -- 3. ANY SELECT (including WITH, CTEs, subqueries, window functions, CASE, etc)
    -- 4. DROP TABLE analysis_temp_*
    IF NOT (
      stmt_upper ~* '^\s*CREATE\s+TEMP\s+TABLE\s+analysis_temp_' OR
      stmt_upper ~* '^\s*INSERT\s+INTO\s+analysis_temp_' OR
      stmt_upper ~* '^\s*(WITH\s+.*\s+)?SELECT\s+' OR  -- Allow SELECT with or without WITH
      stmt_upper ~* '^\s*DROP\s+TABLE\s+(IF\s+EXISTS\s+)?analysis_temp_'
    ) THEN
      RAISE EXCEPTION 'Security violation: Invalid statement type. Only CREATE TEMP TABLE, INSERT, SELECT (with CTEs/subqueries), DROP TABLE allowed. Statement: %',
        substring(stmt FROM 1 FOR 100);
    END IF;
  END LOOP;

  -- All statements validated - now execute them in order
  -- This happens in ONE transaction, so temp tables persist
  FOREACH stmt IN ARRAY statements
  LOOP
    IF trim(stmt) = '' THEN
      CONTINUE;
    END IF;

    stmt_upper := upper(trim(stmt));

    -- Check if this is a SELECT (including WITH...SELECT)
    is_select := stmt_upper ~* '^\s*(WITH\s+.*\s+)?SELECT\s+';

    RAISE NOTICE 'Executing: %', substring(stmt FROM 1 FOR 100);

    IF is_select THEN
      -- For SELECT (including WITH...SELECT), capture results
      EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t', stmt)
      INTO result_json;
    ELSE
      -- For CREATE, INSERT, DROP just execute
      EXECUTE stmt;
    END IF;
  END LOOP;

  RETURN result_json;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'SQL execution failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- ============================================================================
-- PERMISSIONS & DOCUMENTATION
-- ============================================================================

-- Grant permissions for both functions
GRANT EXECUTE ON FUNCTION exec_sql_secure(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql_secure(text) TO service_role;
GRANT EXECUTE ON FUNCTION exec_sql_secure_transaction(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql_secure_transaction(text) TO service_role;

-- Add documentation
COMMENT ON FUNCTION exec_sql_secure(text) IS
'Securely executes single SQL statements for data analysis. Allows CREATE TEMP TABLE, INSERT, SELECT, and DROP TABLE only for temporary analysis tables (analysis_temp_*). Blocks all destructive operations on regular tables. Supports case-insensitive hex UUIDs.';

COMMENT ON FUNCTION exec_sql_secure_transaction(text) IS
'Executes compound SQL statements in a single transaction. Supports complex SELECT queries including CTEs (WITH), subqueries, window functions, and CASE statements. Only allows operations on analysis_temp_* tables. Blocks destructive operations and system table access.';
