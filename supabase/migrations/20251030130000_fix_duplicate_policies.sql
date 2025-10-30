/*
  # Fix Duplicate Policies

  1. Problema
    - Policies criadas em migrações anteriores podem estar duplicadas
    - Erro: "policy already exists"

  2. Solução
    - DROP POLICY IF EXISTS antes de criar
    - Garante idempotência

  3. Tabelas Afetadas
    - jornadas_consultor
    - consultor_sessoes
*/

-- Remove policies existentes (se houver) e recria
-- jornadas_consultor policies
DROP POLICY IF EXISTS "Users can view own journeys" ON jornadas_consultor;
CREATE POLICY "Users can view own journeys"
  ON jornadas_consultor FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own journeys" ON jornadas_consultor;
CREATE POLICY "Users can create own journeys"
  ON jornadas_consultor FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own journeys" ON jornadas_consultor;
CREATE POLICY "Users can update own journeys"
  ON jornadas_consultor FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- consultor_sessoes policies
DROP POLICY IF EXISTS "Users can view own sessions" ON consultor_sessoes;
CREATE POLICY "Users can view own sessions"
  ON consultor_sessoes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sessions" ON consultor_sessoes;
CREATE POLICY "Users can create own sessions"
  ON consultor_sessoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON consultor_sessoes;
CREATE POLICY "Users can update own sessions"
  ON consultor_sessoes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
