/**
 * RAG Adapter - Bridge between new RAG system and existing UI
 *
 * This adapter:
 * 1. Calls consultor-rag Edge Function instead of legacy consultor-chat
 * 2. Transforms RAG responses to match UI expectations
 * 3. Handles session management and state persistence
 * 4. Provides fallback to legacy system if needed
 */

import { supabase } from '../supabase';

export interface RAGRequest {
  message: string;
  userId: string;
  conversationId?: string;
  sessaoId?: string;
  formData?: Record<string, any>;
  action?: string;
}

export interface RAGResponse {
  response: string;
  sessao_id: string;
  estado_atual: 'coleta' | 'analise' | 'diagnostico' | 'recomendacao' | 'execucao';
  progresso: number;
  actions?: Array<{
    type: string;
    params: Record<string, any>;
  }>;
  rag_info?: {
    documentos_usados: string[];
    tokens_usados: number;
    tempo_busca_ms: number;
  };
}

export interface ConsultorResponse {
  text: string;
  sessaoId: string;
  estado: string;
  progresso: number;
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
 * Call the RAG system and transform response for UI
 */
export async function callConsultorRAG(request: RAGRequest): Promise<ConsultorResponse> {
  try {
    console.log('[RAG-ADAPTER] Calling consultor-rag with:', {
      message: request.message.substring(0, 50) + '...',
      userId: request.userId,
      conversationId: request.conversationId,
      sessaoId: request.sessaoId,
      hasFormData: !!request.formData
    });

    // Load conversation history to provide context
    let conversationHistory: Array<{role: string, content: string}> = [];
    if (request.conversationId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', request.conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      conversationHistory = messages || [];
      console.log('[RAG-ADAPTER] Loaded', conversationHistory.length, 'previous messages');
    }

    const { data, error } = await supabase.functions.invoke('consultor-rag', {
      body: {
        message: request.message,
        user_id: request.userId,
        conversation_id: request.conversationId,
        sessao_id: request.sessaoId,
        form_data: request.formData,
        action: request.action,
        conversation_history: conversationHistory
      }
    });

    if (error) {
      console.error('[RAG-ADAPTER] Error calling consultor-rag:', error);
      throw error;
    }

    const ragResponse = data as RAGResponse;
    console.log('[RAG-ADAPTER] RAG response:', {
      sessaoId: ragResponse.sessao_id,
      estado: ragResponse.estado_atual,
      progresso: ragResponse.progresso,
      actionsCount: ragResponse.actions?.length || 0
    });

    // Transform RAG response to UI format
    const uiResponse: ConsultorResponse = {
      text: ragResponse.response,
      sessaoId: ragResponse.sessao_id,
      estado: ragResponse.estado_atual,
      progresso: ragResponse.progresso,
      ragInfo: ragResponse.rag_info ? {
        methodologies: ragResponse.rag_info.documentos_usados,
        tokensUsed: ragResponse.rag_info.tokens_usados,
        searchTime: ragResponse.rag_info.tempo_busca_ms
      } : undefined
    };

    // Parse actions to set UI flags
    if (ragResponse.actions && ragResponse.actions.length > 0) {
      for (const action of ragResponse.actions) {
        switch (action.type) {
          case 'coletar_info':
            // RAG wants to collect info - could trigger form
            if (action.params?.tipo_form) {
              uiResponse.needsForm = true;
              uiResponse.formType = action.params.tipo_form;
            }
            break;

          case 'gerar_entregavel':
            uiResponse.shouldGenerateDeliverable = true;
            uiResponse.deliverableType = action.params?.tipo_entregavel || 'diagnostico';
            break;

          case 'aplicar_metodologia':
            // Methodology will be applied automatically by orchestrator
            console.log('[RAG-ADAPTER] Methodology to apply:', action.params?.metodologia);
            break;
        }
      }
    }

    return uiResponse;

  } catch (error) {
    console.error('[RAG-ADAPTER] Failed to call consultor-rag:', error);
    throw error;
  }
}

/**
 * Get or create a sessao for this conversation
 */
export async function getOrCreateSessao(
  userId: string,
  conversationId: string,
  initialMessage?: string
): Promise<string | null> {
  try {
    // Check if sessao already exists for this conversation
    const { data: existing, error: fetchError } = await supabase
      .from('consultor_sessoes')
      .select('id')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .eq('ativo', true)
      .maybeSingle();

    if (fetchError) {
      console.error('[RAG-ADAPTER] Error fetching sessao:', fetchError);
      return null;
    }

    if (existing) {
      console.log('[RAG-ADAPTER] Using existing sessao:', existing.id);
      return existing.id;
    }

    // Create new sessao
    const { data: newSessao, error: createError } = await supabase
      .from('consultor_sessoes')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        titulo_problema: initialMessage?.substring(0, 100) || 'Nova consultoria',
        contexto_negocio: {},
        estado_atual: 'coleta',
        progresso: 0,
        ativo: true
      })
      .select('id')
      .single();

    if (createError) {
      console.error('[RAG-ADAPTER] Error creating sessao:', createError);
      return null;
    }

    console.log('[RAG-ADAPTER] Created new sessao:', newSessao.id);
    return newSessao.id;

  } catch (error) {
    console.error('[RAG-ADAPTER] Exception in getOrCreateSessao:', error);
    return null;
  }
}

/**
 * Update sessao context with form data
 */
export async function updateSessaoContext(
  sessaoId: string,
  formData: Record<string, any>
): Promise<boolean> {
  try {
    // Get current context
    const { data: sessao, error: fetchError } = await supabase
      .from('consultor_sessoes')
      .select('contexto_negocio')
      .eq('id', sessaoId)
      .single();

    if (fetchError) {
      console.error('[RAG-ADAPTER] Error fetching sessao context:', fetchError);
      return false;
    }

    // Merge with new form data
    const updatedContext = {
      ...(sessao.contexto_negocio || {}),
      ...formData
    };

    // Update sessao
    const { error: updateError } = await supabase
      .from('consultor_sessoes')
      .update({ contexto_negocio: updatedContext })
      .eq('id', sessaoId);

    if (updateError) {
      console.error('[RAG-ADAPTER] Error updating sessao context:', updateError);
      return false;
    }

    console.log('[RAG-ADAPTER] Updated sessao context');
    return true;

  } catch (error) {
    console.error('[RAG-ADAPTER] Exception in updateSessaoContext:', error);
    return false;
  }
}
