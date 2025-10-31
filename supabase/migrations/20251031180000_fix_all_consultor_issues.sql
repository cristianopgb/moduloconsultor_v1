/*
  # FIX COMPLETO: Normalização de Todo o Sistema Consultor

  ## Problemas Corrigidos:
  1. Normalização de estado_atual (coleta → anamnese)
  2. Garantir coluna progresso existe e é atualizada
  3. Adicionar sessao_id em acoes_plano se não existir
  4. Corrigir estrutura de entregaveis_consultor
  5. Atualizar RLS policies para service role
  6. Criar trigger para auto-atualização de progresso

  ## Resultado Esperado:
  - estado_atual consistente em toda aplicação
  - Progresso visível e atualizado
  - Ações e Kanban funcionais
  - Entregáveis gerados corretamente
  - Timeline atualizada automaticamente
*/

-- ============================================================================
-- PART 1: NORMALIZAR estado_atual (coleta → anamnese)
-- ============================================================================

-- Atualizar sessões existentes que estão em 'coleta' para 'anamnese'
UPDATE consultor_sessoes
SET estado_atual = 'anamnese',
    updated_at = now()
WHERE estado_atual = 'coleta';

-- Criar constraint para validar estados permitidos
DO $$
BEGIN
  -- Remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'consultor_sessoes_estado_check'
    AND table_name = 'consultor_sessoes'
  ) THEN
    ALTER TABLE consultor_sessoes DROP CONSTRAINT consultor_sessoes_estado_check;
  END IF;

  -- Adicionar constraint com estados normalizados
  ALTER TABLE consultor_sessoes
  ADD CONSTRAINT consultor_sessoes_estado_check
  CHECK (estado_atual IN ('anamnese', 'mapeamento', 'investigacao', 'priorizacao', 'mapeamento_processos', 'diagnostico', 'execucao', 'concluido'));
END $$;

-- ============================================================================
-- PART 2: GARANTIR COLUNA PROGRESSO EXISTE
-- ============================================================================

DO $$
BEGIN
  -- Adicionar coluna progresso se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'progresso'
  ) THEN
    ALTER TABLE consultor_sessoes ADD COLUMN progresso integer DEFAULT 0;
    RAISE NOTICE 'Added progresso column to consultor_sessoes';
  END IF;
END $$;

-- Atualizar progresso baseado em estado_atual
UPDATE consultor_sessoes
SET progresso = CASE estado_atual
  WHEN 'anamnese' THEN 15
  WHEN 'mapeamento' THEN 30
  WHEN 'investigacao' THEN 45
  WHEN 'priorizacao' THEN 55
  WHEN 'mapeamento_processos' THEN 70
  WHEN 'diagnostico' THEN 85
  WHEN 'execucao' THEN 100
  WHEN 'concluido' THEN 100
  ELSE 0
END
WHERE progresso IS NULL OR progresso = 0;

-- ============================================================================
-- PART 3: GARANTIR sessao_id EM acoes_plano
-- ============================================================================

DO $$
BEGIN
  -- Adicionar sessao_id em acoes_plano se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'acoes_plano'
      AND column_name = 'sessao_id'
  ) THEN
    ALTER TABLE acoes_plano ADD COLUMN sessao_id uuid REFERENCES consultor_sessoes(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added sessao_id to acoes_plano';
  END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_acoes_plano_sessao_id ON acoes_plano(sessao_id);

-- ============================================================================
-- PART 4: GARANTIR ESTRUTURA CORRETA DE entregaveis_consultor
-- ============================================================================

-- Garantir colunas essenciais existem
DO $$
BEGIN
  -- nome
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entregaveis_consultor' AND column_name = 'nome'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN nome text;
  END IF;

  -- titulo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entregaveis_consultor' AND column_name = 'titulo'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN titulo text;
  END IF;

  -- tipo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entregaveis_consultor' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN tipo text DEFAULT 'html';
  END IF;

  -- conteudo_html
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entregaveis_consultor' AND column_name = 'conteudo_html'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN conteudo_html text;
  END IF;

  -- etapa_origem
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entregaveis_consultor' AND column_name = 'etapa_origem'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN etapa_origem text;
  END IF;

  -- visualizado
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entregaveis_consultor' AND column_name = 'visualizado'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN visualizado boolean DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- PART 5: ADICIONAR RLS POLICIES PARA SERVICE ROLE
-- ============================================================================

-- Service role pode tudo em consultor_sessoes
DROP POLICY IF EXISTS "Service role full access to consultor_sessoes" ON consultor_sessoes;
CREATE POLICY "Service role full access to consultor_sessoes"
  ON consultor_sessoes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role pode tudo em consultor_mensagens
DROP POLICY IF EXISTS "Service role full access to consultor_mensagens" ON consultor_mensagens;
CREATE POLICY "Service role full access to consultor_mensagens"
  ON consultor_mensagens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role pode tudo em entregaveis_consultor
DROP POLICY IF EXISTS "Service role full access to entregaveis_consultor" ON entregaveis_consultor;
CREATE POLICY "Service role full access to entregaveis_consultor"
  ON entregaveis_consultor FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role pode tudo em timeline_consultor
DROP POLICY IF EXISTS "Service role full access to timeline_consultor" ON timeline_consultor;
CREATE POLICY "Service role full access to timeline_consultor"
  ON timeline_consultor FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role pode tudo em acoes_plano
DROP POLICY IF EXISTS "Service role full access to acoes_plano" ON acoes_plano;
CREATE POLICY "Service role full access to acoes_plano"
  ON acoes_plano FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role pode tudo em kanban_cards
DROP POLICY IF EXISTS "Service role full access to kanban_cards" ON kanban_cards;
CREATE POLICY "Service role full access to kanban_cards"
  ON kanban_cards FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role pode tudo em gamificacao_consultor
DROP POLICY IF EXISTS "Service role full access to gamificacao_consultor" ON gamificacao_consultor;
CREATE POLICY "Service role full access to gamificacao_consultor"
  ON gamificacao_consultor FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 6: TRIGGER PARA AUTO-ATUALIZAÇÃO DE PROGRESSO
-- ============================================================================

-- Função para atualizar progresso quando estado_atual muda
CREATE OR REPLACE FUNCTION update_consultor_progresso()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar progresso baseado no novo estado
  NEW.progresso := CASE NEW.estado_atual
    WHEN 'anamnese' THEN 15
    WHEN 'mapeamento' THEN 30
    WHEN 'investigacao' THEN 45
    WHEN 'priorizacao' THEN 55
    WHEN 'mapeamento_processos' THEN 70
    WHEN 'diagnostico' THEN 85
    WHEN 'execucao' THEN 100
    WHEN 'concluido' THEN 100
    ELSE NEW.progresso
  END;

  -- Atualizar progresso no contexto_coleta também
  IF NEW.contexto_coleta IS NOT NULL THEN
    NEW.contexto_coleta := NEW.contexto_coleta || jsonb_build_object('progresso', NEW.progresso);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_update_consultor_progresso ON consultor_sessoes;
CREATE TRIGGER trigger_update_consultor_progresso
  BEFORE UPDATE OF estado_atual ON consultor_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION update_consultor_progresso();

-- ============================================================================
-- PART 7: ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices para consultor_sessoes
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_estado_atual ON consultor_sessoes(estado_atual);
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_user_id ON consultor_sessoes(user_id);
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_conversation_id ON consultor_sessoes(conversation_id);

-- Índices para entregaveis_consultor
CREATE INDEX IF NOT EXISTS idx_entregaveis_sessao_id ON entregaveis_consultor(sessao_id);
CREATE INDEX IF NOT EXISTS idx_entregaveis_etapa_origem ON entregaveis_consultor(etapa_origem);

-- Índices para timeline_consultor
CREATE INDEX IF NOT EXISTS idx_timeline_sessao_id ON timeline_consultor(sessao_id);
CREATE INDEX IF NOT EXISTS idx_timeline_fase ON timeline_consultor(fase);

-- ============================================================================
-- PART 8: LIMPEZA DE DADOS INCONSISTENTES
-- ============================================================================

-- Limpar entregáveis sem sessao_id (órfãos)
DELETE FROM entregaveis_consultor
WHERE sessao_id IS NULL;

-- Limpar mensagens de sessões que não existem mais
DELETE FROM consultor_mensagens
WHERE sessao_id NOT IN (SELECT id FROM consultor_sessoes);

-- Limpar timeline de sessões que não existem mais
DELETE FROM timeline_consultor
WHERE sessao_id NOT IN (SELECT id FROM consultor_sessoes);

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Log de resultados
DO $$
DECLARE
  sessoes_count integer;
  mensagens_count integer;
  entregaveis_count integer;
BEGIN
  SELECT COUNT(*) INTO sessoes_count FROM consultor_sessoes;
  SELECT COUNT(*) INTO mensagens_count FROM consultor_mensagens;
  SELECT COUNT(*) INTO entregaveis_count FROM entregaveis_consultor;

  RAISE NOTICE '✅ Migration completed successfully';
  RAISE NOTICE '   - Sessões: %', sessoes_count;
  RAISE NOTICE '   - Mensagens: %', mensagens_count;
  RAISE NOTICE '   - Entregáveis: %', entregaveis_count;
END $$;
