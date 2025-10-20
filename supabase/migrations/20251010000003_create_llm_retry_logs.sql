/*
  # Sistema de Log de Tentativas da LLM

  ## Objetivo
  Rastrear todas as tentativas de chamadas à LLM (OpenAI) com sistema de retry automático,
  registrando erros, correções e sucessos para análise e melhoria contínua.

  ## Tabela: llm_retry_logs

  ### Propósito
  Armazena cada tentativa de interação com a LLM, incluindo:
  - Prompt enviado
  - Resposta recebida
  - Erros capturados
  - Prompts de correção
  - Tempo de execução
  - Sucesso/falha

  ### Campos Principais
  - `operation_type` - Tipo de operação: generate_sql | execute_sql | interpret_results | template_mapping
  - `attempt_number` - Número da tentativa (1, 2, 3...)
  - `error_type` - Tipo de erro: invalid_json | invalid_sql | missing_columns | execution_error | timeout | other
  - `success` - Se esta tentativa foi bem-sucedida
  - `execution_time_ms` - Tempo de execução em milissegundos

  ## Workflow
  1. Função edge chama LLM
  2. Se erro: registra em llm_retry_logs
  3. Constrói prompt de correção com erro
  4. Tenta novamente (até 3x)
  5. Registra cada tentativa
  6. Masters podem analisar padrões de erro

  ## Security
  - RLS habilitado
  - Masters podem ver todos os logs
  - Usuários veem apenas seus próprios logs
  - Logs nunca são deletados (auditoria)

  ## Indexes
  - data_analysis_id (link com análises)
  - operation_type (filtrar por tipo)
  - success (filtrar sucessos/falhas)
  - created_at (ordem cronológica)
*/

-- ============================================================================
-- CRIAR TABELA llm_retry_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_retry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contexto da operação
  data_analysis_id uuid REFERENCES data_analyses(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tipo de operação
  operation_type text NOT NULL CHECK (operation_type IN ('generate_sql', 'execute_sql', 'interpret_results', 'template_mapping')),
  attempt_number int NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 10),

  -- Dados da tentativa
  llm_input_prompt text NOT NULL,
  llm_raw_response text,

  -- Informações de erro
  error_type text CHECK (error_type IN ('invalid_json', 'invalid_sql', 'missing_columns', 'execution_error', 'timeout', 'security_violation', 'group_by_missing', 'no_sql_keywords', 'text_instead_of_sql', 'other')),
  error_message text,
  correction_prompt text,

  -- Status e performance
  success boolean NOT NULL DEFAULT false,
  execution_time_ms int,

  -- Schema context (para debugging)
  schema_columns jsonb,

  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE llm_retry_logs IS 'Log detalhado de todas as tentativas de chamadas à LLM com sistema de retry';
COMMENT ON COLUMN llm_retry_logs.operation_type IS 'Tipo de operação: generate_sql, execute_sql, interpret_results, template_mapping';
COMMENT ON COLUMN llm_retry_logs.attempt_number IS 'Número sequencial da tentativa (1 = primeira tentativa, 2 = primeiro retry, etc)';
COMMENT ON COLUMN llm_retry_logs.llm_input_prompt IS 'Prompt completo enviado para a LLM nesta tentativa';
COMMENT ON COLUMN llm_retry_logs.llm_raw_response IS 'Resposta bruta recebida da LLM (pode estar inválida)';
COMMENT ON COLUMN llm_retry_logs.error_type IS 'Categoria do erro para análise estatística';
COMMENT ON COLUMN llm_retry_logs.error_message IS 'Mensagem completa do erro (SQL, validação, timeout, etc)';
COMMENT ON COLUMN llm_retry_logs.correction_prompt IS 'Prompt de correção que será enviado na próxima tentativa';
COMMENT ON COLUMN llm_retry_logs.success IS 'true = tentativa bem-sucedida | false = falhou e precisa retry';
COMMENT ON COLUMN llm_retry_logs.execution_time_ms IS 'Tempo de execução desta tentativa em milissegundos';
COMMENT ON COLUMN llm_retry_logs.schema_columns IS 'Schema do dataset para contexto (colunas disponíveis)';

-- ============================================================================
-- INDEXES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS llm_retry_logs_data_analysis_id_idx ON llm_retry_logs(data_analysis_id);
CREATE INDEX IF NOT EXISTS llm_retry_logs_user_id_idx ON llm_retry_logs(user_id);
CREATE INDEX IF NOT EXISTS llm_retry_logs_operation_type_idx ON llm_retry_logs(operation_type);
CREATE INDEX IF NOT EXISTS llm_retry_logs_success_idx ON llm_retry_logs(success);
CREATE INDEX IF NOT EXISTS llm_retry_logs_error_type_idx ON llm_retry_logs(error_type) WHERE error_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS llm_retry_logs_created_at_idx ON llm_retry_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS llm_retry_logs_attempt_number_idx ON llm_retry_logs(attempt_number);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE llm_retry_logs ENABLE ROW LEVEL SECURITY;

-- Política 1: Usuários autenticados podem inserir seus próprios logs
CREATE POLICY "llm_retry_logs_insert_own"
  ON llm_retry_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política 2: Usuários podem ver seus próprios logs
CREATE POLICY "llm_retry_logs_select_own"
  ON llm_retry_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política 3: Masters podem ver todos os logs (para análise)
CREATE POLICY "llm_retry_logs_select_master"
  ON llm_retry_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Política 4: Masters podem atualizar logs (para adicionar notas)
CREATE POLICY "llm_retry_logs_update_master"
  ON llm_retry_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Política 5: NUNCA permitir delete (auditoria)
-- Nenhuma política de DELETE = ninguém pode deletar logs

-- ============================================================================
-- FUNÇÃO HELPER: Estatísticas de Retry
-- ============================================================================

CREATE OR REPLACE FUNCTION get_retry_statistics(
  p_start_date timestamptz DEFAULT now() - interval '30 days',
  p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE(
  operation_type text,
  total_attempts bigint,
  successful_first_try bigint,
  successful_after_retry bigint,
  total_failures bigint,
  avg_attempts_to_success numeric,
  most_common_error text,
  avg_execution_time_ms numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      l.operation_type,
      l.data_analysis_id,
      bool_or(l.success) as eventually_succeeded,
      min(CASE WHEN l.success THEN l.attempt_number END) as successful_attempt,
      max(l.attempt_number) as max_attempts,
      avg(l.execution_time_ms) as avg_time
    FROM llm_retry_logs l
    WHERE l.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY l.operation_type, l.data_analysis_id
  ),
  errors AS (
    SELECT DISTINCT ON (l.operation_type)
      l.operation_type,
      l.error_type,
      count(*) as error_count
    FROM llm_retry_logs l
    WHERE l.created_at BETWEEN p_start_date AND p_end_date
      AND l.error_type IS NOT NULL
    GROUP BY l.operation_type, l.error_type
    ORDER BY l.operation_type, error_count DESC
  )
  SELECT
    s.operation_type,
    count(*) as total_attempts,
    count(*) FILTER (WHERE s.successful_attempt = 1) as successful_first_try,
    count(*) FILTER (WHERE s.successful_attempt > 1) as successful_after_retry,
    count(*) FILTER (WHERE NOT s.eventually_succeeded) as total_failures,
    avg(s.successful_attempt) as avg_attempts_to_success,
    e.error_type as most_common_error,
    avg(s.avg_time) as avg_execution_time_ms
  FROM stats s
  LEFT JOIN errors e ON e.operation_type = s.operation_type
  GROUP BY s.operation_type, e.error_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_retry_statistics IS 'Retorna estatísticas de sucesso/falha do sistema de retry da LLM';

-- ============================================================================
-- FUNÇÃO HELPER: Logs de uma Análise Específica
-- ============================================================================

CREATE OR REPLACE FUNCTION get_analysis_retry_chain(
  p_data_analysis_id uuid
)
RETURNS TABLE(
  id uuid,
  operation_type text,
  attempt_number int,
  success boolean,
  error_type text,
  error_message text,
  execution_time_ms int,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.operation_type,
    l.attempt_number,
    l.success,
    l.error_type,
    l.error_message,
    l.execution_time_ms,
    l.created_at
  FROM llm_retry_logs l
  WHERE l.data_analysis_id = p_data_analysis_id
  ORDER BY l.created_at ASC, l.attempt_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_analysis_retry_chain IS 'Retorna toda a cadeia de tentativas de retry para uma análise específica';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'llm_retry_logs'
  ) THEN
    RAISE EXCEPTION 'Table llm_retry_logs was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'llm_retry_logs' AND column_name = 'operation_type'
  ) THEN
    RAISE EXCEPTION 'Column operation_type not found in llm_retry_logs';
  END IF;

  RAISE NOTICE '✅ LLM retry logging system created successfully!';
  RAISE NOTICE '📋 Table: llm_retry_logs';
  RAISE NOTICE '🔒 RLS: Enabled with 4 policies';
  RAISE NOTICE '⚙️ Functions: get_retry_statistics, get_analysis_retry_chain';
  RAISE NOTICE '📊 Ready to track all LLM retry attempts';
END $$;
