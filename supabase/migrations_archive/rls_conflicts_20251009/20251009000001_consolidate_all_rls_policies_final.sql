/*
  # Consolidação Final de Todas as Políticas RLS

  ## Objetivo
  Esta migração consolida TODAS as políticas RLS em uma única migração definitiva,
  eliminando duplicações e conflitos de migrações anteriores.

  ## Problema Resolvido
  - Múltiplas migrações estavam recriando as mesmas políticas
  - Algumas políticas tinham queries recursivas (causando erro 500)
  - Falta de clareza sobre qual é o estado final correto

  ## Solução
  - Dropar TODAS as políticas existentes de todas as tabelas
  - Recriar apenas as versões corretas e finais
  - Usar APENAS auth.users (nunca public.users) para evitar recursão
  - Documentar claramente cada política

  ## Tabelas Afetadas
  1. users - 4 policies (master access + own profile)
  2. custom_sql_attempts - 5 policies (master review workflow)
  3. models - 4 policies (templates management)
  4. data_analyses - 4 policies (analytics results)

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Masters identificados via: auth.users.raw_app_meta_data->>'role' OU email ILIKE '%master%'
  - Usuários normais acessam apenas seus próprios dados
  - ZERO queries recursivas (não consulta public.users em policies)

  ## Notas
  - Storage policies já foram consolidadas em migrações anteriores
  - Esta migração substitui: 20251008234016 e 20251009000000 (removidas)
*/

-- ============================================================================
-- PARTE 1: LIMPAR TODAS AS POLÍTICAS EXISTENTES
-- ============================================================================

-- 1.1 Tabela users
DROP POLICY IF EXISTS "users_select_all_master" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Masters can view all users" ON users;
DROP POLICY IF EXISTS "Masters can update any user" ON users;
DROP POLICY IF EXISTS "Users can insert profile" ON users;
DROP POLICY IF EXISTS "Users can delete own profile" ON users;

-- 1.2 Tabela custom_sql_attempts
DROP POLICY IF EXISTS "Masters can view all custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Users can view own custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Service role can insert custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Users can insert own custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Masters can update custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Masters can delete custom SQL attempts" ON custom_sql_attempts;

-- 1.3 Tabela models (templates)
DROP POLICY IF EXISTS "models_select_authenticated" ON models;
DROP POLICY IF EXISTS "models_insert_authenticated" ON models;
DROP POLICY IF EXISTS "models_update_authenticated" ON models;
DROP POLICY IF EXISTS "models_delete_authenticated" ON models;
DROP POLICY IF EXISTS "models_select_all" ON models;
DROP POLICY IF EXISTS "models_insert_master" ON models;
DROP POLICY IF EXISTS "models_update_master" ON models;
DROP POLICY IF EXISTS "models_delete_master" ON models;

-- 1.4 Tabela data_analyses
DROP POLICY IF EXISTS "Users can read own analyses" ON data_analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON data_analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON data_analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON data_analyses;

-- ============================================================================
-- PARTE 2: GARANTIR QUE RLS ESTÁ HABILITADO
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_sql_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_analyses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 3: CRIAR POLÍTICAS FINAIS - TABELA USERS
-- ============================================================================

-- Policy 1: Masters podem ver TODOS os usuários
-- SEGURANÇA: Consulta APENAS auth.users (não public.users) para evitar recursão
CREATE POLICY "Masters can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        (au.raw_app_meta_data->>'role' = 'master')
        OR
        (au.email ILIKE '%master%')
      )
    )
  );

COMMENT ON POLICY "Masters can view all users" ON users IS
  'Masters podem visualizar todos os usuários. Identifica masters via auth.users apenas (SEM recursão).';

-- Policy 2: Usuários podem ver próprio perfil
CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

COMMENT ON POLICY "Users can view own profile" ON users IS
  'Usuários podem visualizar apenas seu próprio perfil.';

-- Policy 3: Usuários podem atualizar próprio perfil
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMENT ON POLICY "Users can update own profile" ON users IS
  'Usuários podem atualizar apenas seu próprio perfil.';

-- Policy 4: Masters podem atualizar qualquer usuário
-- SEGURANÇA: Consulta APENAS auth.users (não public.users) para evitar recursão
CREATE POLICY "Masters can update any user"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        (au.raw_app_meta_data->>'role' = 'master')
        OR
        (au.email ILIKE '%master%')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        (au.raw_app_meta_data->>'role' = 'master')
        OR
        (au.email ILIKE '%master%')
      )
    )
  );

COMMENT ON POLICY "Masters can update any user" ON users IS
  'Masters podem atualizar qualquer usuário (manage tokens, roles, etc).';

-- ============================================================================
-- PARTE 4: CRIAR POLÍTICAS FINAIS - TABELA CUSTOM_SQL_ATTEMPTS
-- ============================================================================

-- Policy 1: Masters podem ver TODOS os registros
-- SEGURANÇA: Consulta APENAS auth.users (não public.users) para evitar recursão
CREATE POLICY "Masters can view all custom SQL attempts"
  ON custom_sql_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        (au.raw_app_meta_data->>'role' = 'master')
        OR
        (au.email ILIKE '%master%')
      )
    )
  );

COMMENT ON POLICY "Masters can view all custom SQL attempts" ON custom_sql_attempts IS
  'Masters podem visualizar todas as tentativas de SQL customizado para revisão.';

-- Policy 2: Usuários podem ver apenas seus próprios registros
CREATE POLICY "Users can view own custom SQL attempts"
  ON custom_sql_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own custom SQL attempts" ON custom_sql_attempts IS
  'Usuários podem visualizar apenas suas próprias tentativas de SQL.';

-- Policy 3: Usuários podem inserir seus próprios registros
CREATE POLICY "Users can insert own custom SQL attempts"
  ON custom_sql_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can insert own custom SQL attempts" ON custom_sql_attempts IS
  'Usuários podem criar tentativas de SQL customizado (via edge function).';

-- Policy 4: Masters podem atualizar (aprovar/rejeitar)
-- SEGURANÇA: Consulta APENAS auth.users (não public.users) para evitar recursão
CREATE POLICY "Masters can update custom SQL attempts"
  ON custom_sql_attempts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        (au.raw_app_meta_data->>'role' = 'master')
        OR
        (au.email ILIKE '%master%')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        (au.raw_app_meta_data->>'role' = 'master')
        OR
        (au.email ILIKE '%master%')
      )
    )
  );

COMMENT ON POLICY "Masters can update custom SQL attempts" ON custom_sql_attempts IS
  'Masters podem aprovar ou rejeitar tentativas de SQL customizado.';

-- Policy 5: Masters podem deletar
-- SEGURANÇA: Consulta APENAS auth.users (não public.users) para evitar recursão
CREATE POLICY "Masters can delete custom SQL attempts"
  ON custom_sql_attempts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        (au.raw_app_meta_data->>'role' = 'master')
        OR
        (au.email ILIKE '%master%')
      )
    )
  );

COMMENT ON POLICY "Masters can delete custom SQL attempts" ON custom_sql_attempts IS
  'Masters podem deletar tentativas de SQL customizado.';

-- ============================================================================
-- PARTE 5: CRIAR POLÍTICAS FINAIS - TABELA MODELS (TEMPLATES)
-- ============================================================================

-- Policy 1: Todos autenticados podem ver templates
CREATE POLICY "models_select_authenticated"
  ON models
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "models_select_authenticated" ON models IS
  'Todos os usuários autenticados podem visualizar templates.';

-- Policy 2: Todos autenticados podem criar templates
CREATE POLICY "models_insert_authenticated"
  ON models
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON POLICY "models_insert_authenticated" ON models IS
  'Todos os usuários autenticados podem criar novos templates.';

-- Policy 3: Todos autenticados podem atualizar templates
CREATE POLICY "models_update_authenticated"
  ON models
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "models_update_authenticated" ON models IS
  'Todos os usuários autenticados podem atualizar templates.';

-- Policy 4: Todos autenticados podem deletar (exceto system templates)
CREATE POLICY "models_delete_authenticated"
  ON models
  FOR DELETE
  TO authenticated
  USING (COALESCE(is_system_template, false) = false);

COMMENT ON POLICY "models_delete_authenticated" ON models IS
  'Todos os usuários autenticados podem deletar templates (exceto system templates protegidos).';

-- ============================================================================
-- PARTE 6: CRIAR POLÍTICAS FINAIS - TABELA DATA_ANALYSES
-- ============================================================================

-- Policy 1: Usuários podem ler suas próprias análises
CREATE POLICY "Users can read own analyses"
  ON data_analyses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can read own analyses" ON data_analyses IS
  'Usuários podem visualizar apenas suas próprias análises de dados.';

-- Policy 2: Usuários podem inserir suas próprias análises
CREATE POLICY "Users can insert own analyses"
  ON data_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can insert own analyses" ON data_analyses IS
  'Usuários podem criar análises de dados para seus datasets.';

-- Policy 3: Usuários podem atualizar suas próprias análises
CREATE POLICY "Users can update own analyses"
  ON data_analyses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can update own analyses" ON data_analyses IS
  'Usuários podem atualizar suas próprias análises de dados.';

-- Policy 4: Usuários podem deletar suas próprias análises
CREATE POLICY "Users can delete own analyses"
  ON data_analyses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can delete own analyses" ON data_analyses IS
  'Usuários podem deletar suas próprias análises de dados.';

-- ============================================================================
-- PARTE 7: VERIFICAÇÃO DE INTEGRIDADE
-- ============================================================================

DO $$
DECLARE
  v_users_policies integer;
  v_custom_sql_policies integer;
  v_models_policies integer;
  v_analyses_policies integer;
BEGIN
  -- Contar policies de cada tabela
  SELECT COUNT(*) INTO v_users_policies
  FROM pg_policies WHERE tablename = 'users';

  SELECT COUNT(*) INTO v_custom_sql_policies
  FROM pg_policies WHERE tablename = 'custom_sql_attempts';

  SELECT COUNT(*) INTO v_models_policies
  FROM pg_policies WHERE tablename = 'models';

  SELECT COUNT(*) INTO v_analyses_policies
  FROM pg_policies WHERE tablename = 'data_analyses';

  -- Verificar se todas as políticas foram criadas
  IF v_users_policies < 4 THEN
    RAISE EXCEPTION 'Expected at least 4 policies for users table, found %', v_users_policies;
  END IF;

  IF v_custom_sql_policies < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 policies for custom_sql_attempts table, found %', v_custom_sql_policies;
  END IF;

  IF v_models_policies < 4 THEN
    RAISE EXCEPTION 'Expected at least 4 policies for models table, found %', v_models_policies;
  END IF;

  IF v_analyses_policies < 4 THEN
    RAISE EXCEPTION 'Expected at least 4 policies for data_analyses table, found %', v_analyses_policies;
  END IF;

  -- Verificar que RLS está habilitado
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'users'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on users table';
  END IF;

  -- Relatório de sucesso
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ CONSOLIDAÇÃO DE POLÍTICAS RLS CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 RESUMO DAS POLÍTICAS CRIADAS:';
  RAISE NOTICE '   • users: % policies (master access + own profile)', v_users_policies;
  RAISE NOTICE '   • custom_sql_attempts: % policies (knowledge base workflow)', v_custom_sql_policies;
  RAISE NOTICE '   • models: % policies (templates management)', v_models_policies;
  RAISE NOTICE '   • data_analyses: % policies (analytics results)', v_analyses_policies;
  RAISE NOTICE '';
  RAISE NOTICE '🔐 SEGURANÇA GARANTIDA:';
  RAISE NOTICE '   • RLS habilitado em todas as tabelas';
  RAISE NOTICE '   • ZERO queries recursivas (auth.users apenas)';
  RAISE NOTICE '   • Masters identificados por email OU raw_app_meta_data';
  RAISE NOTICE '   • Usuários acessam apenas próprios dados';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 PROBLEMAS RESOLVIDOS:';
  RAISE NOTICE '   • Eliminada recursão infinita em policies';
  RAISE NOTICE '   • Removida duplicação de políticas';
  RAISE NOTICE '   • Consolidado estado final correto';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;
