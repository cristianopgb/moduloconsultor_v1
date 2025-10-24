/*
  # Adicionar flags de validação de escopo no framework_checklist

  1. Novas Colunas
    - `aguardando_validacao_escopo` - flag para mostrar botão de validação
    - `escopo_validado_pelo_usuario` - confirmação do usuário
    - `escopo_validacao_ts` - timestamp da validação

  2. Objetivo
    - Controlar fluxo de validação de escopo explicitamente
    - Evitar avanço automático sem confirmação do usuário
*/

-- Adicionar coluna aguardando_validacao_escopo se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist'
    AND column_name = 'aguardando_validacao_escopo'
  ) THEN
    ALTER TABLE framework_checklist
    ADD COLUMN aguardando_validacao_escopo boolean DEFAULT false;
  END IF;
END $$;

-- Adicionar coluna escopo_validado_pelo_usuario se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist'
    AND column_name = 'escopo_validado_pelo_usuario'
  ) THEN
    ALTER TABLE framework_checklist
    ADD COLUMN escopo_validado_pelo_usuario boolean DEFAULT false;
  END IF;
END $$;

-- Adicionar coluna escopo_validacao_ts se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist'
    AND column_name = 'escopo_validacao_ts'
  ) THEN
    ALTER TABLE framework_checklist
    ADD COLUMN escopo_validacao_ts timestamptz;
  END IF;
END $$;

-- Adicionar coluna fase_atual se não existir (para tracking de fase)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'framework_checklist'
    AND column_name = 'fase_atual'
  ) THEN
    ALTER TABLE framework_checklist
    ADD COLUMN fase_atual text DEFAULT 'anamnese';
  END IF;
END $$;

-- Comentários para documentação
COMMENT ON COLUMN framework_checklist.aguardando_validacao_escopo IS 'True quando matriz foi gerada e aguarda validação do usuário';
COMMENT ON COLUMN framework_checklist.escopo_validado_pelo_usuario IS 'True quando usuário confirmou a priorização e escopo';
COMMENT ON COLUMN framework_checklist.escopo_validacao_ts IS 'Timestamp de quando o escopo foi validado';
COMMENT ON COLUMN framework_checklist.fase_atual IS 'Fase atual do framework (anamnese, modelagem, execucao)';

-- Corrigir registros existentes que possam estar em estado inconsistente
UPDATE framework_checklist
SET fase_atual = CASE
  WHEN plano_acao_gerado = true THEN 'concluido'
  WHEN todos_processos_concluidos = true THEN 'execucao'
  WHEN matriz_priorizacao_preenchida = true THEN 'modelagem'
  WHEN cadeia_valor_preenchida = true THEN 'modelagem'
  WHEN canvas_preenchido = true THEN 'modelagem'
  WHEN anamnese_preenchida = true THEN 'modelagem'
  ELSE 'anamnese'
END
WHERE fase_atual IS NULL;

RAISE NOTICE 'Flags de validação de escopo adicionadas com sucesso';
