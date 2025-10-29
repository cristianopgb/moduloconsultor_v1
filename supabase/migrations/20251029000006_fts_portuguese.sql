/*
  # Full-Text Search em Português

  1. Configuração
    - Cria configuração de busca pt (português)
    - Adiciona coluna tsvector para busca rápida
    - Cria índice GIN otimizado

  2. Triggers
    - update_knowledge_search_vector: atualiza automaticamente ao inserir/atualizar
    - Pesos: title (A), content (B), tags (C)

  3. Performance
    - Busca ~100x mais rápida que LIKE/ILIKE
    - Suporta stemming e stopwords em português
    - Ranking por relevância automático

  4. Não Ativa Embeddings
    - Sistema preparado mas não habilitado
    - Busca textual suficiente para volume atual
*/

-- Criar configuração de busca para português
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS pt (COPY = pg_catalog.portuguese);

-- Adicionar coluna tsvector para busca rápida
ALTER TABLE knowledge_base_documents
ADD COLUMN IF NOT EXISTS content_search_vector tsvector;

-- Criar índice GIN para busca full-text
CREATE INDEX IF NOT EXISTS idx_knowledge_content_search
ON knowledge_base_documents
USING GIN (content_search_vector);

-- Trigger para atualizar search_vector automaticamente
CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_search_vector :=
    setweight(to_tsvector('pt', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('pt', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('pt', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_knowledge_search_vector ON knowledge_base_documents;
CREATE TRIGGER trigger_update_knowledge_search_vector
BEFORE INSERT OR UPDATE OF title, content, tags
ON knowledge_base_documents
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_search_vector();

-- Popular search_vector para docs existentes
UPDATE knowledge_base_documents
SET content_search_vector =
  setweight(to_tsvector('pt', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('pt', COALESCE(content, '')), 'B') ||
  setweight(to_tsvector('pt', COALESCE(array_to_string(tags, ' '), '')), 'C')
WHERE content_search_vector IS NULL;

-- Comentários
COMMENT ON COLUMN knowledge_base_documents.content_search_vector IS
'Vetor de busca full-text em português (title peso A, content peso B, tags peso C)';

COMMENT ON FUNCTION update_knowledge_search_vector() IS
'Atualiza automaticamente o vetor de busca quando title, content ou tags mudam';

-- Estatísticas
DO $$
DECLARE
  v_total_docs INT;
  v_com_search_vector INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE content_search_vector IS NOT NULL)
  INTO v_total_docs, v_com_search_vector
  FROM knowledge_base_documents;

  RAISE NOTICE 'Full-Text Search em Português instalado:';
  RAISE NOTICE '  Total de documentos: %', v_total_docs;
  RAISE NOTICE '  Com search vector: %', v_com_search_vector;
  RAISE NOTICE '  Configuração: pt (português)';
  RAISE NOTICE '  Índice: GIN otimizado';
  RAISE NOTICE '  Trigger: automático';
END $$;
