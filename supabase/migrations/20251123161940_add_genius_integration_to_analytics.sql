/*
  # Integração Genius no Analytics

  1. Novos Campos
    - `messages.analysis_source_id`: Link para análise Analytics que originou análise Genius
    - `data_analyses.dataset_id`: Referência ao dataset usado (para recuperar arquivo)

  2. Nova Tabela
    - `genius_credits`: Gerenciamento de créditos Genius por usuário

  3. Função RPC
    - `consume_genius_credit`: Consumir 1 crédito ao criar tarefa Genius

  4. Security
    - RLS policies para genius_credits
    - Usuários podem ver apenas seus próprios créditos
*/

-- ============================================================================
-- 1. Adicionar campo analysis_source_id em messages
-- ============================================================================

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS analysis_source_id uuid REFERENCES data_analyses(id) ON DELETE SET NULL;

COMMENT ON COLUMN messages.analysis_source_id IS
'Para message_type = genius_result: referencia a análise Analytics que originou esta análise Genius';

CREATE INDEX IF NOT EXISTS messages_analysis_source_id_idx ON messages(analysis_source_id);

-- ============================================================================
-- 2. Adicionar dataset_id em data_analyses (se não existir)
-- ============================================================================

-- Verificar se coluna já existe antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_analyses' AND column_name = 'dataset_id'
  ) THEN
    ALTER TABLE data_analyses
    ADD COLUMN dataset_id uuid REFERENCES datasets(id) ON DELETE SET NULL;

    CREATE INDEX data_analyses_dataset_id_idx ON data_analyses(dataset_id);
  END IF;
END $$;

COMMENT ON COLUMN data_analyses.dataset_id IS
'Referência ao dataset original usado para esta análise (necessário para Genius upgrade)';

-- ============================================================================
-- 3. Criar tabela genius_credits
-- ============================================================================

CREATE TABLE IF NOT EXISTS genius_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Créditos disponíveis e utilizados
  credits_available integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,

  -- Histórico
  last_recharge_date timestamptz,
  last_recharge_amount integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraint: apenas 1 registro por usuário
  UNIQUE(user_id),

  -- Validações
  CHECK (credits_available >= 0),
  CHECK (credits_used >= 0)
);

-- Index para queries rápidas
CREATE INDEX IF NOT EXISTS genius_credits_user_id_idx ON genius_credits(user_id);

COMMENT ON TABLE genius_credits IS
'Gerenciamento de créditos Genius por usuário. Cada análise Genius consome 1 crédito.';

-- ============================================================================
-- 4. RLS Policies para genius_credits
-- ============================================================================

ALTER TABLE genius_credits ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas seus próprios créditos
CREATE POLICY "Users can view own genius credits"
  ON genius_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role pode tudo (para consumo de créditos via webhook)
CREATE POLICY "Service role has full access to genius credits"
  ON genius_credits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. Função RPC para consumir crédito
-- ============================================================================

CREATE OR REPLACE FUNCTION consume_genius_credit(
  p_user_id uuid,
  p_task_id text
) RETURNS jsonb AS $$
DECLARE
  v_credits_available integer;
  v_credits_after integer;
BEGIN
  -- Buscar créditos atuais
  SELECT credits_available INTO v_credits_available
  FROM genius_credits
  WHERE user_id = p_user_id;

  -- Se usuário não tem registro, retornar erro
  IF v_credits_available IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_credits_record',
      'message', 'Usuário não possui registro de créditos Genius'
    );
  END IF;

  -- Se não tem créditos suficientes, retornar erro
  IF v_credits_available < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'message', 'Créditos Genius insuficientes',
      'credits_available', v_credits_available
    );
  END IF;

  -- Consumir 1 crédito
  UPDATE genius_credits
  SET
    credits_available = GREATEST(0, credits_available - 1),
    credits_used = credits_used + 1,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING credits_available INTO v_credits_after;

  -- Retornar sucesso com créditos restantes
  RETURN jsonb_build_object(
    'success', true,
    'credits_remaining', v_credits_after,
    'credits_consumed', 1,
    'task_id', p_task_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION consume_genius_credit IS
'Consome 1 crédito Genius do usuário. Retorna sucesso/erro e créditos restantes.';

-- ============================================================================
-- 6. Função helper para verificar créditos disponíveis
-- ============================================================================

CREATE OR REPLACE FUNCTION get_genius_credits(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_credits genius_credits%ROWTYPE;
BEGIN
  SELECT * INTO v_credits
  FROM genius_credits
  WHERE user_id = p_user_id;

  IF v_credits.user_id IS NULL THEN
    -- Criar registro inicial com 0 créditos
    INSERT INTO genius_credits (user_id, credits_available, credits_used)
    VALUES (p_user_id, 0, 0)
    RETURNING * INTO v_credits;
  END IF;

  RETURN jsonb_build_object(
    'credits_available', v_credits.credits_available,
    'credits_used', v_credits.credits_used,
    'last_recharge_date', v_credits.last_recharge_date,
    'last_recharge_amount', v_credits.last_recharge_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_genius_credits IS
'Retorna informações de créditos Genius do usuário. Cria registro se não existir.';

-- ============================================================================
-- 7. Função para adicionar créditos (recarga)
-- ============================================================================

CREATE OR REPLACE FUNCTION add_genius_credits(
  p_user_id uuid,
  p_amount integer
) RETURNS jsonb AS $$
DECLARE
  v_credits_after integer;
BEGIN
  -- Validar amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_amount',
      'message', 'Quantidade deve ser maior que 0'
    );
  END IF;

  -- Inserir ou atualizar créditos
  INSERT INTO genius_credits (
    user_id,
    credits_available,
    credits_used,
    last_recharge_date,
    last_recharge_amount
  ) VALUES (
    p_user_id,
    p_amount,
    0,
    now(),
    p_amount
  )
  ON CONFLICT (user_id) DO UPDATE SET
    credits_available = genius_credits.credits_available + p_amount,
    last_recharge_date = now(),
    last_recharge_amount = p_amount,
    updated_at = now()
  RETURNING credits_available INTO v_credits_after;

  RETURN jsonb_build_object(
    'success', true,
    'credits_added', p_amount,
    'credits_total', v_credits_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_genius_credits IS
'Adiciona créditos Genius ao usuário (recarga/compra). Apenas masters podem executar.';

-- ============================================================================
-- 8. Grant permissions
-- ============================================================================

-- Permitir que authenticated users chamem as funções
GRANT EXECUTE ON FUNCTION get_genius_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_genius_credit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION add_genius_credits(uuid, integer) TO service_role;