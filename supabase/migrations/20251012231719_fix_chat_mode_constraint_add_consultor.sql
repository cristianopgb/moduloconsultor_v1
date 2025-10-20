/*
  # Fix chat_mode constraint to include 'consultor' mode

  1. Problem
    - The database CHECK constraint only allows 'analytics' and 'presentation'
    - The application also uses 'consultor' mode (shown in UI and TypeScript types)
    - This causes 400 errors when trying to switch to consultor mode

  2. Changes
    - Drop the existing CHECK constraint
    - Create a new CHECK constraint that includes 'consultor' as a valid value
    - Ensures all three modes (analytics, presentation, consultor) are allowed

  3. Security
    - Maintains data integrity by validating chat_mode values
    - No RLS policy changes needed
*/

-- Drop the existing constraint
ALTER TABLE conversations 
DROP CONSTRAINT IF EXISTS conversations_chat_mode_check;

-- Add the new constraint with all three valid modes
ALTER TABLE conversations 
ADD CONSTRAINT conversations_chat_mode_check 
CHECK (chat_mode IN ('analytics', 'presentation', 'consultor'));

-- Update the column comment to reflect all valid values
COMMENT ON COLUMN conversations.chat_mode IS 'Current chat mode: analytics (auto template selection), presentation (manual template selection), or consultor (consultant journey mode)';
