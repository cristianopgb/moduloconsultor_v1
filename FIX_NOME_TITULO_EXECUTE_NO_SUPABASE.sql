-- =====================================================
-- EXECUTE ESTE SQL NO SUPABASE SQL EDITOR
-- =====================================================
-- Dashboard → SQL Editor → New Query → Cole e Execute
-- =====================================================

-- 1. Tornar coluna 'nome' nullable
ALTER TABLE entregaveis_consultor ALTER COLUMN nome DROP NOT NULL;

-- 2. Adicionar coluna 'titulo' se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'titulo'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN titulo text;
  END IF;
END $$;

-- 3. Copiar dados de nome para titulo
UPDATE entregaveis_consultor
SET titulo = nome
WHERE titulo IS NULL AND nome IS NOT NULL;

-- 4. Preencher titulos vazios com default
UPDATE entregaveis_consultor
SET titulo = 'Documento ' || tipo
WHERE titulo IS NULL;

-- 5. Tornar titulo NOT NULL
ALTER TABLE entregaveis_consultor ALTER COLUMN titulo SET NOT NULL;
ALTER TABLE entregaveis_consultor ALTER COLUMN titulo SET DEFAULT 'Documento sem título';

-- 6. Criar trigger para sincronizar nome→titulo automaticamente
CREATE OR REPLACE FUNCTION sync_nome_titulo()
RETURNS TRIGGER AS $$
BEGIN
  -- Se titulo está null mas nome foi fornecido, copiar
  IF NEW.titulo IS NULL AND NEW.nome IS NOT NULL THEN
    NEW.titulo := NEW.nome;
  END IF;

  -- Se ambos null, gerar default
  IF NEW.titulo IS NULL THEN
    NEW.titulo := 'Documento ' || COALESCE(NEW.tipo, 'Desconhecido');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_nome_titulo ON entregaveis_consultor;

CREATE TRIGGER trigger_sync_nome_titulo
  BEFORE INSERT OR UPDATE ON entregaveis_consultor
  FOR EACH ROW
  EXECUTE FUNCTION sync_nome_titulo();

-- =====================================================
-- FIM - MIGRAÇÃO COMPLETA!
-- =====================================================
