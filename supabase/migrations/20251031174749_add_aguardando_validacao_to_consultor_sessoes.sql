/*
  # Add aguardando_validacao to consultor_sessoes

  1. Changes
    - Add `aguardando_validacao` column to consultor_sessoes
    - Allows tracking validation checkpoints (escopo, priorizacao)
  
  2. Security
    - No RLS changes needed
*/

-- Add aguardando_validacao column
ALTER TABLE consultor_sessoes
ADD COLUMN IF NOT EXISTS aguardando_validacao text
CHECK (aguardando_validacao IS NULL OR aguardando_validacao IN ('escopo', 'priorizacao'));

COMMENT ON COLUMN consultor_sessoes.aguardando_validacao IS 'Checkpoint de validacao aguardando confirmacao do usuario';
