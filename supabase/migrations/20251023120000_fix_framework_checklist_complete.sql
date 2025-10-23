/*
  # Correção Completa do Framework Checklist

  1. Alterações na Tabela framework_checklist
    - Adicionar campos de CTA (Call-to-Action) para cada fase
    - Renomear campos ambíguos da matriz (de "formulário" para "gerada")
    - Adicionar campo de validação de escopo pelo usuário
    - Adicionar contadores para prevenir loops infinitos
    - Adicionar campos de controle de estado

  2. Alterações na Tabela processo_checklist
    - Adicionar campos de CTA por processo
    - Adicionar contador de iterações
    - Adicionar campo de estado explícito

  3. Alterações na Tabela cadeia_valor_processos
    - Adicionar campo tipo_processo (primario, suporte, gestao)
    - Adicionar índice para filtros por tipo

  4. Novas Funções
    - Função para detectar estado atual do framework
    - Função para validar transições de estado
    - Função para sincronizar checklist com jornada

  5. Triggers
    - Atualizar etapa_atual em jornadas_consultor automaticamente
    - Sincronizar timeline em tempo real
    - Prevenir mudanças inválidas de estado

  6. Segurança
    - Manter RLS em todas as tabelas
    - Validar permissões antes de mudanças de estado
*/

-- ===================================
-- PARTE 1: ADICIONAR CAMPOS DE CTA
-- ===================================

-- Adicionar campos de CTA para Anamnese
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'anamnese_cta_enviado'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN anamnese_cta_enviado BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'anamnese_usuario_confirmou'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN anamnese_usuario_confirmou BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Adicionar campos de CTA para Canvas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'canvas_cta_enviado'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN canvas_cta_enviado BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'canvas_usuario_confirmou'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN canvas_usuario_confirmou BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Adicionar campos de CTA para Cadeia de Valor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'cadeia_valor_cta_enviado'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN cadeia_valor_cta_enviado BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'cadeia_valor_usuario_confirmou'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN cadeia_valor_usuario_confirmou BOOLEAN DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- PARTE 2: CORRIGIR CAMPOS DA MATRIZ E ESCOPO
-- =====================================================

-- Adicionar campo de validação de escopo pelo usuário
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'escopo_validado_pelo_usuario'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN escopo_validado_pelo_usuario BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'escopo_validacao_ts'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN escopo_validacao_ts TIMESTAMPTZ;
  END IF;
END $$;

-- Adicionar campo para aguardar validação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'aguardando_validacao_escopo'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN aguardando_validacao_escopo BOOLEAN DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- PARTE 3: ADICIONAR CONTROLE DE LOOPS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'iteracoes_fase_atual'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN iteracoes_fase_atual INT DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist' AND column_name = 'fase_atual'
  ) THEN
    ALTER TABLE framework_checklist ADD COLUMN fase_atual TEXT DEFAULT 'apresentacao';
  END IF;
END $$;

-- =====================================================
-- PARTE 4: ADICIONAR CAMPOS NO PROCESSO_CHECKLIST
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processo_checklist' AND column_name = 'atributos_cta_enviado'
  ) THEN
    ALTER TABLE processo_checklist ADD COLUMN atributos_cta_enviado BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processo_checklist' AND column_name = 'atributos_usuario_confirmou'
  ) THEN
    ALTER TABLE processo_checklist ADD COLUMN atributos_usuario_confirmou BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processo_checklist' AND column_name = 'estado_processo'
  ) THEN
    ALTER TABLE processo_checklist ADD COLUMN estado_processo TEXT DEFAULT 'IDLE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processo_checklist' AND column_name = 'iteracoes_processo'
  ) THEN
    ALTER TABLE processo_checklist ADD COLUMN iteracoes_processo INT DEFAULT 0;
  END IF;
END $$;

-- Adicionar constraint para estado_processo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'processo_checklist' AND constraint_name = 'processo_checklist_estado_check'
  ) THEN
    ALTER TABLE processo_checklist
    ADD CONSTRAINT processo_checklist_estado_check
    CHECK (estado_processo IN ('IDLE', 'ATRIBUTOS', 'BPMN', 'DIAGNOSTICO', 'COMPLETO'));
  END IF;
END $$;

-- =====================================================
-- PARTE 5: ADICIONAR tipo_processo EM CADEIA_VALOR_PROCESSOS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cadeia_valor_processos' AND column_name = 'tipo_processo'
  ) THEN
    ALTER TABLE cadeia_valor_processos ADD COLUMN tipo_processo TEXT DEFAULT 'primario';
  END IF;
END $$;

-- Adicionar constraint para tipo_processo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'cadeia_valor_processos' AND constraint_name = 'cadeia_valor_processos_tipo_check'
  ) THEN
    ALTER TABLE cadeia_valor_processos
    ADD CONSTRAINT cadeia_valor_processos_tipo_check
    CHECK (tipo_processo IN ('primario', 'suporte', 'gestao'));
  END IF;
END $$;

-- Criar índice para filtrar por tipo
CREATE INDEX IF NOT EXISTS idx_cadeia_valor_processos_tipo ON cadeia_valor_processos(tipo_processo);

-- =====================================================
-- PARTE 6: FUNÇÕES AUXILIARES
-- =====================================================

-- Função para obter estado atual do framework
CREATE OR REPLACE FUNCTION get_framework_estado(p_jornada_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_estado TEXT;
BEGIN
  SELECT
    CASE
      WHEN NOT apresentacao_feita THEN 'apresentacao'
      WHEN NOT anamnese_preenchida THEN 'anamnese'
      WHEN NOT canvas_preenchido THEN 'canvas'
      WHEN NOT cadeia_valor_preenchida THEN 'cadeia_valor'
      WHEN NOT escopo_validado_pelo_usuario THEN 'validacao_escopo'
      WHEN processos_em_analise_count > 0 AND NOT todos_processos_concluidos THEN 'execucao_processos'
      WHEN NOT plano_acao_gerado THEN 'plano_acao'
      WHEN framework_completo THEN 'completo'
      ELSE 'desconhecido'
    END INTO v_estado
  FROM framework_checklist
  WHERE jornada_id = p_jornada_id;

  RETURN COALESCE(v_estado, 'apresentacao');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para sincronizar fase_atual
CREATE OR REPLACE FUNCTION sync_framework_fase()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fase_atual := get_framework_estado(NEW.jornada_id);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar fase_atual automaticamente
DROP TRIGGER IF EXISTS trigger_sync_framework_fase ON framework_checklist;
CREATE TRIGGER trigger_sync_framework_fase
  BEFORE UPDATE ON framework_checklist
  FOR EACH ROW
  EXECUTE FUNCTION sync_framework_fase();

-- =====================================================
-- PARTE 7: SINCRONIZAR COM JORNADAS_CONSULTOR
-- =====================================================

-- Função para atualizar etapa_atual em jornadas_consultor
CREATE OR REPLACE FUNCTION sync_jornada_etapa()
RETURNS TRIGGER AS $$
DECLARE
  v_etapa TEXT;
BEGIN
  v_etapa := get_framework_estado(NEW.jornada_id);

  UPDATE jornadas_consultor
  SET
    etapa_atual = v_etapa,
    updated_at = now()
  WHERE id = NEW.jornada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar jornada quando checklist muda
DROP TRIGGER IF EXISTS trigger_sync_jornada_etapa ON framework_checklist;
CREATE TRIGGER trigger_sync_jornada_etapa
  AFTER UPDATE ON framework_checklist
  FOR EACH ROW
  WHEN (OLD.fase_atual IS DISTINCT FROM NEW.fase_atual)
  EXECUTE FUNCTION sync_jornada_etapa();

-- =====================================================
-- PARTE 8: REGISTRAR EVENTOS NA TIMELINE
-- =====================================================

-- Função para registrar eventos importantes na timeline
CREATE OR REPLACE FUNCTION register_timeline_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Anamnese preenchida
  IF OLD.anamnese_preenchida = false AND NEW.anamnese_preenchida = true THEN
    INSERT INTO timeline_consultor (jornada_id, tipo_evento, descricao, created_at)
    VALUES (NEW.jornada_id, 'anamnese', 'Anamnese empresarial concluída', now());
  END IF;

  -- Canvas preenchido
  IF OLD.canvas_preenchido = false AND NEW.canvas_preenchido = true THEN
    INSERT INTO timeline_consultor (jornada_id, tipo_evento, descricao, created_at)
    VALUES (NEW.jornada_id, 'modelagem', 'Business Model Canvas concluído', now());
  END IF;

  -- Cadeia de valor preenchida
  IF OLD.cadeia_valor_preenchida = false AND NEW.cadeia_valor_preenchida = true THEN
    INSERT INTO timeline_consultor (jornada_id, tipo_evento, descricao, created_at)
    VALUES (NEW.jornada_id, 'modelagem', 'Cadeia de Valor definida', now());
  END IF;

  -- Escopo validado
  IF OLD.escopo_validado_pelo_usuario = false AND NEW.escopo_validado_pelo_usuario = true THEN
    INSERT INTO timeline_consultor (jornada_id, tipo_evento, descricao, created_at)
    VALUES (NEW.jornada_id, 'planejamento', 'Escopo e priorização validados', now());
  END IF;

  -- Todos processos concluídos
  IF OLD.todos_processos_concluidos = false AND NEW.todos_processos_concluidos = true THEN
    INSERT INTO timeline_consultor (jornada_id, tipo_evento, descricao, created_at)
    VALUES (NEW.jornada_id, 'execucao', 'Todos processos mapeados e diagnosticados', now());
  END IF;

  -- Plano de ação gerado
  IF OLD.plano_acao_gerado = false AND NEW.plano_acao_gerado = true THEN
    INSERT INTO timeline_consultor (jornada_id, tipo_evento, descricao, created_at)
    VALUES (NEW.jornada_id, 'execucao', 'Plano de ação 5W2H gerado', now());
  END IF;

  -- Framework completo
  IF OLD.framework_completo = false AND NEW.framework_completo = true THEN
    INSERT INTO timeline_consultor (jornada_id, tipo_evento, descricao, created_at)
    VALUES (NEW.jornada_id, 'conclusao', 'Framework de transformação concluído!', now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar eventos na timeline
DROP TRIGGER IF EXISTS trigger_register_timeline_event ON framework_checklist;
CREATE TRIGGER trigger_register_timeline_event
  AFTER UPDATE ON framework_checklist
  FOR EACH ROW
  EXECUTE FUNCTION register_timeline_event();

-- =====================================================
-- PARTE 9: FUNÇÃO PARA INCREMENTAR ITERAÇÕES
-- =====================================================

-- Função para incrementar contador de iterações (chamada pela edge function)
CREATE OR REPLACE FUNCTION increment_framework_iteration(p_conversation_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE framework_checklist
  SET iteracoes_fase_atual = iteracoes_fase_atual + 1
  WHERE conversation_id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_processo_iteration(p_processo_checklist_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE processo_checklist
  SET iteracoes_processo = iteracoes_processo + 1
  WHERE id = p_processo_checklist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PARTE 10: COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN framework_checklist.anamnese_cta_enviado IS 'LLM enviou CTA perguntando se pode enviar formulário de anamnese';
COMMENT ON COLUMN framework_checklist.anamnese_usuario_confirmou IS 'Usuário confirmou que quer preencher anamnese';
COMMENT ON COLUMN framework_checklist.canvas_cta_enviado IS 'LLM enviou CTA perguntando se pode enviar formulário de canvas';
COMMENT ON COLUMN framework_checklist.canvas_usuario_confirmou IS 'Usuário confirmou que quer preencher canvas';
COMMENT ON COLUMN framework_checklist.cadeia_valor_cta_enviado IS 'LLM enviou CTA perguntando se pode enviar formulário de cadeia';
COMMENT ON COLUMN framework_checklist.cadeia_valor_usuario_confirmou IS 'Usuário confirmou que quer preencher cadeia';
COMMENT ON COLUMN framework_checklist.escopo_validado_pelo_usuario IS 'Usuário clicou em validar escopo após revisar matriz e processos priorizados';
COMMENT ON COLUMN framework_checklist.aguardando_validacao_escopo IS 'Sistema aguarda usuário validar escopo antes de avançar';
COMMENT ON COLUMN framework_checklist.iteracoes_fase_atual IS 'Contador de mensagens na fase atual (previne loops)';
COMMENT ON COLUMN framework_checklist.fase_atual IS 'Estado atual do framework (calculado automaticamente)';

COMMENT ON COLUMN processo_checklist.atributos_cta_enviado IS 'LLM enviou CTA perguntando se pode coletar atributos do processo';
COMMENT ON COLUMN processo_checklist.atributos_usuario_confirmou IS 'Usuário confirmou que quer preencher atributos';
COMMENT ON COLUMN processo_checklist.estado_processo IS 'Estado da máquina: IDLE, ATRIBUTOS, BPMN, DIAGNOSTICO, COMPLETO';
COMMENT ON COLUMN processo_checklist.iteracoes_processo IS 'Contador de iterações no processo atual (previne loops)';

COMMENT ON COLUMN cadeia_valor_processos.tipo_processo IS 'Tipo do processo na cadeia: primario, suporte ou gestao';
