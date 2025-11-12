/*
  # Módulo Genius - Integração com API Manus

  1. Novos Enums
    - Cria `genius_status_enum` (pending, running, completed, failed)
    - Cria `genius_stop_reason_enum` (finish, ask, timeout)
    - Nota: chat_mode e message_type são TEXT, aceitos como strings

  2. Novas Tabelas
    - `genius_tasks`: registro principal das tarefas Manus
    - `genius_task_events`: auditoria de webhooks (idempotência por event_id)
    - `genius_webhook_registry`: registro de webhooks por ambiente

  3. Alterações em Tabelas Existentes
    - `messages`: adiciona campos genius específicos

  4. Índices, RLS Policies, Realtime e Views
*/

-- ====================================
-- 1. CRIAR ENUMS ESPECÍFICOS DO GENIUS
-- ====================================

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
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id text UNIQUE NOT NULL,
  trace_id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  status genius_status_enum NOT NULL DEFAULT 'pending',
  stop_reason genius_stop_reason_enum,
  attachments jsonb,
  task_url text,
  credit_usage integer DEFAULT 0,
  error_message text,
  latency_ms integer,
  file_count integer DEFAULT 0,
  total_size_bytes bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genius_tasks_conversation ON genius_tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_task_id ON genius_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_user_id ON genius_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_trace_id ON genius_tasks(trace_id);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_status ON genius_tasks(status);
CREATE INDEX IF NOT EXISTS idx_genius_tasks_created_at ON genius_tasks(created_at DESC);

CREATE OR REPLACE FUNCTION update_genius_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_genius_tasks_updated_at ON genius_tasks;
CREATE TRIGGER trigger_update_genius_tasks_updated_at
  BEFORE UPDATE ON genius_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_genius_tasks_updated_at();

-- ====================================
-- 3. CRIAR TABELA genius_task_events
-- ====================================

CREATE TABLE IF NOT EXISTS genius_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  source_ip inet,
  received_at timestamptz NOT NULL DEFAULT now()
);

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
  webhook_id text UNIQUE NOT NULL,
  webhook_url text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
  tenant_id uuid,
  active boolean NOT NULL DEFAULT true,
  verification_status text NOT NULL DEFAULT 'pending',
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'external_task_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN external_task_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'genius_status'
  ) THEN
    ALTER TABLE messages ADD COLUMN genius_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'genius_attachments'
  ) THEN
    ALTER TABLE messages ADD COLUMN genius_attachments jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'genius_credit_usage'
  ) THEN
    ALTER TABLE messages ADD COLUMN genius_credit_usage integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'trace_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN trace_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_external_task_id ON messages(external_task_id) WHERE external_task_id IS NOT NULL;

-- ====================================
-- 6. RLS POLICIES
-- ====================================

ALTER TABLE genius_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE genius_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE genius_webhook_registry ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Service role full access to genius_tasks" ON genius_tasks;
CREATE POLICY "Service role full access to genius_tasks"
  ON genius_tasks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to genius_task_events" ON genius_task_events;
CREATE POLICY "Service role full access to genius_task_events"
  ON genius_task_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to genius_webhook_registry" ON genius_webhook_registry;
CREATE POLICY "Service role full access to genius_webhook_registry"
  ON genius_webhook_registry FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ====================================
-- 7. HABILITAR REALTIME
-- ====================================

ALTER PUBLICATION supabase_realtime ADD TABLE genius_tasks;

-- ====================================
-- 8. VIEWS DE TELEMETRIA
-- ====================================

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
-- 9. COMENTÁRIOS
-- ====================================

COMMENT ON TABLE genius_tasks IS 'Registro de tarefas enviadas para a API Manus via módulo Genius';
COMMENT ON TABLE genius_task_events IS 'Auditoria de eventos de webhook do Manus (idempotência por event_id)';
COMMENT ON TABLE genius_webhook_registry IS 'Registro de webhooks configurados por ambiente/tenant';
