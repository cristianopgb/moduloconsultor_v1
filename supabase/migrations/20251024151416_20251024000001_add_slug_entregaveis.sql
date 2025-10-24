/*
  # Adicionar slug aos entregáveis e prevenir duplicatas

  1. Alterações
    - Adiciona coluna `slug` em `entregaveis_consultor`
    - Cria índice único para prevenir duplicatas por jornada
    - Adiciona função para gerar slug automaticamente

  2. Objetivo
    - Permitir UPSERT de entregáveis sem duplicação
    - Identificação única por (jornada_id, slug)
*/

-- Adicionar coluna slug se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entregaveis_consultor' AND column_name = 'slug'
  ) THEN
    ALTER TABLE entregaveis_consultor ADD COLUMN slug text;
  END IF;
END $$;

-- Função para gerar slug a partir de texto
CREATE OR REPLACE FUNCTION generate_slug(text_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        translate(
          text_input,
          'áàãâéêíóôõúçÁÀÃÂÉÊÍÓÔÕÚÇ',
          'aaaaeeiooooucAAAAEEIOOOUC'
        ),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
END;
$$;

-- Criar índice único composto (jornada_id, slug)
-- Isso previne duplicatas de entregáveis do mesmo tipo na mesma jornada
DROP INDEX IF EXISTS idx_entregaveis_jornada_slug;
CREATE UNIQUE INDEX idx_entregaveis_jornada_slug
ON entregaveis_consultor(jornada_id, slug)
WHERE slug IS NOT NULL;

-- Comentários
COMMENT ON COLUMN entregaveis_consultor.slug IS 'Identificador único do entregável dentro da jornada (gerado a partir do tipo)';
COMMENT ON INDEX idx_entregaveis_jornada_slug IS 'Previne duplicatas de entregáveis do mesmo tipo na mesma jornada';