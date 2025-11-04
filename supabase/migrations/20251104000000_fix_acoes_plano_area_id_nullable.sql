/*
  # Fix kanban system constraints

  ## Problem
  1. acoes_plano.area_id is NOT NULL but RAG system doesn't use areas_trabalho
  2. kanban_cards.status constraint only allows 'todo', 'doing', 'done'
     but frontend expects 'todo', 'in_progress', 'blocked', 'done'

  ## Changes
  1. Make area_id nullable in acoes_plano table
  2. Update status constraint in kanban_cards to match frontend expectations
*/

-- Make area_id nullable in acoes_plano
ALTER TABLE acoes_plano
ALTER COLUMN area_id DROP NOT NULL;

COMMENT ON COLUMN acoes_plano.area_id IS 'Optional reference to areas_trabalho. Can be null for RAG-generated actions.';

-- Update status constraint in kanban_cards
ALTER TABLE kanban_cards
DROP CONSTRAINT IF EXISTS kanban_cards_status_check;

ALTER TABLE kanban_cards
ADD CONSTRAINT kanban_cards_status_check
CHECK (status IN ('todo', 'in_progress', 'blocked', 'done'));

COMMENT ON COLUMN kanban_cards.status IS 'Card status: todo, in_progress, blocked, or done';
