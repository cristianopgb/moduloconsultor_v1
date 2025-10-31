// src/lib/consultor/rag-adapter-simplified.ts
import { supabase } from '../supabase';

export interface ConsultorResponse {
  text: string;
  estado: string;
  turno_atual: number;
  anamnese_completa: boolean;
  contexto_coletado: number;
  sessaoId: string;
}

/**
 * Cria/recupera sessão do consultor de forma simplificada
 */
export async function getOrCreateSessao(
  userId: string,
  conversationId: string,
  tituloProblemaPadrao = 'Nova Consultoria'
): Promise<string> {
  // 1) Tentar buscar sessão existente com ativo=true
  try {
    const { data: sessExistente, error: errBusca } = await supabase
      .from('consultor_sessoes')
      .select('id')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
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

  // 2) Criar nova sessão
  console.log('[RAG-ADAPTER] Criando nova sessão...');

  try {
    const { data: created, error: errCreate } = await supabase
      .from('consultor_sessoes')
      .insert([{
        user_id: userId,
        conversation_id: conversationId,
        titulo_problema: tituloProblemaPadrao,
        estado_atual: 'coleta',
        contexto_coleta: {},
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
 * Chama a Edge Function consultor-rag simplificada
 */
export async function callConsultorRAG(input: {
  sessaoId?: string;
  userId: string;
  conversationId: string;
  message: string;
}): Promise<ConsultorResponse> {
  const sessaoId = input.sessaoId || (await getOrCreateSessao(input.userId, input.conversationId, input.message));
  const message = input.message || '...';

  console.log('[RAG-ADAPTER] Calling consultor-rag function with:', {
    sessaoId,
    messageLength: message.length
  });

  // Chamar Edge Function
  const { data, error } = await supabase.functions.invoke('consultor-rag', {
    body: {
      sessao_id: sessaoId,
      message: message
    }
  });

  if (error) {
    console.error('[RAG-ADAPTER] Error calling consultor-rag:', error);
    throw new Error(error.message || 'Falha ao chamar consultor-rag');
  }

  console.log('[RAG-ADAPTER] Response received:', {
    estado: data?.estado,
    turno: data?.turno_atual,
    completa: data?.anamnese_completa
  });

  return {
    text: data?.reply ?? '',
    estado: data?.fase ?? data?.estado ?? 'coleta',  // Edge Function returns 'fase', not 'estado'
    turno_atual: data?.turno_atual ?? 1,
    anamnese_completa: data?.anamnese_completa ?? false,
    contexto_coletado: data?.contexto_coletado ?? 0,
    sessaoId: sessaoId,
    actions: data?.actions_processadas ? [] : (data?.actions || []),  // Pass actions through
    progresso: data?.progresso
  };
}
