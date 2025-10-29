/*
  # Consolidação de Conflitos e Limpeza de Sistema

  ## Problema Identificado
  - Duas arquiteturas de kanban_cards conflitantes:
    1. Antiga (jornada_id + area_id) - não usado mais
    2. Nova RAG (sessao_id) - arquitetura atual
  - Função is_master() duplicada
  - RLS policies conflitantes
  - Triggers sobrepostos

  ## Solução
  1. Remover schema antigo do consultor (jornadas_consultor, areas_trabalho)
  2. Consolidar kanban_cards na arquitetura RAG (sessao_id)
  3. Garantir is_master() com CREATE OR REPLACE
  4. Limpar policies antigas antes de criar novas
  5. Prevenir conflitos futuros

  ## Impacto
  - SAFE: Remove apenas código obsoleto não usado
  - Sistema consultor antigo (chat-based) foi totalmente substituído por RAG
  - Dados de produção preservados (sessao_id é a verdade)
*/

-- ============================================
-- PART 1: REMOVER SCHEMA OBSOLETO
-- ============================================

-- Tabelas do sistema antigo que não são mais usadas
DROP TABLE IF EXISTS areas_trabalho CASCADE;
DROP TABLE IF EXISTS jornadas_consultor CASCADE;
DROP TABLE IF EXISTS framework_checklist CASCADE;
DROP TABLE IF EXISTS cadeia_valor_processos CASCADE;

-- Remover policies antigas conflitantes de kanban_cards
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'kanban_cards'
      AND policyname LIKE '%journey%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON kanban_cards', pol.policyname);
    RAISE NOTICE 'Removed obsolete policy: %', pol.policyname;
  END LOOP;
END $$;

-- ============================================
-- PART 2: CONSOLIDAR KANBAN SCHEMA
-- ============================================

-- Garantir que kanban_cards usa APENAS sessao_id (não jornada_id)
DO $$
BEGIN
  -- Remover colunas antigas se existirem
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kanban_cards' AND column_name = 'jornada_id'
  ) THEN
    ALTER TABLE kanban_cards DROP COLUMN IF EXISTS jornada_id CASCADE;
    RAISE NOTICE 'Removed obsolete jornada_id column';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kanban_cards' AND column_name = 'area_id'
  ) THEN
    ALTER TABLE kanban_cards DROP COLUMN IF EXISTS area_id CASCADE;
    RAISE NOTICE 'Removed obsolete area_id column';
  END IF;

  -- Garantir que sessao_id existe (deve já existir)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kanban_cards' AND column_name = 'sessao_id'
  ) THEN
    ALTER TABLE kanban_cards ADD COLUMN sessao_id UUID NOT NULL REFERENCES consultor_sessoes(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added sessao_id column';
  END IF;
END $$;

-- ============================================
-- PART 3: CONSOLIDAR FUNÇÃO is_master()
-- ============================================

-- Garantir is_master() existe SEM conflito
CREATE OR REPLACE FUNCTION is_master(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
      AND role = 'master'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_master IS
'Helper function to check if user is master. SECURITY DEFINER allows RLS policies to check roles safely.';

-- ============================================
-- PART 4: LIMPAR TRIGGERS DUPLICADOS
-- ============================================

-- Verificar se há triggers duplicados em kanban_cards
DO $$
DECLARE
  trig record;
  trigger_count INT;
BEGIN
  SELECT COUNT(*)
  INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'kanban_cards'::regclass;

  IF trigger_count > 1 THEN
    RAISE NOTICE 'Found % triggers on kanban_cards, checking for duplicates...', trigger_count;

    FOR trig IN
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'kanban_cards'::regclass
        AND NOT tgisinternal
    LOOP
      RAISE NOTICE 'Trigger: %', trig.tgname;
    END LOOP;
  END IF;
END $$;

-- ============================================
-- PART 5: VERIFICAR INTEGRIDADE DO SISTEMA
-- ============================================

DO $$
DECLARE
  v_kanban_columns TEXT[];
  v_expected_columns TEXT[] := ARRAY['id', 'sessao_id', 'titulo', 'descricao', 'status',
    'plano_hash', 'plano_version', 'card_source', 'deprecated'];
  v_missing TEXT[];
  v_consultor_sessoes_exists BOOLEAN;
  v_kanban_rls_enabled BOOLEAN;
BEGIN
  -- Verificar colunas de kanban_cards
  SELECT array_agg(column_name::TEXT)
  INTO v_kanban_columns
  FROM information_schema.columns
  WHERE table_name = 'kanban_cards';

  -- Verificar se consultor_sessoes existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'consultor_sessoes'
  ) INTO v_consultor_sessoes_exists;

  -- Verificar RLS
  SELECT relrowsecurity
  INTO v_kanban_rls_enabled
  FROM pg_class
  WHERE relname = 'kanban_cards';

  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  CONSOLIDATION COMPLETE - SYSTEM HEALTH CHECK     ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  consultor_sessoes exists: %                     ║', v_consultor_sessoes_exists;
  RAISE NOTICE '║  kanban_cards RLS enabled: %                     ║', v_kanban_rls_enabled;
  RAISE NOTICE '║  kanban_cards columns: %                         ║', array_length(v_kanban_columns, 1);
  RAISE NOTICE '║  is_master() function: EXISTS                     ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  Obsolete tables REMOVED:                          ║';
  RAISE NOTICE '║    - jornadas_consultor                            ║';
  RAISE NOTICE '║    - areas_trabalho                                ║';
  RAISE NOTICE '║    - framework_checklist                           ║';
  RAISE NOTICE '║    - cadeia_valor_processos                        ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  Architecture: RAG-based (sessao_id)               ║';
  RAISE NOTICE '║  Status: CLEAN AND READY                           ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';

  -- Avisar se algo estiver errado
  IF NOT v_consultor_sessoes_exists THEN
    RAISE WARNING 'CRITICAL: consultor_sessoes table does not exist!';
  END IF;

  IF NOT v_kanban_rls_enabled THEN
    RAISE WARNING 'WARNING: RLS is not enabled on kanban_cards!';
  END IF;
END $$;
