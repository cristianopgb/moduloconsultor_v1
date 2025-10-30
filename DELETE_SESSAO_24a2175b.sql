-- EXECUTE NO SUPABASE SQL EDITOR

-- Deletar sessão específica problemática
DELETE FROM consultor_sessoes WHERE id = '24a2175b-5805-4a18-8939-a23204dd775b';

-- Deletar todas sessões órfãs sem jornada
DELETE FROM consultor_sessoes WHERE jornada_id IS NULL;

-- Verificar
SELECT id, estado_atual, jornada_id, ativo FROM consultor_sessoes LIMIT 5;
