/**
 * RAG Engine - Sistema de Recuperação de Conhecimento
 *
 * Responsável por:
 * 1. Buscar documentos relevantes na knowledge base
 * 2. Gerar embeddings para busca semântica
 * 3. Ranking e filtragem de documentos
 * 4. Construção de contexto para LLM
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

export interface DocumentoKnowledge {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  aplicabilidade: any;
  relevancia?: number;
}

export interface ResultadoRAG {
  documentos: DocumentoKnowledge[];
  contexto_construido: string;
  tokens_usados: number;
  tempo_busca_ms: number;
}

export class RAGEngine {
  private supabase: ReturnType<typeof createClient>;
  private openaiKey: string;
  private maxTokensContexto: number = 4000; // Limite de tokens para contexto

  constructor(supabase: ReturnType<typeof createClient>, openaiKey: string) {
    this.supabase = supabase;
    this.openaiKey = openaiKey;
  }

  /**
   * Busca documentos relevantes para uma query
   */
  async buscarDocumentos(
    query: string,
    filtros?: {
      categorias?: string[];
      tags?: string[];
      limite?: number;
    }
  ): Promise<ResultadoRAG> {
    const startTime = Date.now();
    const limite = filtros?.limite || 5;

    // 1. Busca por texto completo (fallback sem embeddings)
    let documentos = await this.buscaTextoCompleto(query, filtros, limite);

    // 2. Se implementado, usar busca semântica com embeddings
    // documentos = await this.buscaSemantica(query, filtros, limite);

    // 3. Ranking e filtragem
    documentos = await this.rankearDocumentos(documentos, query);

    // 4. Construir contexto
    const contexto = await this.construirContexto(documentos, query);

    const tempoTotal = Date.now() - startTime;

    return {
      documentos: documentos.slice(0, limite),
      contexto_construido: contexto.texto,
      tokens_usados: contexto.tokens,
      tempo_busca_ms: tempoTotal
    };
  }

  /**
   * Busca por texto completo usando PostgreSQL full-text search
   */
  private async buscaTextoCompleto(
    query: string,
    filtros: any,
    limite: number
  ): Promise<DocumentoKnowledge[]> {
    let queryBuilder = this.supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('ativo', true);

    // Aplica filtros
    if (filtros?.categorias && filtros.categorias.length > 0) {
      queryBuilder = queryBuilder.in('category', filtros.categorias);
    }

    if (filtros?.tags && filtros.tags.length > 0) {
      queryBuilder = queryBuilder.overlaps('tags', filtros.tags);
    }

    // Busca textual
    queryBuilder = queryBuilder.textSearch('content', query, {
      type: 'websearch',
      config: 'portuguese'
    });

    queryBuilder = queryBuilder.limit(limite * 2); // Busca mais para depois rankear

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('[RAG] Erro na busca:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Busca semântica usando embeddings (implementação futura)
   */
  private async buscaSemantica(
    query: string,
    filtros: any,
    limite: number
  ): Promise<DocumentoKnowledge[]> {
    // TODO: Implementar busca com embeddings
    // 1. Gerar embedding da query
    // 2. Buscar documentos similares usando cosine similarity
    // 3. Retornar top-k resultados

    const embedding = await this.gerarEmbedding(query);

    // Query usando pgvector
    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limite
    });

    if (error) {
      console.error('[RAG] Erro na busca semântica:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Gera embedding usando OpenAI
   */
  private async gerarEmbedding(texto: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiKey}`
        },
        body: JSON.stringify({
          input: texto,
          model: 'text-embedding-3-small'
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao gerar embedding: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('[RAG] Erro ao gerar embedding:', error);
      return [];
    }
  }

  /**
   * Rankeia documentos por relevância
   */
  private async rankearDocumentos(
    documentos: DocumentoKnowledge[],
    query: string
  ): Promise<DocumentoKnowledge[]> {
    const queryLower = query.toLowerCase();
    const queryTermos = queryLower.split(/\s+/);

    return documentos.map(doc => {
      let pontuacao = 0;

      // Pontuação por título
      const tituloLower = doc.title.toLowerCase();
      queryTermos.forEach(termo => {
        if (tituloLower.includes(termo)) {
          pontuacao += 5;
        }
      });

      // Pontuação por tags
      doc.tags.forEach(tag => {
        const tagLower = tag.toLowerCase();
        queryTermos.forEach(termo => {
          if (tagLower.includes(termo)) {
            pontuacao += 3;
          }
        });
      });

      // Pontuação por conteúdo (sample)
      const contentLower = doc.content.toLowerCase().substring(0, 500);
      queryTermos.forEach(termo => {
        const matches = (contentLower.match(new RegExp(termo, 'g')) || []).length;
        pontuacao += matches * 1;
      });

      // Pontuação por categoria
      if (doc.category === 'metodologia' || doc.category === 'framework') {
        pontuacao += 2;
      }

      return {
        ...doc,
        relevancia: pontuacao
      };
    }).sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0));
  }

  /**
   * Constrói contexto para LLM a partir dos documentos
   */
  private async construirContexto(
    documentos: DocumentoKnowledge[],
    query: string
  ): Promise<{ texto: string; tokens: number }> {
    let contexto = `# Contexto de Conhecimento\n\n`;
    contexto += `Query: "${query}"\n\n`;
    contexto += `## Documentos Relevantes:\n\n`;

    let tokensAproximados = this.estimarTokens(contexto);

    for (const doc of documentos) {
      const secao = this.formatarDocumento(doc);
      const tokensSecao = this.estimarTokens(secao);

      // Verifica se cabe no limite
      if (tokensAproximados + tokensSecao > this.maxTokensContexto) {
        break;
      }

      contexto += secao + '\n\n';
      tokensAproximados += tokensSecao;
    }

    return {
      texto: contexto,
      tokens: tokensAproximados
    };
  }

  /**
   * Formata documento para inclusão no contexto
   */
  private formatarDocumento(doc: DocumentoKnowledge): string {
    let texto = `### ${doc.title}\n\n`;
    texto += `**Categoria:** ${doc.category}\n`;
    texto += `**Tags:** ${doc.tags.join(', ')}\n\n`;

    // Inclui aplicabilidade se existir
    if (doc.aplicabilidade && Object.keys(doc.aplicabilidade).length > 0) {
      texto += `**Quando usar:**\n`;
      if (doc.aplicabilidade.problemas) {
        texto += `- Problemas: ${doc.aplicabilidade.problemas.join(', ')}\n`;
      }
      if (doc.aplicabilidade.contextos) {
        texto += `- Contextos: ${doc.aplicabilidade.contextos.join(', ')}\n`;
      }
      texto += '\n';
    }

    // Conteúdo (limita para não explodir o contexto)
    const conteudoLimitado = doc.content.substring(0, 1500);
    texto += `**Conteúdo:**\n${conteudoLimitado}${doc.content.length > 1500 ? '...' : ''}\n`;

    return texto;
  }

  /**
   * Estima tokens de um texto (aproximação: 1 token ≈ 4 caracteres)
   */
  private estimarTokens(texto: string): number {
    return Math.ceil(texto.length / 4);
  }

  /**
   * Busca específica por categoria
   */
  async buscarPorCategoria(
    categoria: string,
    limite: number = 10
  ): Promise<DocumentoKnowledge[]> {
    const { data, error } = await this.supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('category', categoria)
      .eq('ativo', true)
      .limit(limite);

    if (error) {
      console.error('[RAG] Erro ao buscar por categoria:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Busca específica por tags
   */
  async buscarPorTags(
    tags: string[],
    limite: number = 10
  ): Promise<DocumentoKnowledge[]> {
    const { data, error } = await this.supabase
      .from('knowledge_base_documents')
      .select('*')
      .overlaps('tags', tags)
      .eq('ativo', true)
      .limit(limite);

    if (error) {
      console.error('[RAG] Erro ao buscar por tags:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Adiciona documento à knowledge base
   */
  async adicionarDocumento(
    documento: {
      title: string;
      category: string;
      content: string;
      tags?: string[];
      aplicabilidade?: any;
      metadados?: any;
    }
  ): Promise<string | null> {
    // Gera embedding se disponível
    let embedding = null;
    if (this.openaiKey) {
      const embeddingArray = await this.gerarEmbedding(documento.content);
      if (embeddingArray.length > 0) {
        embedding = embeddingArray;
      }
    }

    const { data, error } = await this.supabase
      .from('knowledge_base_documents')
      .insert({
        title: documento.title,
        category: documento.category,
        content: documento.content,
        tags: documento.tags || [],
        aplicabilidade: documento.aplicabilidade || {},
        metadados: documento.metadados || {},
        embedding,
        ativo: true,
        versao: 1
      })
      .select('id')
      .single();

    if (error) {
      console.error('[RAG] Erro ao adicionar documento:', error);
      return null;
    }

    return data?.id || null;
  }
}
