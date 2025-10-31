/*
  # Add sessao_id to timeline and fix schemas

  1. Changes
    - Add sessao_id to timeline_consultor (can be NULL if using jornada_id)
    - Make jornada_id nullable in timeline (transition period)
    - Add sessao_id to consultor_mensagens if missing
  
  2. Security
    - Allow both old (jornada_id) and new (sessao_id) systems to coexist
*/

-- Add sessao_id to timeline_consultor
ALTER TABLE timeline_consultor
ADD COLUMN IF NOT EXISTS sessao_id uuid REFERENCES consultor_sessoes(id) ON DELETE CASCADE;

-- Make jornada_id nullable for new records using sessao_id
ALTER TABLE timeline_consultor
ALTER COLUMN jornada_id DROP NOT NULL;

-- Add check to ensure either jornada_id or sessao_id is present
ALTER TABLE timeline_consultor
DROP CONSTRAINT IF EXISTS timeline_consultor_id_check;

ALTER TABLE timeline_consultor
ADD CONSTRAINT timeline_consultor_id_check
CHECK (jornada_id IS NOT NULL OR sessao_id IS NOT NULL);

-- Ensure consultor_mensagens has sessao_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'consultor_mensagens' AND column_name = 'sessao_id'
  ) THEN
    ALTER TABLE consultor_mensagens
    ADD COLUMN sessao_id uuid REFERENCES consultor_sessoes(id) ON DELETE CASCADE;
  END IF;
END$$;

COMMENT ON COLUMN timeline_consultor.sessao_id IS 'Reference to consultor_sessoes (new system)';
COMMENT ON COLUMN timeline_consultor.jornada_id IS 'Reference to jornadas_consultor (legacy system)';
