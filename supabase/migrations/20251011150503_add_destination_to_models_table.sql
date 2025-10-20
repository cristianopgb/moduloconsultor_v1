/*
  # Add destination column to models table

  1. Changes
    - Add `destination` column to `models` table
    - Values: 'presentation' or 'consultor_entregavel'
    - Default to 'presentation' for backward compatibility
    - Create index on destination for faster queries

  2. Notes
    - Existing templates default to 'presentation'
    - New templates can be marked as 'consultor_entregavel' for automatic use
    - Templates marked as 'consultor_entregavel' won't appear in presentation template selector
*/

-- Add destination column to models table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'destination'
  ) THEN
    ALTER TABLE models ADD COLUMN destination text DEFAULT 'presentation' NOT NULL;
  END IF;
END $$;

-- Add check constraint for valid destination values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'models_destination_check'
  ) THEN
    ALTER TABLE models ADD CONSTRAINT models_destination_check
    CHECK (destination IN ('presentation', 'consultor_entregavel'));
  END IF;
END $$;

-- Create index on destination for faster filtering
CREATE INDEX IF NOT EXISTS idx_models_destination ON models(destination);