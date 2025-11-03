/*
  # Correção Completa do Sistema Consultor RAG

  ## Problemas Corrigidos

  1. **Loop de Priorização**
     - Garantir que coluna `aguardando_validacao` existe e funciona corretamente
     - Adicionar índices para performance

  2. **Entregáveis Invisíveis**
     - Garantir que `jornada_id` está sempre populado
     - Corrigir semântica do campo `tipo` (tipo de documento, não formato)
     - Adicionar campo `formato` para distinguir (html, pdf, etc.)

  3. **Timeline não Atualiza**
     - Verificar schema correto da tabela `timeline_consultor`
     - Garantir coluna `tipo_evento` (não `evento`)
     - Garantir coluna `detalhe` é jsonb (não text)

  ## Data
  03 de Novembro de 2025

  ## Changelog
  - Fix #1: aguardando_validacao agora é setada imediatamente quando escopo é definido
  - Fix #2: jornada_id sempre incluído em inserts de entregaveis
  - Fix #3: campo tipo agora contém tipo de documento (canvas, matriz, etc)
  - Fix #4: timeline com schema validado e consistente
*/

-- ============================================================================
-- 1. VERIFICAR E CORRIGIR SCHEMA DE consultor_sessoes
-- ============================================================================

-- Garantir que coluna aguardando_validacao existe e é do tipo correto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'aguardando_validacao'
  ) THEN
    ALTER TABLE consultor_sessoes
    ADD COLUMN aguardando_validacao text NULL;

    COMMENT ON COLUMN consultor_sessoes.aguardando_validacao IS
    'Flag que indica se sessão está aguardando validação do usuário. Valores: escopo, diagnostico, null';
  END IF;
END $$;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_aguardando_validacao
ON consultor_sessoes(aguardando_validacao)
WHERE aguardando_validacao IS NOT NULL;

-- ============================================================================
-- 2. VERIFICAR E CORRIGIR SCHEMA DE entregaveis_consultor
-- ============================================================================

-- Garantir que jornada_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entregaveis_consultor'
      AND column_name = 'jornada_id'
  ) THEN
    ALTER TABLE entregaveis_consultor
    ADD COLUMN jornada_id uuid REFERENCES jornadas_consultor(id) ON DELETE CASCADE;

    COMMENT ON COLUMN entregaveis_consultor.jornada_id IS
    'Referência à jornada. Essencial para filtros em painéis.';
  END IF;
END $$;

-- Backfill: popular jornada_id onde está null mas existe sessao_id
UPDATE entregaveis_consultor e
SET jornada_id = s.jornada_id
FROM consultor_sessoes s
WHERE e.jornada_id IS NULL
  AND e.sessao_id = s.id
  AND s.jornada_id IS NOT NULL;

-- Adicionar campo formato (opcional) para distinguir de tipo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entregaveis_consultor'
      AND column_name = 'formato'
  ) THEN
    ALTER TABLE entregaveis_consultor
    ADD COLUMN formato text DEFAULT 'html';

    COMMENT ON COLUMN entregaveis_consultor.formato IS
    'Formato do arquivo: html, pdf, docx, etc. Campo tipo contém o tipo de documento (canvas, matriz, etc).';
  END IF;
END $$;

-- Atualizar formato baseado em registros existentes
UPDATE entregaveis_consultor
SET formato = CASE
  WHEN tipo = 'html' THEN 'html'
  WHEN html_conteudo IS NOT NULL AND html_conteudo != '' THEN 'html'
  ELSE 'html'
END
WHERE formato IS NULL;

-- Atualizar tipo para refletir tipo de documento (não formato)
-- Apenas se tipo estiver como 'html' e nome tiver o tipo real
UPDATE entregaveis_consultor
SET tipo = nome
WHERE tipo = 'html'
  AND nome IN ('anamnese_empresarial', 'canvas', 'cadeia_valor', 'matriz_priorizacao',
               'escopo', 'sipoc', 'bpmn_as_is', 'diagnostico', 'plano_acao');

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_entregaveis_jornada_id
ON entregaveis_consultor(jornada_id)
WHERE jornada_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entregaveis_tipo
ON entregaveis_consultor(tipo);

CREATE INDEX IF NOT EXISTS idx_entregaveis_sessao_jornada
ON entregaveis_consultor(sessao_id, jornada_id);

-- ============================================================================
-- 3. VERIFICAR E CORRIGIR SCHEMA DE timeline_consultor
-- ============================================================================

-- Verificar se coluna tipo_evento existe (não evento)
DO $$
BEGIN
  -- Se existe coluna 'evento', renomear para 'tipo_evento'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timeline_consultor'
      AND column_name = 'evento'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timeline_consultor'
      AND column_name = 'tipo_evento'
  ) THEN
    ALTER TABLE timeline_consultor
    RENAME COLUMN evento TO tipo_evento;
  END IF;
END $$;

-- Garantir que tipo_evento existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timeline_consultor'
      AND column_name = 'tipo_evento'
  ) THEN
    ALTER TABLE timeline_consultor
    ADD COLUMN tipo_evento text NOT NULL DEFAULT 'interacao';
  END IF;
END $$;

-- Garantir que detalhe é jsonb (não text)
DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'timeline_consultor'
    AND column_name = 'detalhe';

  IF current_type = 'text' THEN
    -- Converter text para jsonb
    ALTER TABLE timeline_consultor
    ALTER COLUMN detalhe TYPE jsonb
    USING CASE
      WHEN detalhe IS NULL OR detalhe = '' THEN '{}'::jsonb
      WHEN detalhe::text ~ '^\{.*\}$' THEN detalhe::jsonb
      ELSE json_build_object('texto', detalhe)::jsonb
    END;
  ELSIF current_type IS NULL THEN
    -- Coluna não existe, criar
    ALTER TABLE timeline_consultor
    ADD COLUMN detalhe jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Garantir que sessao_id existe na timeline
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timeline_consultor'
      AND column_name = 'sessao_id'
  ) THEN
    ALTER TABLE timeline_consultor
    ADD COLUMN sessao_id uuid REFERENCES consultor_sessoes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_timeline_jornada_timestamp
ON timeline_consultor(jornada_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_timeline_sessao_timestamp
ON timeline_consultor(sessao_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_timeline_fase
ON timeline_consultor(fase);

-- ============================================================================
-- 4. VALIDAÇÃO E COMENTÁRIOS
-- ============================================================================

-- Adicionar comentários úteis
COMMENT ON TABLE consultor_sessoes IS
'Sessões individuais de consultoria dentro de uma jornada. Cada sessão tem um foco específico (problema/projeto).';

COMMENT ON TABLE entregaveis_consultor IS
'Documentos e entregáveis gerados durante a consultoria (Canvas, BPMN, Diagnósticos, etc).';

COMMENT ON TABLE timeline_consultor IS
'Histórico cronológico de eventos e marcos importantes da consultoria.';

-- Adicionar constraint para validar valores de aguardando_validacao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consultor_sessoes_aguardando_validacao_check'
  ) THEN
    ALTER TABLE consultor_sessoes
    ADD CONSTRAINT consultor_sessoes_aguardando_validacao_check
    CHECK (aguardando_validacao IN ('escopo', 'diagnostico', 'plano_acao') OR aguardando_validacao IS NULL);
  END IF;
END $$;

-- ============================================================================
-- 5. LIMPEZA DE DADOS INCONSISTENTES
-- ============================================================================

-- Limpar sessões órfãs (sem jornada e antigas)
DELETE FROM consultor_sessoes
WHERE jornada_id IS NULL
  AND created_at < NOW() - INTERVAL '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM entregaveis_consultor e
    WHERE e.sessao_id = consultor_sessoes.id
  );

-- Resetar flags de validação travadas (mais de 48h)
UPDATE consultor_sessoes
SET aguardando_validacao = NULL
WHERE aguardando_validacao IS NOT NULL
  AND updated_at < NOW() - INTERVAL '48 hours';

-- ============================================================================
-- 6. TRIGGERS PARA MANUTENÇÃO AUTOMÁTICA
-- ============================================================================

-- Trigger para auto-popular jornada_id em entregaveis quando inserido
CREATE OR REPLACE FUNCTION auto_populate_jornada_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se jornada_id não foi fornecido mas sessao_id sim, buscar automaticamente
  IF NEW.jornada_id IS NULL AND NEW.sessao_id IS NOT NULL THEN
    SELECT jornada_id INTO NEW.jornada_id
    FROM consultor_sessoes
    WHERE id = NEW.sessao_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_populate_jornada_id ON entregaveis_consultor;
CREATE TRIGGER trigger_auto_populate_jornada_id
  BEFORE INSERT ON entregaveis_consultor
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_jornada_id();

-- ============================================================================
-- 7. VIEWS ÚTEIS PARA DEBUG
-- ============================================================================

-- View para debug de entregaveis
CREATE OR REPLACE VIEW v_entregaveis_debug AS
SELECT
  e.id,
  e.nome,
  e.tipo,
  e.formato,
  e.titulo,
  e.sessao_id,
  e.jornada_id,
  e.etapa_origem,
  e.visualizado,
  e.created_at,
  s.estado_atual as sessao_estado,
  s.progresso as sessao_progresso,
  j.etapa_atual as jornada_etapa,
  CASE
    WHEN e.jornada_id IS NULL THEN '❌ SEM JORNADA'
    WHEN e.tipo = 'html' AND e.nome != 'html' THEN '⚠️ TIPO INCORRETO'
    ELSE '✅ OK'
  END as status_validacao
FROM entregaveis_consultor e
LEFT JOIN consultor_sessoes s ON e.sessao_id = s.id
LEFT JOIN jornadas_consultor j ON e.jornada_id = j.id
ORDER BY e.created_at DESC;

-- View para debug de timeline
CREATE OR REPLACE VIEW v_timeline_debug AS
SELECT
  t.id,
  t.jornada_id,
  t.sessao_id,
  t.fase,
  t.tipo_evento,
  t.detalhe,
  t.timestamp,
  s.estado_atual as sessao_estado,
  CASE
    WHEN t.sessao_id IS NULL THEN '❌ SEM SESSAO'
    WHEN t.jornada_id IS NULL THEN '⚠️ SEM JORNADA'
    ELSE '✅ OK'
  END as status_validacao
FROM timeline_consultor t
LEFT JOIN consultor_sessoes s ON t.sessao_id = s.id
ORDER BY t.timestamp DESC;

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================

-- Log de conclusão
DO $$
BEGIN
  RAISE NOTICE '✅ Migração 20251103000000_fix_consultor_rag_issues aplicada com sucesso!';
  RAISE NOTICE '📊 Verificar views: v_entregaveis_debug, v_timeline_debug';
  RAISE NOTICE '🔧 Triggers ativos: trigger_auto_populate_jornada_id';
END $$;
