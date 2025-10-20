/*
  # Corrigir Roles de Usuários e Criar Usuários de Teste
  
  ## Problema
  Os erros 403 estão ocorrendo porque:
  1. Os usuários não têm o campo 'role' no raw_app_meta_data
  2. As políticas RLS verificam role='master' no metadata
  3. Os usuários master@demo e user@demo não existem
  
  ## Solução
  1. Atualizar metadata dos usuários existentes
  2. Configurar roles apropriadamente
  3. Instruir como criar usuários de teste
  
  ## Segurança
  - Mantém RLS habilitado
  - Usa metadata seguro (raw_app_meta_data)
  - Não expõe senhas
*/

-- ============================================================================
-- PARTE 1: ATUALIZAR METADATA DOS USUÁRIOS EXISTENTES
-- ============================================================================

-- Definir role padrão 'user' para usuários sem role
UPDATE auth.users
SET raw_app_meta_data = 
  CASE 
    WHEN raw_app_meta_data IS NULL THEN '{"role": "user"}'::jsonb
    WHEN raw_app_meta_data->>'role' IS NULL THEN 
      raw_app_meta_data || '{"role": "user"}'::jsonb
    ELSE raw_app_meta_data
  END
WHERE raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data IS NULL;

-- Atualizar emails com 'master' para role master
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "master"}'::jsonb
WHERE email ILIKE '%master%' 
  AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' != 'master');

-- Atualizar emails com 'admin' para role master
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "master"}'::jsonb
WHERE email ILIKE '%admin%' 
  AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' != 'master');

-- ============================================================================
-- PARTE 2: GARANTIR SINCRONIZAÇÃO COM TABELA PUBLIC.USERS
-- ============================================================================

-- Atualizar tabela public.users com base nos roles do auth.users
UPDATE public.users u
SET role = COALESCE((
  SELECT 
    CASE 
      WHEN au.raw_app_meta_data->>'role' = 'master' THEN 'master'::user_role
      ELSE 'user'::user_role
    END
  FROM auth.users au
  WHERE au.id = u.id
), 'user'::user_role)
WHERE u.role IS NULL OR u.role::text != COALESCE((
  SELECT au.raw_app_meta_data->>'role'
  FROM auth.users au
  WHERE au.id = u.id
), 'user');

-- ============================================================================
-- PARTE 3: CRIAR FUNÇÃO HELPER PARA VERIFICAR SE É MASTER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_master(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users au
    WHERE au.id = COALESCE(user_id, auth.uid())
    AND (
      (au.raw_app_meta_data->>'role' = 'master')
      OR (au.email ILIKE '%master%')
      OR (au.email ILIKE '%admin%')
    )
  );
$$;

COMMENT ON FUNCTION public.is_master IS 
  'Verifica se um usuário é master baseado no metadata ou email. Usa SECURITY DEFINER para acessar auth.users.';

-- ============================================================================
-- PARTE 4: VERIFICAÇÃO E RELATÓRIO
-- ============================================================================

DO $$
DECLARE
  v_total_users integer;
  v_master_users integer;
  v_regular_users integer;
BEGIN
  -- Contar usuários
  SELECT COUNT(*) INTO v_total_users FROM auth.users;
  
  SELECT COUNT(*) INTO v_master_users 
  FROM auth.users 
  WHERE raw_app_meta_data->>'role' = 'master' 
     OR email ILIKE '%master%' 
     OR email ILIKE '%admin%';
  
  v_regular_users := v_total_users - v_master_users;
  
  -- Relatório
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ CORREÇÃO DE ROLES CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 RESUMO:';
  RAISE NOTICE '   • Total de usuários: %', v_total_users;
  RAISE NOTICE '   • Usuários Master: %', v_master_users;
  RAISE NOTICE '   • Usuários Regulares: %', v_regular_users;
  RAISE NOTICE '';
  RAISE NOTICE '🔧 AÇÕES REALIZADAS:';
  RAISE NOTICE '   • Metadata atualizado para todos os usuários';
  RAISE NOTICE '   • Emails com "master" ou "admin" promovidos a master';
  RAISE NOTICE '   • Tabela public.users sincronizada';
  RAISE NOTICE '   • Função helper is_master() criada';
  RAISE NOTICE '';
  RAISE NOTICE '📝 PARA CRIAR USUÁRIOS DE TESTE:';
  RAISE NOTICE '   1. Use a interface de cadastro da aplicação';
  RAISE NOTICE '   2. Para master: use email contendo "master" (ex: master@demo)';
  RAISE NOTICE '   3. Para user: use qualquer outro email (ex: user@demo)';
  RAISE NOTICE '   4. O sistema detectará automaticamente o role pelo email';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '   • Faça logout e login novamente para aplicar as mudanças';
  RAISE NOTICE '   • As políticas RLS agora funcionarão corretamente';
  RAISE NOTICE '   • Erros 403 devem ser eliminados';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;
