/*
  # Create dataset_rows table for queryable data
  
  1. New Table
    - `dataset_rows` - stores individual rows of dataset in queryable JSONB format
      - `id` (uuid, primary key)
      - `dataset_id` (uuid, foreign key to datasets)
      - `row_number` (integer, position in original dataset)
      - `data` (jsonb, the actual row data with column_name: value pairs)
      - `created_at` (timestamptz)
  
  2. Indexes
    - Primary key on id
    - Index on dataset_id for fast filtering
    - GIN index on data JSONB for fast queries
  
  3. Security
    - Enable RLS on dataset_rows
    - Users can only read/write their own dataset rows (via FK to datasets)
    - Policies follow EXACT same pattern as datasets table
  
  4. Cascade Deletion
    - When a dataset is deleted, all its rows are automatically deleted
*/

-- Create table only if it doesn't exist
CREATE TABLE IF NOT EXISTS dataset_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL,
  row_number integer NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint with cascade deletion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'dataset_rows_dataset_id_fkey'
  ) THEN
    ALTER TABLE dataset_rows
      ADD CONSTRAINT dataset_rows_dataset_id_fkey
      FOREIGN KEY (dataset_id)
      REFERENCES datasets(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS dataset_rows_dataset_id_idx ON dataset_rows(dataset_id);
CREATE INDEX IF NOT EXISTS dataset_rows_data_gin_idx ON dataset_rows USING GIN(data);
CREATE INDEX IF NOT EXISTS dataset_rows_dataset_row_idx ON dataset_rows(dataset_id, row_number);

-- Enable RLS
ALTER TABLE dataset_rows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can read own dataset rows" ON dataset_rows;
DROP POLICY IF EXISTS "Users can insert own dataset rows" ON dataset_rows;
DROP POLICY IF EXISTS "Users can update own dataset rows" ON dataset_rows;
DROP POLICY IF EXISTS "Users can delete own dataset rows" ON dataset_rows;

-- SELECT policy: Users can read rows from their own datasets
CREATE POLICY "Users can read own dataset rows"
  ON dataset_rows
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_rows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

-- INSERT policy: Users can insert rows into their own datasets
CREATE POLICY "Users can insert own dataset rows"
  ON dataset_rows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_rows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

-- UPDATE policy: Users can update rows in their own datasets
CREATE POLICY "Users can update own dataset rows"
  ON dataset_rows
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_rows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_rows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );

-- DELETE policy: Users can delete rows from their own datasets
CREATE POLICY "Users can delete own dataset rows"
  ON dataset_rows
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_rows.dataset_id
      AND datasets.user_id = auth.uid()
    )
  );
