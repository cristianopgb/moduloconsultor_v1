-- Seed Genius Credits para testes
-- Este script adiciona créditos Genius aos usuários existentes para testes

-- Adicionar 10 créditos Genius para todos os usuários
INSERT INTO genius_credits (user_id, credits_available, credits_used, last_recharge_date, last_recharge_amount)
SELECT
  id as user_id,
  10 as credits_available,
  0 as credits_used,
  now() as last_recharge_date,
  10 as last_recharge_amount
FROM auth.users
ON CONFLICT (user_id)
DO UPDATE SET
  credits_available = genius_credits.credits_available + 10,
  last_recharge_date = now(),
  last_recharge_amount = 10,
  updated_at = now();

-- Verificar quantos usuários receberam créditos
SELECT
  u.email,
  gc.credits_available,
  gc.credits_used,
  gc.last_recharge_date
FROM genius_credits gc
JOIN auth.users u ON u.id = gc.user_id
ORDER BY gc.created_at DESC;
