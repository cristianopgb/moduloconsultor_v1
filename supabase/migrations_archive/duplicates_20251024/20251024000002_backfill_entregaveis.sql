/*
  # Backfill e correção de dados em entregáveis

  1. Correções
    - Preenche títulos vazios/null com valores padrão
    - Gera slugs para todos os registros existentes
    - Remove duplicatas mantendo o mais recente
    - Adiciona constraint NOT NULL em titulo após correção

  2. Objetivo
    - Garantir integridade de dados históricos
    - Preparar para constraints mais rígidos
*/

-- 1. Preencher títulos vazios com base no tipo
UPDATE entregaveis_consultor
SET nome = CASE tipo
  WHEN 'anamnese' THEN 'Relatório de Anamnese Empresarial'
  WHEN 'canvas' THEN 'Canvas de Modelo de Negócio'
  WHEN 'cadeia_valor' THEN 'Cadeia de Valor'
  WHEN 'cadeia-valor' THEN 'Cadeia de Valor'
  WHEN 'matriz_priorizacao' THEN 'Matriz de Priorização'
  WHEN 'matriz-priorizacao' THEN 'Matriz de Priorização'
  WHEN 'escopo_projeto' THEN 'Escopo do Projeto'
  WHEN 'escopo-projeto' THEN 'Escopo do Projeto'
  WHEN 'bpmn_as_is' THEN 'BPMN As-Is'
  WHEN 'bpmn-as-is' THEN 'BPMN As-Is'
  WHEN 'diagnostico' THEN 'Diagnóstico'
  WHEN 'plano_acao' THEN 'Plano de Ação'
  WHEN 'plano-acao' THEN 'Plano de Ação'
  ELSE initcap(replace(replace(tipo, '_', ' '), '-', ' '))
END
WHERE nome IS NULL OR nome = '';

-- 2. Gerar slugs para todos os registros
-- Normalizar tipo primeiro (converter hífens em underscores)
UPDATE entregaveis_consultor
SET tipo = replace(tipo, '-', '_')
WHERE tipo LIKE '%-%';

-- Gerar slug a partir do tipo normalizado
UPDATE entregaveis_consultor
SET slug = generate_slug(tipo)
WHERE slug IS NULL;

-- 3. Identificar e remover duplicatas (manter o mais recente)
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY jornada_id, slug
      ORDER BY created_at DESC, id DESC
    ) as rn
  FROM entregaveis_consultor
  WHERE slug IS NOT NULL
)
DELETE FROM entregaveis_consultor
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 4. Adicionar constraint NOT NULL em nome após backfill
ALTER TABLE entregaveis_consultor
ALTER COLUMN nome SET NOT NULL;

-- 5. Adicionar constraint NOT NULL em slug após backfill
ALTER TABLE entregaveis_consultor
ALTER COLUMN slug SET NOT NULL;

-- Log de correções aplicadas
DO $$
DECLARE
  total_corrigidos integer;
BEGIN
  SELECT COUNT(*) INTO total_corrigidos
  FROM entregaveis_consultor
  WHERE slug IS NOT NULL;

  RAISE NOTICE 'Backfill concluído: % entregáveis processados', total_corrigidos;
END $$;
