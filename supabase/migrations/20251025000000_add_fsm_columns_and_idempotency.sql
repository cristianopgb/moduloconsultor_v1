/*
  # Adicionar colunas para FSM e idempotência - VERSÃO CONSOLIDADA

  1. Mudanças em entregaveis_consultor
    - Adicionar colunas slug, titulo, updated_at (com IF NOT EXISTS)
    - Usar índice existente da migração 20251024 (idx_entregaveis_jornada_slug)
    - Backfill inteligente que respeita dados existentes

  2. Mudanças em jornadas_consultor, areas_trabalho, gamificacao_consultor
    - Adicionar coluna `ultima_interacao` para Realtime reativo

  3. Consolidação
    - Remove conflito de índices duplicados
    - Usa função generate_entregavel_slug existente
    - Backfill condicional que não sobrescreve dados válidos
*/

-- 1. Entregaveis: adicionar colunas para idempotência (seguro com IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'slug'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN slug text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'titulo'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN titulo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 2. Usar o índice da migração anterior (evita duplicação)
-- O índice idx_entregaveis_jornada_slug já existe da migração 20251024
-- Não criar índice duplicado

-- 3. Trigger para atualizar updated_at automaticamente
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

-- 4. Adicionar ultima_interacao para Realtime reativo
ALTER TABLE jornadas_consultor
  ADD COLUMN IF NOT EXISTS ultima_interacao timestamptz DEFAULT now();

ALTER TABLE areas_trabalho
  ADD COLUMN IF NOT EXISTS ultima_interacao timestamptz DEFAULT now();

ALTER TABLE gamificacao_consultor
  ADD COLUMN IF NOT EXISTS ultima_interacao timestamptz DEFAULT now();

-- 5. Backfill CONDICIONAL de slug - só atualiza se ainda não tiver valor válido
-- Usa formato com hífen para consistência com templates
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
  ELSE lower(regexp_replace(tipo, '_', '-', 'g'))
END
WHERE slug IS NULL
   OR slug = ''
   OR slug = lower(regexp_replace(tipo, '-', '_', 'g')); -- Corrige formato antigo com underscore

-- 6. Backfill de titulo - preenche vazios e fallback para nome
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
  ELSE COALESCE(NULLIF(nome, ''), initcap(replace(tipo, '_', ' ')))
END
WHERE titulo IS NULL OR titulo = '';

-- 7. Garantir updated_at em registros existentes
UPDATE entregaveis_consultor
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- 8. Adicionar constraints SOMENTE APÓS backfill completo
DO $$
BEGIN
  -- Verifica se todos os títulos estão preenchidos antes de adicionar constraint
  IF NOT EXISTS (
    SELECT 1 FROM entregaveis_consultor
    WHERE titulo IS NULL OR trim(titulo) = ''
  ) THEN
    -- Set default
    ALTER TABLE entregaveis_consultor
      ALTER COLUMN titulo SET DEFAULT 'Entregável';

    -- Add constraint se não existir
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'entregaveis_titulo_not_empty'
    ) THEN
      ALTER TABLE entregaveis_consultor
        ADD CONSTRAINT entregaveis_titulo_not_empty
        CHECK (titulo IS NOT NULL AND length(trim(titulo)) > 0);
    END IF;
  ELSE
    RAISE WARNING 'Existem registros com titulo vazio - constraint não aplicada. Execute backfill manual.';
  END IF;
END $$;

-- 9. Manter função normalize_slug para uso futuro (não conflita)
CREATE OR REPLACE FUNCTION normalize_slug(input_text text)
RETURNS text AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        trim(input_text),
        '[áàâãäåèéêëìíîïòóôõöùúûü]',
        translate(
          regexp_replace(trim(input_text), '[áàâãäåèéêëìíîïòóôõöùúûü]', ''),
          'áàâãäåèéêëìíîïòóôõöùúûü',
          'aaaaaaeeeeiiiioooooouuuu'
        ),
        'gi'
      ),
      '[^a-z0-9]+', '-', 'gi'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 10. Comentários para documentação
COMMENT ON COLUMN entregaveis_consultor.slug IS 'Identificador único do tipo de entregável (formato: anamnese-empresarial com hífen)';
COMMENT ON COLUMN entregaveis_consultor.titulo IS 'Título do entregável para exibição, nunca nulo';
COMMENT ON COLUMN entregaveis_consultor.updated_at IS 'Timestamp da última atualização do entregável';
COMMENT ON COLUMN jornadas_consultor.ultima_interacao IS 'Timestamp para disparar eventos Realtime na timeline';
COMMENT ON FUNCTION normalize_slug IS 'Normaliza texto para formato slug (remove acentos, converte para lowercase com hífens)';
