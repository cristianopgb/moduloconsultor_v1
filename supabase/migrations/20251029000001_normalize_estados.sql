/*
  # Normalizar Estados das Sessões Consultor

  1. Mudanças
    - Cria backup de segurança da tabela consultor_sessoes
    - Normaliza estados existentes para formato backend canônico
    - Adiciona constraint para validar apenas estados válidos
    - Adiciona comentário documentando estados aceitos

  2. Estados Mapeados
    - apresentacao, anamnese → coleta
    - mapeamento, priorizacao → analise
    - as_is → diagnostico
    - to_be, plano → recomendacao
    - execucao → execucao
    - Qualquer outro → coleta (padrão)

  3. Segurança
    - Backup completo antes de modificar
    - Constraint garante apenas estados válidos no futuro
*/

-- Backup antes de migrar
CREATE TABLE IF NOT EXISTS consultor_sessoes_backup_20251029 AS
SELECT * FROM consultor_sessoes;

-- Normalizar estados existentes
UPDATE consultor_sessoes
SET estado_atual = CASE
  WHEN estado_atual IN ('apresentacao', 'anamnese') THEN 'coleta'
  WHEN estado_atual IN ('mapeamento', 'priorizacao') THEN 'analise'
  WHEN estado_atual = 'as_is' THEN 'diagnostico'
  WHEN estado_atual IN ('to_be', 'plano') THEN 'recomendacao'
  WHEN estado_atual = 'execucao' THEN 'execucao'
  WHEN estado_atual = 'concluido' THEN 'concluido'
  ELSE 'coleta'
END
WHERE estado_atual NOT IN ('coleta', 'analise', 'diagnostico', 'recomendacao', 'execucao', 'concluido');

-- Verificar resultados
DO $$
DECLARE
  v_coleta INT;
  v_analise INT;
  v_diagnostico INT;
  v_recomendacao INT;
  v_execucao INT;
  v_concluido INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE estado_atual = 'coleta'),
    COUNT(*) FILTER (WHERE estado_atual = 'analise'),
    COUNT(*) FILTER (WHERE estado_atual = 'diagnostico'),
    COUNT(*) FILTER (WHERE estado_atual = 'recomendacao'),
    COUNT(*) FILTER (WHERE estado_atual = 'execucao'),
    COUNT(*) FILTER (WHERE estado_atual = 'concluido')
  INTO v_coleta, v_analise, v_diagnostico, v_recomendacao, v_execucao, v_concluido
  FROM consultor_sessoes;

  RAISE NOTICE 'Migração de estados concluída:';
  RAISE NOTICE '  coleta: %', v_coleta;
  RAISE NOTICE '  analise: %', v_analise;
  RAISE NOTICE '  diagnostico: %', v_diagnostico;
  RAISE NOTICE '  recomendacao: %', v_recomendacao;
  RAISE NOTICE '  execucao: %', v_execucao;
  RAISE NOTICE '  concluido: %', v_concluido;
END $$;

-- Adicionar constraint se não existir
ALTER TABLE consultor_sessoes
DROP CONSTRAINT IF EXISTS consultor_sessoes_estado_atual_check;

ALTER TABLE consultor_sessoes
ADD CONSTRAINT consultor_sessoes_estado_atual_check
CHECK (estado_atual IN ('coleta', 'analise', 'diagnostico', 'recomendacao', 'execucao', 'concluido'));

-- Atualizar comentário
COMMENT ON COLUMN consultor_sessoes.estado_atual IS
'Estado atual da sessão (backend canônico): coleta (anamnese), analise (mapeamento), diagnostico (as-is), recomendacao (to-be/plano), execucao, concluido';

COMMENT ON TABLE consultor_sessoes_backup_20251029 IS
'Backup de segurança antes da normalização de estados em 29/10/2025';
