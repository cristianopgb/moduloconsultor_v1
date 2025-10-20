/*
  # Complete RLS Fix - Final Consolidation

  ## Problem
  Multiple migrations have been creating/updating the same policies, causing conflicts.
  Result: 403 errors on users, custom_sql_attempts, and other tables.

  ## Root Cause
  Some policies were querying public.users table directly, creating circular RLS dependencies.

  ## Solution
  1. Drop ALL existing policies from affected tables
  2. Recreate clean policies using is_master() helper function
  3. Ensure no circular dependencies

  ## Tables Fixed
  - users (base table - must work first)
  - custom_sql_attempts
  - ai_agents
  - ai_providers
  - analyses
  - datasets
  - documents
  - projects
  - conversations
  - messages
*/

-- =============================================================================
-- STEP 1: Fix users table first (everything depends on this)
-- =============================================================================

-- Drop all existing policies on users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON users;
DROP POLICY IF EXISTS "Masters can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Masters can update any user" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Create clean policies for users table
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_select_master"
  ON users FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_master"
  ON users FOR UPDATE
  TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- =============================================================================
-- STEP 2: Fix custom_sql_attempts
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Users can view own custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Masters can view all custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Masters can update custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Masters can delete custom SQL attempts" ON custom_sql_attempts;

CREATE POLICY "custom_sql_attempts_insert_auth"
  ON custom_sql_attempts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "custom_sql_attempts_select_own"
  ON custom_sql_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "custom_sql_attempts_select_master"
  ON custom_sql_attempts FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "custom_sql_attempts_update_master"
  ON custom_sql_attempts FOR UPDATE
  TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

CREATE POLICY "custom_sql_attempts_delete_master"
  ON custom_sql_attempts FOR DELETE
  TO authenticated
  USING (is_master());

-- =============================================================================
-- STEP 3: Fix ai_agents
-- =============================================================================

DROP POLICY IF EXISTS "ai_agents_master_only" ON ai_agents;

CREATE POLICY "ai_agents_all_master"
  ON ai_agents FOR ALL
  TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- =============================================================================
-- STEP 4: Fix ai_providers
-- =============================================================================

DROP POLICY IF EXISTS "ai_providers_master_only" ON ai_providers;

CREATE POLICY "ai_providers_all_master"
  ON ai_providers FOR ALL
  TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- =============================================================================
-- STEP 5: Fix analyses
-- =============================================================================

DROP POLICY IF EXISTS "analyses_select_own" ON analyses;
DROP POLICY IF EXISTS "analyses_select_master" ON analyses;
DROP POLICY IF EXISTS "analyses_insert_own" ON analyses;
DROP POLICY IF EXISTS "analyses_update_own" ON analyses;
DROP POLICY IF EXISTS "analyses_delete_own" ON analyses;

CREATE POLICY "analyses_select_own"
  ON analyses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "analyses_select_master"
  ON analyses FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "analyses_insert_own"
  ON analyses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "analyses_update_own"
  ON analyses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "analyses_delete_own"
  ON analyses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- STEP 6: Fix datasets
-- =============================================================================

DROP POLICY IF EXISTS "datasets_select_own" ON datasets;
DROP POLICY IF EXISTS "datasets_select_master" ON datasets;
DROP POLICY IF EXISTS "datasets_insert_own" ON datasets;
DROP POLICY IF EXISTS "datasets_update_own" ON datasets;
DROP POLICY IF EXISTS "datasets_delete_own" ON datasets;

CREATE POLICY "datasets_select_own"
  ON datasets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "datasets_select_master"
  ON datasets FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "datasets_insert_own"
  ON datasets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "datasets_update_own"
  ON datasets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "datasets_delete_own"
  ON datasets FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- STEP 7: Fix documents
-- =============================================================================

DROP POLICY IF EXISTS "documents_select_own" ON documents;
DROP POLICY IF EXISTS "documents_select_master" ON documents;
DROP POLICY IF EXISTS "documents_insert_own" ON documents;
DROP POLICY IF EXISTS "documents_update_own" ON documents;
DROP POLICY IF EXISTS "documents_delete_own" ON documents;
DROP POLICY IF EXISTS "Users can read own documents or masters can read all" ON documents;

CREATE POLICY "documents_select_own"
  ON documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "documents_select_master"
  ON documents FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "documents_insert_own"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "documents_update_own"
  ON documents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "documents_delete_own"
  ON documents FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- STEP 8: Fix projects
-- =============================================================================

DROP POLICY IF EXISTS "projects_select_own" ON projects;
DROP POLICY IF EXISTS "projects_select_master" ON projects;
DROP POLICY IF EXISTS "projects_insert_own" ON projects;
DROP POLICY IF EXISTS "projects_update_own" ON projects;
DROP POLICY IF EXISTS "projects_delete_own" ON projects;
DROP POLICY IF EXISTS "Users can read own projects or masters can read all" ON projects;

CREATE POLICY "projects_select_own"
  ON projects FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "projects_select_master"
  ON projects FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "projects_insert_own"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update_own"
  ON projects FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_delete_own"
  ON projects FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- STEP 9: Fix conversations
-- =============================================================================

DROP POLICY IF EXISTS "conversations_select_own" ON conversations;
DROP POLICY IF EXISTS "conversations_select_master" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_own" ON conversations;
DROP POLICY IF EXISTS "conversations_update_own" ON conversations;
DROP POLICY IF EXISTS "conversations_delete_own" ON conversations;

CREATE POLICY "conversations_select_own"
  ON conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "conversations_select_master"
  ON conversations FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "conversations_insert_own"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_update_own"
  ON conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_delete_own"
  ON conversations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- STEP 10: Fix messages
-- =============================================================================

DROP POLICY IF EXISTS "messages_select_own" ON messages;
DROP POLICY IF EXISTS "messages_select_master" ON messages;
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
DROP POLICY IF EXISTS "messages_update_own" ON messages;
DROP POLICY IF EXISTS "messages_delete_own" ON messages;

CREATE POLICY "messages_select_own"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_select_master"
  ON messages FOR SELECT
  TO authenticated
  USING (is_master());

CREATE POLICY "messages_insert_own"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_delete_own"
  ON messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Success notification
DO $$
BEGIN
  RAISE NOTICE '✅ Complete RLS consolidation successful - all policies recreated cleanly';
END $$;
