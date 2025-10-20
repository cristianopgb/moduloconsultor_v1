/*
  # Correção Crítica: Isolamento de Gamificação por Jornada

  ## Problema
  A gamificação estava vinculada globalmente ao user_id, causando herança de XP e níveis entre diferentes conversas/jornadas.
  Isso destruía completamente a motivação e o senso de progresso.

  ## Solução
  - Adicionar jornada_id como chave única na tabela gamificacao_consultor
  - Remover constraint de user_id único
  - Cada jornada inicia com gamificação zerada (nível 1, 0 XP, sem conquistas)
  - Gamificação de diferentes jornadas não interfere entre si

  ## Mudanças
  1. Adiciona coluna jornada_id (relacionamento 1:1 com jornadas_consultor)
  2. Remove constraint antiga de user_id único
  3. Adiciona constraint de jornada_id único
  4. Migra dados existentes (se houver)
  5. Adiciona índices para performance
*/

-- 1. Adicionar coluna jornada_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gamificacao_consultor'
    AND column_name = 'jornada_id'
  ) THEN
    ALTER TABLE gamificacao_consultor
      ADD COLUMN jornada_id UUID REFERENCES jornadas_consultor(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Migrar dados existentes: vincular gamificação antiga à jornada mais recente do usuário
UPDATE gamificacao_consultor g
SET jornada_id = (
  SELECT j.id
  FROM jornadas_consultor j
  WHERE j.user_id = g.user_id
  ORDER BY j.created_at DESC
  LIMIT 1
)
WHERE jornada_id IS NULL;

-- 3. Remover gamificações órfãs (sem jornada correspondente)
DELETE FROM gamificacao_consultor WHERE jornada_id IS NULL;

-- 4. Remover constraint de user_id único se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gamificacao_consultor_user_id_key'
  ) THEN
    ALTER TABLE gamificacao_consultor
      DROP CONSTRAINT gamificacao_consultor_user_id_key;
  END IF;
END $$;

-- 5. Tornar jornada_id obrigatório e único
ALTER TABLE gamificacao_consultor
  ALTER COLUMN jornada_id SET NOT NULL;

-- 6. Adicionar constraint de jornada_id único (cada jornada tem UMA gamificação)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gamificacao_consultor_jornada_id_key'
  ) THEN
    ALTER TABLE gamificacao_consultor
      ADD CONSTRAINT gamificacao_consultor_jornada_id_key UNIQUE(jornada_id);
  END IF;
END $$;

-- 7. Criar índice para performance em queries por jornada
CREATE INDEX IF NOT EXISTS idx_gamificacao_jornada
  ON gamificacao_consultor(jornada_id);

-- 8. Criar função helper para inicializar gamificação de nova jornada
CREATE OR REPLACE FUNCTION inicializar_gamificacao_jornada()
RETURNS TRIGGER AS $$
BEGIN
  -- Ao criar nova jornada, criar gamificação zerada automaticamente
  INSERT INTO gamificacao_consultor (
    user_id,
    jornada_id,
    xp_total,
    nivel,
    conquistas,
    dias_consecutivos,
    areas_completadas,
    ultimo_acesso
  ) VALUES (
    NEW.user_id,
    NEW.id,
    0,
    1,
    '[]'::jsonb,
    1,
    0,
    NOW()
  )
  ON CONFLICT (jornada_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Criar trigger para inicialização automática
DROP TRIGGER IF EXISTS trigger_inicializar_gamificacao ON jornadas_consultor;
CREATE TRIGGER trigger_inicializar_gamificacao
  AFTER INSERT ON jornadas_consultor
  FOR EACH ROW
  EXECUTE FUNCTION inicializar_gamificacao_jornada();

-- 10. Atualizar RLS policies para usar jornada_id
DROP POLICY IF EXISTS "Users can view own gamification" ON gamificacao_consultor;
CREATE POLICY "Users can view own gamification"
  ON gamificacao_consultor
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor j
      WHERE j.id = gamificacao_consultor.jornada_id
      AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own gamification" ON gamificacao_consultor;
CREATE POLICY "Users can update own gamification"
  ON gamificacao_consultor
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor j
      WHERE j.id = gamificacao_consultor.jornada_id
      AND j.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jornadas_consultor j
      WHERE j.id = gamificacao_consultor.jornada_id
      AND j.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can manage gamification" ON gamificacao_consultor;
CREATE POLICY "System can manage gamification"
  ON gamificacao_consultor
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 11. Comentários para documentação
COMMENT ON COLUMN gamificacao_consultor.jornada_id IS 'Vincula gamificação a uma jornada específica. Cada jornada inicia com gamificação zerada.';
COMMENT ON CONSTRAINT gamificacao_consultor_jornada_id_key ON gamificacao_consultor IS 'Garante que cada jornada tem exatamente uma gamificação isolada.';
COMMENT ON TRIGGER trigger_inicializar_gamificacao ON jornadas_consultor IS 'Cria automaticamente gamificação zerada ao criar nova jornada.';
