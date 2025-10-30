// src/lib/consultor/rag-adapter.ts
import { supabase } from '../supabase';
import { normalizeToUI } from './state-mapping';

export interface RAGRequest {
  sessaoId: string;
  message: string;
}

export interface RAGAction {
  type: string;
  payload?: any;
  enforce?: boolean;
}

export interface RAGResponse {
  reply: string;
  actions: RAGAction[];
  etapa?: string; // backend state (coleta/analise/...)
  progresso?: number;
}

export interface ConsultorResponse {
  text: string;
  actions: RAGAction[];
  estado: string;   // UI state
  progresso: number;
  sessaoId: string;
  contexto_incremental?: any;
  ragInfo?: any;
}

/**
 * Cria/recupera sessão do consultor.
 * - Progressivo fallback para evitar schema cache errors
 * - NUNCA usa coluna 'status' (não existe no schema)
 * - Cria com user_id, estado_atual e campos básicos
 */
export async function getOrCreateSessao(
  userId: string,
  conversationId: string,
  tituloProblemaPadrao = 'Nova Consultoria'
): Promise<string> {
  // 1) Tenta buscar sessão existente com ativo=true
  try {
    const { data: sessExistente, error: errBusca } = await supabase
      .from('consultor_sessoes')
      .select('id, estado_atual, empresa, setor')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!errBusca && sessExistente?.id) {
      console.log('[RAG-ADAPTER] Sessão existente encontrada:', sessExistente.id);
      return sessExistente.id;
    }

    if (errBusca) {
      console.warn('[RAG-ADAPTER] Erro ao buscar sessão existente:', errBusca.message);
    }
  } catch (err: any) {
    console.warn('[RAG-ADAPTER] Exceção ao buscar sessão:', err?.message || err);
  }

  // 2) Cria nova sessão com campos essenciais
  console.log('[RAG-ADAPTER] Criando nova sessão...');

  try {
    const { data: created, error: errCreate } = await supabase
      .from('consultor_sessoes')
      .insert([{
        user_id: userId,
        conversation_id: conversationId,
        titulo_problema: tituloProblemaPadrao,
        estado_atual: 'coleta',
        contexto_negocio: {},
        metodologias_aplicadas: [],
        documentos_usados: [],
        historico_rag: [],
        entregaveis_gerados: [],
        progresso: 0,
        ativo: true
      }])
      .select('id')
      .single();

    if (errCreate) {
      console.error('[RAG-ADAPTER] Erro ao criar sessão:', errCreate);
      throw new Error(`Erro ao criar sessão: ${errCreate.message || 'desconhecido'}`);
    }

    console.log('[RAG-ADAPTER] Nova sessão criada:', created.id);
    return created.id as string;

  } catch (err: any) {
    console.error('[RAG-ADAPTER] Exceção ao criar sessão:', err);
    throw new Error(`Falha crítica ao criar sessão: ${err?.message || 'desconhecido'}`);
  }
}

/**
 * Chama a Edge Function consultor-rag e normaliza a resposta para a UI
 */
export async function callConsultorRAG(input: {
  sessaoId?: string;
  userId: string;
  conversationId: string;
  message: string;
}): Promise<ConsultorResponse> {
  const sessaoId = input.sessaoId || (await getOrCreateSessao(input.userId, input.conversationId, input.message));
  const message = input.message || '...';

  const { data, error } = await supabase.functions.invoke('consultor-rag', {
    body: { sessao_id: sessaoId, message }
  });

  if (error) {
    console.error('[RAG-ADAPTER] Error calling consultor-rag:', error);
    throw new Error(error.message || 'Falha ao chamar consultor-rag');
  }

  const rag: RAGResponse = {
    reply: data?.reply ?? '',
    actions: data?.actions ?? [],
    etapa: data?.etapa ?? 'coleta',
    progresso: data?.progresso ?? 0
  };

  return {
    text: rag.reply,
    actions: rag.actions,
    estado: normalizeToUI(rag.etapa),
    progresso: rag.progresso,
    sessaoId: sessaoId,
    contexto_incremental: data?.contexto_incremental,
    ragInfo: {
      methodologies: data?.methodologies,
      kbDocs: data?.kb_docs
    }
  };
}
