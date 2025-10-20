/*
  # Create Consultor Module Complete Schema

  1. New Tables
    - `jornadas_consultor` - Main consultation journey tracking
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `empresa_nome` (text)
      - `etapa_atual` (text) - Current stage: anamnese, mapeamento, priorizacao, execucao
      - `dados_anamnese` (jsonb) - All anamnesis data collected
      - `areas_priorizadas` (jsonb) - Ordered array of prioritized areas
      - `progresso_geral` (integer) - Overall progress percentage
      - `conversation_id` (uuid, references conversations)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `areas_trabalho` - Work areas within each journey
      - `id` (uuid, primary key)
      - `jornada_id` (uuid, references jornadas_consultor)
      - `nome_area` (text) - Area name (Financeiro, RH, etc)
      - `posicao_prioridade` (integer) - Priority order (1, 2, 3...)
      - `etapa_area` (text) - Stage: aguardando, as_is, analise, plano, execucao
      - `pode_iniciar` (boolean) - Can start based on parallelism rules
      - `bloqueada_por` (uuid, references areas_trabalho) - Which area blocks this one
      - `progresso_area` (integer) - Area progress percentage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `processos_mapeados` - Mapped processes within each area
      - `id` (uuid, primary key)
      - `area_id` (uuid, references areas_trabalho)
      - `nome_processo` (text)
      - `input` (text) - Process inputs
      - `output` (text) - Process outputs
      - `ferramentas` (text) - Tools and systems used
      - `metricas` (text) - Metrics and KPIs
      - `regras` (text) - Business rules
      - `fluxo_trabalho` (text) - Workflow description
      - `pessoas` (text) - People involved
      - `fluxo_bpmn_xml` (text) - BPMN XML diagram
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `diagnosticos_area` - Diagnostics for each area
      - `id` (uuid, primary key)
      - `area_id` (uuid, references areas_trabalho)
      - `conteudo_diagnostico` (jsonb) - Structured diagnostic content
      - `status_aprovacao` (text) - Status: rascunho, aguardando_aprovacao, aprovado, rejeitado
      - `versao` (integer) - Version number for revisions
      - `data_aprovacao` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `acoes_plano` - 5W2H action plan items
      - `id` (uuid, primary key)
      - `area_id` (uuid, references areas_trabalho)
      - `what` (text) - What will be done
      - `why` (text) - Why / objective
      - `where` (text) - Where it will be implemented
      - `when` (timestamptz) - Deadline
      - `who` (text) - Responsible person
      - `how` (text) - How it will be executed
      - `how_much` (text) - Estimated cost
      - `status` (text) - Status: a_fazer, em_andamento, bloqueado, concluido
      - `progresso` (integer) - Progress percentage 0-100
      - `evidencias` (jsonb) - Evidence uploads, links, notes
      - `prioridade` (text) - Priority: alta, media, baixa
      - `ordem_kanban` (integer) - Order within kanban column
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `entregaveis_consultor` - Generated deliverables
      - `id` (uuid, primary key)
      - `jornada_id` (uuid, references jornadas_consultor)
      - `area_id` (uuid, references areas_trabalho, nullable)
      - `nome` (text) - Deliverable name
      - `tipo` (text) - Type: anamnese, mapa_geral, mapa_area, bpmn, diagnostico, plano_acao
      - `html_conteudo` (text) - Generated HTML content
      - `etapa_origem` (text) - Stage that generated it
      - `template_usado_id` (uuid, references models, nullable)
      - `data_geracao` (timestamptz)
      - `created_at` (timestamptz)

    - `gamificacao_consultor` - Gamification tracking
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, unique)
      - `xp_total` (integer) - Total experience points
      - `nivel` (integer) - Current level
      - `conquistas` (jsonb) - Array of unlocked achievements
      - `dias_consecutivos` (integer) - Consecutive days streak
      - `areas_completadas` (integer) - Number of completed areas
      - `ultimo_acesso` (timestamptz) - Last access date
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `chat_acoes` - Chat history for action specialists
      - `id` (uuid, primary key)
      - `acao_id` (uuid, references acoes_plano)
      - `user_id` (uuid, references auth.users)
      - `role` (text) - Role: user or assistant
      - `content` (text) - Message content
      - `metadados` (jsonb) - Additional metadata
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Add policies for master users to view all data

  3. Indexes
    - Add indexes on foreign keys
    - Add indexes on frequently queried columns
*/

-- Create jornadas_consultor table
CREATE TABLE IF NOT EXISTS jornadas_consultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empresa_nome text,
  etapa_atual text DEFAULT 'anamnese' NOT NULL,
  dados_anamnese jsonb DEFAULT '{}'::jsonb,
  areas_priorizadas jsonb DEFAULT '[]'::jsonb,
  progresso_geral integer DEFAULT 0,
  conversation_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create areas_trabalho table
CREATE TABLE IF NOT EXISTS areas_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid REFERENCES jornadas_consultor(id) ON DELETE CASCADE NOT NULL,
  nome_area text NOT NULL,
  posicao_prioridade integer NOT NULL,
  etapa_area text DEFAULT 'aguardando' NOT NULL,
  pode_iniciar boolean DEFAULT false,
  bloqueada_por uuid REFERENCES areas_trabalho(id) ON DELETE SET NULL,
  progresso_area integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create processos_mapeados table
CREATE TABLE IF NOT EXISTS processos_mapeados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas_trabalho(id) ON DELETE CASCADE NOT NULL,
  nome_processo text NOT NULL,
  input text DEFAULT '',
  output text DEFAULT '',
  ferramentas text DEFAULT '',
  metricas text DEFAULT '',
  regras text DEFAULT '',
  fluxo_trabalho text DEFAULT '',
  pessoas text DEFAULT '',
  fluxo_bpmn_xml text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create diagnosticos_area table
CREATE TABLE IF NOT EXISTS diagnosticos_area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas_trabalho(id) ON DELETE CASCADE NOT NULL,
  conteudo_diagnostico jsonb DEFAULT '{}'::jsonb,
  status_aprovacao text DEFAULT 'rascunho' NOT NULL,
  versao integer DEFAULT 1,
  data_aprovacao timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create acoes_plano table
CREATE TABLE IF NOT EXISTS acoes_plano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES areas_trabalho(id) ON DELETE CASCADE NOT NULL,
  what text NOT NULL,
  why text DEFAULT '',
  where_field text DEFAULT '',
  when_field timestamptz,
  who text DEFAULT '',
  how text DEFAULT '',
  how_much text DEFAULT '',
  status text DEFAULT 'a_fazer' NOT NULL,
  progresso integer DEFAULT 0,
  evidencias jsonb DEFAULT '[]'::jsonb,
  prioridade text DEFAULT 'media',
  ordem_kanban integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create entregaveis_consultor table
CREATE TABLE IF NOT EXISTS entregaveis_consultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid REFERENCES jornadas_consultor(id) ON DELETE CASCADE NOT NULL,
  area_id uuid REFERENCES areas_trabalho(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL,
  html_conteudo text DEFAULT '',
  etapa_origem text NOT NULL,
  template_usado_id uuid,
  data_geracao timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create gamificacao_consultor table
CREATE TABLE IF NOT EXISTS gamificacao_consultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  xp_total integer DEFAULT 0,
  nivel integer DEFAULT 1,
  conquistas jsonb DEFAULT '[]'::jsonb,
  dias_consecutivos integer DEFAULT 0,
  areas_completadas integer DEFAULT 0,
  ultimo_acesso timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat_acoes table
CREATE TABLE IF NOT EXISTS chat_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid REFERENCES acoes_plano(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  metadados jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE jornadas_consultor ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos_mapeados ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticos_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE acoes_plano ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregaveis_consultor ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamificacao_consultor ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_acoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jornadas_consultor
CREATE POLICY "Users can view own journeys"
  ON jornadas_consultor FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own journeys"
  ON jornadas_consultor FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journeys"
  ON jornadas_consultor FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for areas_trabalho
CREATE POLICY "Users can view own work areas"
  ON areas_trabalho FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = areas_trabalho.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create work areas"
  ON areas_trabalho FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = areas_trabalho.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own work areas"
  ON areas_trabalho FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = areas_trabalho.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- RLS Policies for processos_mapeados
CREATE POLICY "Users can view own processes"
  ON processos_mapeados FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = processos_mapeados.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create processes"
  ON processos_mapeados FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = processos_mapeados.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own processes"
  ON processos_mapeados FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = processos_mapeados.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- RLS Policies for diagnosticos_area
CREATE POLICY "Users can view own diagnostics"
  ON diagnosticos_area FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = diagnosticos_area.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create diagnostics"
  ON diagnosticos_area FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = diagnosticos_area.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own diagnostics"
  ON diagnosticos_area FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = diagnosticos_area.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- RLS Policies for acoes_plano
CREATE POLICY "Users can view own actions"
  ON acoes_plano FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = acoes_plano.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create actions"
  ON acoes_plano FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = acoes_plano.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own actions"
  ON acoes_plano FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM areas_trabalho
      INNER JOIN jornadas_consultor ON jornadas_consultor.id = areas_trabalho.jornada_id
      WHERE areas_trabalho.id = acoes_plano.area_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- RLS Policies for entregaveis_consultor
CREATE POLICY "Users can view own deliverables"
  ON entregaveis_consultor FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = entregaveis_consultor.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create deliverables"
  ON entregaveis_consultor FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = entregaveis_consultor.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- RLS Policies for gamificacao_consultor
CREATE POLICY "Users can view own gamification"
  ON gamificacao_consultor FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gamification"
  ON gamificacao_consultor FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gamification"
  ON gamificacao_consultor FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for chat_acoes
CREATE POLICY "Users can view own action chats"
  ON chat_acoes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create action chats"
  ON chat_acoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jornadas_user ON jornadas_consultor(user_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_conversation ON jornadas_consultor(conversation_id);
CREATE INDEX IF NOT EXISTS idx_areas_jornada ON areas_trabalho(jornada_id);
CREATE INDEX IF NOT EXISTS idx_areas_prioridade ON areas_trabalho(posicao_prioridade);
CREATE INDEX IF NOT EXISTS idx_processos_area ON processos_mapeados(area_id);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_area ON diagnosticos_area(area_id);
CREATE INDEX IF NOT EXISTS idx_acoes_area ON acoes_plano(area_id);
CREATE INDEX IF NOT EXISTS idx_acoes_status ON acoes_plano(status);
CREATE INDEX IF NOT EXISTS idx_entregaveis_jornada ON entregaveis_consultor(jornada_id);
CREATE INDEX IF NOT EXISTS idx_entregaveis_area ON entregaveis_consultor(area_id);
CREATE INDEX IF NOT EXISTS idx_gamificacao_user ON gamificacao_consultor(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_acoes_acao ON chat_acoes(acao_id);