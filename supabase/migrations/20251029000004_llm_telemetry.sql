/*
  # Sistema de Telemetria LLM

  1. Nova Tabela
    - llm_usage_log: tracking de todas chamadas LLM
    - Campos: function, profile, model, temperature, tokens, response_time, success, user_id

  2. View de Métricas
    - llm_usage_metrics: agregação dos últimos 30 dias
    - Agrupa por: function, profile, model
    - Métricas: total_calls, total_tokens, avg_response_time, success_rate

  3. Índices
    - idx_llm_usage_function: busca por função
    - idx_llm_usage_user: busca por usuário
    - idx_llm_usage_created: busca por data

  4. RLS
    - Masters veem tudo
    - Usuários veem apenas seus próprios logs
*/

-- Tabela para tracking de chamadas LLM
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_function TEXT NOT NULL,
  profile_used TEXT NOT NULL,
  model TEXT NOT NULL,
  temperature NUMERIC NOT NULL,
  max_tokens INTEGER NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE llm_usage_log ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_llm_usage_function ON llm_usage_log(edge_function);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user ON llm_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage_log(created_at);

-- View para metricas
CREATE OR REPLACE VIEW llm_usage_metrics AS
SELECT
  edge_function,
  profile_used,
  model,
  COUNT(*) as total_calls,
  SUM(total_tokens) as total_tokens,
  AVG(response_time_ms) as avg_response_time_ms,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
  SUM(CASE WHEN success THEN 0 ELSE 1 END) as failed_calls
FROM llm_usage_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY edge_function, profile_used, model
ORDER BY total_calls DESC;

-- RLS Policies
CREATE POLICY "Service role can insert usage logs"
ON llm_usage_log FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Masters can view usage logs"
ON llm_usage_log FOR SELECT
TO authenticated
USING (is_master());

CREATE POLICY "Users can view their own usage logs"
ON llm_usage_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Comentários
COMMENT ON TABLE llm_usage_log IS
'Log de todas chamadas LLM para analise de custos e performance';

COMMENT ON VIEW llm_usage_metrics IS
'Metricas agregadas de uso LLM (ultimos 30 dias)';

COMMENT ON COLUMN llm_usage_log.edge_function IS
'Nome da Edge Function que fez a chamada LLM';

COMMENT ON COLUMN llm_usage_log.profile_used IS
'Profile usado: precise, analytical, conversational, creative';

COMMENT ON COLUMN llm_usage_log.response_time_ms IS
'Tempo de resposta da API OpenAI em milissegundos';

-- Estatísticas
DO $$
BEGIN
  RAISE NOTICE 'Sistema de telemetria LLM instalado:';
  RAISE NOTICE '  Tabela: llm_usage_log';
  RAISE NOTICE '  View: llm_usage_metrics';
  RAISE NOTICE '  Índices: 3 (function, user, created)';
  RAISE NOTICE '  Policies: 3 (service_insert, masters_view, users_view_own)';
END $$;
