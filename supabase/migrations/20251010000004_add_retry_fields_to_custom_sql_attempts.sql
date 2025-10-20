/*
  # Adicionar Campos de Retry ao custom_sql_attempts

  ## Objetivo
  Adicionar campos para rastrear tentativas de retry da LLM e vincular aos logs
  detalhados em llm_retry_logs.

  ## Novos Campos
  - retry_count: Número de tentativas necessárias para gerar/executar o SQL
  - final_success: Se conseguiu sucesso após retries ou falhou definitivamente
  - retry_log_ids: Array de UUIDs dos logs de retry para rastreamento completo

  ## Benefícios
  - Análise de quais perguntas/datasets causam mais erros
  - Identificar padrões de erro para melhorar prompts
  - Vincular tentativas de SQL customizado com seus logs de retry
*/

-- ============================================================================
-- ADICIONAR NOVOS CAMPOS
-- ============================================================================

-- Adicionar retry_count
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_sql_attempts' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE custom_sql_attempts
    ADD COLUMN retry_count int DEFAULT 1 CHECK (retry_count >= 1 AND retry_count <= 10);

    COMMENT ON COLUMN custom_sql_attempts.retry_count IS 'Número de tentativas necessárias para gerar o SQL (1 = sucesso na primeira, 3 = sucesso na terceira)';
  END IF;
END $$;

-- Adicionar final_success
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_sql_attempts' AND column_name = 'final_success'
  ) THEN
    ALTER TABLE custom_sql_attempts
    ADD COLUMN final_success boolean DEFAULT true;

    COMMENT ON COLUMN custom_sql_attempts.final_success IS 'true = conseguiu sucesso (pode ter sido após retries) | false = falhou mesmo após todas tentativas';
  END IF;
END $$;

-- Adicionar retry_log_ids
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_sql_attempts' AND column_name = 'retry_log_ids'
  ) THEN
    ALTER TABLE custom_sql_attempts
    ADD COLUMN retry_log_ids uuid[] DEFAULT ARRAY[]::uuid[];

    COMMENT ON COLUMN custom_sql_attempts.retry_log_ids IS 'Array de UUIDs dos logs em llm_retry_logs para rastrear toda a cadeia de tentativas';
  END IF;
END $$;

-- ============================================================================
-- CRIAR ÍNDICE
-- ============================================================================

CREATE INDEX IF NOT EXISTS custom_sql_attempts_retry_count_idx ON custom_sql_attempts(retry_count);
CREATE INDEX IF NOT EXISTS custom_sql_attempts_final_success_idx ON custom_sql_attempts(final_success);

-- ============================================================================
-- FUNÇÃO HELPER: Estatísticas de Retry por SQL Customizado
-- ============================================================================

CREATE OR REPLACE FUNCTION get_custom_sql_retry_stats(
  p_start_date timestamptz DEFAULT now() - interval '30 days',
  p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE(
  total_attempts bigint,
  successful_first_try bigint,
  successful_after_retry bigint,
  total_failures bigint,
  avg_retry_count numeric,
  max_retries_needed int,
  success_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    count(*) as total_attempts,
    count(*) FILTER (WHERE retry_count = 1) as successful_first_try,
    count(*) FILTER (WHERE retry_count > 1 AND final_success = true) as successful_after_retry,
    count(*) FILTER (WHERE final_success = false) as total_failures,
    avg(retry_count) as avg_retry_count,
    max(retry_count) as max_retries_needed,
    round(
      (count(*) FILTER (WHERE final_success = true)::numeric / count(*)::numeric) * 100,
      2
    ) as success_rate
  FROM custom_sql_attempts
  WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_custom_sql_retry_stats IS 'Retorna estatísticas de retry para SQLs customizados (sucesso vs falha, tentativas necessárias)';

-- ============================================================================
-- FUNÇÃO HELPER: Obter SQLs com Mais Retries (Problemáticos)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_problematic_sql_attempts(
  p_min_retries int DEFAULT 2,
  p_limit int DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  user_question text,
  retry_count int,
  final_success boolean,
  execution_error text,
  created_at timestamptz,
  retry_log_ids uuid[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.user_question,
    c.retry_count,
    c.final_success,
    c.execution_error,
    c.created_at,
    c.retry_log_ids
  FROM custom_sql_attempts c
  WHERE c.retry_count >= p_min_retries
  ORDER BY c.retry_count DESC, c.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_problematic_sql_attempts IS 'Retorna SQLs que precisaram de múltiplos retries (para análise de problemas recorrentes)';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_sql_attempts' AND column_name = 'retry_count'
  ) THEN
    RAISE EXCEPTION 'Column retry_count was not added to custom_sql_attempts';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_sql_attempts' AND column_name = 'final_success'
  ) THEN
    RAISE EXCEPTION 'Column final_success was not added to custom_sql_attempts';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_sql_attempts' AND column_name = 'retry_log_ids'
  ) THEN
    RAISE EXCEPTION 'Column retry_log_ids was not added to custom_sql_attempts';
  END IF;

  RAISE NOTICE '✅ Retry fields added to custom_sql_attempts successfully!';
  RAISE NOTICE '📊 New fields: retry_count, final_success, retry_log_ids';
  RAISE NOTICE '⚙️ New functions: get_custom_sql_retry_stats, get_problematic_sql_attempts';
END $$;
