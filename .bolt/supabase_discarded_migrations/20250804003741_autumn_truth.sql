/*
  # Schema Completo do proceda.ia

  1. Tabelas
    - `users` - Usuários do sistema
    - `projects` - Projetos dos usuários  
    - `documents` - Documentos gerados
    - `models` - Templates/modelos
    - `conversations` - Conversas do chat
    - `messages` - Mensagens das conversas

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas simples e funcionais
    - Masters têm acesso total
    - Users só veem próprios dados

  3. Triggers
    - Auto-criação de usuário após signup
*/

-- Enum para roles
CREATE TYPE user_role AS ENUM ('user', 'master');

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ═══════════════════════════════════════════════════════════════
--                           TABELA USERS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'user',
  tokens_used integer NOT NULL DEFAULT 0,
  tokens_limit integer NOT NULL DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política SUPER SIMPLES para Masters
CREATE POLICY "masters_full_access" ON users
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role = 'master'
  )
);

-- Política para Users verem apenas próprios dados
CREATE POLICY "users_own_data" ON users
FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Trigger
CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
--                         TABELA PROJECTS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_projects" ON projects
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
--                        TABELA DOCUMENTS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'document',
  file_url text DEFAULT '',
  template_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_documents" ON documents
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
--                         TABELA MODELS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text NOT NULL DEFAULT 'general',
  file_type text NOT NULL DEFAULT 'template',
  file_url text DEFAULT '',
  description text DEFAULT '',
  tags text[] DEFAULT '{}',
  preview_image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- Todos podem ler models
CREATE POLICY "everyone_can_read_models" ON models
FOR SELECT TO authenticated
USING (true);

-- Apenas masters podem inserir/atualizar models
CREATE POLICY "masters_can_manage_models" ON models
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role = 'master'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role = 'master'
  )
);

CREATE OR REPLACE TRIGGER update_models_updated_at
    BEFORE UPDATE ON models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
--                      TABELA CONVERSATIONS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Nova Conversa',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_conversations" ON conversations
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
--                        TABELA MESSAGES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_messages_in_own_conversations" ON messages
FOR ALL TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE user_id = auth.uid()
  )
);

-- ═══════════════════════════════════════════════════════════════
--                    FUNÇÃO HANDLE NEW USER
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, tokens_used, tokens_limit)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    CASE 
      WHEN NEW.email LIKE '%master%' OR NEW.email LIKE '%admin%' THEN 'master'::user_role
      ELSE 'user'::user_role
    END,
    0,
    CASE 
      WHEN NEW.email LIKE '%master%' OR NEW.email LIKE '%admin%' THEN 50000
      ELSE 1000
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar usuário automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();