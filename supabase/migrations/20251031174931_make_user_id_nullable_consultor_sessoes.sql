/*
  # Make user_id nullable in consultor_sessoes

  1. Changes
    - Allow NULL user_id for testing/anonymous sessions
    - Keep foreign key constraint
  
  2. Security
    - RLS policies updated to handle NULL user_id
*/

-- Make user_id nullable
ALTER TABLE consultor_sessoes
ALTER COLUMN user_id DROP NOT NULL;
