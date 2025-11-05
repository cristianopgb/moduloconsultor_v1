/*
  # Expandir Sistema Kanban para Gestão Completa de Projetos

  1. Alterações na Tabela kanban_cards
    - Adiciona campo `observacoes` (text) para notas do usuário
    - Adiciona campo `tags` (text[]) para categorização
    - Adiciona campo `responsavel_id` (uuid) referência para users
    - Adiciona campo `prioridade` (text) com valores: alta, media, baixa
    - Adiciona campo `data_conclusao` (timestamptz) para registro de conclusão
    - Adiciona campo `progresso` (integer) de 0 a 100
    - Modifica constraint de status para incluir novo fluxo correto
    - Adiciona campo `sessao_id` (uuid) para vincular à sessão de consultoria

  2. Nova Tabela acao_anexos
    - `id` (uuid, primary key)
    - `acao_id` (uuid, foreign key para kanban_cards)
    - `nome_arquivo` (text)
    - `storage_path` (text)
    - `tipo_mime` (text)
    - `tamanho_bytes` (bigint)
    - `descricao` (text, opcional)
    - `uploaded_by` (uuid, foreign key para users)
    - `created_at` (timestamptz)

  3. Nova Tabela project_files
    - `id` (uuid, primary key)
    - `jornada_id` (uuid, foreign key para jornadas_consultor)
    - `nome_arquivo` (text)
    - `storage_path` (text)
    - `tipo_mime` (text)
    - `tamanho_bytes` (bigint)
    - `contexto` (text) - para que foi usado
    - `uploaded_by` (uuid, foreign key para users)
    - `created_at` (timestamptz)

  4. Nova Tabela acao_historico
    - `id` (uuid, primary key)
    - `acao_id` (uuid, foreign key para kanban_cards)
    - `campo_alterado` (text)
    - `valor_anterior` (text)
    - `valor_novo` (text)
    - `alterado_por` (uuid, foreign key para users)
    - `origem` (text) - 'manual' ou 'agente_executor'
    - `created_at` (timestamptz)

  5. Security
    - Enable RLS em todas as novas tabelas
    - Políticas para usuários acessarem seus próprios dados
    - Políticas para masters visualizarem tudo
*/

-- Expandir tabela kanban_cards
ALTER TABLE kanban_cards
ADD COLUMN IF NOT EXISTS observacoes TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS prioridade TEXT CHECK (prioridade IN ('alta', 'media', 'baixa')) DEFAULT 'media',
ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS progresso INTEGER DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
ADD COLUMN IF NOT EXISTS sessao_id UUID REFERENCES consultor_sessoes(id) ON DELETE CASCADE;

-- Corrigir constraint de status para fluxo correto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'kanban_cards' AND constraint_name LIKE '%status%'
  ) THEN
    ALTER TABLE kanban_cards DROP CONSTRAINT IF EXISTS kanban_cards_status_check;
  END IF;
END $$;

ALTER TABLE kanban_cards
ADD CONSTRAINT kanban_cards_status_check
CHECK (status IN ('todo', 'in_progress', 'blocked', 'done'));

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_kanban_cards_responsavel_id ON kanban_cards(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_prioridade ON kanban_cards(prioridade);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_sessao_id ON kanban_cards(sessao_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_tags ON kanban_cards USING GIN(tags);

-- Criar tabela de anexos de ações
CREATE TABLE IF NOT EXISTS acao_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  descricao TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE acao_anexos ENABLE ROW LEVEL SECURITY;

-- Políticas para acao_anexos
CREATE POLICY "Users can view attachments of their journey actions"
  ON acao_anexos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kanban_cards
      JOIN jornadas_consultor ON kanban_cards.jornada_id = jornadas_consultor.id
      WHERE kanban_cards.id = acao_anexos.acao_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments to their journey actions"
  ON acao_anexos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kanban_cards
      JOIN jornadas_consultor ON kanban_cards.jornada_id = jornadas_consultor.id
      WHERE kanban_cards.id = acao_anexos.acao_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own attachments"
  ON acao_anexos FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Masters can view all attachments"
  ON acao_anexos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Criar tabela de arquivos do projeto
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES jornadas_consultor(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  contexto TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- Políticas para project_files
CREATE POLICY "Users can view files of their journey"
  ON project_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = project_files.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload files to their journey"
  ON project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = project_files.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own files"
  ON project_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Masters can view all project files"
  ON project_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Criar tabela de histórico de ações
CREATE TABLE IF NOT EXISTS acao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  alterado_por UUID NOT NULL REFERENCES users(id),
  origem TEXT CHECK (origem IN ('manual', 'agente_executor')) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE acao_historico ENABLE ROW LEVEL SECURITY;

-- Políticas para acao_historico
CREATE POLICY "Users can view history of their journey actions"
  ON acao_historico FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kanban_cards
      JOIN jornadas_consultor ON kanban_cards.jornada_id = jornadas_consultor.id
      WHERE kanban_cards.id = acao_historico.acao_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert action history"
  ON acao_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Masters can view all action history"
  ON acao_historico FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_acao_anexos_acao_id ON acao_anexos(acao_id);
CREATE INDEX IF NOT EXISTS idx_project_files_jornada_id ON project_files(jornada_id);
CREATE INDEX IF NOT EXISTS idx_acao_historico_acao_id ON acao_historico(acao_id);
CREATE INDEX IF NOT EXISTS idx_acao_historico_created_at ON acao_historico(created_at DESC);

-- Função para atualizar progresso automaticamente baseado em status
CREATE OR REPLACE FUNCTION update_acao_progresso()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-atualizar progresso baseado no status
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.progresso = 100;
    NEW.data_conclusao = now();
  ELSIF NEW.status = 'in_progress' AND NEW.progresso = 0 THEN
    NEW.progresso = 25;
  ELSIF NEW.status = 'todo' THEN
    NEW.progresso = 0;
    NEW.data_conclusao = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_acao_progresso
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_acao_progresso();

-- Função para registrar mudanças no histórico
CREATE OR REPLACE FUNCTION log_acao_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar mudança de status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO acao_historico (acao_id, campo_alterado, valor_anterior, valor_novo, alterado_por, origem)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, auth.uid(), 'manual');
  END IF;

  -- Registrar mudança de responsável
  IF OLD.responsavel IS DISTINCT FROM NEW.responsavel THEN
    INSERT INTO acao_historico (acao_id, campo_alterado, valor_anterior, valor_novo, alterado_por, origem)
    VALUES (NEW.id, 'responsavel', OLD.responsavel, NEW.responsavel, auth.uid(), 'manual');
  END IF;

  -- Registrar mudança de prazo
  IF OLD.prazo IS DISTINCT FROM NEW.prazo THEN
    INSERT INTO acao_historico (acao_id, campo_alterado, valor_anterior, valor_novo, alterado_por, origem)
    VALUES (NEW.id, 'prazo', OLD.prazo, NEW.prazo, auth.uid(), 'manual');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_acao_changes
  AFTER UPDATE ON kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION log_acao_changes();

-- Criar bucket de storage para anexos (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-attachments', 'project-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para anexos
CREATE POLICY "Users can upload attachments to their projects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-attachments');

CREATE POLICY "Users can view attachments of their projects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'project-attachments');

CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'project-attachments' AND owner = auth.uid());
