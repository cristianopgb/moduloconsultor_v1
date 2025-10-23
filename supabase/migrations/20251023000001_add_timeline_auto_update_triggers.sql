/*
  # Add Automatic Timeline Updates

  ## Problem
  The timeline (JornadaTimeline component) doesn't update automatically when the user completes steps.
  The etapa_atual and progresso_geral fields need to be automatically calculated and updated.

  ## Solution
  1. Create trigger to auto-update etapa_atual when framework_checklist changes
  2. Create function to calculate progresso_geral based on completed steps
  3. Add trigger to update progresso_geral whenever checklist changes
  4. Add trigger to insert timeline events when phases change

  ## Phases and Progress Mapping
  - Apresentação: 0-10%
  - Anamnese: 10-25% (anamnese_preenchida)
  - Modelagem: 25-50% (canvas_preenchido + cadeia_valor_preenchida)
  - Priorização: 50-70% (matriz_preenchida)
  - Execução: 70-100% (based on areas_trabalho completion)
*/

-- 1. Function to calculate progress based on checklist
CREATE OR REPLACE FUNCTION calcular_progresso_jornada(p_jornada_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_checklist RECORD;
  v_progresso INTEGER := 0;
  v_areas_total INTEGER;
  v_areas_concluidas INTEGER;
BEGIN
  -- Get checklist for this jornada
  SELECT * INTO v_checklist
  FROM framework_checklist
  WHERE jornada_id = p_jornada_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Base progress on completed steps
  IF v_checklist.anamnese_preenchida THEN
    v_progresso := v_progresso + 15; -- 0-15%
  END IF;

  IF v_checklist.canvas_preenchido THEN
    v_progresso := v_progresso + 12; -- 15-27%
  END IF;

  IF v_checklist.cadeia_valor_preenchida THEN
    v_progresso := v_progresso + 13; -- 27-40%
  END IF;

  IF v_checklist.matriz_preenchida THEN
    v_progresso := v_progresso + 20; -- 40-60%
  END IF;

  -- For execution phase, calculate based on areas_trabalho
  SELECT COUNT(*), COUNT(*) FILTER (WHERE etapa_area = 'concluida')
  INTO v_areas_total, v_areas_concluidas
  FROM areas_trabalho
  WHERE jornada_id = p_jornada_id;

  IF v_areas_total > 0 THEN
    -- Execution phase is 60-100% (40% range)
    v_progresso := v_progresso + ((v_areas_concluidas::FLOAT / v_areas_total::FLOAT) * 40)::INTEGER;
  END IF;

  -- Cap at 100%
  IF v_progresso > 100 THEN
    v_progresso := 100;
  END IF;

  RETURN v_progresso;
END;
$$;

-- 2. Function to determine current phase based on checklist
CREATE OR REPLACE FUNCTION determinar_etapa_atual(p_jornada_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_checklist RECORD;
  v_aguardando TEXT;
BEGIN
  -- Get checklist
  SELECT * INTO v_checklist
  FROM framework_checklist
  WHERE jornada_id = p_jornada_id;

  IF NOT FOUND THEN
    RETURN 'apresentacao';
  END IF;

  -- Get aguardando_validacao status
  SELECT aguardando_validacao INTO v_aguardando
  FROM jornadas_consultor
  WHERE id = p_jornada_id;

  -- Determine phase based on what's completed
  IF v_checklist.matriz_preenchida AND v_aguardando IS NULL THEN
    RETURN 'execucao';
  ELSIF v_checklist.cadeia_valor_preenchida AND v_checklist.canvas_preenchido THEN
    RETURN 'priorizacao';
  ELSIF v_checklist.anamnese_preenchida THEN
    RETURN 'modelagem';
  ELSIF v_checklist.anamnese_exibida THEN
    RETURN 'anamnese';
  ELSE
    RETURN 'apresentacao';
  END IF;
END;
$$;

-- 3. Trigger function to auto-update jornada when checklist changes
CREATE OR REPLACE FUNCTION atualizar_jornada_por_checklist()
RETURNS TRIGGER AS $$
DECLARE
  v_nova_etapa TEXT;
  v_novo_progresso INTEGER;
BEGIN
  -- Calculate new phase and progress
  v_nova_etapa := determinar_etapa_atual(NEW.jornada_id);
  v_novo_progresso := calcular_progresso_jornada(NEW.jornada_id);

  -- Update jornada
  UPDATE jornadas_consultor
  SET
    etapa_atual = v_nova_etapa,
    progresso_geral = v_novo_progresso,
    updated_at = NOW()
  WHERE id = NEW.jornada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger on framework_checklist
DROP TRIGGER IF EXISTS trigger_atualizar_jornada_checklist ON framework_checklist;
CREATE TRIGGER trigger_atualizar_jornada_checklist
  AFTER INSERT OR UPDATE ON framework_checklist
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_jornada_por_checklist();

-- 5. Trigger function to update progress when areas change
CREATE OR REPLACE FUNCTION atualizar_progresso_por_areas()
RETURNS TRIGGER AS $$
DECLARE
  v_novo_progresso INTEGER;
BEGIN
  -- Recalculate progress
  v_novo_progresso := calcular_progresso_jornada(NEW.jornada_id);

  -- Update jornada
  UPDATE jornadas_consultor
  SET
    progresso_geral = v_novo_progresso,
    updated_at = NOW()
  WHERE id = NEW.jornada_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger on areas_trabalho
DROP TRIGGER IF EXISTS trigger_atualizar_progresso_areas ON areas_trabalho;
CREATE TRIGGER trigger_atualizar_progresso_areas
  AFTER INSERT OR UPDATE ON areas_trabalho
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_progresso_por_areas();

-- 7. Function to log phase changes to timeline
CREATE OR REPLACE FUNCTION registrar_mudanca_fase()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if etapa_atual actually changed
  IF OLD.etapa_atual IS DISTINCT FROM NEW.etapa_atual THEN
    INSERT INTO timeline_consultor (jornada_id, fase, evento)
    VALUES (
      NEW.id,
      NEW.etapa_atual,
      'Fase alterada: ' || COALESCE(OLD.etapa_atual, 'inicio') || ' → ' || NEW.etapa_atual
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger on jornadas_consultor for phase changes
DROP TRIGGER IF EXISTS trigger_registrar_mudanca_fase ON jornadas_consultor;
CREATE TRIGGER trigger_registrar_mudanca_fase
  AFTER UPDATE ON jornadas_consultor
  FOR EACH ROW
  EXECUTE FUNCTION registrar_mudanca_fase();

-- 9. Comments
COMMENT ON FUNCTION calcular_progresso_jornada IS 'Calculates journey progress percentage (0-100) based on completed checklist steps and areas.';
COMMENT ON FUNCTION determinar_etapa_atual IS 'Determines current phase based on framework_checklist completion status.';
COMMENT ON FUNCTION atualizar_jornada_por_checklist IS 'Trigger function that auto-updates jornada phase and progress when checklist changes.';
COMMENT ON FUNCTION atualizar_progresso_por_areas IS 'Trigger function that updates progress when areas_trabalho completion changes.';
COMMENT ON FUNCTION registrar_mudanca_fase IS 'Logs phase changes to timeline_consultor table.';
