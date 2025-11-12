/*
  # Fix Genius Mode Constraints

  1. Problem
    - conversations.chat_mode constraint doesn't include 'genius' mode
    - messages.message_type constraint doesn't include genius types
    - This causes 400 errors when using Genius mode

  2. Changes
    - Update conversations.chat_mode CHECK constraint to include 'genius'
    - Update messages.message_type CHECK constraint to include 'genius_task', 'genius_result', 'genius_error'
    - Update column comments to document all valid values

  3. Security
    - No RLS changes needed
    - Maintains data integrity with updated constraints
*/

-- ====================================
-- Fix conversations.chat_mode constraint
-- ====================================

-- Drop existing constraint if exists
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_chat_mode_check;

-- Add new constraint with genius mode
ALTER TABLE conversations
ADD CONSTRAINT conversations_chat_mode_check
CHECK (chat_mode IN ('analytics', 'presentation', 'consultor', 'genius'));

-- Update column comment
COMMENT ON COLUMN conversations.chat_mode IS
'Current chat mode: analytics (auto template selection), presentation (manual template selection), consultor (consultant journey mode), or genius (Manus AI integration)';

-- ====================================
-- Fix messages.message_type constraint
-- ====================================

-- Drop existing constraint if exists
ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Add new constraint with genius types
ALTER TABLE messages
ADD CONSTRAINT messages_message_type_check
CHECK (message_type IN ('text', 'analysis_result', 'chart', 'system', 'genius_task', 'genius_result', 'genius_error'));

-- Update column comment
COMMENT ON COLUMN messages.message_type IS
'Message type: text (regular message), analysis_result (data analysis output), chart (visualization), system (system notification), genius_task (Manus task request), genius_result (Manus task completed), genius_error (Manus task failed)';
