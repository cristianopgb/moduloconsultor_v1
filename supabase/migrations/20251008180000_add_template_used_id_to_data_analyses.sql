/*
  # Add template_used_id to data_analyses table

  ## Overview
  This migration adds the `template_used_id` column to the `data_analyses` table
  to track which analytics template was automatically selected and used for each analysis.

  ## Changes

  1. **data_analyses table** - Add template tracking
     - `template_used_id` (uuid) - Foreign key to models table (analytics templates)
     - Nullable because early analyses might not have had template selection
     - ON DELETE SET NULL to preserve analysis history even if template is deleted

  2. **Performance** - Add index for queries
     - Index on template_used_id for filtering analyses by template

  ## Security
  - Table already has RLS enabled
  - Existing policies continue to work (no changes needed)
*/

-- ============================================================================
-- ADD template_used_id COLUMN TO data_analyses
-- ============================================================================

-- Add template_used_id column to track which analytics template was used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'template_used_id'
  ) THEN
    ALTER TABLE data_analyses ADD COLUMN template_used_id uuid REFERENCES models(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for performance when filtering by template
CREATE INDEX IF NOT EXISTS data_analyses_template_used_id_idx ON data_analyses(template_used_id);

-- Add comment explaining the column
COMMENT ON COLUMN data_analyses.template_used_id IS 'ID of the analytics template (from models table with template_type=analytics) that was automatically selected and used for this analysis';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'template_used_id'
  ) THEN
    RAISE EXCEPTION 'Column data_analyses.template_used_id was not created';
  END IF;

  RAISE NOTICE 'Migration completed successfully! template_used_id column added to data_analyses table.';
END $$;
