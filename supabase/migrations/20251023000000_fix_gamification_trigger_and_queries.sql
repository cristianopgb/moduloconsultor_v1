/*
  # Fix Gamification Trigger and Query Issues

  ## Problem
  The gamification system has a critical bug where user_id is NULL when created by trigger.
  The trigger function `inicializar_gamificacao_jornada` correctly passes NEW.user_id,
  but queries in the Edge Functions are still searching by user_id instead of jornada_id.

  ## Solution
  1. Ensure the trigger function properly sets user_id (already correct in migration 20251014120000)
  2. Fix any queries that search gamification by user_id instead of jornada_id
  3. Add defensive check to prevent NULL user_id
  4. Update RPC functions to ensure they work with the new jornada-based structure

  ## Changes
  - Add NOT NULL constraint to user_id column (with data migration)
  - Update helper functions to be more defensive
  - Add indexes for common query patterns
*/

-- 1. First, fix any existing records with NULL user_id by linking to jornada's user_id
UPDATE gamificacao_consultor g
SET user_id = j.user_id
FROM jornadas_consultor j
WHERE g.jornada_id = j.id
  AND g.user_id IS NULL;

-- 2. Delete any orphaned gamification records that can't be fixed
DELETE FROM gamificacao_consultor
WHERE user_id IS NULL;

-- 3. Make user_id NOT NULL (should never be null)
ALTER TABLE gamificacao_consultor
  ALTER COLUMN user_id SET NOT NULL;

-- 4. Recreate the trigger function with extra safety checks
CREATE OR REPLACE FUNCTION inicializar_gamificacao_jornada()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate that jornada has user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create gamification for jornada without user_id';
  END IF;

  -- Create gamification record with proper user_id
  INSERT INTO gamificacao_consultor (
    user_id,
    jornada_id,
    xp_total,
    nivel,
    conquistas,
    dias_consecutivos,
    areas_completadas,
    ultimo_acesso
  ) VALUES (
    NEW.user_id,  -- Critical: must use the jornada's user_id
    NEW.id,       -- jornada_id
    0,
    1,
    '[]'::jsonb,
    1,
    0,
    NOW()
  )
  ON CONFLICT (jornada_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate trigger
DROP TRIGGER IF EXISTS trigger_inicializar_gamificacao ON jornadas_consultor;
CREATE TRIGGER trigger_inicializar_gamificacao
  AFTER INSERT ON jornadas_consultor
  FOR EACH ROW
  EXECUTE FUNCTION inicializar_gamificacao_jornada();

-- 6. Create helper function to get gamification by jornada_id (preferred method)
CREATE OR REPLACE FUNCTION get_gamificacao_by_jornada(p_jornada_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  jornada_id UUID,
  xp_total INTEGER,
  nivel INTEGER,
  conquistas JSONB,
  dias_consecutivos INTEGER,
  areas_completadas INTEGER,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.user_id,
    g.jornada_id,
    g.xp_total,
    g.nivel,
    g.conquistas,
    g.dias_consecutivos,
    g.areas_completadas,
    g.ultimo_acesso,
    g.created_at,
    g.updated_at
  FROM gamificacao_consultor g
  WHERE g.jornada_id = p_jornada_id;
END;
$$;

-- 7. Create index on user_id for queries that need it (but jornada_id is primary access)
CREATE INDEX IF NOT EXISTS idx_gamificacao_user_id
  ON gamificacao_consultor(user_id);

-- 8. Add check constraint to ensure user_id matches jornada's user_id
-- This is a defensive constraint to catch bugs early
CREATE OR REPLACE FUNCTION check_gamificacao_user_matches_jornada()
RETURNS TRIGGER AS $$
DECLARE
  v_jornada_user_id UUID;
BEGIN
  -- Get the user_id from the jornada
  SELECT user_id INTO v_jornada_user_id
  FROM jornadas_consultor
  WHERE id = NEW.jornada_id;

  -- Verify they match
  IF NEW.user_id != v_jornada_user_id THEN
    RAISE EXCEPTION 'Gamification user_id (%) does not match jornada user_id (%)', NEW.user_id, v_jornada_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_gamificacao_user ON gamificacao_consultor;
CREATE TRIGGER trigger_check_gamificacao_user
  BEFORE INSERT OR UPDATE ON gamificacao_consultor
  FOR EACH ROW
  EXECUTE FUNCTION check_gamificacao_user_matches_jornada();

-- 9. Comments
COMMENT ON FUNCTION inicializar_gamificacao_jornada IS 'Trigger function that creates gamification record when jornada is created. Ensures user_id is properly set from jornada.user_id.';
COMMENT ON FUNCTION get_gamificacao_by_jornada IS 'Helper function to get gamification by jornada_id (preferred query method).';
COMMENT ON FUNCTION check_gamificacao_user_matches_jornada IS 'Defensive trigger to ensure gamification user_id always matches jornada user_id.';
COMMENT ON CONSTRAINT gamificacao_consultor_user_id_not_null ON gamificacao_consultor IS 'Ensures user_id is never NULL - critical for RLS and queries.';
