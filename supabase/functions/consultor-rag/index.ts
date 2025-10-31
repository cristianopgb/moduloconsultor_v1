/**
 * CONSULTOR RAG - VERSÃO SIMPLIFICADA E FUNCIONAL
 *
 * Fluxo Linear:
 * 1. Recebe mensagem do usuário
 * 2. Carrega histórico completo de mensagens
 * 3. Carrega contexto acumulado da sessão
 * 4. Monta prompt com knowledge base e adapter do setor
 * 5. Chama LLM uma vez com histórico completo
 * 6. Salva resposta no histórico
 * 7. Atualiza contexto se houver dados novos
 * 8. Retorna resposta ao usuário
 *
 * Sem orchestrators, sem action parsing complexo, sem fallbacks elaborados.
 * Apenas uma conversação simples e confiável.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

interface RequestBody {
  sessao_id: string;
  message: string;
}

// Prompt sistema simples e focado
const ANAMNESE_PROMPT = `Você é o PROCEDA | Consultor Empresarial Sênior.

OBJETIVO: Conduzir uma anamnese empresarial em exatamente 7 turnos, coletando:

TURNO 1: Nome completo e cargo do respondente
TURNO 2: Idade e formação acadêmica
TURNO 3: Nome da empresa
TURNO 4: Segmento de atuação e o que a empresa vende/oferece
TURNO 5: Faturamento anual estimado
TURNO 6: Principal dor ou desafio que motivou a buscar consultoria
TURNO 7: Expectativa de sucesso (como saberá que funcionou?)

REGRAS CRÍTICAS:
1. SEMPRE verifique o CONTEXTO JÁ COLETADO antes de perguntar!
2. NÃO repita perguntas já respondidas
3. Faça APENAS 1 pergunta direta por turno
4. Seja breve (máximo 4 linhas) e direto
5. Informe o turno atual: "Turno X/7: ..."
6. Após coletar os 7 turnos, informe que a anamnese foi concluída

FORMATO DE RESPOSTA:

[PARTE A]
Turno X/7: [sua pergunta objetiva aqui]

[PARTE B]
{
  "contexto_incremental": {
    "turno_atual": X,
    "[campo]": "[resposta do usuário]"
  },
  "anamnese_completa": false
}

Quando completar os 7 turnos, retorne:
{
  "contexto_incremental": {},
  "anamnese_completa": true
}
`;

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

    if (!body.sessao_id || !body.message) {
      return new Response(
        JSON.stringify({ error: 'sessao_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONSULTOR] Processing message for session:', body.sessao_id);

    // 1. Buscar sessão
    const { data: sessao, error: sessaoError } = await supabase
      .from('consultor_sessoes')
      .select('*')
      .eq('id', body.sessao_id)
      .maybeSingle();

    if (sessaoError || !sessao) {
      console.error('[CONSULTOR] Session not found:', sessaoError);
      return new Response(
        JSON.stringify({ error: 'Sessão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Carregar histórico de mensagens
    const { data: historico, error: histError } = await supabase
      .from('consultor_mensagens')
      .select('role, content, created_at')
      .eq('sessao_id', body.sessao_id)
      .order('created_at', { ascending: true });

    if (histError) {
      console.error('[CONSULTOR] Error loading history:', histError);
    }

    const messages = historico || [];
    console.log('[CONSULTOR] Loaded', messages.length, 'previous messages');

    // 3. Carregar contexto acumulado
    const contexto = sessao.contexto_coleta || {};
    const turnoAtual = contexto.turno_atual || 1;
    const anamneseCompleta = contexto.anamnese_completa === true;

    console.log('[CONSULTOR] Current context:', {
      turno: turnoAtual,
      completed: anamneseCompleta,
      keys: Object.keys(contexto)
    });

    // 4. Carregar knowledge base e adapter (simplificado - pode ser expandido depois)
    let kbContext = '';
    if (sessao.setor) {
      const { data: adapter } = await supabase
        .from('adapters_setor')
        .select('kpis, perguntas, metodologias')
        .ilike('setor', `%${sessao.setor}%`)
        .limit(1)
        .maybeSingle();

      if (adapter) {
        kbContext = `\n\nCONTEXTO DO SETOR ${sessao.setor}:\n` +
          `KPIs relevantes: ${adapter.kpis?.slice(0, 5).join(', ') || 'N/A'}\n` +
          `Metodologias recomendadas: ${adapter.metodologias?.slice(0, 3).join(', ') || 'N/A'}`;
      }
    }

    // 5. Montar contexto já coletado de forma legível
    const contextoStr = Object.entries(contexto)
      .filter(([k]) => k !== 'turno_atual' && k !== 'anamnese_completa')
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join('\n');

    const contextoSection = contextoStr
      ? `\n\n═══ CONTEXTO JÁ COLETADO (NÃO PERGUNTE NOVAMENTE) ═══\n${contextoStr}\n═══════════════════════════════════════════════════════\n`
      : '\n\nNenhum dado coletado ainda. Comece pela primeira pergunta do Turno 1.\n';

    // 6. Montar prompt do sistema
    const systemPrompt = ANAMNESE_PROMPT + contextoSection + kbContext;

    // 7. Construir array de mensagens para LLM
    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Adicionar histórico completo
    for (const msg of messages) {
      if (msg.role !== 'system') {
        llmMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }

    // Adicionar mensagem atual do usuário
    llmMessages.push({
      role: 'user',
      content: body.message
    });

    console.log('[CONSULTOR] Calling LLM with', llmMessages.length, 'messages');

    // 8. Chamar OpenAI
    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: llmMessages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('[CONSULTOR] LLM error:', errorText);
      throw new Error(`LLM API error: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    const fullResponse = llmData?.choices?.[0]?.message?.content || '';

    console.log('[CONSULTOR] LLM response length:', fullResponse.length);

    // 9. Extrair PARTE A (texto para usuário)
    const parteAMatch = fullResponse.match(/\[PARTE A\]([\s\S]*?)(\[PARTE B\]|$)/i);
    const responseText = parteAMatch
      ? parteAMatch[1].trim()
      : fullResponse.split('[PARTE B]')[0].trim() || fullResponse;

    // 10. Extrair PARTE B (contexto incremental)
    let contextoIncremental = {};
    let anamneseCompletaAgora = false;

    const parteBMatch = fullResponse.match(/\[PARTE B\]([\s\S]*)/i);
    if (parteBMatch) {
      try {
        const jsonStr = parteBMatch[1]
          .trim()
          .replace(/```json|```/g, '')
          .trim();
        const parsed = JSON.parse(jsonStr);
        contextoIncremental = parsed.contexto_incremental || {};
        anamneseCompletaAgora = parsed.anamnese_completa === true;
      } catch (e) {
        console.warn('[CONSULTOR] Failed to parse PARTE B:', e);
      }
    }

    // 11. Salvar mensagem do usuário no histórico
    await supabase.from('consultor_mensagens').insert({
      sessao_id: body.sessao_id,
      role: 'user',
      content: body.message
    });

    // 12. Salvar resposta do assistente no histórico
    await supabase.from('consultor_mensagens').insert({
      sessao_id: body.sessao_id,
      role: 'assistant',
      content: responseText
    });

    // 13. Atualizar contexto acumulado
    if (Object.keys(contextoIncremental).length > 0 || anamneseCompletaAgora) {
      const novoContexto = {
        ...contexto,
        ...contextoIncremental,
        anamnese_completa: anamneseCompletaAgora
      };

      await supabase
        .from('consultor_sessoes')
        .update({
          contexto_coleta: novoContexto,
          estado_atual: anamneseCompletaAgora ? 'mapeamento' : 'coleta',
          updated_at: new Date().toISOString()
        })
        .eq('id', body.sessao_id);

      console.log('[CONSULTOR] Context updated:', Object.keys(novoContexto));
    }

    // 14. Retornar resposta
    return new Response(
      JSON.stringify({
        reply: responseText,
        estado: anamneseCompletaAgora ? 'mapeamento' : 'coleta',
        turno_atual: contextoIncremental.turno_atual || turnoAtual,
        anamnese_completa: anamneseCompletaAgora,
        contexto_coletado: Object.keys({ ...contexto, ...contextoIncremental }).length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[CONSULTOR] ERROR:', error);
    return new Response(
      JSON.stringify({
        reply: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
