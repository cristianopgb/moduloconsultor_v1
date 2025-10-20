/*
  # Update RLS Policies to Use is_master() Helper Function

  ## Problem
  Several RLS policies are directly querying public.users table to check roles:
  `EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'master')`
  
  This causes 403 errors because the subquery is also subject to RLS on public.users.

  ## Solution
  Replace all direct queries to public.users with the existing is_master() helper function.
  The is_master() function is SECURITY DEFINER and uses auth.users, so it bypasses RLS.

  ## Changes
  Update policies on: ai_agents, ai_providers, analyses, datasets, documents, projects
*/

-- Fix ai_agents policies
DROP POLICY IF EXISTS "ai_agents_master_only" ON ai_agents;
CREATE POLICY "ai_agents_master_only"
  ON ai_agents
  FOR ALL
  TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- Fix ai_providers policies
DROP POLICY IF EXISTS "ai_providers_master_only" ON ai_providers;
CREATE POLICY "ai_providers_master_only"
  ON ai_providers
  FOR ALL
  TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- Fix analyses policies
DROP POLICY IF EXISTS "analyses_select_master" ON analyses;
CREATE POLICY "analyses_select_master"
  ON analyses
  FOR SELECT
  TO authenticated
  USING (is_master());

-- Fix datasets policies
DROP POLICY IF EXISTS "datasets_select_master" ON datasets;
CREATE POLICY "datasets_select_master"
  ON datasets
  FOR SELECT
  TO authenticated
  USING (is_master());

-- Fix documents policies
DROP POLICY IF EXISTS "Users can read own documents or masters can read all" ON documents;
CREATE POLICY "Users can read own documents or masters can read all"
  ON documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_master());

-- Fix projects policies  
DROP POLICY IF EXISTS "Users can read own projects or masters can read all" ON projects;
CREATE POLICY "Users can read own projects or masters can read all"
  ON projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_master());

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully updated RLS policies to use is_master() function';
END $$;
