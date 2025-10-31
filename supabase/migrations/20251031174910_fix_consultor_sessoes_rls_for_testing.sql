/*
  # Fix consultor_sessoes RLS for testing

  1. Changes
    - Allow anonymous users to create sessions for testing
    - Keep authenticated user restrictions
  
  2. Security
    - Temporary relaxation for development/testing
    - Production should require authentication
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own sessions" ON consultor_sessoes;

-- Create new INSERT policy that allows both authenticated and anon
CREATE POLICY "Users can insert own sessions"
  ON consultor_sessoes FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR
    (auth.role() = 'anon' AND user_id IS NULL)
  );

-- Also allow SELECT for anon
DROP POLICY IF EXISTS "Users can view own sessions" ON consultor_sessoes;
CREATE POLICY "Users can view own sessions"
  ON consultor_sessoes FOR SELECT
  TO authenticated, anon
  USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR
    (auth.role() = 'anon' AND user_id IS NULL)
  );

-- Allow UPDATE for anon on their sessions
DROP POLICY IF EXISTS "Users can update own sessions" ON consultor_sessoes;
CREATE POLICY "Users can update own sessions"
  ON consultor_sessoes FOR UPDATE
  TO authenticated, anon
  USING (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR
    (auth.role() = 'anon' AND user_id IS NULL)
  )
  WITH CHECK (
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
    OR
    (auth.role() = 'anon' AND user_id IS NULL)
  );
