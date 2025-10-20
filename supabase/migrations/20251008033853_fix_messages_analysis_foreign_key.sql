/*
  # Fix messages.analysis_id Foreign Key

  ## Problem
  The messages.analysis_id column currently references the old 'analyses' table,
  but the new analytics system (v2) uses 'data_analyses' table.
  
  This causes:
  - 409 Conflict errors when saving analysis results
  - Unable to link messages to their analysis results
  - Presentation generation fails

  ## Solution
  1. Drop the old foreign key constraint to 'analyses'
  2. Create new foreign key constraint to 'data_analyses'
  3. Keep the column and index as-is (no data loss)

  ## Impact
  - Existing messages with analysis_id = NULL: unaffected
  - New analyses: will correctly reference data_analyses table
  - Backward compatible: column structure unchanged
*/

-- Drop old foreign key constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_analysis_id_fkey;

-- Create new foreign key constraint to data_analyses
ALTER TABLE messages 
ADD CONSTRAINT messages_analysis_id_fkey 
FOREIGN KEY (analysis_id) 
REFERENCES data_analyses(id) 
ON DELETE SET NULL;

-- Update comment to reflect new relationship
COMMENT ON COLUMN messages.analysis_id IS 
'Links message to data analysis result (data_analyses table) for persistence across sessions';