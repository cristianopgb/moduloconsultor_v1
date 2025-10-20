-- Resetar gamificação incorreta para usuário específico
-- Execute no Supabase SQL Editor substituindo 'SEU_USER_ID'

-- 1. Verificar estado atual
SELECT
  gc.*,
  jc.etapa_atual,
  jc.progresso_geral
FROM gamificacao_consultor gc
LEFT JOIN jornadas_consultor jc ON gc.user_id = jc.user_id
WHERE gc.user_id = 'SEU_USER_ID';

-- 2. Resetar gamificação se estiver incorreta
UPDATE gamificacao_consultor
SET
  xp_total = 0,
  nivel = 1
WHERE user_id = 'SEU_USER_ID'
  AND xp_total > 100; -- Só reseta se tiver XP anormal

-- 3. Limpar conquistas incorretas
DELETE FROM conquistas_consultor
WHERE user_id = 'SEU_USER_ID'
  AND tipo_conquista NOT IN ('anamnese_completa', 'mapeamento_completo', 'priorizacao_definida');

-- 4. Verificar jornada atual
SELECT
  id,
  etapa_atual,
  progresso_geral,
  contexto_coleta,
  created_at
FROM jornadas_consultor
WHERE user_id = 'SEU_USER_ID'
ORDER BY created_at DESC
LIMIT 1;

-- 5. Se jornada está em mapeamento mas anamnese incompleta, voltar para anamnese
UPDATE jornadas_consultor
SET
  etapa_atual = 'anamnese',
  progresso_geral = 0
WHERE user_id = 'SEU_USER_ID'
  AND etapa_atual != 'anamnese'
  AND (
    contexto_coleta->>'nome_usuario' IS NULL
    OR contexto_coleta->>'empresa_nome' IS NULL
    OR contexto_coleta->>'segmento' IS NULL
    OR contexto_coleta->>'porte' IS NULL
  );
