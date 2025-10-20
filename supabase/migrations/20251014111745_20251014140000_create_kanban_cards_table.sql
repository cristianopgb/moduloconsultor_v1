/*
  # Create Kanban Cards Table

  1. New Tables
    - `kanban_cards`
      - `id` (uuid, primary key)
      - `jornada_id` (uuid, foreign key to jornadas_consultor)
      - `area_id` (uuid, foreign key to areas_trabalho, nullable)
      - `titulo` (text, required)
      - `descricao` (text, optional)
      - `responsavel` (text, optional)
      - `prazo` (text, optional)
      - `status` (text, check constraint: 'todo', 'doing', 'done')
      - `ordem` (integer, for sorting)
      - `dados_5w2h` (jsonb, stores detailed 5W2H data)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `kanban_cards` table
    - Add policy for users to manage their own journey's cards
*/

CREATE TABLE IF NOT EXISTS kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES jornadas_consultor(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas_trabalho(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel TEXT,
  prazo TEXT,
  status TEXT CHECK (status IN ('todo', 'doing', 'done')) DEFAULT 'todo',
  ordem INTEGER DEFAULT 0,
  dados_5w2h JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own journey's kanban cards
CREATE POLICY "Users can view their journey kanban cards"
  ON kanban_cards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = kanban_cards.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Policy: Users can insert cards for their journey
CREATE POLICY "Users can insert kanban cards for their journey"
  ON kanban_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = kanban_cards.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Policy: Users can update their journey's cards
CREATE POLICY "Users can update their journey kanban cards"
  ON kanban_cards FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = kanban_cards.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = kanban_cards.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their journey's cards
CREATE POLICY "Users can delete their journey kanban cards"
  ON kanban_cards FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = kanban_cards.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Masters can view all kanban cards
CREATE POLICY "Masters can view all kanban cards"
  ON kanban_cards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_jornada_id ON kanban_cards(jornada_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_area_id ON kanban_cards(area_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_status ON kanban_cards(status);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_ordem ON kanban_cards(ordem);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_kanban_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kanban_cards_updated_at_trigger
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_kanban_cards_updated_at();