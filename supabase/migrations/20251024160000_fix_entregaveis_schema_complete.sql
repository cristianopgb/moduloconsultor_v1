/*
  # Fix entregaveis_consultor schema for UPSERT functionality

  1. Schema Changes
    - Add `slug` column (text) - normalized identifier for UPSERT
    - Add `titulo` column (text) - user-friendly title for UI compatibility
    - Add `updated_at` column (timestamptz) - track last update time
    - Create unique index on (jornada_id, slug) to prevent duplicates

  2. Purpose
    - Enable UPSERT operations to prevent duplicate deliverables
    - Maintain backward compatibility with existing UI code expecting `titulo`
    - Support both old (`nome`) and new (`titulo`) naming conventions
*/

-- Add slug column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'slug'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN slug text;
  END IF;
END $$;

-- Add titulo column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'titulo'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN titulo text;
  END IF;
END $$;

-- Add updated_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create function to generate slug from tipo
CREATE OR REPLACE FUNCTION generate_entregavel_slug(tipo_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Normalize tipo to slug format: replace - with _, lowercase
  RETURN lower(regexp_replace(tipo_input, '-', '_', 'g'));
END;
$$;

-- Backfill existing records with slug and titulo
UPDATE entregaveis_consultor
SET
  slug = generate_entregavel_slug(tipo),
  titulo = COALESCE(titulo, nome),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE slug IS NULL OR titulo IS NULL OR updated_at IS NULL;

-- Create unique index on (jornada_id, slug)
DROP INDEX IF EXISTS idx_entregaveis_jornada_slug;
CREATE UNIQUE INDEX idx_entregaveis_jornada_slug
ON entregaveis_consultor(jornada_id, slug)
WHERE slug IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN entregaveis_consultor.slug IS 'Normalized identifier for UPSERT operations (generated from tipo)';
COMMENT ON COLUMN entregaveis_consultor.titulo IS 'User-friendly title for UI display (fallback to nome for compatibility)';
COMMENT ON COLUMN entregaveis_consultor.updated_at IS 'Timestamp of last update';
COMMENT ON INDEX idx_entregaveis_jornada_slug IS 'Unique constraint to prevent duplicate deliverables per jornada';
