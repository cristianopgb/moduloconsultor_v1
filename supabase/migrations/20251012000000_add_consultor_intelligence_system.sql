/*
  # Add Consultor Intelligence System

  1. Schema Enhancements
    - Add `contexto_coleta` JSONB to `jornadas_consultor` for tracking collected information per stage
    - Add `resumo_etapa` JSONB to `jornadas_consultor` for LLM context awareness
    - Add `processos_escopo` JSONB to `jornadas_consultor` for tracking scoped processes
    - Add notification trigger for new deliverables
    - Add indexes for performance optimization

  2. Security
    - All tables already have RLS enabled
    - No changes to existing policies needed

  3. Functions
    - Create notification trigger function for deliverables
    - Create helper function to check stage completion readiness
*/

-- Add new columns to jornadas_consultor for intelligent context tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jornadas_consultor' AND column_name = 'contexto_coleta'
  ) THEN
    ALTER TABLE jornadas_consultor ADD COLUMN contexto_coleta JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jornadas_consultor' AND column_name = 'resumo_etapa'
  ) THEN
    ALTER TABLE jornadas_consultor ADD COLUMN resumo_etapa JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jornadas_consultor' AND column_name = 'processos_escopo'
  ) THEN
    ALTER TABLE jornadas_consultor ADD COLUMN processos_escopo JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add notification flag to entregaveis_consultor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'visualizado'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN visualizado BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add substage tracking to areas_trabalho
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'areas_trabalho' AND column_name = 'processos_mapeados_ids'
  ) THEN
    ALTER TABLE areas_trabalho ADD COLUMN processos_mapeados_ids JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'areas_trabalho' AND column_name = 'processo_atual'
  ) THEN
    ALTER TABLE areas_trabalho ADD COLUMN processo_atual TEXT;
  END IF;
END $$;

-- Create notification function for new deliverables
CREATE OR REPLACE FUNCTION notify_new_entregavel()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'novo_entregavel',
    json_build_object(
      'id', NEW.id,
      'jornada_id', NEW.jornada_id,
      'nome', NEW.nome,
      'tipo', NEW.tipo,
      'etapa_origem', NEW.etapa_origem
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for deliverable notifications
DROP TRIGGER IF EXISTS trigger_notify_new_entregavel ON entregaveis_consultor;
CREATE TRIGGER trigger_notify_new_entregavel
AFTER INSERT ON entregaveis_consultor
FOR EACH ROW
EXECUTE FUNCTION notify_new_entregavel();

-- Create helper function to evaluate stage completion readiness
CREATE OR REPLACE FUNCTION avaliar_prontidao_etapa(
  p_jornada_id UUID,
  p_etapa TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_jornada RECORD;
  v_contexto JSONB;
  v_resultado JSONB;
BEGIN
  SELECT * INTO v_jornada
  FROM jornadas_consultor
  WHERE id = p_jornada_id;

  v_contexto := COALESCE(v_jornada.contexto_coleta, '{}'::jsonb);

  -- Evaluate based on stage
  IF p_etapa = 'anamnese' THEN
    v_resultado := jsonb_build_object(
      'pronto', (
        v_contexto ? 'nome_usuario' AND
        v_contexto ? 'empresa_nome' AND
        v_contexto ? 'segmento' AND
        v_contexto ? 'desafios_principais'
      ),
      'campos_faltantes', ARRAY(
        SELECT campo FROM (
          VALUES ('nome_usuario'), ('empresa_nome'), ('segmento'), ('desafios_principais')
        ) AS t(campo)
        WHERE NOT v_contexto ? campo
      )
    );

  ELSIF p_etapa = 'mapeamento' THEN
    v_resultado := jsonb_build_object(
      'pronto', (
        v_contexto ? 'areas_mapeadas' AND
        jsonb_array_length(v_contexto->'areas_mapeadas') >= 3
      ),
      'areas_mapeadas', COALESCE(jsonb_array_length(v_contexto->'areas_mapeadas'), 0)
    );

  ELSIF p_etapa = 'priorizacao' THEN
    v_resultado := jsonb_build_object(
      'pronto', (
        v_contexto ? 'areas_priorizadas' AND
        jsonb_array_length(v_contexto->'areas_priorizadas') >= 1
      ),
      'areas_priorizadas', COALESCE(jsonb_array_length(v_contexto->'areas_priorizadas'), 0)
    );

  ELSE
    v_resultado := jsonb_build_object('pronto', false, 'etapa_invalida', true);
  END IF;

  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jornadas_contexto ON jornadas_consultor USING gin (contexto_coleta);
CREATE INDEX IF NOT EXISTS idx_jornadas_resumo ON jornadas_consultor USING gin (resumo_etapa);
CREATE INDEX IF NOT EXISTS idx_entregaveis_visualizado ON entregaveis_consultor(visualizado) WHERE visualizado = false;
CREATE INDEX IF NOT EXISTS idx_areas_processo_atual ON areas_trabalho(processo_atual) WHERE processo_atual IS NOT NULL;

-- Grant execute permissions on helper function
GRANT EXECUTE ON FUNCTION avaliar_prontidao_etapa(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_new_entregavel() TO authenticated;
