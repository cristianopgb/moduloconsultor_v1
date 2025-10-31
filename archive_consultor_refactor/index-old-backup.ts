/**
 * CONSULTOR RAG - ARQUITETURA DE 3 CAMADAS ADAPTATIVAS
 *
 * 1. ESTRATEGISTA: Carrega Adapter por Setor + Knowledge Base RAG
 * 2. TÁTICO: LLM decide ações baseado em portfólio adaptativo
 * 3. EXECUTOR: Frontend executa actions retornadas (gerar entregáveis, kanban, etc.)
 *
 * Fluxo:
 * 1. Recebe mensagem do usuário + sessão
 * 2. Carrega Adapter do setor (KPIs, perguntas, metodologias)
 * 3. Busca Knowledge Base por tags relevantes
 * 4. Monta prompt especializado com contexto
 * 5. LLM retorna resposta + actions[] (nunca vazio, Enforcer garante)
 * 6. Frontend executa actions via rag-executor
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { ConsultorOrchestrator } from './orchestrator.ts';
import { normalizeToBackend, isValidBackendState } from '../_shared/state-mapping.ts';
import { callOpenAI } from '../_shared/llm-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

interface RequestBody {
  sessao: {
    id: string;
    empresa?: string | null;
    setor?: string | null;
    estado?: string | null;
  };
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!;

    if (!OPENAI_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
    const body: RequestBody = await req.json();

    const { sessao, messages } = body;

    if (!sessao?.id || !messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'sessao.id and messages are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. BUSCAR SESSÃO COMPLETA DO BANCO (COM CONTEXTO!)
    const { data: sessaoCompleta, error: errSessao } = await supabase
      .from('consultor_sessoes')
      .select('*')
      .eq('id', sessao.id)
      .maybeSingle();

    if (errSessao || !sessaoCompleta) {
      console.error('[CONSULTOR-RAG] Erro buscando sessão:', errSessao);
      return new Response(
        JSON.stringify({ error: 'Sessão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONSULTOR-RAG] Sessão completa carregada:', {
      id: sessaoCompleta.id,
      estado: sessaoCompleta.estado_atual,
      tem_contexto: !!sessaoCompleta.contexto_coleta,
      empresa: sessaoCompleta.empresa,
      setor: sessaoCompleta.setor
    });

    // 2. ESTRATEGISTA: Inicializar orchestrator e carregar contexto
    const orchestrator = new ConsultorOrchestrator(supabase);

    // Carrega adapter por setor (usar sessaoCompleta)
    const adapter = await orchestrator.loadAdapterFor({
      setor: sessaoCompleta.setor,
      empresa: sessaoCompleta.empresa
    });

    // Carrega Knowledge Base relevante
    const tagsRelevantes = [
      ...(adapter?.setor ? [adapter.setor] : []),
      ...(adapter?.tags ?? []),
      ...(sessaoCompleta.setor ? [sessaoCompleta.setor] : [])
    ].filter(Boolean) as string[];

    const kb = await orchestrator.loadKnowledgeBaseBlocs(
      [...new Set(tagsRelevantes)].slice(0, 5),
      6
    );

    // Normalizar estado
    const estadoAtual = sessaoCompleta.estado_atual || 'coleta';
    const estadoNormalizado = normalizeToBackend(estadoAtual);

    if (!isValidBackendState(estadoNormalizado)) {
      console.warn('[CONSULTOR-RAG] Estado inválido, usando coleta:', estadoAtual);
    }

    // Extrair contexto já coletado
    const contextoColeta = sessaoCompleta.contexto_coleta || {};

    console.log('[CONSULTOR-RAG] Loaded:', {
      adapter: adapter?.setor || 'none',
      kb_docs: kb.length,
      estado_original: estadoAtual,
      estado_normalizado: estadoNormalizado,
      contexto_keys: Object.keys(contextoColeta)
    });

    // 3. TÁTICO: Montar prompt do Estrategista COM CONTEXTO
    const systemPrompt = orchestrator.getSystemPrompt({
      empresa: sessaoCompleta.empresa,
      setor: sessaoCompleta.setor,
      adapter,
      kb,
      estado: estadoNormalizado,
      contextoColeta  // PASSAR CONTEXTO JÁ COLETADO!
    });

    // Construir histórico para LLM (PRESERVAR ESTRUTURA DE CONVERSA)
    // CRÍTICO: Passar mensagens separadas, não concatenadas!
    const llmMessages: Array<{role: string, content: string}> = [
      { role: 'system', content: systemPrompt }
    ];

    // Adicionar histórico completo de mensagens
    for (const msg of messages) {
      llmMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }

    console.log('[CONSULTOR-RAG] Calling LLM with analytical profile');
    const llmResp = await callOpenAI(OPENAI_KEY, llmMessages, 'analytical');

    if (!llmResp.ok) {
      const err = await llmResp.text();
      console.error('[CONSULTOR-RAG] LLM error:', err);
      throw new Error(`LLM API error: ${llmResp.status}`);
    }

    const llmData = await llmResp.json();
    const fullText = String(llmData?.choices?.[0]?.message?.content ?? '');

    console.log('[CONSULTOR-RAG] LLM response length:', fullText.length);

    // 4. TÁTICO: Parse actions (sempre retorna algo)
    let { actions, contexto_incremental } = orchestrator.parseActionsBlock(fullText);

    // 5. ENFORCER: Se LLM não retornou actions, sintetiza fallback
    const ultimaMensagemUser = String(messages.at(-1)?.content ?? '');

    if (!Array.isArray(actions) || actions.length === 0) {
      console.warn('[ENFORCER] LLM não retornou actions, sintetizando fallback...');
      actions = orchestrator.synthesizeFallbackActions(estadoNormalizado, ultimaMensagemUser);
    }

    // 6. CRITICAL: Filtrar transições prematuras durante anamnese incompleta
    actions = orchestrator.filterPrematureTransitions(actions, contextoColeta, estadoNormalizado);
    console.log('[CONSULTOR-RAG] Actions after filtering premature transitions:', actions.length);

    // 7. FIX: Normaliza transicao_estado para sempre ter 'to' válido
    actions = orchestrator.fixTransicaoEstadoTargets(actions, estadoNormalizado);
    console.log('[CONSULTOR-RAG] Actions after normalization:', actions.length);

    // Extrai texto limpo (antes de [PARTE B])
    const replyText = fullText.split('[PARTE B]')[0]?.trim() || 'Avançando com a próxima ação.';

    console.log('[CONSULTOR-RAG] Returning:', {
      reply_length: replyText.length,
      actions_count: actions.length,
      etapa: estadoNormalizado,
      contexto_incremental_keys: Object.keys(contexto_incremental || {})
    });

    // 8. Retornar para frontend (EXECUTOR executará as actions)
    return new Response(JSON.stringify({
      reply: replyText,
      actions: actions,
      contexto_incremental,
      etapa: estadoNormalizado,
      sessao_id: sessaoCompleta.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('[consultor-rag] ERROR:', e);
    return new Response(JSON.stringify({
      reply: 'Não consegui processar sua mensagem agora. Por favor, tente novamente.',
      actions: [],
      error: e.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 // Return 200 to not break frontend
    });
  }
});
