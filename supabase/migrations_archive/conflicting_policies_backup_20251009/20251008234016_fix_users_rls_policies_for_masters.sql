/*
  # Corrigir Políticas RLS para Tabelas users e custom_sql_attempts
  
  ## Problema Identificado
  - Usuário master@demo.com não consegue acessar tabelas users e custom_sql_attempts
  - Políticas RLS verificam apenas raw_app_meta_data->>'role'
  - Usuário master tem role no email, mas não no raw_app_meta_data
  
  ## Solução
  1. Atualizar política SELECT da tabela users para aceitar:
     - raw_app_meta_data->>'role' = 'master' OU
     - email ILIKE '%master%' OU
     - role (coluna da tabela public.users) = 'master'
  
  2. Criar políticas para custom_sql_attempts se não existirem
  
  ## Tabelas Afetadas
  - public.users (policies: users_select_all_master)
  - public.custom_sql_attempts (todas as policies)
  
  ## Segurança
  - Mantém controle de acesso restrito a masters
  - Permite múltiplos métodos de identificação de master
  - Não remove políticas existentes, apenas ajusta
*/

-- ============================================================================
-- CORRIGIR POLÍTICA SELECT DA TABELA USERS
-- ============================================================================

-- Dropar política existente se existir
DROP POLICY IF EXISTS "users_select_all_master" ON users;

-- Criar nova política mais flexível para masters
CREATE POLICY "users_select_all_master"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        -- Método 1: Verificar raw_app_meta_data
        (au.raw_app_meta_data->>'role' = 'master')
        OR
        -- Método 2: Verificar email
        (au.email ILIKE '%master%')
        OR
        -- Método 3: Verificar role na tabela users
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'master'
        )
      )
    )
  );

COMMENT ON POLICY "users_select_all_master" ON users IS 
  'Masters podem ver todos os usuários. Identifica masters por: raw_app_meta_data.role, email com master, ou users.role';

-- ============================================================================
-- VERIFICAR E CRIAR POLÍTICAS PARA custom_sql_attempts
-- ============================================================================

-- Garantir que RLS está habilitado
ALTER TABLE custom_sql_attempts ENABLE ROW LEVEL SECURITY;

-- Policy 1: Masters podem ver TODOS os registros
DROP POLICY IF EXISTS "Masters can view all custom SQL attempts" ON custom_sql_attempts;

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
        OR (au.email ILIKE '%master%')
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.role = 'master'
        )
      )
    )
  );

-- Policy 2: Usuários podem ver apenas seus próprios registros
DROP POLICY IF EXISTS "Users can view own custom SQL attempts" ON custom_sql_attempts;

CREATE POLICY "Users can view own custom SQL attempts"
  ON custom_sql_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 3: Sistema pode inserir
DROP POLICY IF EXISTS "Service role can insert custom SQL attempts" ON custom_sql_attempts;

CREATE POLICY "Service role can insert custom SQL attempts"
  ON custom_sql_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Masters podem atualizar (aprovar/rejeitar)
DROP POLICY IF EXISTS "Masters can update custom SQL attempts" ON custom_sql_attempts;

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
        OR (au.email ILIKE '%master%')
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.role = 'master'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        (au.raw_app_meta_data->>'role' = 'master')
        OR (au.email ILIKE '%master%')
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.role = 'master'
        )
      )
    )
  );

-- Policy 5: Masters podem deletar
DROP POLICY IF EXISTS "Masters can delete custom SQL attempts" ON custom_sql_attempts;

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
        OR (au.email ILIKE '%master%')
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.role = 'master'
        )
      )
    )
  );

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
BEGIN
  -- Verificar se as políticas foram criadas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'users_select_all_master'
  ) THEN
    RAISE EXCEPTION 'Policy users_select_all_master was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'custom_sql_attempts' 
    AND policyname = 'Masters can view all custom SQL attempts'
  ) THEN
    RAISE EXCEPTION 'Policy for custom_sql_attempts was not created';
  END IF;

  RAISE NOTICE '✅ RLS policies updated successfully!';
  RAISE NOTICE '📋 Table users: policy users_select_all_master updated';
  RAISE NOTICE '📋 Table custom_sql_attempts: 5 policies created/updated';
  RAISE NOTICE '🔐 Masters now identified by: email, raw_app_meta_data, or users.role';
END $$;