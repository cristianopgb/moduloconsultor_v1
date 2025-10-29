/**
 * RAG Adapter - Frontend bridge to 3-Layer Consultor Architecture
 *
 * Responsabilidades:
 * 1. Gerencia sessão (busca empresa, setor, estado)
 * 2. Monta mensagens no formato esperado pelo backend
 * 3. Chama consultor-rag Edge Function (Estrategista + Tático)
 * 4. Retorna actions normalizadas para o Executor executar
 * 5. NUNCA re-chama RAG automaticamente (anti-loop)
 */

import { supabase } from '../supabase';
import { normalizeToBackend, normalizeToUI } from './state-mapping';

export interface RAGRequest {
  sessaoId: string; // Obrigatório agora
  message: string;
  userId: string;
  conversationId?: string;
}

export interface RAGResponse {
  reply: string;
  actions: Array<{
    type: string;
    params?: Record<string, any>;
    [key: string]: any;
  }>;
  contexto_incremental?: any;
  etapa?: string;
  sessao_id: string;
}

export interface ConsultorResponse {
  text: string;
  sessaoId: string;
  estado: string;
  progresso: number;
  actions?: any[]; // Direct actions from enforcer
  contexto_incremental?: any;
  needsForm?: boolean;
  formType?: string;
  shouldGenerateDeliverable?: boolean;
  deliverableType?: string;
  ragInfo?: {
    methodologies: string[];
    tokensUsed: number;
    searchTime: number;
  };
}

/**
 * Call the RAG system (Estrategista + Tático)
 * Retorna actions para o Executor executar
 */
export async function callConsultorRAG(request: RAGRequest): Promise<ConsultorResponse> {
  try {
    console.log('[RAG-ADAPTER] Calling consultor-rag:', {
      sessaoId: request.sessaoId,
      message: request.message.substring(0, 50) + '...'
    });

    // 1. Buscar dados da sessão (empresa, setor, estado)
    const { data: sessao } = await supabase
      .from('consultor_sessoes')
      .select('id, empresa, setor, estado_atual, contexto_negocio')
      .eq('id', request.sessaoId)
      .single();

    if (!sessao) {
      throw new Error('Sessão não encontrada');
    }

    // 2. Carregar histórico da conversa
    let messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

    if (request.conversationId) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', request.conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (msgs) {
        messages = msgs.map(m => ({
          role: (m.role === 'user' || m.role === 'assistant' ? m.role : 'assistant') as 'user' | 'assistant',
          content: m.content
        }));
      }
    }

    // Adiciona mensagem atual
    messages.push({ role: 'user', content: request.message });

    console.log('[RAG-ADAPTER] Sending', messages.length, 'messages to RAG');

    // 3. Chamar consultor-rag com novo formato (normaliza estado para backend)
    const { data, error } = await supabase.functions.invoke('consultor-rag', {
      body: {
        sessao: {
          id: sessao.id,
          empresa: sessao.contexto_negocio?.empresa_nome || sessao.empresa || null,
          setor: sessao.contexto_negocio?.segmento || sessao.setor || null,
          estado: normalizeToBackend(sessao.estado_atual || 'anamnese')
        },
        messages
      }
    });

    if (error) {
      console.error('[RAG-ADAPTER] Error calling consultor-rag:', error);
      throw error;
    }

    const ragResponse = data as RAGResponse;
    console.log('[RAG-ADAPTER] RAG response:', {
      reply_length: ragResponse.reply?.length || 0,
      actions_count: ragResponse.actions?.length || 0,
      etapa: ragResponse.etapa
    });

    // 4. Transformar para formato UI (normaliza estado para UI, actions passam direto)
    const uiResponse: ConsultorResponse = {
      text: ragResponse.reply || 'Processando...',
      sessaoId: ragResponse.sessao_id || request.sessaoId,
      estado: normalizeToUI(ragResponse.etapa || 'coleta'),
      progresso: 0, // Calculado pelo backend se necessário
      actions: ragResponse.actions || [],
      contexto_incremental: ragResponse.contexto_incremental
    };

    return uiResponse;

  } catch (error: any) {
    console.error('[RAG-ADAPTER] Failed to call consultor-rag:', error);
    throw error;
  }
}

/**
 * Get or create a sessao for this conversation
 * IMPORTANTE: Sempre retorna sessaoId (nunca null)
 */
export async function getOrCreateSessao(
  userId: string,
  conversationId: string,
  initialMessage?: string
): Promise<string> {
  try {
    // Verificar se já existe sessão para esta conversa
    const { data: existing, error: fetchError } = await supabase
      .from('consultor_sessoes')
      .select('id')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .eq('ativo', true)
      .maybeSingle();

    if (!fetchError && existing) {
      console.log('[RAG-ADAPTER] Using existing sessao:', existing.id);
      return existing.id;
    }

    // Criar nova sessão
    const { data: newSessao, error: createError } = await supabase
      .from('consultor_sessoes')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        titulo_problema: initialMessage?.substring(0, 100) || 'Nova consultoria',
        contexto_negocio: {},
        estado_atual: 'anamnese',
        progresso: 0,
        ativo: true
      })
      .select('id')
      .single();

    if (createError || !newSessao) {
      throw new Error(`Erro ao criar sessão: ${createError?.message}`);
    }

    console.log('[RAG-ADAPTER] Created new sessao:', newSessao.id);
    return newSessao.id;

  } catch (error: any) {
    console.error('[RAG-ADAPTER] Exception in getOrCreateSessao:', error);
    throw error;
  }
}

// Re-export secure session client
export { updateSessaoContext } from './session-client';
