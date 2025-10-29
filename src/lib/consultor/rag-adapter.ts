// src/lib/consultor/rag-adapter.ts
import { supabase } from '../supabase';
import { normalizeToBackend, normalizeToUI } from './state-mapping';

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
}

export async function getOrCreateSessao(): Promise<string> {
  // 1) tenta sessão aberta do usuário
  const { data: sess, error: errSess } = await supabase
    .from('consultor_sessoes')
    .select('id')
    .eq('status', 'aberta')
    .limit(1)
    .maybeSingle();

  if (!errSess && sess?.id) return sess.id;

  // 2) cria nova com estado backend padrão 'coleta'
  const { data: created, error: errCreate } = await supabase
    .from('consultor_sessoes')
    .insert([{ estado_atual: 'coleta', status: 'aberta' }])
    .select('id')
    .single();

  if (errCreate) {
    console.error('[RAG-ADAPTER] Error creating sessao:', errCreate);
    throw new Error(
      `Erro ao criar sessão: ${errCreate.message || 'desconhecido'}`
    );
  }
  return created!.id as string;
}

export async function callConsultorRAG(input: Partial<RAGRequest>): Promise<ConsultorResponse> {
  const sessaoId = input.sessaoId || (await getOrCreateSessao());
  const message = input.message || '...';

  // Chama a Edge Function
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
    progresso: rag.progresso
  };
}
