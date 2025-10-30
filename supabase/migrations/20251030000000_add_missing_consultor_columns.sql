/*
  # Add Missing Columns to consultor_sessoes

  1. Changes
    - Add empresa (text) column for company name
    - Add setor (text) column for business sector
    - Add jornada_id (uuid) column for linking to jornadas (nullable for backward compat)
    - Create index on jornada_id for faster lookups
    - Update RLS policies if needed

  2. Safety
    - All columns nullable for backward compatibility
    - Idempotent: only adds if not exists
    - No data loss - existing sessions remain intact

  3. Purpose
    - empresa/setor: Required by RAG adapter for sector-specific context
    - jornada_id: Required by executor for creating entregaveis
*/

-- Add empresa column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'empresa'
  ) THEN
    ALTER TABLE public.consultor_sessoes
    ADD COLUMN empresa text;

    RAISE NOTICE 'Added empresa column to consultor_sessoes';
  ELSE
    RAISE NOTICE 'Column empresa already exists in consultor_sessoes';
  END IF;
END $$;

-- Add setor column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'setor'
  ) THEN
    ALTER TABLE public.consultor_sessoes
    ADD COLUMN setor text;

    RAISE NOTICE 'Added setor column to consultor_sessoes';
  ELSE
    RAISE NOTICE 'Column setor already exists in consultor_sessoes';
  END IF;
END $$;

-- Add jornada_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'jornada_id'
  ) THEN
    ALTER TABLE public.consultor_sessoes
    ADD COLUMN jornada_id uuid;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_jornada_id
    ON public.consultor_sessoes(jornada_id);

    RAISE NOTICE 'Added jornada_id column to consultor_sessoes with index';
  ELSE
    RAISE NOTICE 'Column jornada_id already exists in consultor_sessoes';
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN consultor_sessoes.empresa IS 'Nome da empresa do cliente';
COMMENT ON COLUMN consultor_sessoes.setor IS 'Setor de atuação (ex: transportes, varejo, saúde)';
COMMENT ON COLUMN consultor_sessoes.jornada_id IS 'ID da jornada vinculada (para entregáveis)';

-- Verification
DO $$
DECLARE
  v_has_empresa BOOLEAN;
  v_has_setor BOOLEAN;
  v_has_jornada BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'empresa'
  ) INTO v_has_empresa;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'setor'
  ) INTO v_has_setor;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultor_sessoes'
      AND column_name = 'jornada_id'
  ) INTO v_has_jornada;

  RAISE NOTICE '╔════════════════════════════════════════╗';
  RAISE NOTICE '║  CONSULTOR_SESSOES SCHEMA VERIFIED     ║';
  RAISE NOTICE '╠════════════════════════════════════════╣';
  RAISE NOTICE '║  empresa column: %                    ║', CASE WHEN v_has_empresa THEN '✓' ELSE '✗' END;
  RAISE NOTICE '║  setor column: %                      ║', CASE WHEN v_has_setor THEN '✓' ELSE '✗' END;
  RAISE NOTICE '║  jornada_id column: %                 ║', CASE WHEN v_has_jornada THEN '✓' ELSE '✗' END;
  RAISE NOTICE '╚════════════════════════════════════════╝';
END $$;
