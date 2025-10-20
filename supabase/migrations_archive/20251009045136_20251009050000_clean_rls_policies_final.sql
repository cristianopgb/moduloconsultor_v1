/*
  # Clean RLS Policies - Single Definitive Migration

  ## Purpose
  This migration completely replaces all previous RLS policy migrations.
  Previous conflicting migrations have been archived.

  ## What This Does
  1. Removes ALL existing policies from 10 core tables
  2. Creates clean, consistent policies using is_master() helper
  3. No circular dependencies - all master checks use auth.users via is_master()

  ## Tables Covered
  - users, custom_sql_attempts, ai_agents, ai_providers
  - analyses, datasets, documents, projects
  - conversations, messages

  ## Policy Naming Convention
  - {table}_select_own: User can view their own data
  - {table}_select_master: Master can view all data
  - {table}_insert_own: User can insert their own data
  - {table}_update_own: User can update their own data
  - {table}_delete_own: User can delete their own data
*/

-- =============================================================================
-- CLEANUP: Remove all existing policies
-- =============================================================================

DO $$ 
DECLARE
  pol record;
  tables_to_clean text[] := ARRAY[
    'users', 'custom_sql_attempts', 'ai_agents', 'ai_providers',
    'analyses', 'datasets', 'documents', 'projects', 
    'conversations', 'messages'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY tables_to_clean
  LOOP
    FOR pol IN 
      EXECUTE format('SELECT polname FROM pg_policy WHERE polrelid = ''public.%I''::regclass', tbl)
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, tbl);
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ All existing policies removed';
END $$;

-- =============================================================================
-- USERS TABLE
-- =============================================================================

CREATE POLICY "users_select_own"
  ON users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_select_master"
  ON users FOR SELECT TO authenticated
  USING (is_master());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_master"
  ON users FOR UPDATE TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- =============================================================================
-- CUSTOM_SQL_ATTEMPTS TABLE
-- =============================================================================

CREATE POLICY "custom_sql_attempts_insert_auth"
  ON custom_sql_attempts FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "custom_sql_attempts_select_own"
  ON custom_sql_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "custom_sql_attempts_select_master"
  ON custom_sql_attempts FOR SELECT TO authenticated
  USING (is_master());

CREATE POLICY "custom_sql_attempts_update_master"
  ON custom_sql_attempts FOR UPDATE TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

CREATE POLICY "custom_sql_attempts_delete_master"
  ON custom_sql_attempts FOR DELETE TO authenticated
  USING (is_master());

-- =============================================================================
-- AI_AGENTS TABLE
-- =============================================================================

CREATE POLICY "ai_agents_all_master"
  ON ai_agents FOR ALL TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- =============================================================================
-- AI_PROVIDERS TABLE
-- =============================================================================

CREATE POLICY "ai_providers_all_master"
  ON ai_providers FOR ALL TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- =============================================================================
-- ANALYSES TABLE
-- =============================================================================

CREATE POLICY "analyses_select_own"
  ON analyses FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "analyses_select_master"
  ON analyses FOR SELECT TO authenticated
  USING (is_master());

CREATE POLICY "analyses_insert_own"
  ON analyses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "analyses_update_own"
  ON analyses FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "analyses_delete_own"
  ON analyses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- DATASETS TABLE
-- =============================================================================

CREATE POLICY "datasets_select_own"
  ON datasets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "datasets_select_master"
  ON datasets FOR SELECT TO authenticated
  USING (is_master());

CREATE POLICY "datasets_insert_own"
  ON datasets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "datasets_update_own"
  ON datasets FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "datasets_delete_own"
  ON datasets FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- DOCUMENTS TABLE
-- =============================================================================

CREATE POLICY "documents_select_own"
  ON documents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "documents_select_master"
  ON documents FOR SELECT TO authenticated
  USING (is_master());

CREATE POLICY "documents_insert_own"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "documents_update_own"
  ON documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "documents_delete_own"
  ON documents FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- PROJECTS TABLE
-- =============================================================================

CREATE POLICY "projects_select_own"
  ON projects FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "projects_select_master"
  ON projects FOR SELECT TO authenticated
  USING (is_master());

CREATE POLICY "projects_insert_own"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update_own"
  ON projects FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_delete_own"
  ON projects FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- CONVERSATIONS TABLE
-- =============================================================================

CREATE POLICY "conversations_select_own"
  ON conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "conversations_select_master"
  ON conversations FOR SELECT TO authenticated
  USING (is_master());

CREATE POLICY "conversations_insert_own"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_update_own"
  ON conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "conversations_delete_own"
  ON conversations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================

CREATE POLICY "messages_select_own"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_select_master"
  ON messages FOR SELECT TO authenticated
  USING (is_master());

CREATE POLICY "messages_insert_own"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE TO authenticated
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
  ON messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- =============================================================================
-- COMPLETION
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Clean RLS policies applied successfully - 41 policies created';
END $$;
