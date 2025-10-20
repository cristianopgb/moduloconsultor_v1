/*
  # Add Consultant Validation Flow and Per-Conversation Gamification

  1. Changes to jornadas_consultor
    - Add `aguardando_validacao` field to track validation checkpoints
    - Add `contexto_coleta` field to store all collected data for LLM context
    - Field indicates what the consultant is waiting to be validated
    
  2. New Table: gamificacao_conversa
    - `conversation_id` (uuid, references conversations)
    - `xp_total` (integer, default 0)
    - `nivel` (integer, default 1)
    - `conquistas` (jsonb, default [])
    - `ultima_atualizacao` (timestamptz)
    - Tracks gamification per conversation (resets on new conversation)
    
  3. New Table: timeline_consultor
    - Tracks phase transitions and major events in the journey
    - `jornada_id` (uuid, references jornadas_consultor)
    - `evento` (text) - Event description
    - `fase` (text) - Phase when event occurred
    - `timestamp` (timestamptz)
    
  4. Security
    - Enable RLS on new tables
    - Users can only access their own conversation's data
*/

-- Add fields to jornadas_consultor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jornadas_consultor' AND column_name = 'aguardando_validacao'
  ) THEN
    ALTER TABLE jornadas_consultor 
    ADD COLUMN aguardando_validacao text CHECK (
      aguardando_validacao IS NULL OR aguardando_validacao IN (
        'anamnese', 'modelagem', 'priorizacao', 'bpmn', 'diagnostico', 'plano_acao'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jornadas_consultor' AND column_name = 'contexto_coleta'
  ) THEN
    ALTER TABLE jornadas_consultor 
    ADD COLUMN contexto_coleta jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create gamificacao_conversa table
CREATE TABLE IF NOT EXISTS gamificacao_conversa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  xp_total integer DEFAULT 0 NOT NULL,
  nivel integer DEFAULT 1 NOT NULL,
  conquistas jsonb DEFAULT '[]'::jsonb NOT NULL,
  ultima_atualizacao timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(conversation_id)
);

-- Create timeline_consultor table
CREATE TABLE IF NOT EXISTS timeline_consultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid NOT NULL REFERENCES jornadas_consultor(id) ON DELETE CASCADE,
  evento text NOT NULL,
  fase text NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE gamificacao_conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_consultor ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gamificacao_conversa
CREATE POLICY "Users can view their own conversation gamification"
  ON gamificacao_conversa FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = gamificacao_conversa.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own conversation gamification"
  ON gamificacao_conversa FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = gamificacao_conversa.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own conversation gamification"
  ON gamificacao_conversa FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = gamificacao_conversa.conversation_id
      AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = gamificacao_conversa.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- RLS Policies for timeline_consultor
CREATE POLICY "Users can view their own timeline"
  ON timeline_consultor FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = timeline_consultor.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own timeline events"
  ON timeline_consultor FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = timeline_consultor.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_gamificacao_conversation ON gamificacao_conversa(conversation_id);
CREATE INDEX IF NOT EXISTS idx_timeline_jornada ON timeline_consultor(jornada_id);
CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline_consultor(timestamp DESC);

-- Function to add XP and level up (per conversation)
CREATE OR REPLACE FUNCTION add_xp_to_conversation(
  p_conversation_id uuid,
  p_xp_amount integer,
  p_conquista_nome text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_xp integer;
  v_current_nivel integer;
  v_new_xp integer;
  v_new_nivel integer;
  v_conquistas jsonb;
  v_level_up boolean := false;
  v_result jsonb;
BEGIN
  -- Get or create gamification record
  INSERT INTO gamificacao_conversa (conversation_id, xp_total, nivel)
  VALUES (p_conversation_id, 0, 1)
  ON CONFLICT (conversation_id) DO NOTHING;
  
  -- Get current values
  SELECT xp_total, nivel, conquistas
  INTO v_current_xp, v_current_nivel, v_conquistas
  FROM gamificacao_conversa
  WHERE conversation_id = p_conversation_id;
  
  -- Calculate new XP
  v_new_xp := v_current_xp + p_xp_amount;
  
  -- Calculate new level (every 200 XP = 1 level)
  v_new_nivel := FLOOR(v_new_xp / 200) + 1;
  
  -- Check if leveled up
  IF v_new_nivel > v_current_nivel THEN
    v_level_up := true;
  END IF;
  
  -- Add conquista if provided
  IF p_conquista_nome IS NOT NULL THEN
    v_conquistas := v_conquistas || jsonb_build_object(
      'nome', p_conquista_nome,
      'timestamp', now(),
      'xp', p_xp_amount
    );
  END IF;
  
  -- Update record
  UPDATE gamificacao_conversa
  SET 
    xp_total = v_new_xp,
    nivel = v_new_nivel,
    conquistas = v_conquistas,
    ultima_atualizacao = now()
  WHERE conversation_id = p_conversation_id;
  
  -- Return result
  v_result := jsonb_build_object(
    'xp_total', v_new_xp,
    'nivel', v_new_nivel,
    'level_up', v_level_up,
    'xp_gained', p_xp_amount,
    'xp_to_next_level', (v_new_nivel * 200) - v_new_xp
  );
  
  RETURN v_result;
END;
$$;

-- Function to add timeline event
CREATE OR REPLACE FUNCTION add_timeline_event(
  p_jornada_id uuid,
  p_evento text,
  p_fase text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO timeline_consultor (jornada_id, evento, fase)
  VALUES (p_jornada_id, p_evento, p_fase)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION add_xp_to_conversation IS 'Adds XP to a conversation and handles level ups. Returns updated gamification data.';
COMMENT ON FUNCTION add_timeline_event IS 'Adds an event to the journey timeline. Returns the event ID.';
