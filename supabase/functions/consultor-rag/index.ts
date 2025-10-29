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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno';
import { ConsultorOrchestrator } from './orchestrator.ts';

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

    // 1. ESTRATEGISTA: Inicializar orchestrator e carregar contexto
    const orchestrator = new ConsultorOrchestrator(supabase);

    // Carrega adapter por setor
    const adapter = await orchestrator.loadAdapterFor({
      setor: sessao.setor,
      empresa: sessao.empresa
    });

    // Carrega Knowledge Base relevante
    const tagsRelevantes = [
      ...(adapter?.setor ? [adapter.setor] : []),
      ...(adapter?.tags ?? []),
      ...(sessao.setor ? [sessao.setor] : [])
    ].filter(Boolean) as string[];

    const kb = await orchestrator.loadKnowledgeBaseBlocs(
      [...new Set(tagsRelevantes)].slice(0, 5),
      6
    );

    console.log('[CONSULTOR-RAG] Loaded:', {
      adapter: adapter?.setor || 'none',
      kb_docs: kb.length,
      estado: sessao.estado || 'anamnese'
    });

    // 2. TÁTICO: Montar prompt do Estrategista
    const systemPrompt = orchestrator.getSystemPrompt({
      empresa: sessao.empresa,
      setor: sessao.setor,
      adapter,
      kb
    });

    // Construir histórico para LLM
    const userContent = messages.map((m: any) =>
      `${m.role.toUpperCase()}: ${m.content}`
    ).join('\n');

    // 3. Chamar LLM (TÁTICO decide actions)
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
    console.log('[CONSULTOR-RAG] Calling LLM:', model);

    const llmResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

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
    const estadoAtual = String(sessao.estado || 'anamnese');
    const ultimaMensagemUser = String(messages.at(-1)?.content ?? '');

    if (!Array.isArray(actions) || actions.length === 0) {
      console.warn('[ENFORCER] LLM não retornou actions, sintetizando fallback...');
      actions = orchestrator.synthesizeFallbackActions(estadoAtual, ultimaMensagemUser);
    }

    // Extrai texto limpo (antes de [PARTE B])
    const replyText = fullText.split('[PARTE B]')[0]?.trim() || 'Avançando com a próxima ação.';

    console.log('[CONSULTOR-RAG] Returning:', {
      reply_length: replyText.length,
      actions_count: actions.length,
      etapa: estadoAtual
    });

    // 6. Retornar para frontend (EXECUTOR executará as actions)
    return new Response(JSON.stringify({
      reply: replyText,
      actions: actions,
      contexto_incremental,
      etapa: estadoAtual,
      sessao_id: sessao.id
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
