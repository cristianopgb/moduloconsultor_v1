/*
  # Add sessao_id and content fields to entregaveis_consultor

  1. Schema Changes
    - Add `sessao_id` column to link entregaveis with consultor_sessoes
    - Add `conteudo_xml` column for BPMN XML storage
    - Add `conteudo_md` column for Markdown content
    - Add `bpmn_xml` column (compatibility)
    - Add index for performance

  2. Compatibility
    - Keep `jornada_id` for backward compatibility
    - Allow NULL for both sessao_id and jornada_id (transitional)

  3. Security
    - RLS policies already exist, no changes needed
*/

-- Add sessao_id column
ALTER TABLE entregaveis_consultor
  ADD COLUMN IF NOT EXISTS sessao_id uuid REFERENCES consultor_sessoes(id) ON DELETE CASCADE;

-- Add content columns
ALTER TABLE entregaveis_consultor
  ADD COLUMN IF NOT EXISTS conteudo_xml text;

ALTER TABLE entregaveis_consultor
  ADD COLUMN IF NOT EXISTS conteudo_md text;

-- Add compatibility alias for BPMN
ALTER TABLE entregaveis_consultor
  ADD COLUMN IF NOT EXISTS bpmn_xml text;

-- Add visualizado flag if not exists
ALTER TABLE entregaveis_consultor
  ADD COLUMN IF NOT EXISTS visualizado boolean DEFAULT false;

-- Create index for sessao_id lookups
CREATE INDEX IF NOT EXISTS idx_entregaveis_sessao
  ON entregaveis_consultor(sessao_id);

-- Create index for tipo lookups
CREATE INDEX IF NOT EXISTS idx_entregaveis_tipo
  ON entregaveis_consultor(tipo);

-- Update existing RLS policies to allow sessao_id access
-- Users can see entregaveis from their sessoes
DROP POLICY IF EXISTS "Users can view own entregaveis via sessao" ON entregaveis_consultor;
CREATE POLICY "Users can view own entregaveis via sessao"
  ON entregaveis_consultor FOR SELECT
  TO authenticated
  USING (
    sessao_id IN (
      SELECT id FROM consultor_sessoes WHERE user_id = auth.uid()
    )
    OR
    jornada_id IN (
      SELECT id FROM jornadas_consultor WHERE user_id = auth.uid()
    )
  );

-- Users can insert entregaveis for their sessoes
DROP POLICY IF EXISTS "Users can insert entregaveis for own sessoes" ON entregaveis_consultor;
CREATE POLICY "Users can insert entregaveis for own sessoes"
  ON entregaveis_consultor FOR INSERT
  TO authenticated
  WITH CHECK (
    sessao_id IN (
      SELECT id FROM consultor_sessoes WHERE user_id = auth.uid()
    )
    OR
    jornada_id IN (
      SELECT id FROM jornadas_consultor WHERE user_id = auth.uid()
    )
  );

-- Users can update entregaveis from their sessoes
DROP POLICY IF EXISTS "Users can update own entregaveis" ON entregaveis_consultor;
CREATE POLICY "Users can update own entregaveis"
  ON entregaveis_consultor FOR UPDATE
  TO authenticated
  USING (
    sessao_id IN (
      SELECT id FROM consultor_sessoes WHERE user_id = auth.uid()
    )
    OR
    jornada_id IN (
      SELECT id FROM jornadas_consultor WHERE user_id = auth.uid()
    )
  );
