/*
  # Preparar Infraestrutura pgvector (NÃO ATIVADO)

  1. Extensão
    - Garante pgvector instalado
    - Adiciona coluna embedding (1536 dimensões para OpenAI)

  2. Função de Busca
    - match_knowledge_documents: busca por similaridade
    - Preparada mas não usada (aguarda geração de embeddings)

  3. Índice HNSW
    - NÃO CRIADO AGORA (performance ruim sem dados)
    - Criar quando popular embeddings com script batch

  4. Status
    - Infraestrutura pronta
    - Busca FTS suficiente para volume atual
    - Embeddings: futuro quando volume crescer
*/

-- Garantir extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Adicionar coluna embedding se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base_documents'
      AND column_name = 'embedding'
  ) THEN
    ALTER TABLE knowledge_base_documents
    ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- Função para busca vetorial (preparada, não ativada)
CREATE OR REPLACE FUNCTION match_knowledge_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base_documents.id,
    knowledge_base_documents.title,
    knowledge_base_documents.content,
    1 - (knowledge_base_documents.embedding <=> query_embedding) as similarity
  FROM knowledge_base_documents
  WHERE
    knowledge_base_documents.ativo = true
    AND knowledge_base_documents.embedding IS NOT NULL
    AND 1 - (knowledge_base_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Comentários
COMMENT ON COLUMN knowledge_base_documents.embedding IS
'Embedding vetorial (1536 dims) para busca semântica - NÃO ATIVO, aguardando geração';

COMMENT ON FUNCTION match_knowledge_documents IS
'Busca documentos similares usando embeddings (cosine similarity). NÃO ATIVO ainda - aguardando geração de embeddings.';

-- Estatísticas
DO $$
DECLARE
  v_total_docs INT;
  v_com_embedding INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE embedding IS NOT NULL)
  INTO v_total_docs, v_com_embedding
  FROM knowledge_base_documents;

  RAISE NOTICE '╔════════════════════════════════════════╗';
  RAISE NOTICE '║  PGVECTOR INFRASTRUCTURE READY         ║';
  RAISE NOTICE '╠════════════════════════════════════════╣';
  RAISE NOTICE '║  Extension: vector                     ║';
  RAISE NOTICE '║  Column: embedding (1536 dims)         ║';
  RAISE NOTICE '║  Function: match_knowledge_documents   ║';
  RAISE NOTICE '║  Status: PREPARED (not active)         ║';
  RAISE NOTICE '╠════════════════════════════════════════╣';
  RAISE NOTICE '║  Total docs: %                       ║', v_total_docs;
  RAISE NOTICE '║  With embeddings: %                  ║', v_com_embedding;
  RAISE NOTICE '╠════════════════════════════════════════╣';
  RAISE NOTICE '║  Next Steps:                           ║';
  RAISE NOTICE '║  1. Run generate-embeddings.ts script  ║';
  RAISE NOTICE '║  2. Create HNSW index after populate   ║';
  RAISE NOTICE '║  3. Activate hybrid search             ║';
  RAISE NOTICE '╚════════════════════════════════════════╝';
END $$;
