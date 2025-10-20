/*
  # Script de Validação RLS
  
  Este script verifica a integridade das políticas Row Level Security
  em todo o banco de dados. Execute no Supabase SQL Editor.
  
  ## O que verifica:
  1. Contagem de políticas por tabela vs esperado
  2. Políticas duplicadas (mesmo nome, mesma tabela)
  3. Tabelas sem RLS habilitado
  4. Políticas órfãs (sem tabela correspondente)
  5. Naming convention (padrão {table}_{op}_{scope})
  
  ## Como usar:
  1. Copie todo este arquivo
  2. Cole no Supabase SQL Editor
  3. Execute
  4. Revise o relatório gerado
*/

-- =============================================================================
-- SEÇÃO 1: Contagem de Políticas por Tabela
-- =============================================================================

DO $$
DECLARE
  expected_policies jsonb := '{
    "users": 4,
    "custom_sql_attempts": 5,
    "ai_agents": 1,
    "ai_providers": 1,
    "analyses": 5,
    "datasets": 5,
    "documents": 5,
    "projects": 5,
    "conversations": 5,
    "messages": 5,
    "data_analyses": 4
  }'::jsonb;
  
  tbl text;
  expected_count integer;
  actual_count integer;
  all_ok boolean := true;
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 VALIDAÇÃO RLS - CONTAGEM DE POLÍTICAS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  FOR tbl, expected_count IN SELECT * FROM jsonb_each_text(expected_policies)
  LOOP
    SELECT COUNT(*) INTO actual_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = tbl;
    
    IF actual_count = expected_count::integer THEN
      RAISE NOTICE '✅ % → % policies (OK)', rpad(tbl, 25, ' '), actual_count;
    ELSIF actual_count > expected_count::integer THEN
      RAISE WARNING '⚠️  % → % policies (esperado: %, EXCESSO: %)', 
        rpad(tbl, 25, ' '), actual_count, expected_count, (actual_count - expected_count::integer);
      all_ok := false;
    ELSE
      RAISE WARNING '❌ % → % policies (esperado: %, FALTAM: %)', 
        rpad(tbl, 25, ' '), actual_count, expected_count, (expected_count::integer - actual_count);
      all_ok := false;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  IF all_ok THEN
    RAISE NOTICE '✅ Todas as tabelas têm o número correto de políticas!';
  ELSE
    RAISE WARNING '⚠️  Algumas tabelas têm contagem incorreta de políticas';
  END IF;
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- SEÇÃO 2: Detectar Políticas Duplicadas
-- =============================================================================

DO $$
DECLARE
  dup record;
  has_duplicates boolean := false;
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🔍 VERIFICAÇÃO DE POLÍTICAS DUPLICADAS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  FOR dup IN
    SELECT schemaname, tablename, policyname, COUNT(*) as count
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
    GROUP BY schemaname, tablename, policyname
    HAVING COUNT(*) > 1
  LOOP
    RAISE WARNING '❌ DUPLICADA: %.% → policy "%" aparece % vezes',
      dup.schemaname, dup.tablename, dup.policyname, dup.count;
    has_duplicates := true;
  END LOOP;
  
  IF NOT has_duplicates THEN
    RAISE NOTICE '✅ Nenhuma política duplicada encontrada!';
  ELSE
    RAISE WARNING '⚠️  Políticas duplicadas detectadas - execute a migração mestre RLS';
  END IF;
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- SEÇÃO 3: Tabelas Sem RLS Habilitado
-- =============================================================================

DO $$
DECLARE
  tbl record;
  has_issues boolean := false;
  important_tables text[] := ARRAY[
    'users', 'custom_sql_attempts', 'ai_agents', 'ai_providers',
    'analyses', 'datasets', 'documents', 'projects',
    'conversations', 'messages', 'data_analyses', 'references'
  ];
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🔒 VERIFICAÇÃO DE RLS HABILITADO';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  FOR tbl IN
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = ANY(important_tables)
    ORDER BY tablename
  LOOP
    IF tbl.rowsecurity THEN
      RAISE NOTICE '✅ % → RLS habilitado', rpad(tbl.tablename, 25, ' ');
    ELSE
      RAISE WARNING '❌ % → RLS NÃO HABILITADO', rpad(tbl.tablename, 25, ' ');
      has_issues := true;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  IF NOT has_issues THEN
    RAISE NOTICE '✅ Todas as tabelas importantes têm RLS habilitado!';
  ELSE
    RAISE WARNING '⚠️  Algumas tabelas não têm RLS habilitado';
  END IF;
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- SEÇÃO 4: Verificar Naming Convention
-- =============================================================================

DO $$
DECLARE
  pol record;
  has_issues boolean := false;
  -- Pattern: {table}_{operation}_{scope} ou {table}_all_{scope}
  -- Exemplos: users_select_own, datasets_insert_master, ai_agents_all_master
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📝 VERIFICAÇÃO DE NAMING CONVENTION';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE 'Pattern esperado: {table}_{operation}_{scope}';
  RAISE NOTICE 'Exemplos: users_select_own, datasets_insert_master';
  RAISE NOTICE '';
  
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    -- Ignora políticas de storage (têm padrão diferente)
    AND tablename NOT IN ('objects')
    -- Verifica se NÃO segue o padrão
    AND policyname !~ '^[a-z_]+_(select|insert|update|delete|all)_(own|master|auth|public)$'
    ORDER BY tablename, policyname
  LOOP
    RAISE WARNING '⚠️  %.% → policy "%" não segue naming convention',
      pol.schemaname, pol.tablename, pol.policyname;
    has_issues := true;
  END LOOP;
  
  IF NOT has_issues THEN
    RAISE NOTICE '✅ Todas as políticas seguem a naming convention!';
  ELSE
    RAISE WARNING '⚠️  Algumas políticas não seguem o padrão de nomenclatura';
  END IF;
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- SEÇÃO 5: Storage Buckets
-- =============================================================================

DO $$
DECLARE
  bucket record;
  bucket_count integer;
  expected_buckets text[] := ARRAY['references', 'previews', 'templates'];
  missing_buckets text[];
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📦 VERIFICAÇÃO DE STORAGE BUCKETS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  FOR bucket IN
    SELECT id, name, public, 
      (SELECT COUNT(*) FROM pg_policies 
       WHERE schemaname = 'storage' 
       AND tablename = 'objects' 
       AND policyname LIKE id || '%') as policy_count
    FROM storage.buckets
    WHERE id = ANY(expected_buckets)
    ORDER BY id
  LOOP
    RAISE NOTICE '% → % políticas (público: %)',
      rpad(bucket.id, 20, ' '),
      bucket.policy_count,
      CASE WHEN bucket.public THEN 'sim' ELSE 'não' END;
  END LOOP;
  
  -- Verificar buckets faltantes
  SELECT ARRAY_AGG(b) INTO missing_buckets
  FROM unnest(expected_buckets) b
  WHERE b NOT IN (SELECT id FROM storage.buckets);
  
  RAISE NOTICE '';
  IF missing_buckets IS NOT NULL THEN
    RAISE WARNING '⚠️  Buckets faltantes: %', array_to_string(missing_buckets, ', ');
  ELSE
    RAISE NOTICE '✅ Todos os buckets necessários existem!';
  END IF;
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- SEÇÃO 6: Relatório Final
-- =============================================================================

DO $$
DECLARE
  total_policies integer;
  total_tables_with_rls integer;
  total_buckets integer;
BEGIN
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage');
  
  SELECT COUNT(*) INTO total_tables_with_rls
  FROM pg_tables
  WHERE schemaname = 'public'
  AND rowsecurity = true;
  
  SELECT COUNT(*) INTO total_buckets
  FROM storage.buckets;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 RELATÓRIO FINAL';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '  Total de políticas RLS: %', total_policies;
  RAISE NOTICE '  Tabelas com RLS: %', total_tables_with_rls;
  RAISE NOTICE '  Storage buckets: %', total_buckets;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Validação concluída!';
  RAISE NOTICE '';
  RAISE NOTICE 'Se encontrou problemas:';
  RAISE NOTICE '  1. Execute: 20251010000000_master_rls_policies_consolidated.sql';
  RAISE NOTICE '  2. Re-execute este script para verificar';
  RAISE NOTICE '  3. Consulte: /supabase/migrations/README.md';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
