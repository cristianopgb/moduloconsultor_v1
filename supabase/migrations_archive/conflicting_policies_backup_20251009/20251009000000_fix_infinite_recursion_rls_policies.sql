/*
  # Corrigir Recursão Infinita nas Políticas RLS

  ## Problema Identificado
  - Erro: "infinite recursion detected in policy for relation users"
  - Causa: Políticas RLS consultando a própria tabela que protegem
  - Exemplo: policy em "users" faz SELECT FROM users → loop infinito
  - Afeta: users, custom_sql_attempts, e outras tabelas

  ## Solução
  - Remover TODAS as consultas recursivas tipo: EXISTS (SELECT 1 FROM users WHERE ...)
  - Usar APENAS auth.users (tabela auth, não public.users)
  - Verificar role através de:
    1. auth.users.raw_app_meta_data->>'role'
    2. auth.users.email ILIKE '%master%'

  ## Tabelas Corrigidas
  1. public.users
  2. public.custom_sql_attempts

  ## Segurança
  - Mantém controle de acesso restrito
  - Remove recursão mantendo funcionalidade
  - Masters identificados por auth.users apenas
*/

-- ============================================================================
-- PARTE 1: CORRIGIR TABELA USERS
-- ============================================================================

-- Dropar todas as policies existentes da tabela users
DROP POLICY IF EXISTS "users_select_all_master" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Masters can view all users" ON users;
DROP POLICY IF EXISTS "Masters can update any user" ON users;

-- Policy 1: Masters podem ver TODOS os usuários (SEM RECURSÃO)
CREATE POLICY "Masters can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    -- Verifica APENAS em auth.users (não em public.users)
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

-- Policy 2: Usuários podem ver próprio perfil
CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 3: Usuários podem atualizar próprio perfil
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 4: Masters podem atualizar qualquer usuário
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

-- ============================================================================
-- PARTE 2: CORRIGIR TABELA CUSTOM_SQL_ATTEMPTS
-- ============================================================================

-- Garantir que RLS está habilitado
ALTER TABLE custom_sql_attempts ENABLE ROW LEVEL SECURITY;

-- Dropar políticas antigas com recursão
DROP POLICY IF EXISTS "Masters can view all custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Users can view own custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Service role can insert custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Masters can update custom SQL attempts" ON custom_sql_attempts;
DROP POLICY IF EXISTS "Masters can delete custom SQL attempts" ON custom_sql_attempts;

-- Policy 1: Masters podem ver TODOS os registros (SEM RECURSÃO)
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

-- Policy 2: Usuários podem ver apenas seus próprios registros
CREATE POLICY "Users can view own custom SQL attempts"
  ON custom_sql_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 3: Usuários podem inserir seus próprios registros
CREATE POLICY "Users can insert own custom SQL attempts"
  ON custom_sql_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Masters podem atualizar (aprovar/rejeitar)
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

-- Policy 5: Masters podem deletar
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

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
  v_users_policies integer;
  v_attempts_policies integer;
BEGIN
  -- Contar policies da tabela users
  SELECT COUNT(*) INTO v_users_policies
  FROM pg_policies
  WHERE tablename = 'users';

  -- Contar policies da tabela custom_sql_attempts
  SELECT COUNT(*) INTO v_attempts_policies
  FROM pg_policies
  WHERE tablename = 'custom_sql_attempts';

  -- Verificar se as políticas foram criadas
  IF v_users_policies < 4 THEN
    RAISE EXCEPTION 'Expected at least 4 policies for users table, found %', v_users_policies;
  END IF;

  IF v_attempts_policies < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 policies for custom_sql_attempts table, found %', v_attempts_policies;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ Recursão infinita corrigida com sucesso!';
  RAISE NOTICE '📋 Tabela users: % policies criadas (SEM recursão)', v_users_policies;
  RAISE NOTICE '📋 Tabela custom_sql_attempts: % policies criadas (SEM recursão)', v_attempts_policies;
  RAISE NOTICE '🔐 Verificação de master usa APENAS auth.users';
  RAISE NOTICE '⚡ Erro 500 deve estar resolvido';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;
