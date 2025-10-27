/*
  # Sistema RAG - Base de Conhecimento para Consultor

  1. Tabelas Criadas
    - `knowledge_base_documents` - Documentos de metodologias e frameworks
      - `id` (uuid, primary key)
      - `title` (text) - Título do documento
      - `category` (text) - Categoria: metodologia, framework, template, best_practice
      - `content` (text) - Conteúdo completo do documento
      - `embedding` (vector) - Embedding para busca semântica (via pgvector)
      - `tags` (text[]) - Tags para filtragem rápida
      - `aplicabilidade` (jsonb) - Quando usar este documento
      - `versao` (integer) - Versionamento do documento
      - `ativo` (boolean) - Se está ativo para uso
      - `metadados` (jsonb) - Metadados adicionais
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `consultor_sessoes` - Sessões de trabalho do consultor
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `conversation_id` (uuid, nullable)
      - `titulo_problema` (text) - Título do problema sendo tratado
      - `contexto_negocio` (jsonb) - Contexto do negócio do cliente
      - `metodologias_aplicadas` (text[]) - Metodologias já aplicadas
      - `estado_atual` (text) - Estado: coleta, analise, diagnostico, recomendacao, execucao
      - `documentos_usados` (uuid[]) - IDs dos documentos da knowledge base usados
      - `historico_rag` (jsonb[]) - Histórico de consultas RAG realizadas
      - `entregaveis_gerados` (uuid[]) - IDs dos entregáveis gerados
      - `progresso` (integer) - Progresso 0-100
      - `ativo` (boolean) - Se a sessão está ativa
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `orquestrador_acoes` - Log de ações do orquestrador
      - `id` (uuid, primary key)
      - `sessao_id` (uuid, references consultor_sessoes)
      - `tipo_acao` (text) - Tipo: coletar_info, aplicar_metodologia, gerar_entregavel, validar
      - `entrada` (jsonb) - Input da ação
      - `documentos_consultados` (uuid[]) - Docs da knowledge base consultados
      - `saida` (jsonb) - Output da ação
      - `sucesso` (boolean)
      - `tempo_execucao_ms` (integer)
      - `created_at` (timestamptz)

  2. Segurança
    - Enable RLS em todas as tabelas
    - Policies para usuários acessarem suas próprias sessões
    - Masters podem ver tudo
    - Knowledge base é read-only para users, read-write para masters

  3. Índices
    - Índices para busca rápida
    - Índice GIN para arrays e jsonb
    - Índice para busca de texto completo
*/

-- Extensão para vetores (se ainda não existir)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de documentos da base de conhecimento
CREATE TABLE IF NOT EXISTS knowledge_base_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('metodologia', 'framework', 'template', 'best_practice', 'caso_uso')),
  content text NOT NULL,
  embedding vector(1536), -- OpenAI embeddings dimension
  tags text[] DEFAULT '{}',
  aplicabilidade jsonb DEFAULT '{}',
  versao integer DEFAULT 1,
  ativo boolean DEFAULT true,
  metadados jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de sessões do consultor
CREATE TABLE IF NOT EXISTS consultor_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid,
  titulo_problema text NOT NULL,
  contexto_negocio jsonb DEFAULT '{}',
  metodologias_aplicadas text[] DEFAULT '{}',
  estado_atual text DEFAULT 'coleta' CHECK (estado_atual IN ('coleta', 'analise', 'diagnostico', 'recomendacao', 'execucao', 'concluido')),
  documentos_usados uuid[] DEFAULT '{}',
  historico_rag jsonb[] DEFAULT '{}',
  entregaveis_gerados uuid[] DEFAULT '{}',
  progresso integer DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de log de ações do orquestrador
CREATE TABLE IF NOT EXISTS orquestrador_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid REFERENCES consultor_sessoes(id) ON DELETE CASCADE NOT NULL,
  tipo_acao text NOT NULL,
  entrada jsonb DEFAULT '{}',
  documentos_consultados uuid[] DEFAULT '{}',
  saida jsonb DEFAULT '{}',
  sucesso boolean DEFAULT true,
  tempo_execucao_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultor_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orquestrador_acoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies para knowledge_base_documents
-- Todos podem ler documentos ativos
CREATE POLICY "Users can read active knowledge documents"
  ON knowledge_base_documents FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Apenas masters podem inserir/atualizar documentos
CREATE POLICY "Masters can manage knowledge documents"
  ON knowledge_base_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- RLS Policies para consultor_sessoes
CREATE POLICY "Users can view own sessions"
  ON consultor_sessoes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON consultor_sessoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON consultor_sessoes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Masters podem ver todas as sessões
CREATE POLICY "Masters can view all sessions"
  ON consultor_sessoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- RLS Policies para orquestrador_acoes
CREATE POLICY "Users can view own orchestrator actions"
  ON orquestrador_acoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consultor_sessoes
      WHERE consultor_sessoes.id = orquestrador_acoes.sessao_id
      AND consultor_sessoes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create orchestrator actions"
  ON orquestrador_acoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultor_sessoes
      WHERE consultor_sessoes.id = orquestrador_acoes.sessao_id
      AND consultor_sessoes.user_id = auth.uid()
    )
  );

-- Masters podem ver todas as ações
CREATE POLICY "Masters can view all orchestrator actions"
  ON orquestrador_acoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base_documents(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_ativo ON knowledge_base_documents(ativo);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding ON knowledge_base_documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_search ON knowledge_base_documents USING gin(to_tsvector('portuguese', content));

CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_user ON consultor_sessoes(user_id);
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_conversation ON consultor_sessoes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_estado ON consultor_sessoes(estado_atual);
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_ativo ON consultor_sessoes(ativo);

CREATE INDEX IF NOT EXISTS idx_orquestrador_acoes_sessao ON orquestrador_acoes(sessao_id);
CREATE INDEX IF NOT EXISTS idx_orquestrador_acoes_tipo ON orquestrador_acoes(tipo_acao);
CREATE INDEX IF NOT EXISTS idx_orquestrador_acoes_created ON orquestrador_acoes(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultor_sessoes_updated_at BEFORE UPDATE ON consultor_sessoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
