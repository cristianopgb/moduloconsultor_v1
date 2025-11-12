/*
  # Módulo Genius - Integração com API Manus

  1. Novos Enums
    - Adiciona `genius`, `genius_task`, `genius_result`, `genius_error` aos enums existentes
    - Cria `genius_status_enum` (pending, running, completed, failed)
    - Cria `genius_stop_reason_enum` (finish, ask, timeout)

  2. Novas Tabelas
    - `genius_tasks`: registro principal das tarefas Manus
      - Campos: task_id, conversation_id, user_id, prompt, status, attachments (JSONB)
      - Telemetria: latency_ms, credit_usage, file_count, total_size_bytes
      - Rastreamento: trace_id para correlação de logs
    - `genius_task_events`: auditoria de webhooks (idempotência por event_id)
    - `genius_webhook_registry`: registro de webhooks por ambiente

  3. Alterações em Tabelas Existentes
    - `messages`: adiciona campos genius específicos (external_task_id, genius_status, genius_attachments, genius_credit_usage, trace_id)

  4. Índices
    - Otimizações para queries por conversation_id, task_id, user_id, trace_id
    - Índice único para idempotência: (task_id, event_id)
    - Índice único para webhook por ambiente: (environment, tenant_id) WHERE active

  5. RLS Policies
    - genius_tasks: leitura por user_id ou conversation.user_id, escrita service_role
    - genius_task_events: apenas service_role
    - genius_webhook_registry: apenas service_role

  6. Realtime
    - Habilita Realtime para genius_tasks (atualização de status via webhook)

  7. Views de Telemetria
    - genius_task_stats: agregação por usuário (total, taxa sucesso, latência, créditos)
    - genius_conversation_stats: agregação por conversa

  8. Segurança
    - Rate limiting via metadados (10/hora, 100/dia)
    - Validação de MIME types no backend
    - Magic bytes validation para tipos de arquivo
*/

-- ====================================
-- 1. ATUALIZAR ENUMS EXISTENTES
-- ====================================

-- Adicionar genius ao chat_mode se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'chat_mode' AND e.enumlabel = 'genius'
  ) THEN
    ALTER TYPE chat_mode ADD VALUE IF NOT EXISTS 'genius';
  END IF;
END $$;

-- Adicionar genius_task, genius_result, genius_error ao message_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'message_type' AND e.enumlabel = 'genius_task'
  ) THEN
    ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'genius_task';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'message_type' AND e.enumlabel = 'genius_result'
  ) THEN
    ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'genius_result';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'message_type' AND e.enumlabel = 'genius_error'
  ) THEN
    ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'genius_error';
  END IF;
END $$;

-- Criar novos enums específicos do Genius
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'genius_status_enum') THEN
    CREATE TYPE genius_status_enum AS ENUM ('pending', 'running', 'completed', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'genius_stop_reason_enum') THEN
    CREATE TYPE genius_stop_reason_enum AS ENUM ('finish', 'ask', 'timeout');
  END IF;
END $$;

-- ====================================
-- 2. CRIAR TABELA genius_tasks
-- ====================================

CREATE TABLE IF NOT EXISTS genius_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relacionamentos
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificação Manus
  task_id text UNIQUE NOT NULL,
  trace_id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Conteúdo
  prompt text NOT NULL,

  -- Status
  status genius_status_enum NOT NULL DEFAULT 'pending',
  stop_reason genius_stop_reason_enum,

  -- Dados de retorno (JSONB)
  attachments jsonb,
  -- Formato: [{"file_name": "report.pdf", "url": "https://...", "size_bytes": 12345, "mime_type": "application/pdf", "expires_at": "2025-11-19T00:00:00Z"}]

  task_url text, -- Link para visualizar no Manus

  -- Telemetria
  credit_usage integer DEFAULT 0,
  error_message text,
  latency_ms integer,
  file_count integer DEFAULT 0,
  total_size_bytes bigint DEFAULT 0,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_genius_tasks_conversation ON genius_tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_task_id ON genius_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_user_id ON genius_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_trace_id ON genius_tasks(trace_id);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_status ON genius_tasks(status);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_created_at ON genius_tasks(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_genius_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_genius_tasks_updated_at
  BEFORE UPDATE ON genius_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_genius_tasks_updated_at();

-- ====================================
-- 3. CRIAR TABELA genius_task_events
-- ====================================

CREATE TABLE IF NOT EXISTS genius_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  task_id text NOT NULL,
  event_id text NOT NULL, -- Para idempotência
  event_type text NOT NULL, -- task_created ou task_stopped

  -- Payload completo do webhook
  payload jsonb NOT NULL,

  -- Auditoria
  source_ip inet,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único para idempotência
CREATE UNIQUE INDEX IF NOT EXISTS idx_genius_events_idempotency
  ON genius_task_events(task_id, event_id);

CREATE INDEX IF NOT EXISTS idx_genius_events_task_id ON genius_task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_genius_events_received_at ON genius_task_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_genius_events_event_type ON genius_task_events(event_type);

-- ====================================
-- 4. CRIAR TABELA genius_webhook_registry
-- ====================================

CREATE TABLE IF NOT EXISTS genius_webhook_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação Manus
  webhook_id text UNIQUE NOT NULL,
  webhook_url text NOT NULL,

  -- Configuração
  environment text NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
  tenant_id uuid, -- Para multi-tenant futuro

  -- Status
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'pending',
  last_verified_at timestamptz,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único: apenas 1 webhook ativo por ambiente/tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_genius_webhook_active_env
  ON genius_webhook_registry(environment, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_genius_webhook_env ON genius_webhook_registry(environment);
CREATE INDEX IF NOT EXISTS idx_genius_webhook_active ON genius_webhook_registry(active);

-- ====================================
-- 5. ATUALIZAR TABELA messages
-- ====================================

DO $$
BEGIN
  -- external_task_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'external_task_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN external_task_id text;
  END IF;

  -- genius_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'genius_status'
  ) THEN
    ALTER TABLE messages ADD COLUMN genius_status text;
  END IF;

  -- genius_attachments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'genius_attachments'
  ) THEN
    ALTER TABLE messages ADD COLUMN genius_attachments jsonb;
  END IF;

  -- genius_credit_usage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'genius_credit_usage'
  ) THEN
    ALTER TABLE messages ADD COLUMN genius_credit_usage integer DEFAULT 0;
  END IF;

  -- trace_id (para correlação)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'trace_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN trace_id uuid;
  END IF;
END $$;

-- Índice para busca por external_task_id
CREATE INDEX IF NOT EXISTS idx_messages_external_task_id ON messages(external_task_id) WHERE external_task_id IS NOT NULL;

-- ====================================
-- 6. RLS POLICIES
-- ====================================

-- Habilitar RLS
ALTER TABLE genius_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE genius_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE genius_webhook_registry ENABLE ROW LEVEL SECURITY;

-- genius_tasks: leitura por user_id ou conversation.user_id
DROP POLICY IF EXISTS "Users can view own genius tasks" ON genius_tasks;
CREATE POLICY "Users can view own genius tasks"
  ON genius_tasks FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- genius_tasks: service_role pode tudo
DROP POLICY IF EXISTS "Service role full access to genius_tasks" ON genius_tasks;
CREATE POLICY "Service role full access to genius_tasks"
  ON genius_tasks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- genius_task_events: apenas service_role
DROP POLICY IF EXISTS "Service role full access to genius_task_events" ON genius_task_events;
CREATE POLICY "Service role full access to genius_task_events"
  ON genius_task_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- genius_webhook_registry: apenas service_role
DROP POLICY IF EXISTS "Service role full access to genius_webhook_registry" ON genius_webhook_registry;
CREATE POLICY "Service role full access to genius_webhook_registry"
  ON genius_webhook_registry FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ====================================
-- 7. HABILITAR REALTIME
-- ====================================

-- Habilitar Realtime para genius_tasks (para atualização de status)
ALTER PUBLICATION supabase_realtime ADD TABLE genius_tasks;

-- ====================================
-- 8. VIEWS DE TELEMETRIA
-- ====================================

-- View: estatísticas por usuário
CREATE OR REPLACE VIEW genius_task_stats AS
SELECT
  user_id,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'completed' AND stop_reason = 'finish') as success_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failure_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'completed' AND stop_reason = 'finish') / NULLIF(COUNT(*), 0),
    2
  ) as success_rate,
  ROUND(AVG(latency_ms)) as avg_latency_ms,
  SUM(credit_usage) as total_credits,
  SUM(file_count) as total_files,
  ROUND(SUM(total_size_bytes)::numeric / 1048576, 2) as total_size_mb,
  MAX(created_at) as last_task_at
FROM genius_tasks
GROUP BY user_id;

-- View: estatísticas por conversa
CREATE OR REPLACE VIEW genius_conversation_stats AS
SELECT
  conversation_id,
  COUNT(*) as task_count,
  SUM(credit_usage) as total_credits,
  ROUND(AVG(latency_ms)) as avg_latency_ms,
  MAX(created_at) as last_task_at
FROM genius_tasks
GROUP BY conversation_id;

-- ====================================
-- 9. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ====================================

COMMENT ON TABLE genius_tasks IS 'Registro de tarefas enviadas para a API Manus via módulo Genius';
COMMENT ON TABLE genius_task_events IS 'Auditoria de eventos de webhook do Manus (idempotência por event_id)';
COMMENT ON TABLE genius_webhook_registry IS 'Registro de webhooks configurados por ambiente/tenant';

COMMENT ON COLUMN genius_tasks.task_id IS 'ID da tarefa no Manus (único)';
COMMENT ON COLUMN genius_tasks.trace_id IS 'UUID para rastreamento de logs e correlação entre frontend/backend';
COMMENT ON COLUMN genius_tasks.attachments IS 'Array JSON com anexos retornados: [{file_name, url, size_bytes, mime_type, expires_at}]';
COMMENT ON COLUMN genius_tasks.stop_reason IS 'Motivo de parada: finish (sucesso), ask (pergunta), timeout (expiração)';
COMMENT ON COLUMN genius_tasks.latency_ms IS 'Latência total: tempo entre created_at e completed_at em milissegundos';

COMMENT ON COLUMN genius_task_events.event_id IS 'ID único do evento (webhook) para idempotência';
COMMENT ON COLUMN genius_task_events.source_ip IS 'IP de origem do webhook para auditoria';

COMMENT ON COLUMN genius_webhook_registry.verification_status IS 'Status da verificação: pending, verified, failed';
