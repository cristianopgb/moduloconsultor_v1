/*
  # Sistema Automático de Cálculo de Progresso

  1. Funcionalidade
    - Função auto_update_session_progress() recalcula progresso automaticamente
    - Triggers em: consultor_sessoes (estado), kanban_cards (status), entregaveis_consultor (insert)
    - Progresso baseado em: estado (30%) + entregaveis (40%) + kanban (30%)

  2. Triggers
    - trigger_sessao_state_change: quando estado muda
    - trigger_kanban_progress: quando card muda de status
    - trigger_entregavel_created: quando entregavel é criado

  3. Pesos
    - Estados: coleta(10%), analise(25%), diagnostico(50%), recomendacao(70%), execucao(85%), concluido(100%)
    - Entregaveis: até 8 entregaveis = 100%
    - Kanban: % de cards concluidos

  4. Segurança
    - Função é segura para execução em trigger
    - Não causa loops infinitos (usa WHEN OLD IS DISTINCT FROM NEW)
*/

-- Função para recalcular progresso automaticamente
CREATE OR REPLACE FUNCTION auto_update_session_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_sessao_id UUID;
  v_estado_atual TEXT;
  v_num_entregaveis INT;
  v_total_cards INT;
  v_completed_cards INT;
  v_state_weight INT;
  v_deliverable_progress NUMERIC;
  v_kanban_progress NUMERIC;
  v_total_progress INT;
BEGIN
  -- Determinar sessao_id dependendo da tabela
  IF TG_TABLE_NAME = 'consultor_sessoes' THEN
    v_sessao_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'kanban_cards' THEN
    v_sessao_id := NEW.sessao_id;
  ELSIF TG_TABLE_NAME = 'entregaveis_consultor' THEN
    v_sessao_id := NEW.sessao_id;
  ELSE
    RETURN NEW;
  END IF;

  -- Buscar dados da sessao
  SELECT estado_atual, COALESCE(array_length(entregaveis_gerados, 1), 0)
  INTO v_estado_atual, v_num_entregaveis
  FROM consultor_sessoes
  WHERE id = v_sessao_id;

  -- Calcular peso do estado (30%)
  v_state_weight := CASE v_estado_atual
    WHEN 'coleta' THEN 10
    WHEN 'analise' THEN 25
    WHEN 'diagnostico' THEN 50
    WHEN 'recomendacao' THEN 70
    WHEN 'execucao' THEN 85
    WHEN 'concluido' THEN 100
    ELSE 0
  END;

  -- Calcular peso dos entregaveis (40%)
  v_deliverable_progress := LEAST(100, (v_num_entregaveis::NUMERIC / 8) * 100);

  -- Calcular peso do kanban (30%)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('concluido', 'done'))
  INTO v_total_cards, v_completed_cards
  FROM kanban_cards
  WHERE sessao_id = v_sessao_id
    AND deprecated = FALSE;

  IF v_total_cards > 0 THEN
    v_kanban_progress := (v_completed_cards::NUMERIC / v_total_cards) * 100;
  ELSE
    v_kanban_progress := 0;
  END IF;

  -- Calcular progresso total
  v_total_progress := ROUND(
    (v_state_weight * 0.3) +
    (v_deliverable_progress * 0.4) +
    (v_kanban_progress * 0.3)
  );

  -- Atualizar sessao
  UPDATE consultor_sessoes
  SET progresso = v_total_progress,
      updated_at = NOW()
  WHERE id = v_sessao_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger quando estado da sessao muda
DROP TRIGGER IF EXISTS trigger_sessao_state_change ON consultor_sessoes;
CREATE TRIGGER trigger_sessao_state_change
AFTER UPDATE OF estado_atual ON consultor_sessoes
FOR EACH ROW
WHEN (OLD.estado_atual IS DISTINCT FROM NEW.estado_atual)
EXECUTE FUNCTION auto_update_session_progress();

-- Trigger quando kanban card muda de status
DROP TRIGGER IF EXISTS trigger_kanban_progress ON kanban_cards;
CREATE TRIGGER trigger_kanban_progress
AFTER INSERT OR UPDATE OF status ON kanban_cards
FOR EACH ROW
EXECUTE FUNCTION auto_update_session_progress();

-- Trigger quando entregavel e criado
DROP TRIGGER IF EXISTS trigger_entregavel_created ON entregaveis_consultor;
CREATE TRIGGER trigger_entregavel_created
AFTER INSERT ON entregaveis_consultor
FOR EACH ROW
EXECUTE FUNCTION auto_update_session_progress();

-- Comentários
COMMENT ON FUNCTION auto_update_session_progress() IS
'Recalcula progresso da sessao automaticamente baseado em estado, entregaveis e kanban. Triggers em: consultor_sessoes, kanban_cards, entregaveis_consultor';

-- Estatísticas
DO $$
DECLARE
  v_total_sessoes INT;
  v_com_progresso INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE progresso > 0)
  INTO v_total_sessoes, v_com_progresso
  FROM consultor_sessoes;

  RAISE NOTICE 'Sistema de progresso automático instalado:';
  RAISE NOTICE '  Total de sessões: %', v_total_sessoes;
  RAISE NOTICE '  Sessões com progresso: %', v_com_progresso;
  RAISE NOTICE '  Triggers criados: 3 (sessao_state, kanban_progress, entregavel_created)';
END $$;
