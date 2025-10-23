/*
  # Create cadeia_valor_processos Table

  1. New Table
    - `cadeia_valor_processos` - Stores processes identified in the value chain
      - `id` (uuid, primary key)
      - `jornada_id` (uuid, references jornadas_consultor) - Journey this process belongs to
      - `nome` (text, not null) - Process name
      - `tipo_processo` (text) - Process type: primario, suporte, gestao
      - `criticidade` (integer) - Criticality score (1-5)
      - `impacto` (integer) - Impact score (1-5)
      - `esforco` (integer) - Effort score (1-5)
      - `descricao` (text) - Process description
      - `ordem` (integer) - Display order in the value chain
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    This table stores all processes identified during the value chain mapping phase.
    It's used for:
    - Building the value chain deliverable
    - Creating prioritization matrices (using criticidade, impacto, esforco)
    - Tracking which processes will be analyzed in detail
    - Linking processes to detailed analysis (BPMN, diagnostics, action plans)

  3. Security
    - Enable RLS on table
    - Add policy for authenticated users to access their own journey processes
    - Add policy for master users to access all processes

  4. Indexes
    - Index on jornada_id for filtering
    - Index on tipo_processo for filtering by process type
    - Index on ordem for sorting

  5. Relationships
    - Links to jornadas_consultor (parent journey)
    - Referenced by processo_checklist for detailed process tracking
*/

-- Create cadeia_valor_processos table
CREATE TABLE IF NOT EXISTS cadeia_valor_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid NOT NULL REFERENCES jornadas_consultor(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo_processo text DEFAULT 'primario' CHECK (tipo_processo IN ('primario', 'suporte', 'gestao')),
  criticidade integer DEFAULT 1 CHECK (criticidade >= 1 AND criticidade <= 5),
  impacto integer DEFAULT 1 CHECK (impacto >= 1 AND impacto <= 5),
  esforco integer DEFAULT 1 CHECK (esforco >= 1 AND esforco <= 5),
  descricao text DEFAULT '',
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cadeia_valor_processos_jornada_id
  ON cadeia_valor_processos(jornada_id);

CREATE INDEX IF NOT EXISTS idx_cadeia_valor_processos_tipo
  ON cadeia_valor_processos(tipo_processo);

CREATE INDEX IF NOT EXISTS idx_cadeia_valor_processos_ordem
  ON cadeia_valor_processos(jornada_id, ordem);

-- Enable RLS
ALTER TABLE cadeia_valor_processos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view processes from their own journeys
CREATE POLICY "Users can view own journey processes"
  ON cadeia_valor_processos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = cadeia_valor_processos.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Policy: Users can insert processes in their own journeys
CREATE POLICY "Users can insert own journey processes"
  ON cadeia_valor_processos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = cadeia_valor_processos.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Policy: Users can update processes in their own journeys
CREATE POLICY "Users can update own journey processes"
  ON cadeia_valor_processos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = cadeia_valor_processos.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = cadeia_valor_processos.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Policy: Users can delete processes in their own journeys
CREATE POLICY "Users can delete own journey processes"
  ON cadeia_valor_processos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = cadeia_valor_processos.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Policy: Master users can view all processes
CREATE POLICY "Master users can view all processes"
  ON cadeia_valor_processos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Policy: Master users can manage all processes
CREATE POLICY "Master users can manage all processes"
  ON cadeia_valor_processos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cadeia_valor_processos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cadeia_valor_processos_updated_at ON cadeia_valor_processos;
CREATE TRIGGER trigger_update_cadeia_valor_processos_updated_at
  BEFORE UPDATE ON cadeia_valor_processos
  FOR EACH ROW
  EXECUTE FUNCTION update_cadeia_valor_processos_updated_at();

-- Add comments for documentation
COMMENT ON TABLE cadeia_valor_processos IS 'Stores processes identified during value chain mapping phase';
COMMENT ON COLUMN cadeia_valor_processos.tipo_processo IS 'Process type: primario (primary/core), suporte (support), gestao (management)';
COMMENT ON COLUMN cadeia_valor_processos.criticidade IS 'Criticality score from 1-5 for prioritization matrix';
COMMENT ON COLUMN cadeia_valor_processos.impacto IS 'Impact score from 1-5 for prioritization matrix';
COMMENT ON COLUMN cadeia_valor_processos.esforco IS 'Effort score from 1-5 for prioritization matrix';
COMMENT ON COLUMN cadeia_valor_processos.ordem IS 'Display order within the value chain visualization';
