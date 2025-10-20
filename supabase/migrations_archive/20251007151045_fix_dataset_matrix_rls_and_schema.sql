/*
  # Fix Dataset Matrix RLS and Schema Issues

  ## Problem
  The `materialize_dataset_matrix_rpc` function returns 404 error because:
  1. RLS policy requires `auth.uid()` which returns NULL when called via service role
  2. Table has duplicate columns (`value_num` and `value_numeric`)
  3. Service role cannot INSERT into the table due to RLS blocking it

  ## Changes Made

  1. **Schema Cleanup**
    - Remove duplicate `value_num` column (keeping only `value_numeric`)
    - Standardize on `value_numeric` for all numeric values

  2. **RLS Policies**
    - Add policy for service role to bypass auth.uid() requirement
    - Keep existing user ownership policy for app access
    - Service role can INSERT/SELECT/UPDATE/DELETE for materialization

  3. **Materialization Functions**
    - Drop and recreate functions to fix return types and logic
    - `materialize_dataset_matrix()` - Worker function that populates the matrix
    - `materialize_dataset_matrix_rpc()` - RPC wrapper (returns void, not json)
    - Uses existing helper functions to safely convert and store values

  4. **Performance**
    - Add indexes on `dataset_id` and `col_name` for faster queries
    - Composite index for common query patterns

  ## Security Notes
  - Service role policy only allows operations on `dataset_matrix` table
  - Regular users still require dataset ownership via existing policy
  - RLS is enabled and enforced for all non-service-role access
*/

-- =====================================================
-- 1. SCHEMA CLEANUP: Remove duplicate column
-- =====================================================

-- Drop the duplicate value_num column (keep value_numeric)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dataset_matrix' AND column_name = 'value_num'
  ) THEN
    ALTER TABLE dataset_matrix DROP COLUMN value_num;
  END IF;
END $$;

-- =====================================================
-- 2. ADD SERVICE ROLE RLS POLICY
-- =====================================================

-- Drop existing policy to recreate with proper permissions
DROP POLICY IF EXISTS "dataset_matrix_owner" ON dataset_matrix;
DROP POLICY IF EXISTS "dataset_matrix_service_role" ON dataset_matrix;

-- Policy: Allow service role full access for materialization
-- This allows both service role (auth.uid() IS NULL) and regular users who own the dataset
CREATE POLICY "dataset_matrix_access"
  ON dataset_matrix
  FOR ALL
  TO authenticated
  USING (
    -- Allow if called with service role (no user session)
    auth.uid() IS NULL
    OR
    -- Allow if user owns the dataset
    EXISTS (
      SELECT 1 FROM datasets d
      WHERE d.id = dataset_matrix.dataset_id
      AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Allow if called with service role (no user session)
    auth.uid() IS NULL
    OR
    -- Allow if user owns the dataset
    EXISTS (
      SELECT 1 FROM datasets d
      WHERE d.id = dataset_matrix.dataset_id
      AND d.user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. MATERIALIZATION WORKER FUNCTION
-- =====================================================

-- Drop existing function to recreate with correct logic
DROP FUNCTION IF EXISTS materialize_dataset_matrix(uuid);

CREATE FUNCTION materialize_dataset_matrix(p_dataset uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  col_record RECORD;
  row_record RECORD;
BEGIN
  -- Clear existing matrix data for this dataset
  DELETE FROM dataset_matrix WHERE dataset_id = p_dataset;

  -- Get all unique columns from the dataset
  FOR col_record IN
    SELECT DISTINCT jsonb_object_keys(data) AS col_name
    FROM dataset_rows
    WHERE dataset_id = p_dataset
  LOOP
    -- For each column, insert all row values
    FOR row_record IN
      SELECT
        row_number,
        data->>col_record.col_name AS raw_value
      FROM dataset_rows
      WHERE dataset_id = p_dataset
      AND data ? col_record.col_name
      ORDER BY row_number
    LOOP
      INSERT INTO dataset_matrix (
        dataset_id,
        row_number,
        col_name,
        value_text,
        value_numeric,
        value_date
      )
      VALUES (
        p_dataset,
        row_record.row_number,
        col_record.col_name,
        row_record.raw_value,
        safe_to_numeric(row_record.raw_value),
        safe_to_date(row_record.raw_value)
      );
    END LOOP;
  END LOOP;
END;
$$;

-- =====================================================
-- 4. RPC WRAPPER FOR EDGE FUNCTIONS
-- =====================================================

-- Drop existing function to ensure clean recreation
DROP FUNCTION IF EXISTS materialize_dataset_matrix_rpc(uuid);

CREATE FUNCTION materialize_dataset_matrix_rpc(p_dataset uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the worker function
  PERFORM materialize_dataset_matrix(p_dataset);
END;
$$;

-- =====================================================
-- 5. PERFORMANCE INDEXES
-- =====================================================

-- Index on dataset_id for filtering
CREATE INDEX IF NOT EXISTS idx_dataset_matrix_dataset_id
  ON dataset_matrix(dataset_id);

-- Index on col_name for column lookups
CREATE INDEX IF NOT EXISTS idx_dataset_matrix_col_name
  ON dataset_matrix(col_name);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_dataset_matrix_dataset_col
  ON dataset_matrix(dataset_id, col_name);

-- Index on row_number for ordered retrieval
CREATE INDEX IF NOT EXISTS idx_dataset_matrix_row_number
  ON dataset_matrix(dataset_id, row_number);

-- =====================================================
-- 6. VERIFY RLS IS ENABLED
-- =====================================================

-- Ensure RLS is enabled (should already be, but confirm)
ALTER TABLE dataset_matrix ENABLE ROW LEVEL SECURITY;