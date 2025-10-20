/*
  # Add queryable flag to datasets table
  
  1. Changes
    - Add `has_queryable_data` boolean column to datasets table
    - Defaults to false for backward compatibility
    - Indicates if dataset has rows stored in dataset_rows table
  
  2. Backward Compatibility
    - Existing datasets will have this set to false
    - System continues working exactly as before
    - New datasets can opt-in to queryable storage
*/

-- Add column only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'datasets' AND column_name = 'has_queryable_data'
  ) THEN
    ALTER TABLE datasets ADD COLUMN has_queryable_data boolean DEFAULT false;
  END IF;
END $$;

-- Create index for filtering datasets with queryable data
CREATE INDEX IF NOT EXISTS datasets_has_queryable_data_idx ON datasets(has_queryable_data) WHERE has_queryable_data = true;
