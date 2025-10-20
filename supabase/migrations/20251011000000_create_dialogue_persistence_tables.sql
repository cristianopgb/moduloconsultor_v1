/*
  # Sistema de Persistência de Diálogo Conversacional

  1. Novas Tabelas
    - `dialogue_states`
      - Armazena o estado do diálogo de cada conversa
      - Estado, contexto, completude, histórico de perguntas
      - Relacionamento 1:1 com conversations

    - `dialogue_messages`
      - Histórico completo de mensagens do diálogo
      - Tipos: llm_question, llm_statement, user_answer, user_message
      - Permite recuperar conversa completa ao voltar para a tela

  2. Segurança
    - RLS habilitado em ambas as tabelas
    - Usuários só acessam seus próprios diálogos
    - Masters podem ver tudo para debug

  3. Funcionalidade
    - Persistência completa do fluxo conversacional
    - Recuperação de estado ao navegar entre páginas
    - Histórico de perguntas para evitar loops
    - Contexto acumulado para LLM tomar decisões inteligentes
*/

-- Tabela principal de estado do diálogo
CREATE TABLE IF NOT EXISTS dialogue_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid UNIQUE NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Estado atual do diálogo
  state text NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'conversing', 'ready_to_analyze', 'analyzing', 'completed')),

  -- Contexto acumulado
  context_data jsonb DEFAULT '{}'::jsonb,
  -- Estrutura: { schema: [...], sample: [...], file_metadata: {...}, domain_understanding: {...} }

  -- Histórico de perguntas para evitar repetição
  questions_history jsonb DEFAULT '[]'::jsonb,
  -- Estrutura: [{ question: "...", asked_at: "...", answered: true/false, answer: "..." }, ...]

  -- Respostas acumuladas do usuário
  user_responses jsonb DEFAULT '{}'::jsonb,
  -- Estrutura: { key1: "resposta1", key2: "resposta2", ... }

  -- Métrica de completude do contexto (0-100)
  completeness_score integer DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),

  -- Entendimento da LLM sobre o contexto
  llm_understanding jsonb DEFAULT '{}'::jsonb,
  -- Estrutura: { objective: "...", domain: "...", key_metrics: [...], constraints: [...] }

  -- Flag se está pronto para análise
  ready_for_analysis boolean DEFAULT false,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dialogue_states_conversation ON dialogue_states(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_states_state ON dialogue_states(state);
CREATE INDEX IF NOT EXISTS idx_dialogue_states_ready ON dialogue_states(ready_for_analysis);

-- Tabela de mensagens do diálogo
CREATE TABLE IF NOT EXISTS dialogue_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dialogue_state_id uuid NOT NULL REFERENCES dialogue_states(id) ON DELETE CASCADE,

  -- Tipo de mensagem
  message_type text NOT NULL CHECK (message_type IN ('llm_question', 'llm_statement', 'user_answer', 'user_message')),

  -- Conteúdo da mensagem
  content text NOT NULL,

  -- Se espera resposta do usuário (mostra campo de input)
  expects_response boolean DEFAULT false,

  -- Metadados adicionais
  metadata jsonb DEFAULT '{}'::jsonb,
  -- Estrutura: { suggestions: [...], related_question_id: "...", confidence: 0.95 }

  -- Timestamp
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dialogue_messages_state ON dialogue_messages(dialogue_state_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_messages_type ON dialogue_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_dialogue_messages_created ON dialogue_messages(created_at DESC);

-- Trigger para atualizar updated_at em dialogue_states
CREATE OR REPLACE FUNCTION update_dialogue_state_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dialogue_states_updated_at
  BEFORE UPDATE ON dialogue_states
  FOR EACH ROW
  EXECUTE FUNCTION update_dialogue_state_timestamp();

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE dialogue_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialogue_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES: dialogue_states
-- =====================================================

-- SELECT: Usuários veem seus próprios diálogos, masters veem tudo
CREATE POLICY "Users can view own dialogue states"
  ON dialogue_states FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = dialogue_states.conversation_id
      AND conversations.user_id = auth.uid()
    )
    OR is_master()
  );

-- INSERT: Usuários podem criar diálogos em suas próprias conversas
CREATE POLICY "Users can create dialogue states for own conversations"
  ON dialogue_states FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = dialogue_states.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- UPDATE: Usuários podem atualizar seus próprios diálogos
CREATE POLICY "Users can update own dialogue states"
  ON dialogue_states FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = dialogue_states.conversation_id
      AND conversations.user_id = auth.uid()
    )
    OR is_master()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = dialogue_states.conversation_id
      AND conversations.user_id = auth.uid()
    )
    OR is_master()
  );

-- DELETE: Usuários podem deletar seus próprios diálogos (cascade já limpa as mensagens)
CREATE POLICY "Users can delete own dialogue states"
  ON dialogue_states FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = dialogue_states.conversation_id
      AND conversations.user_id = auth.uid()
    )
    OR is_master()
  );

-- =====================================================
-- POLICIES: dialogue_messages
-- =====================================================

-- SELECT: Usuários veem mensagens dos seus diálogos
CREATE POLICY "Users can view own dialogue messages"
  ON dialogue_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dialogue_states
      JOIN conversations ON conversations.id = dialogue_states.conversation_id
      WHERE dialogue_states.id = dialogue_messages.dialogue_state_id
      AND conversations.user_id = auth.uid()
    )
    OR is_master()
  );

-- INSERT: Usuários podem adicionar mensagens nos seus diálogos
CREATE POLICY "Users can create dialogue messages for own states"
  ON dialogue_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dialogue_states
      JOIN conversations ON conversations.id = dialogue_states.conversation_id
      WHERE dialogue_states.id = dialogue_messages.dialogue_state_id
      AND conversations.user_id = auth.uid()
    )
  );

-- UPDATE: Usuários podem atualizar mensagens dos seus diálogos
CREATE POLICY "Users can update own dialogue messages"
  ON dialogue_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dialogue_states
      JOIN conversations ON conversations.id = dialogue_states.conversation_id
      WHERE dialogue_states.id = dialogue_messages.dialogue_state_id
      AND conversations.user_id = auth.uid()
    )
    OR is_master()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dialogue_states
      JOIN conversations ON conversations.id = dialogue_states.conversation_id
      WHERE dialogue_states.id = dialogue_messages.dialogue_state_id
      AND conversations.user_id = auth.uid()
    )
    OR is_master()
  );

-- DELETE: Usuários podem deletar mensagens dos seus diálogos
CREATE POLICY "Users can delete own dialogue messages"
  ON dialogue_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dialogue_states
      JOIN conversations ON conversations.id = dialogue_states.conversation_id
      WHERE dialogue_states.id = dialogue_messages.dialogue_state_id
      AND conversations.user_id = auth.uid()
    )
    OR is_master()
  );
