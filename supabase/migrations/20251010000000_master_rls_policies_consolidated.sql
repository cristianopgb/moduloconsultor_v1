/*
  # Master RLS Policies - Single Source of Truth
  
  ## Purpose
  This is the DEFINITIVE migration for ALL Row Level Security policies.
  All other migrations that previously created policies have been refactored
  to remove that responsibility.
  
  ## Migration Strategy
  1. Dynamically removes ALL existing policies from all tables
  2. Creates clean, consistent policies with standardized naming
  3. Uses is_master() helper function to avoid circular dependencies
  4. Includes validation and reporting
  
  ## Tables Covered (11 total)
  - users (4 policies)
  - custom_sql_attempts (5 policies) 
  - ai_agents (1 policy)
  - ai_providers (1 policy)
  - analyses (5 policies)
  - datasets (5 policies)
  - documents (5 policies)
  - projects (5 policies)
  - conversations (5 policies)
  - messages (5 policies)
  - data_analyses (4 policies - Analytics V2)
  
  ## Naming Convention
  Format: {table}_{operation}_{scope}
  Examples:
    - users_select_own      → Users can view their own data
    - users_select_master   → Masters can view all users
    - datasets_insert_own   → Users can create datasets
    - datasets_delete_own   → Users can delete their datasets
  
  ## Security Model
  - Users can SELECT, INSERT, UPDATE, DELETE their own data
  - Masters can SELECT all data (supervision)
  - Some tables are master-only (ai_agents, ai_providers)
  - Storage buckets have separate policies (not covered here)
*/

-- =============================================================================
-- STEP 1: CLEANUP - Remove ALL existing policies
-- =============================================================================

DO $$ 
DECLARE
  pol record;
  tables_to_clean text[] := ARRAY[
    'users', 'custom_sql_attempts', 'ai_agents', 'ai_providers',
    'analyses', 'datasets', 'documents', 'projects', 
    'conversations', 'messages', 'data_analyses'
  ];
  tbl text;
  total_dropped integer := 0;
BEGIN
  RAISE NOTICE '🧹 Starting policy cleanup...';
  
  FOREACH tbl IN ARRAY tables_to_clean
  LOOP
    FOR pol IN 
      SELECT polname 
      FROM pg_policy 
      WHERE polrelid = ('public.' || tbl)::regclass
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.polname, tbl);
      total_dropped := total_dropped + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ Dropped % existing policies', total_dropped;
END $$;

-- =============================================================================
-- STEP 2: USERS TABLE (4 policies)
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
-- STEP 3: CUSTOM_SQL_ATTEMPTS TABLE (5 policies)
-- =============================================================================

CREATE POLICY "custom_sql_attempts_insert_auth"
  ON custom_sql_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

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
-- STEP 4: AI_AGENTS TABLE (1 policy - Master only)
-- =============================================================================

CREATE POLICY "ai_agents_all_master"
  ON ai_agents FOR ALL TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- =============================================================================
-- STEP 5: AI_PROVIDERS TABLE (1 policy - Master only)
-- =============================================================================

CREATE POLICY "ai_providers_all_master"
  ON ai_providers FOR ALL TO authenticated
  USING (is_master())
  WITH CHECK (is_master());

-- =============================================================================
-- STEP 6: ANALYSES TABLE (5 policies)
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
-- STEP 7: DATASETS TABLE (5 policies)
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
-- STEP 8: DOCUMENTS TABLE (5 policies)
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
-- STEP 9: PROJECTS TABLE (5 policies)
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
-- STEP 10: CONVERSATIONS TABLE (5 policies)
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
-- STEP 11: MESSAGES TABLE (5 policies)
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
-- STEP 12: DATA_ANALYSES TABLE (4 policies - Analytics V2)
-- =============================================================================

CREATE POLICY "data_analyses_select_own"
  ON data_analyses FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "data_analyses_insert_own"
  ON data_analyses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "data_analyses_update_own"
  ON data_analyses FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "data_analyses_delete_own"
  ON data_analyses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- STEP 13: VALIDATION & REPORTING
-- =============================================================================

DO $$
DECLARE
  policy_count integer;
  expected_count integer := 51; -- Total expected policies
  tables_checked text[] := ARRAY[
    'users', 'custom_sql_attempts', 'ai_agents', 'ai_providers',
    'analyses', 'datasets', 'documents', 'projects', 
    'conversations', 'messages', 'data_analyses'
  ];
  tbl text;
  tbl_policy_count integer;
BEGIN
  RAISE NOTICE '✅ Master RLS policies applied successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Policy Summary by Table:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  policy_count := 0;
  
  FOREACH tbl IN ARRAY tables_checked
  LOOP
    SELECT COUNT(*) INTO tbl_policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = tbl;
    
    policy_count := policy_count + tbl_policy_count;
    
    RAISE NOTICE '  % → % policies', 
      rpad(tbl, 25, ' '), 
      tbl_policy_count;
  END LOOP;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '  TOTAL: % policies created', policy_count;
  RAISE NOTICE '';
  
  IF policy_count != expected_count THEN
    RAISE WARNING '⚠️  Expected % policies but found %', expected_count, policy_count;
  ELSE
    RAISE NOTICE '✅ Policy count matches expected: %', policy_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security Model:';
  RAISE NOTICE '  • Users: Can manage their own data';
  RAISE NOTICE '  • Masters: Can view all data + manage AI configs';
  RAISE NOTICE '  • Messages: Inherit permissions from conversations';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Note: Storage bucket policies are managed separately';
  RAISE NOTICE '   → See: 20251004000000_consolidate_storage_policies.sql';
END $$;
