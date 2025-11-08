/*
  # Fix Hints Telemetry Trigger

  1. Changes
    - Replace trigger to only count REAL usage (usado_em_acao = true)
    - Only increment uso_count when hint was actually used in action generation
    - Keep aceite_count logic unchanged

  2. Security
    - No RLS changes needed
*/

-- Drop old trigger
DROP TRIGGER IF EXISTS update_hint_stats_on_telemetry ON proceda_hints_telemetry;

-- Recreate function with corrected logic
CREATE OR REPLACE FUNCTION update_hint_telemetry_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment uso_count if hint was actually used in action generation
  IF NEW.usado_em_acao = true THEN
    UPDATE proceda_hints
    SET
      uso_count = uso_count + 1,
      ultima_utilizacao = now()
    WHERE id = NEW.hint_id;

    -- If action was accepted, increment aceite_count
    IF NEW.acao_aceita = true THEN
      UPDATE proceda_hints
      SET aceite_count = aceite_count + 1
      WHERE id = NEW.hint_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER update_hint_stats_on_telemetry
  AFTER INSERT ON proceda_hints_telemetry
  FOR EACH ROW
  EXECUTE FUNCTION update_hint_telemetry_stats();

COMMENT ON FUNCTION update_hint_telemetry_stats IS 'Only increments uso_count when usado_em_acao = true (real usage)';
