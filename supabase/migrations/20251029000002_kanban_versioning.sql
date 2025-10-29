/*
  # Sistema de Versionamento para Kanban Cards

  1. Mudanças
    - Adiciona coluna plano_hash para deduplicação inteligente
    - Adiciona coluna plano_version para rastreamento de versões
    - Adiciona coluna card_source para identificar origem (original/incremental)
    - Adiciona coluna parent_card_id para referência à versão anterior
    - Adiciona colunas deprecated e deprecated_version para soft delete

  2. Índices
    - idx_kanban_hash_version: busca eficiente por hash e versão
    - idx_kanban_active: busca cards ativos (não deprecated)
    - idx_kanban_hash_lookup: busca rápida por hash

  3. Modelo de Versionamento
    - v1 (original): Primeira versão do plano
    - v2+ (incremental): Versões subsequentes com novos cards
    - Cards deprecated: Removidos em versão posterior mas mantidos para histórico
    - Hash baseado em: tipo_plano + area + titulos_ordenados (ignora timestamps)

  4. Segurança
    - Popula hash para cards existentes usando md5
    - Todos cards existentes começam como versão 1
*/

-- Adicionar colunas de versionamento
ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS plano_hash TEXT,
  ADD COLUMN IF NOT EXISTS plano_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS card_source TEXT DEFAULT 'original' CHECK (card_source IN ('original', 'incremental')),
  ADD COLUMN IF NOT EXISTS parent_card_id UUID REFERENCES kanban_cards(id),
  ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deprecated_version INTEGER;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_kanban_hash_version
  ON kanban_cards(sessao_id, plano_hash, plano_version);

CREATE INDEX IF NOT EXISTS idx_kanban_active
  ON kanban_cards(sessao_id)
  WHERE deprecated = FALSE;

CREATE INDEX IF NOT EXISTS idx_kanban_hash_lookup
  ON kanban_cards(plano_hash)
  WHERE deprecated = FALSE;

-- Comentários explicativos
COMMENT ON COLUMN kanban_cards.plano_hash IS
'Hash SHA-256 do conteúdo do plano para deduplicação inteligente. Baseado em tipo+area+titulos ordenados (ignora timestamps e IDs)';

COMMENT ON COLUMN kanban_cards.plano_version IS
'Versão incremental do plano (1, 2, 3...) - permite evolução sem perder cards antigos';

COMMENT ON COLUMN kanban_cards.card_source IS
'Origem do card: original (primeira versão do plano) ou incremental (adicionado em versão posterior)';

COMMENT ON COLUMN kanban_cards.parent_card_id IS
'ID do card original se este for uma atualização/modificação de card existente';

COMMENT ON COLUMN kanban_cards.deprecated IS
'TRUE se card foi removido em versão posterior do plano (soft delete para manter histórico)';

COMMENT ON COLUMN kanban_cards.deprecated_version IS
'Versão do plano em que este card foi marcado como deprecated';

-- Popular hash para cards existentes (baseado em conteúdo para evitar colisões)
UPDATE kanban_cards
SET plano_hash = md5(
  COALESCE(sessao_id::text, '') ||
  COALESCE(titulo, '') ||
  COALESCE(descricao, '')
)
WHERE plano_hash IS NULL;

-- Estatísticas da migração
DO $$
DECLARE
  v_total INT;
  v_com_hash INT;
  v_deprecated INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE plano_hash IS NOT NULL),
    COUNT(*) FILTER (WHERE deprecated = TRUE)
  INTO v_total, v_com_hash, v_deprecated
  FROM kanban_cards;

  RAISE NOTICE 'Migração de versionamento Kanban concluída:';
  RAISE NOTICE '  Total de cards: %', v_total;
  RAISE NOTICE '  Cards com hash: %', v_com_hash;
  RAISE NOTICE '  Cards deprecated: %', v_deprecated;
  RAISE NOTICE '  Índices criados: 3';
END $$;
