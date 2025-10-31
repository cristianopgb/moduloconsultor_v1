/*
  # Refatoração Completa do Módulo Consultor - Schema Consolidado

  ## Objetivo
  Criar um sistema simples e funcional de consultoria conversacional com:
  1. Sessões de consultoria persistentes
  2. Histórico completo de mensagens
  3. Contexto acumulado progressivamente
  4. Documentos gerados sob demanda

  ## Arquitetura Simplificada
  - consultor_sessoes: sessão principal com estado e contexto
  - consultor_mensagens: histórico completo de conversação
  - entregaveis_consultor: documentos gerados (já existe)

  ## Mudanças
  1. Criar tabela consultor_mensagens para histórico persistente
  2. Adicionar índices para performance
  3. Simplificar RLS policies
  4. Remover dependências de tabelas obsoletas
*/

-- ============================================
-- PART 1: CRIAR TABELA DE MENSAGENS
-- ============================================

CREATE TABLE IF NOT EXISTS consultor_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid REFERENCES consultor_sessoes(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_consultor_mensagens_sessao
  ON consultor_mensagens(sessao_id, created_at);

CREATE INDEX IF NOT EXISTS idx_consultor_mensagens_role
  ON consultor_mensagens(role);

-- ============================================
-- PART 2: GARANTIR CAMPOS ESSENCIAIS
-- ============================================

-- Garantir que contexto_coleta existe (foi adicionado em migration anterior)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'contexto_coleta'
  ) THEN
    ALTER TABLE consultor_sessoes
    ADD COLUMN contexto_coleta jsonb DEFAULT '{}'::jsonb;

    RAISE NOTICE 'Added contexto_coleta to consultor_sessoes';
  END IF;
END $$;

-- ============================================
-- PART 3: RLS POLICIES
-- ============================================

-- Enable RLS on mensagens
ALTER TABLE consultor_mensagens ENABLE ROW LEVEL SECURITY;

-- Users can view messages from their own sessions
DROP POLICY IF EXISTS "Users can view own consultor messages" ON consultor_mensagens;
CREATE POLICY "Users can view own consultor messages"
  ON consultor_mensagens FOR SELECT
  TO authenticated
  USING (
    sessao_id IN (
      SELECT id FROM consultor_sessoes WHERE user_id = auth.uid()
    )
  );

-- Users can insert messages to their own sessions
DROP POLICY IF EXISTS "Users can insert messages to own sessions" ON consultor_mensagens;
CREATE POLICY "Users can insert messages to own sessions"
  ON consultor_mensagens FOR INSERT
  TO authenticated
  WITH CHECK (
    sessao_id IN (
      SELECT id FROM consultor_sessoes WHERE user_id = auth.uid()
    )
  );

-- Service role can view all messages (for admin/support)
-- Note: Regular users can only see their own messages via first policy

-- ============================================
-- PART 4: LIMPEZA DE REFERÊNCIAS OBSOLETAS
-- ============================================

-- Remover constraint de jornada_id se existir em entregaveis_consultor
-- (jornada_id ainda existe para compatibilidade mas não é mais obrigatório)
DO $$
BEGIN
  -- Make jornada_id nullable if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entregaveis_consultor'
      AND column_name = 'jornada_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE entregaveis_consultor
    ALTER COLUMN jornada_id DROP NOT NULL;

    RAISE NOTICE 'Made jornada_id nullable in entregaveis_consultor';
  END IF;
END $$;

-- ============================================
-- PART 5: HELPER FUNCTIONS
-- ============================================

-- Function to get message history for a session
CREATE OR REPLACE FUNCTION get_consultor_history(p_sessao_id uuid)
RETURNS TABLE (
  role text,
  content text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.role, m.content, m.created_at
  FROM consultor_mensagens m
  WHERE m.sessao_id = p_sessao_id
  ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add message to session
CREATE OR REPLACE FUNCTION add_consultor_message(
  p_sessao_id uuid,
  p_role text,
  p_content text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_message_id uuid;
BEGIN
  INSERT INTO consultor_mensagens (sessao_id, role, content, metadata)
  VALUES (p_sessao_id, p_role, p_content, p_metadata)
  RETURNING id INTO v_message_id;

  -- Update session updated_at
  UPDATE consultor_sessoes
  SET updated_at = now()
  WHERE id = p_sessao_id;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 6: COMMENTS
-- ============================================

COMMENT ON TABLE consultor_mensagens IS
'Histórico completo de mensagens das sessões de consultoria. Permite reconstruir contexto completo da conversa.';

COMMENT ON COLUMN consultor_mensagens.role IS
'Papel da mensagem: system (instruções), user (cliente), assistant (consultor IA)';

COMMENT ON COLUMN consultor_mensagens.metadata IS
'Metadados adicionais: tokens usados, modelo, temperatura, etc.';

COMMENT ON FUNCTION get_consultor_history IS
'Retorna histórico ordenado de mensagens de uma sessão para enviar à LLM';

COMMENT ON FUNCTION add_consultor_message IS
'Adiciona nova mensagem ao histórico e atualiza timestamp da sessão';

-- ============================================
-- PART 7: VERIFICATION
-- ============================================

DO $$
DECLARE
  v_mensagens_exists BOOLEAN;
  v_mensagens_rls BOOLEAN;
  v_sessoes_has_contexto BOOLEAN;
  v_message_count BIGINT;
BEGIN
  -- Check if mensagens table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'consultor_mensagens'
  ) INTO v_mensagens_exists;

  -- Check RLS
  SELECT relrowsecurity INTO v_mensagens_rls
  FROM pg_class
  WHERE relname = 'consultor_mensagens';

  -- Check contexto_coleta column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'contexto_coleta'
  ) INTO v_sessoes_has_contexto;

  -- Count existing messages
  SELECT COUNT(*) INTO v_message_count
  FROM consultor_mensagens;

  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  CONSULTOR REFACTOR - VERIFICATION                ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  consultor_mensagens created: %                  ║',
    CASE WHEN v_mensagens_exists THEN '✓' ELSE '✗' END;
  RAISE NOTICE '║  RLS enabled on mensagens: %                     ║',
    CASE WHEN v_mensagens_rls THEN '✓' ELSE '✗' END;
  RAISE NOTICE '║  contexto_coleta in sessoes: %                   ║',
    CASE WHEN v_sessoes_has_contexto THEN '✓' ELSE '✗' END;
  RAISE NOTICE '║  Existing messages: %                            ║', v_message_count;
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  Architecture: SIMPLIFIED                          ║';
  RAISE NOTICE '║  - consultor_sessoes (state + context)            ║';
  RAISE NOTICE '║  - consultor_mensagens (full history)             ║';
  RAISE NOTICE '║  - entregaveis_consultor (documents)              ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  Helper Functions:                                 ║';
  RAISE NOTICE '║  - get_consultor_history(sessao_id)               ║';
  RAISE NOTICE '║  - add_consultor_message(...)                     ║';
  RAISE NOTICE '╠════════════════════════════════════════════════════╣';
  RAISE NOTICE '║  Status: READY FOR REFACTORED EDGE FUNCTION       ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';

  IF NOT v_mensagens_exists THEN
    RAISE EXCEPTION 'CRITICAL: consultor_mensagens table was not created!';
  END IF;

  IF NOT v_mensagens_rls THEN
    RAISE WARNING 'WARNING: RLS not enabled on consultor_mensagens!';
  END IF;
END $$;
