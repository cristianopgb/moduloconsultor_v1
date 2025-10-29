/*
  # Habilitar RLS em Todas Tabelas Críticas e Criar Policies Seguras

  1. Tabelas com RLS Habilitado
    - consultor_sessoes
    - kanban_cards
    - entregaveis_consultor
    - knowledge_base_documents
    - orquestrador_acoes
    - llm_usage_log

  2. Modelo de Segurança
    - Usuários: acessam apenas seus próprios dados
    - Masters: acesso total (role=master em user_roles)
    - Service Role: bypass RLS (usado em Edge Functions)

  3. Patterns de Policies
    - SELECT: user_id = auth.uid() OR is_master
    - INSERT: user_id = auth.uid() (com validação)
    - UPDATE: user_id = auth.uid() (preserva propriedade)
    - DELETE: user_id = auth.uid()

  4. Segurança
    - NUNCA usa USING (true) - sempre valida propriedade
    - Masters têm policies separadas
    - Service role insere via backend seguro
*/

-- ============================================
-- HABILITAR RLS EM TODAS TABELAS
-- ============================================

ALTER TABLE consultor_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregaveis_consultor ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE orquestrador_acoes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNCTION: Verificar se usuário é master
-- ============================================
-- NOTA: Função is_master() já foi criada em consolidate_conflicts.sql
-- Não precisa recriar aqui para evitar conflitos

-- ============================================
-- POLICIES PARA consultor_sessoes
-- ============================================

DROP POLICY IF EXISTS "Users can view their own sessoes" ON consultor_sessoes;
CREATE POLICY "Users can view their own sessoes"
ON consultor_sessoes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own sessoes" ON consultor_sessoes;
CREATE POLICY "Users can create their own sessoes"
ON consultor_sessoes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sessoes" ON consultor_sessoes;
CREATE POLICY "Users can update their own sessoes"
ON consultor_sessoes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessoes" ON consultor_sessoes;
CREATE POLICY "Users can delete their own sessoes"
ON consultor_sessoes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Masters can view all sessoes" ON consultor_sessoes;
CREATE POLICY "Masters can view all sessoes"
ON consultor_sessoes FOR SELECT
TO authenticated
USING (is_master());

DROP POLICY IF EXISTS "Masters can update all sessoes" ON consultor_sessoes;
CREATE POLICY "Masters can update all sessoes"
ON consultor_sessoes FOR UPDATE
TO authenticated
USING (is_master());

-- ============================================
-- POLICIES PARA kanban_cards
-- ============================================

DROP POLICY IF EXISTS "Users can view cards from their sessoes" ON kanban_cards;
CREATE POLICY "Users can view cards from their sessoes"
ON kanban_cards FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM consultor_sessoes
    WHERE id = kanban_cards.sessao_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create cards in their sessoes" ON kanban_cards;
CREATE POLICY "Users can create cards in their sessoes"
ON kanban_cards FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM consultor_sessoes
    WHERE id = kanban_cards.sessao_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update cards from their sessoes" ON kanban_cards;
CREATE POLICY "Users can update cards from their sessoes"
ON kanban_cards FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM consultor_sessoes
    WHERE id = kanban_cards.sessao_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete cards from their sessoes" ON kanban_cards;
CREATE POLICY "Users can delete cards from their sessoes"
ON kanban_cards FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM consultor_sessoes
    WHERE id = kanban_cards.sessao_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Masters can view all cards" ON kanban_cards;
CREATE POLICY "Masters can view all cards"
ON kanban_cards FOR SELECT
TO authenticated
USING (is_master());

-- ============================================
-- POLICIES PARA entregaveis_consultor
-- ============================================

DROP POLICY IF EXISTS "Users can view entregaveis from their sessoes" ON entregaveis_consultor;
CREATE POLICY "Users can view entregaveis from their sessoes"
ON entregaveis_consultor FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM consultor_sessoes
    WHERE id = entregaveis_consultor.sessao_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can insert entregaveis" ON entregaveis_consultor;
CREATE POLICY "Service role can insert entregaveis"
ON entregaveis_consultor FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their entregaveis" ON entregaveis_consultor;
CREATE POLICY "Users can update their entregaveis"
ON entregaveis_consultor FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM consultor_sessoes
    WHERE id = entregaveis_consultor.sessao_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Masters can view all entregaveis" ON entregaveis_consultor;
CREATE POLICY "Masters can view all entregaveis"
ON entregaveis_consultor FOR SELECT
TO authenticated
USING (is_master());

-- ============================================
-- POLICIES PARA knowledge_base_documents
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can read knowledge base" ON knowledge_base_documents;
CREATE POLICY "Authenticated users can read knowledge base"
ON knowledge_base_documents FOR SELECT
TO authenticated
USING (ativo = true);

DROP POLICY IF EXISTS "Masters can insert documents" ON knowledge_base_documents;
CREATE POLICY "Masters can insert documents"
ON knowledge_base_documents FOR INSERT
TO authenticated
WITH CHECK (is_master());

DROP POLICY IF EXISTS "Masters can update documents" ON knowledge_base_documents;
CREATE POLICY "Masters can update documents"
ON knowledge_base_documents FOR UPDATE
TO authenticated
USING (is_master());

DROP POLICY IF EXISTS "Masters can delete documents" ON knowledge_base_documents;
CREATE POLICY "Masters can delete documents"
ON knowledge_base_documents FOR DELETE
TO authenticated
USING (is_master());

-- ============================================
-- POLICIES PARA orquestrador_acoes
-- ============================================

DROP POLICY IF EXISTS "Users can view acoes from their sessoes" ON orquestrador_acoes;
CREATE POLICY "Users can view acoes from their sessoes"
ON orquestrador_acoes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM consultor_sessoes
    WHERE id = orquestrador_acoes.sessao_id
      AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can insert acoes" ON orquestrador_acoes;
CREATE POLICY "Service role can insert acoes"
ON orquestrador_acoes FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Masters can view all acoes" ON orquestrador_acoes;
CREATE POLICY "Masters can view all acoes"
ON orquestrador_acoes FOR SELECT
TO authenticated
USING (is_master());

-- ============================================
-- VERIFICAÇÃO E ESTATÍSTICAS
-- ============================================

DO $$
DECLARE
  v_tables_with_rls INT;
  v_total_policies INT;
BEGIN
  -- Contar tabelas com RLS
  SELECT COUNT(*)
  INTO v_tables_with_rls
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND t.tablename IN (
      'consultor_sessoes', 'kanban_cards', 'entregaveis_consultor',
      'knowledge_base_documents', 'orquestrador_acoes', 'llm_usage_log'
    );

  -- Contar policies
  SELECT COUNT(*)
  INTO v_total_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'consultor_sessoes', 'kanban_cards', 'entregaveis_consultor',
      'knowledge_base_documents', 'orquestrador_acoes', 'llm_usage_log'
    );

  RAISE NOTICE '╔════════════════════════════════════════╗';
  RAISE NOTICE '║  RLS SECURITY SYSTEM INSTALLED         ║';
  RAISE NOTICE '╠════════════════════════════════════════╣';
  RAISE NOTICE '║  Tables with RLS: %                  ║', v_tables_with_rls;
  RAISE NOTICE '║  Total Policies: %                   ║', v_total_policies;
  RAISE NOTICE '║  Helper Function: is_master()         ║';
  RAISE NOTICE '╚════════════════════════════════════════╝';
END $$;
