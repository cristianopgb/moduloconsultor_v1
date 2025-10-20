/*
  # Add columns for analysis persistence

  1. Changes to `messages` table
    - Add `analysis_id` (uuid, nullable, FK to analyses)
    - Allows linking messages to their analysis results
    - ON DELETE SET NULL preserves message even if analysis is deleted

  2. Changes to `models` table
    - Add `is_system_template` (boolean, default false)
    - Marks templates created by system (cannot be deleted by users)
    - Used for default analysis presentation template

  3. Indexes
    - Index on messages.analysis_id for fast lookups
    - Partial index on models.is_system_template for system templates only

  4. Security
    - Existing RLS policies continue to work
    - No new policies needed (columns are additions to existing tables)
*/

-- Add analysis_id to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'analysis_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN analysis_id uuid;
  END IF;
END $$;

-- Add foreign key constraint for analysis_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_analysis_id_fkey'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_analysis_id_fkey
      FOREIGN KEY (analysis_id)
      REFERENCES analyses(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Create index on analysis_id
CREATE INDEX IF NOT EXISTS messages_analysis_id_idx ON messages(analysis_id);

-- Add is_system_template to models table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'models' AND column_name = 'is_system_template'
  ) THEN
    ALTER TABLE models ADD COLUMN is_system_template boolean DEFAULT false;
  END IF;
END $$;

-- Create partial index for system templates only (more efficient)
CREATE INDEX IF NOT EXISTS models_system_template_idx
  ON models(is_system_template)
  WHERE is_system_template = true;

-- Add comment for documentation
COMMENT ON COLUMN messages.analysis_id IS 'Links message to analysis result for persistence across sessions';
COMMENT ON COLUMN models.is_system_template IS 'Marks system-created templates that cannot be deleted by users';
