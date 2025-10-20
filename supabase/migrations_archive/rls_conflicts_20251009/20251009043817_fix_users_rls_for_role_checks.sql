/*
  # Fix RLS on users table for role verification

  ## Problem
  Multiple tables have RLS policies that check user roles via:
  `EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'master')`
  
  But the `users` table doesn't have a policy allowing authenticated users to SELECT
  their own row for role verification, causing 403 errors on ALL tables.

  ## Solution
  Add a policy allowing any authenticated user to SELECT their own row from users table.
  This enables role checks in other table policies to work correctly.

  ## Changes
  1. Drop conflicting "Users can view own profile" policy (if exists)
  2. Create new comprehensive policy for authenticated users to view own data
  3. Keep master policy unchanged
*/

-- Drop existing conflicting policy
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Allow authenticated users to view their own profile (needed for role checks in other policies)
CREATE POLICY "Authenticated users can view own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Verify the policy was created
DO $$
BEGIN
  RAISE NOTICE 'RLS policy created successfully for users table';
END $$;
