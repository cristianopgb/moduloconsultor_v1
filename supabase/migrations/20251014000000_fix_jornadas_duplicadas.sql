/*
  # Fix Jornadas Duplicadas

  1. Problema
    - Múltiplas jornadas sendo criadas para mesma conversa
    - Query .single() retornando múltiplas linhas (PGRST116)

  2. Solução
    - Adicionar unique constraint em (user_id, conversation_id)
    - Remover jornadas duplicadas mantendo a mais recente

  3. Segurança
    - Mantém dados da jornada mais recente
    - Remove apenas duplicatas
*/

-- Primeiro: Identificar e remover duplicatas mantendo a mais recente
DELETE FROM jornadas_consultor
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, conversation_id
             ORDER BY created_at DESC NULLS LAST, id DESC
           ) as rn
    FROM jornadas_consultor
  ) t
  WHERE t.rn > 1
);

-- Adicionar unique constraint para prevenir futuras duplicatas
ALTER TABLE jornadas_consultor
DROP CONSTRAINT IF EXISTS jornadas_consultor_user_conversation_unique;

ALTER TABLE jornadas_consultor
ADD CONSTRAINT jornadas_consultor_user_conversation_unique
UNIQUE (user_id, conversation_id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_jornadas_user_conversation
ON jornadas_consultor(user_id, conversation_id);
