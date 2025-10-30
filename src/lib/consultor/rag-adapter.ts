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
 * Cria jornada do consultor vinculada ao user
 */
async function createJornada(
  userId: string,
  conversationId: string,
  empresaNome?: string
): Promise<string> {
  try {
    const { data: jornada, error } = await supabase
      .from('jornadas_consultor')
      .insert([{
        user_id: userId,
        conversation_id: conversationId,
        empresa_nome: empresaNome || null,
        etapa_atual: 'anamnese',
        dados_anamnese: {},
        areas_priorizadas: [],
        progresso_geral: 0
      }])
      .select('id')
      .single();

    if (error) {
      console.error('[RAG-ADAPTER] Erro ao criar jornada:', error);
      throw new Error(`Erro ao criar jornada: ${error.message}`);
    }

    console.log('[RAG-ADAPTER] Jornada criada:', jornada.id);
    return jornada.id as string;
  } catch (err: any) {
    console.error('[RAG-ADAPTER] Exceção ao criar jornada:', err);
    throw new Error(`Falha ao criar jornada: ${err?.message || 'desconhecido'}`);
  }
}

/**
 * Cria/recupera sessão do consultor.
 * - SEMPRE cria jornada vinculada automaticamente
 * - Garante que jornada_id nunca seja null
 * - Progressivo fallback para evitar schema cache errors
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
      .select('id, estado_atual, empresa, setor, jornada_id')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!errBusca && sessExistente?.id) {
      console.log('[RAG-ADAPTER] Sessão existente encontrada:', sessExistente.id);

      // Se sessão existe mas não tem jornada, criar agora
      if (!sessExistente.jornada_id) {
        console.log('[RAG-ADAPTER] Sessão sem jornada, criando...');
        const jornadaId = await createJornada(userId, conversationId, sessExistente.empresa);

        // Vincular jornada à sessão
        await supabase
          .from('consultor_sessoes')
          .update({ jornada_id: jornadaId })
          .eq('id', sessExistente.id);

        console.log('[RAG-ADAPTER] Jornada vinculada à sessão existente');
      }

      return sessExistente.id;
    }

    if (errBusca) {
      console.warn('[RAG-ADAPTER] Erro ao buscar sessão existente:', errBusca.message);
    }
  } catch (err: any) {
    console.warn('[RAG-ADAPTER] Exceção ao buscar sessão:', err?.message || err);
  }

  // 2) Cria nova sessão com jornada vinculada
  console.log('[RAG-ADAPTER] Criando nova sessão com jornada...');

  try {
    // Criar jornada primeiro
    const jornadaId = await createJornada(userId, conversationId);

    // Criar sessão com jornada vinculada
    const { data: created, error: errCreate } = await supabase
      .from('consultor_sessoes')
      .insert([{
        user_id: userId,
        conversation_id: conversationId,
        titulo_problema: tituloProblemaPadrao,
        estado_atual: 'coleta',
        jornada_id: jornadaId,
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

    console.log('[RAG-ADAPTER] Nova sessão criada com jornada:', created.id);
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

  // Buscar dados da sessão para enviar ao Edge Function
  const { data: sessaoData, error: sessaoError } = await supabase
    .from('consultor_sessoes')
    .select('id, empresa, setor, estado_atual')
    .eq('id', sessaoId)
    .single();

  if (sessaoError || !sessaoData) {
    console.error('[RAG-ADAPTER] Error loading sessao data:', sessaoError);
    throw new Error('Falha ao carregar dados da sessão');
  }

  // Montar payload no formato esperado pelo Edge Function
  const { data, error } = await supabase.functions.invoke('consultor-rag', {
    body: {
      sessao: {
        id: sessaoData.id,
        empresa: sessaoData.empresa,
        setor: sessaoData.setor,
        estado: sessaoData.estado_atual
      },
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    }
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
