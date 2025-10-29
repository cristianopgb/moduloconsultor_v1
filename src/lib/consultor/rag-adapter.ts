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
}

/**
 * Cria/recupera sessão do consultor.
 * - Tenta filtrar por status='aberta' (se a coluna existir)
 * - Se falhar por schema/cache, faz fallback sem o filtro
 * - No insert, não envia 'status' (DB usa default se existir)
 */
export async function getOrCreateSessao(): Promise<string> {
  // 1) tenta com status='aberta'
  try {
    const { data: sess1, error: err1 } = await supabase
      .from('consultor_sessoes')
      .select('id')
      .eq('status', 'aberta')
      .limit(1)
      .maybeSingle();

    if (!err1 && sess1?.id) return sess1.id;
  } catch (err: any) {
    console.warn(
      '[RAG-ADAPTER] status filter failed, falling back without status:',
      err?.message || err
    );
  }

  // 2) fallback sem filtrar por status (compatível com schema antigo)
  try {
    const { data: sess2, error: err2 } = await supabase
      .from('consultor_sessoes')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!err2 && sess2?.id) return sess2.id;
  } catch (err: any) {
    console.warn(
      '[RAG-ADAPTER] fallback select failed (no status):',
      err?.message || err
    );
  }

  // 3) cria nova com estado backend padrão 'coleta'
  const { data: created, error: errCreate } = await supabase
    .from('consultor_sessoes')
    .insert([{ estado_atual: 'coleta' }]) // status: default do DB (se existir)
    .select('id')
    .single();

  if (errCreate) {
    console.error('[RAG-ADAPTER] Error creating sessao:', errCreate);
    throw new Error(`Erro ao criar sessão: ${errCreate.message || 'desconhecido'}`);
  }
  return created!.id as string;
}

/**
 * Chama a Edge Function consultor-rag e normaliza a resposta para a UI
 */
export async function callConsultorRAG(input: Partial<RAGRequest>): Promise<ConsultorResponse> {
  const sessaoId = input.sessaoId || (await getOrCreateSessao());
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
    progresso: rag.progresso
  };
}
