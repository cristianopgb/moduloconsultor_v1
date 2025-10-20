/*
  # Funções RPC para Gamificação

  ## Descrição
  Cria funções PostgreSQL que podem ser chamadas via RPC para adicionar XP e desbloquear conquistas.
  Essas funções são chamadas pelos Edge Functions do backend.

  ## Funções Criadas
  1. adicionar_xp_jornada(jornada_id, quantidade, motivo) - Adiciona XP à gamificação da jornada
  2. desbloquear_conquista_jornada(jornada_id, conquista_id) - Desbloqueia conquista para jornada
  3. verificar_transformador_completo(jornada_id) - Verifica se todas áreas foram concluídas

  ## Notas
  - Todas as funções são SECURITY DEFINER para permitir execução pelos Edge Functions
  - Retornam informação sobre level up e conquistas para exibir modais
*/

-- Função: Adicionar XP à jornada
CREATE OR REPLACE FUNCTION adicionar_xp_jornada(
  p_jornada_id UUID,
  p_quantidade INTEGER,
  p_motivo TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gamificacao RECORD;
  v_xp_novo INTEGER;
  v_nivel_anterior INTEGER;
  v_nivel_novo INTEGER;
  v_nivel_subiu BOOLEAN;
BEGIN
  -- Buscar gamificação da jornada
  SELECT * INTO v_gamificacao
  FROM gamificacao_consultor
  WHERE jornada_id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gamificação não encontrada para jornada %', p_jornada_id;
  END IF;

  -- Calcular novo XP e níveis
  v_xp_novo := v_gamificacao.xp_total + p_quantidade;
  v_nivel_anterior := v_gamificacao.nivel;
  v_nivel_novo := FLOOR(v_xp_novo / 1000.0) + 1; -- XP_POR_NIVEL = 1000
  v_nivel_subiu := v_nivel_novo > v_nivel_anterior;

  -- Atualizar gamificação
  UPDATE gamificacao_consultor
  SET
    xp_total = v_xp_novo,
    nivel = v_nivel_novo,
    updated_at = NOW()
  WHERE jornada_id = p_jornada_id;

  -- Registrar log
  RAISE NOTICE '[Gamification] +% XP para jornada % (%)', p_quantidade, p_jornada_id, p_motivo;

  -- Retornar resultado
  RETURN json_build_object(
    'xp_ganho', p_quantidade,
    'xp_total', v_xp_novo,
    'nivel_anterior', v_nivel_anterior,
    'nivel_novo', v_nivel_novo,
    'nivel_subiu', v_nivel_subiu
  );
END;
$$;

-- Função: Desbloquear conquista para jornada
CREATE OR REPLACE FUNCTION desbloquear_conquista_jornada(
  p_jornada_id UUID,
  p_conquista_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gamificacao RECORD;
  v_conquistas JSONB;
  v_ja_desbloqueada BOOLEAN;
  v_xp_bonus INTEGER;
  v_nova_conquista JSONB;
  v_conquista_info JSONB;
BEGIN
  -- Buscar gamificação da jornada
  SELECT * INTO v_gamificacao
  FROM gamificacao_consultor
  WHERE jornada_id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gamificação não encontrada para jornada %', p_jornada_id;
  END IF;

  -- Verificar se já foi desbloqueada
  v_conquistas := COALESCE(v_gamificacao.conquistas, '[]'::jsonb);
  v_ja_desbloqueada := EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_conquistas) AS c
    WHERE c->>'id' = p_conquista_id
  );

  IF v_ja_desbloqueada THEN
    RAISE NOTICE '[Gamification] Conquista % já desbloqueada', p_conquista_id;
    RETURN NULL;
  END IF;

  -- Definir informações das conquistas (hardcoded por performance)
  v_conquista_info := CASE p_conquista_id
    WHEN 'primeiro_passo' THEN jsonb_build_object(
      'id', 'primeiro_passo',
      'nome', 'Primeiro Passo',
      'descricao', 'Completou a anamnese empresarial',
      'icone', '📋',
      'xp_ganho', 50
    )
    WHEN 'visionario' THEN jsonb_build_object(
      'id', 'visionario',
      'nome', 'Visionário',
      'descricao', 'Mapeou todas as áreas da empresa',
      'icone', '🗺️',
      'xp_ganho', 100
    )
    WHEN 'estrategista' THEN jsonb_build_object(
      'id', 'estrategista',
      'nome', 'Estrategista',
      'descricao', 'Definiu priorização estratégica',
      'icone', '📊',
      'xp_ganho', 75
    )
    WHEN 'analista' THEN jsonb_build_object(
      'id', 'analista',
      'nome', 'Analista',
      'descricao', 'Completou primeiro diagnóstico',
      'icone', '🔍',
      'xp_ganho', 100
    )
    WHEN 'executor' THEN jsonb_build_object(
      'id', 'executor',
      'nome', 'Executor',
      'descricao', 'Criou primeiro plano de ação',
      'icone', '✅',
      'xp_ganho', 150
    )
    WHEN 'persistente' THEN jsonb_build_object(
      'id', 'persistente',
      'nome', 'Persistente',
      'descricao', 'Concluiu primeira ação do plano',
      'icone', '💪',
      'xp_ganho', 75
    )
    WHEN 'maestro' THEN jsonb_build_object(
      'id', 'maestro',
      'nome', 'Maestro',
      'descricao', 'Completou transformação de uma área',
      'icone', '🎯',
      'xp_ganho', 300
    )
    WHEN 'transformador' THEN jsonb_build_object(
      'id', 'transformador',
      'nome', 'Transformador',
      'descricao', 'Completou transformação de TODAS as áreas',
      'icone', '🏆',
      'xp_ganho', 1000
    )
    ELSE jsonb_build_object(
      'id', p_conquista_id,
      'nome', 'Conquista Desconhecida',
      'descricao', 'Conquista não catalogada',
      'icone', '⭐',
      'xp_ganho', 50
    )
  END;

  v_xp_bonus := (v_conquista_info->>'xp_ganho')::INTEGER;

  -- Criar nova conquista com data de desbloqueio
  v_nova_conquista := v_conquista_info || jsonb_build_object('data_desbloqueio', NOW());

  -- Adicionar à lista de conquistas
  v_conquistas := v_conquistas || jsonb_build_array(v_nova_conquista);

  -- Atualizar gamificação
  UPDATE gamificacao_consultor
  SET
    conquistas = v_conquistas,
    xp_total = xp_total + v_xp_bonus,
    updated_at = NOW()
  WHERE jornada_id = p_jornada_id;

  RAISE NOTICE '[Gamification] Conquista % desbloqueada (+% XP)', p_conquista_id, v_xp_bonus;

  -- Retornar conquista desbloqueada
  RETURN v_nova_conquista;
END;
$$;

-- Função: Verificar se todas áreas foram concluídas (para conquista Transformador)
CREATE OR REPLACE FUNCTION verificar_transformador_completo(
  p_jornada_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_areas INTEGER;
  v_areas_concluidas INTEGER;
BEGIN
  -- Contar total de áreas
  SELECT COUNT(*) INTO v_total_areas
  FROM areas_trabalho
  WHERE jornada_id = p_jornada_id;

  -- Contar áreas concluídas
  SELECT COUNT(*) INTO v_areas_concluidas
  FROM areas_trabalho
  WHERE jornada_id = p_jornada_id
    AND etapa_area = 'concluida';

  -- Retornar se todas foram concluídas
  RETURN v_total_areas > 0 AND v_total_areas = v_areas_concluidas;
END;
$$;

-- Comentários
COMMENT ON FUNCTION adicionar_xp_jornada IS 'Adiciona XP à gamificação de uma jornada. Retorna informação sobre level up.';
COMMENT ON FUNCTION desbloquear_conquista_jornada IS 'Desbloqueia conquista para uma jornada. Retorna dados da conquista desbloqueada.';
COMMENT ON FUNCTION verificar_transformador_completo IS 'Verifica se todas as áreas da jornada foram concluídas.';
