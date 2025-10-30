/*
  # Fix slug column - Make nullable with auto-generation

  1. Changes
    - Make slug column nullable (remove NOT NULL if exists)
    - Add trigger to auto-generate slug from tipo+id if null
    - Backfill existing NULL slugs

  2. Security
    - No RLS changes needed
*/

-- Make slug nullable if it has NOT NULL constraint
ALTER TABLE entregaveis_consultor
ALTER COLUMN slug DROP NOT NULL;

-- Create function to auto-generate slug if null
CREATE OR REPLACE FUNCTION generate_entregavel_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Se slug for NULL, gerar automaticamente
  IF NEW.slug IS NULL THEN
    NEW.slug := lower(NEW.tipo) || '-' || substring(NEW.id::text from 1 for 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug
DROP TRIGGER IF EXISTS trigger_generate_entregavel_slug ON entregaveis_consultor;
CREATE TRIGGER trigger_generate_entregavel_slug
  BEFORE INSERT ON entregaveis_consultor
  FOR EACH ROW
  EXECUTE FUNCTION generate_entregavel_slug();

-- Backfill existing NULL slugs
UPDATE entregaveis_consultor
SET slug = lower(tipo) || '-' || substring(id::text from 1 for 8)
WHERE slug IS NULL;
