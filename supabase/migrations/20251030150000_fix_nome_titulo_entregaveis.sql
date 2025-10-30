/*
  # Fix entregaveis_consultor - Rename nome to titulo

  1. Changes
    - Add titulo column if not exists
    - Copy data from nome to titulo
    - Make nome nullable (for backwards compatibility)
    - Set default for titulo

  2. Notes
    - Keeps nome column for backwards compat but makes it optional
    - All new inserts should use titulo
*/

-- Add titulo column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'titulo'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN titulo text;
  END IF;
END $$;

-- Copy data from nome to titulo where titulo is null
UPDATE entregaveis_consultor
SET titulo = nome
WHERE titulo IS NULL AND nome IS NOT NULL;

-- Make nome nullable (backwards compat)
ALTER TABLE entregaveis_consultor
ALTER COLUMN nome DROP NOT NULL;

-- Make titulo NOT NULL with a default
ALTER TABLE entregaveis_consultor
ALTER COLUMN titulo SET NOT NULL;

-- Add default for titulo
ALTER TABLE entregaveis_consultor
ALTER COLUMN titulo SET DEFAULT 'Documento sem título';

-- Create trigger to auto-fill titulo if only nome is provided
CREATE OR REPLACE FUNCTION sync_nome_titulo()
RETURNS TRIGGER AS $$
BEGIN
  -- If titulo is null but nome is provided, copy nome to titulo
  IF NEW.titulo IS NULL AND NEW.nome IS NOT NULL THEN
    NEW.titulo := NEW.nome;
  END IF;

  -- If both are null, set default
  IF NEW.titulo IS NULL AND NEW.nome IS NULL THEN
    NEW.titulo := 'Documento ' || NEW.tipo || ' - ' || to_char(now(), 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_nome_titulo ON entregaveis_consultor;
CREATE TRIGGER trigger_sync_nome_titulo
  BEFORE INSERT OR UPDATE ON entregaveis_consultor
  FOR EACH ROW
  EXECUTE FUNCTION sync_nome_titulo();
