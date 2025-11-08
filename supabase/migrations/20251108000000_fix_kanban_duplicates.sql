/*
  # Fix Kanban Duplicates and Add Constraints

  1. Changes
    - Remove duplicate kanban cards based on sessao_id + titulo
    - Add unique constraint to prevent future duplicates
    - Keep only the oldest card for each duplicate set

  2. Security
    - No RLS changes needed
*/

-- Primeiro, identificar e remover duplicatas mantendo apenas a mais antiga
WITH duplicates AS (
  SELECT
    id,
    sessao_id,
    titulo,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY sessao_id, titulo
      ORDER BY created_at ASC
    ) as rn
  FROM kanban_cards
)
DELETE FROM kanban_cards
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Adicionar índice único para prevenir duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_unique_sessao_titulo
  ON kanban_cards(sessao_id, titulo);

-- Comentário explicativo
COMMENT ON INDEX idx_kanban_unique_sessao_titulo IS
  'Previne criação de cards duplicados com mesmo título na mesma sessão';
