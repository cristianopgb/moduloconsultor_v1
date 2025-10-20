/*
  # Sistema de Knowledge Base para SQL Customizados

  ## Objetivo
  Criar um sistema de aprendizado onde SQLs customizados gerados dinamicamente
  podem ser revisados, aprovados e transformados em templates permanentes.

  ## Tabela: custom_sql_attempts

  ### Propósito
  Armazena todas as tentativas de análise onde:
  - Nenhum template analytics foi encontrado (confidence < 70%)
  - SQL dinâmico foi gerado pela LLM
  - Necessita revisão humana para possível aprovação como template

  ### Campos
  - `id` (uuid) - Identificador único
  - `user_id` (uuid) - Usuário que fez a pergunta
  - `conversation_id` (uuid) - Conversa onde aconteceu (opcional)
  - `message_id` (uuid) - Mensagem associada (opcional)
  - `data_analysis_id` (uuid) - Referência à análise completa
  - `user_question` (text) - Pergunta original do usuário
  - `generated_sql` (text) - SQL gerado pela LLM
  - `dataset_columns` (jsonb) - Schema do dataset usado
  - `query_results_sample` (jsonb) - Amostra dos resultados (primeiras 10 linhas)
  - `execution_success` (boolean) - Se o SQL executou com sucesso
  - `execution_error` (text) - Mensagem de erro caso tenha falha
  - `status` (text) - pending | approved | rejected | duplicate
  - `reviewed_by` (uuid) - Usuário master que revisou (se aprovado/rejeitado)
  - `reviewed_at` (timestamptz) - Data/hora da revisão
  - `approved_template_id` (uuid) - ID do template criado (se aprovado)
  - `rejection_reason` (text) - Motivo da rejeição
  - `notes` (text) - Observações do revisor
  - `created_at` (timestamptz) - Data de criação
  - `updated_at` (timestamptz) - Data de atualização

  ## Workflow
  1. Edge function `analyze-file` salva SQL customizado aqui quando não encontra template
  2. Master acessa `/admin/learning` e vê lista de SQLs pendentes
  3. Master pode:
     - Aprovar → cria novo template analytics na tabela `models`
     - Rejeitar → marca como rejeitado com motivo
     - Ignorar → fica pendente para revisão futura
  4. Sistema detecta duplicatas automaticamente

  ## Security
  - RLS habilitado
  - Apenas masters podem visualizar/aprovar/rejeitar
  - Usuários normais NÃO têm acesso direto

  ## Indexes
  - status (para filtrar pendentes)
  - user_id (para rastrear por usuário)
  - created_at (ordem cronológica)
  - data_analysis_id (link com análises)
*/

-- ============================================================================
-- CRIAR TABELA custom_sql_attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_sql_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contexto da solicitação
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  data_analysis_id uuid REFERENCES data_analyses(id) ON DELETE CASCADE,

  -- Conteúdo da análise
  user_question text NOT NULL,
  generated_sql text NOT NULL,
  dataset_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  query_results_sample jsonb DEFAULT '[]'::jsonb,

  -- Status de execução
  execution_success boolean NOT NULL DEFAULT true,
  execution_error text,

  -- Workflow de revisão
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  approved_template_id uuid REFERENCES models(id) ON DELETE SET NULL,
  rejection_reason text,
  notes text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE custom_sql_attempts IS 'Knowledge base de SQLs customizados gerados dinamicamente para possível aprovação como templates';
COMMENT ON COLUMN custom_sql_attempts.user_question IS 'Pergunta original que gerou este SQL customizado';
COMMENT ON COLUMN custom_sql_attempts.generated_sql IS 'SQL gerado pela LLM (sem template)';
COMMENT ON COLUMN custom_sql_attempts.dataset_columns IS 'Schema do dataset: [{name, type, sample_values}]';
COMMENT ON COLUMN custom_sql_attempts.query_results_sample IS 'Primeiras 10 linhas de resultado para preview';
COMMENT ON COLUMN custom_sql_attempts.status IS 'pending: aguardando revisão | approved: virou template | rejected: não aprovado | duplicate: já existe similar';
COMMENT ON COLUMN custom_sql_attempts.approved_template_id IS 'Se aprovado, ID do template analytics criado na tabela models';

-- ============================================================================
-- INDEXES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS custom_sql_attempts_status_idx ON custom_sql_attempts(status);
CREATE INDEX IF NOT EXISTS custom_sql_attempts_user_id_idx ON custom_sql_attempts(user_id);
CREATE INDEX IF NOT EXISTS custom_sql_attempts_created_at_idx ON custom_sql_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS custom_sql_attempts_data_analysis_id_idx ON custom_sql_attempts(data_analysis_id);
CREATE INDEX IF NOT EXISTS custom_sql_attempts_reviewed_by_idx ON custom_sql_attempts(reviewed_by);

-- ============================================================================
-- TRIGGER PARA ATUALIZAR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_custom_sql_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_sql_attempts_updated_at
  BEFORE UPDATE ON custom_sql_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_sql_attempts_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
--
-- IMPORTANTE: As políticas RLS para custom_sql_attempts foram MOVIDAS para:
-- → 20251009045136_20251009050000_clean_rls_policies_final.sql
--
-- Esta migração apenas habilita RLS na tabela. As políticas são criadas na
-- migração consolidada para evitar conflitos e duplicação.
--
-- Políticas que serão criadas posteriormente:
--   1. custom_sql_attempts_insert_auth    - Usuários autenticados podem inserir
--   2. custom_sql_attempts_select_own     - Usuários veem seus próprios
--   3. custom_sql_attempts_select_master  - Masters veem tudo
--   4. custom_sql_attempts_update_master  - Masters podem atualizar
--   5. custom_sql_attempts_delete_master  - Masters podem deletar
-- ============================================================================

ALTER TABLE custom_sql_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FUNÇÃO HELPER: Detectar Templates Duplicados
-- ============================================================================

CREATE OR REPLACE FUNCTION check_similar_templates(
  p_user_question text,
  p_generated_sql text,
  p_similarity_threshold float DEFAULT 0.7
)
RETURNS TABLE(
  template_id uuid,
  template_name text,
  similarity_score float,
  is_duplicate boolean
) AS $$
BEGIN
  -- Verifica se já existe template analytics similar
  -- baseado em semantic_tags e estrutura do SQL

  RETURN QUERY
  SELECT
    m.id,
    m.name,
    0.8::float as score, -- Placeholder: implementar similarity real se necessário
    true as is_dup
  FROM models m
  WHERE m.template_type = 'analytics'
    AND m.sql_template IS NOT NULL
    AND (
      -- Checa se a pergunta contém tags semânticas do template
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(m.semantic_tags) AS tag
        WHERE lower(p_user_question) LIKE '%' || lower(tag) || '%'
      )
      -- Ou se o SQL gerado é muito similar ao template
      OR similarity(m.sql_template, p_generated_sql) > p_similarity_threshold
    )
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_similar_templates IS 'Detecta templates analytics similares para evitar duplicação';

-- ============================================================================
-- FUNÇÃO HELPER: Aprovar SQL Customizado como Template
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_custom_sql_as_template(
  p_custom_sql_id uuid,
  p_template_name text,
  p_template_category text,
  p_template_description text,
  p_semantic_tags jsonb,
  p_required_columns jsonb,
  p_reviewer_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_custom_sql custom_sql_attempts%ROWTYPE;
  v_new_template_id uuid;
BEGIN
  -- 1. Buscar registro de SQL customizado
  SELECT * INTO v_custom_sql
  FROM custom_sql_attempts
  WHERE id = p_custom_sql_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom SQL attempt not found: %', p_custom_sql_id;
  END IF;

  IF v_custom_sql.status != 'pending' THEN
    RAISE EXCEPTION 'Custom SQL attempt is not pending (status: %)', v_custom_sql.status;
  END IF;

  -- 2. Criar novo template analytics na tabela models
  INSERT INTO models (
    name,
    category,
    description,
    template_type,
    file_type,
    sql_template,
    required_columns,
    semantic_tags,
    created_at,
    updated_at
  ) VALUES (
    p_template_name,
    p_template_category,
    p_template_description,
    'analytics',
    NULL, -- Analytics templates não precisam de file_type
    v_custom_sql.generated_sql,
    p_required_columns,
    p_semantic_tags,
    now(),
    now()
  )
  RETURNING id INTO v_new_template_id;

  -- 3. Atualizar registro de SQL customizado como aprovado
  UPDATE custom_sql_attempts
  SET
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    approved_template_id = v_new_template_id,
    updated_at = now()
  WHERE id = p_custom_sql_id;

  RETURN v_new_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION approve_custom_sql_as_template IS 'Aprova um SQL customizado e cria template analytics permanente';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'custom_sql_attempts'
  ) THEN
    RAISE EXCEPTION 'Table custom_sql_attempts was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_sql_attempts' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'Column status not found in custom_sql_attempts';
  END IF;

  RAISE NOTICE '✅ Knowledge base system created successfully!';
  RAISE NOTICE '📋 Table: custom_sql_attempts';
  RAISE NOTICE '🔒 RLS: Enabled (policies in 20251009045136_clean_rls_policies_final.sql)';
  RAISE NOTICE '⚙️ Functions: check_similar_templates, approve_custom_sql_as_template';
END $$;
