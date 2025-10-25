/*
  # Adicionar colunas para FSM e idempotência

  1. Mudanças em entregaveis_consultor
    - Adicionar coluna `slug` para identificação única
    - Adicionar coluna `titulo` para título do entregável
    - Adicionar coluna `updated_at` para tracking de atualizações
    - Criar índice único em (jornada_id, slug)

  2. Mudanças em jornadas_consultor, areas_trabalho, gamificacao_consultor
    - Adicionar coluna `ultima_interacao` para Realtime reativo

  3. Remover coluna problemática de timeline_consultor
    - Remover `tipo_evento` que estava causando erro
*/

-- 1. Entregaveis: adicionar colunas para idempotência
ALTER TABLE entregaveis_consultor
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Criar índice único para prevenir duplicatas
DROP INDEX IF EXISTS entregaveis_consultor_jornada_slug_uk;
CREATE UNIQUE INDEX entregaveis_consultor_jornada_slug_uk
  ON entregaveis_consultor(jornada_id, slug)
  WHERE slug IS NOT NULL;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_entregaveis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entregaveis_updated_at_trigger ON entregaveis_consultor;
CREATE TRIGGER entregaveis_updated_at_trigger
  BEFORE UPDATE ON entregaveis_consultor
  FOR EACH ROW
  EXECUTE FUNCTION update_entregaveis_updated_at();

-- 2. Adicionar ultima_interacao para Realtime reativo
ALTER TABLE jornadas_consultor
  ADD COLUMN IF NOT EXISTS ultima_interacao timestamptz DEFAULT now();

ALTER TABLE areas_trabalho
  ADD COLUMN IF NOT EXISTS ultima_interacao timestamptz DEFAULT now();

ALTER TABLE gamificacao_consultor
  ADD COLUMN IF NOT EXISTS ultima_interacao timestamptz DEFAULT now();

-- 3. Backfill de slug e titulo para entregaveis existentes
UPDATE entregaveis_consultor
SET slug = CASE
  WHEN tipo = 'anamnese' THEN 'anamnese-empresarial'
  WHEN tipo = 'canvas' THEN 'business-canvas'
  WHEN tipo = 'cadeia_valor' THEN 'cadeia-valor'
  WHEN tipo = 'matriz_priorizacao' THEN 'matriz-priorizacao'
  WHEN tipo = 'escopo_projeto' THEN 'escopo-projeto'
  WHEN tipo = 'bpmn' THEN 'bpmn-processo'
  WHEN tipo = 'diagnostico' THEN 'diagnostico-area'
  WHEN tipo = 'plano_acao' THEN 'plano-acao-5w2h'
  ELSE tipo
END
WHERE slug IS NULL;

UPDATE entregaveis_consultor
SET titulo = CASE
  WHEN tipo = 'anamnese' THEN 'Anamnese Empresarial'
  WHEN tipo = 'canvas' THEN 'Business Model Canvas'
  WHEN tipo = 'cadeia_valor' THEN 'Cadeia de Valor'
  WHEN tipo = 'matriz_priorizacao' THEN 'Matriz de Priorização'
  WHEN tipo = 'escopo_projeto' THEN 'Escopo do Projeto'
  WHEN tipo = 'bpmn' THEN 'Modelagem BPMN'
  WHEN tipo = 'diagnostico' THEN 'Diagnóstico da Área'
  WHEN tipo = 'plano_acao' THEN 'Plano de Ação 5W2H'
  ELSE tipo
END
WHERE titulo IS NULL OR titulo = '';

-- 4. Garantir que titulo nunca seja NULL
ALTER TABLE entregaveis_consultor
  ALTER COLUMN titulo SET DEFAULT 'Entregável',
  ADD CONSTRAINT entregaveis_titulo_not_empty CHECK (titulo IS NOT NULL AND length(trim(titulo)) > 0);

-- 5. Criar função para normalizar slug
CREATE OR REPLACE FUNCTION normalize_slug(input_text text)
RETURNS text AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        trim(input_text),
        '[áàâãäå]', 'a', 'gi'
      ),
      '[^a-z0-9]+', '-', 'gi'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Adicionar comentários para documentação
COMMENT ON COLUMN entregaveis_consultor.slug IS 'Identificador único do tipo de entregável (ex: anamnese-empresarial)';
COMMENT ON COLUMN entregaveis_consultor.titulo IS 'Título do entregável, nunca nulo';
COMMENT ON COLUMN entregaveis_consultor.updated_at IS 'Timestamp da última atualização do entregável';
COMMENT ON COLUMN jornadas_consultor.ultima_interacao IS 'Timestamp para disparar eventos Realtime na timeline';
