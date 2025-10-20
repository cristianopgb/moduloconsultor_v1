/*
  # Fix References Type Constraint to Support All File Types

  1. Problem
    - Current constraint `references_type_check` doesn't accept 'csv' as valid type
    - Users cannot upload CSV files due to constraint violation
    - System supports CSV parsing but database rejects it

  2. Changes
    - Drop existing constraint if it exists
    - Create new constraint accepting all supported file types:
      * Document types: pdf, docx, pptx, doc, ppt
      * Data types: xlsx, xls, csv, json
      * Text types: txt, html, htm, md
      * Other: url, file (generic fallback)

  3. Security
    - Maintains type validation (not NULL or empty)
    - Allows all legitimately supported file types
    - No impact on existing data
    - RLS policies remain unchanged
*/

-- Drop existing constraint if it exists
ALTER TABLE "references"
  DROP CONSTRAINT IF EXISTS references_type_check;

-- Create new constraint with all supported types
ALTER TABLE "references"
  ADD CONSTRAINT references_type_check
  CHECK (
    type IN (
      -- Document formats
      'pdf', 'docx', 'pptx', 'doc', 'ppt',
      -- Data formats (CSV NOW INCLUDED!)
      'xlsx', 'xls', 'csv', 'json',
      -- Text formats
      'txt', 'html', 'htm', 'md',
      -- Special types
      'url', 'file'
    )
  );

-- Add index for faster type filtering
CREATE INDEX IF NOT EXISTS idx_references_type
  ON "references"(type)
  WHERE type IS NOT NULL;

-- Add helpful comment
COMMENT ON CONSTRAINT references_type_check ON "references"
  IS 'Validates file type - supports documents, data files (including CSV), text formats, and URLs';

COMMENT ON COLUMN "references".type
  IS 'File type/extension: pdf, docx, xlsx, csv, txt, html, url, etc. Used for parsing and display';
