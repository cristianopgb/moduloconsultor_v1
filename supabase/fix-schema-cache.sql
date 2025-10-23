/*
  ============================================================================
  CORREÇÃO DO SCHEMA CACHE DO POSTGREST
  ============================================================================

  Este script resolve o erro PGRST205 "Could not find table in schema cache"
  executando verificações e correções necessárias.

  INSTRUÇÕES DE USO:
  1. Abra o Supabase Dashboard
  2. Vá para SQL Editor
  3. Cole este script completo
  4. Execute (Ctrl/Cmd + Enter)

  O script irá:
  - Recarregar o schema cache do PostgREST
  - Verificar e corrigir permissões do role authenticator
  - Listar tabelas visíveis para o PostgREST
  - Validar RLS das tabelas principais

  ============================================================================
*/

-- ============================================================================
-- PASSO 1: RELOAD FORÇADO DO SCHEMA CACHE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'INICIANDO RELOAD DO SCHEMA CACHE DO POSTGREST';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
END $$;

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Comando NOTIFY enviado ao PostgREST';
  RAISE NOTICE '   O PostgREST irá recarregar o cache nos próximos segundos';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASSO 2: VERIFICAR PERMISSÕES DO ROLE AUTHENTICATOR
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'VERIFICANDO PERMISSÕES DO ROLE AUTHENTICATOR';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
END $$;

-- Garantir que authenticator tem acesso ao schema public
GRANT USAGE ON SCHEMA public TO authenticator;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Garantir permissões em todas as tabelas existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Garantir permissões em sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Garantir permissões em funções
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Configurar permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Permissões do authenticator configuradas';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASSO 3: LISTAR TABELAS VISÍVEIS PARA POSTGREST
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'TABELAS VISÍVEIS NO SCHEMA PUBLIC';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  RAISE NOTICE 'Total de tabelas encontradas: %', table_count;
  RAISE NOTICE '';
END $$;

-- Listar tabelas principais
SELECT
  tablename as "Tabela",
  CASE
    WHEN rowsecurity THEN '✅ Habilitado'
    ELSE '❌ Desabilitado'
  END as "RLS"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'conversations', 'messages', 'models',
    'documents', 'projects', 'datasets', 'data_analyses',
    'references', 'ai_providers', 'ai_agents'
  )
ORDER BY tablename;

-- ============================================================================
-- PASSO 4: VERIFICAR E HABILITAR RLS EM TABELAS CRÍTICAS
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  tables_fixed INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'HABILITANDO RLS EM TABELAS CRÍTICAS';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
      AND tablename IN (
        'users', 'conversations', 'messages', 'models',
        'documents', 'projects', 'datasets', 'data_analyses',
        'references', 'ai_providers', 'ai_agents', 'custom_sql_attempts'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
    tables_fixed := tables_fixed + 1;
    RAISE NOTICE '✅ RLS habilitado na tabela: %', r.tablename;
  END LOOP;

  IF tables_fixed = 0 THEN
    RAISE NOTICE '✅ Todas as tabelas críticas já possuem RLS habilitado';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✅ RLS habilitado em % tabela(s)', tables_fixed;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASSO 5: VERIFICAR POLÍTICAS RLS DAS TABELAS PRINCIPAIS
-- ============================================================================

DO $$
DECLARE
  table_name TEXT;
  policy_count INTEGER;
  total_tables INTEGER := 0;
  total_policies INTEGER := 0;
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'VERIFICANDO POLÍTICAS RLS';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

  FOR table_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'users', 'conversations', 'messages', 'models',
        'documents', 'projects', 'datasets', 'data_analyses'
      )
    ORDER BY tablename
  LOOP
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = table_name;

    total_tables := total_tables + 1;
    total_policies := total_policies + policy_count;

    IF policy_count = 0 THEN
      RAISE NOTICE '⚠️  %: 0 políticas (RLS pode bloquear acesso)', table_name;
    ELSE
      RAISE NOTICE '✅ %: % política(s)', table_name, policy_count;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Total: % políticas em % tabelas', total_policies, total_tables;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASSO 6: CRIAR POLÍTICAS BÁSICAS SE NÃO EXISTIREM
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'CRIANDO POLÍTICAS BÁSICAS DE ACESSO';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

  -- Users: cada usuário vê apenas seus próprios dados
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY users_select_own ON users
      FOR SELECT TO authenticated
      USING (auth.uid() = id);
    RAISE NOTICE '✅ Política criada: users_select_own';
  END IF;

  -- Conversations: cada usuário vê suas conversas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'conversations_select_own'
  ) THEN
    CREATE POLICY conversations_select_own ON conversations
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
    RAISE NOTICE '✅ Política criada: conversations_select_own';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'conversations_insert_own'
  ) THEN
    CREATE POLICY conversations_insert_own ON conversations
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
    RAISE NOTICE '✅ Política criada: conversations_insert_own';
  END IF;

  -- Messages: usuário vê mensagens de suas conversas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'messages_select_own'
  ) THEN
    CREATE POLICY messages_select_own ON messages
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
      );
    RAISE NOTICE '✅ Política criada: messages_select_own';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'messages_insert_own'
  ) THEN
    CREATE POLICY messages_insert_own ON messages
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
      );
    RAISE NOTICE '✅ Política criada: messages_insert_own';
  END IF;

  -- Models: todos podem ler templates
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'models'
      AND policyname = 'models_select_all'
  ) THEN
    CREATE POLICY models_select_all ON models
      FOR SELECT TO authenticated
      USING (true);
    RAISE NOTICE '✅ Política criada: models_select_all';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Políticas básicas verificadas/criadas';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PASSO 7: FORÇAR RELOAD FINAL
-- ============================================================================

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'RELOAD FINAL ENVIADO';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Script executado com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASSOS:';
  RAISE NOTICE '1. Aguarde 10 segundos para o PostgREST processar';
  RAISE NOTICE '2. Recarregue a página do aplicativo (F5)';
  RAISE NOTICE '3. Tente fazer login/cadastro novamente';
  RAISE NOTICE '';
  RAISE NOTICE 'Se o problema persistir:';
  RAISE NOTICE '1. Vá para Project Settings → Database → Pause project';
  RAISE NOTICE '2. Aguarde 30 segundos';
  RAISE NOTICE '3. Clique em Resume project';
  RAISE NOTICE '4. Aguarde 1-2 minutos e tente novamente';
  RAISE NOTICE '';
END $$;
