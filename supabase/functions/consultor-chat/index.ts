// Use CDN-built ESM to avoid tslib require errors when running in the Edge runtime
// Use an ESM build compatible with Deno to avoid runtime resolution issues (tslib)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno'
import { IntelligentPromptBuilder } from './intelligent-prompt-builder.ts';
import { MarkerProcessor } from './marker-processor.ts';
import { DeliverableGenerator } from './deliverable-generator.ts';
import { FrameworkGuide } from './framework-guide.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

async function saveMessages(supabase: any, conversationId: string, userId: string, userMsg: string, assistantMsg: string) {
  try {
    await supabase.from('messages').insert([
      { conversation_id: conversationId, role: 'user', content: userMsg, user_id: userId },
      { conversation_id: conversationId, role: 'assistant', content: assistantMsg, user_id: userId }
    ]);
  } catch (err) {
    console.error('[CONSULTOR-CHAT] Erro ao salvar mensagens:', err);
  }
}

async function callLLM(systemPrompt: string, userPrompt: string, openaiKey: string): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('[CONSULTOR-CHAT] LLM call failed:', err);
    throw err;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

  const { message, conversation_id, user_id, form_data, form_type } = await req.json();

    if (!message || !conversation_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[CONSULTOR-CHAT] Request received:', { user_id, conversation_id, has_form_data: !!form_data });

    const isFormSubmission = Boolean(form_data && Object.keys(form_data).length > 0);

    const { data: conversationHistory } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    let { data: jornada, error: jornadaError } = await supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('user_id', user_id)
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    if (jornadaError) {
      console.error('[CONSULTOR-CHAT] Erro ao buscar jornada:', jornadaError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar jornada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!jornada) {
      console.log('[CONSULTOR-CHAT] Creating new jornada...');
      const { data: newJornada, error: createError } = await supabase
        .from('jornadas_consultor')
        .insert({
          user_id: user_id,
          conversation_id: conversation_id,
          etapa_atual: 'apresentacao',
          contexto_coleta: {}
        })
        .select()
        .single();

      if (createError) {
        console.error('[CONSULTOR-CHAT] Error creating jornada:', createError);
        return new Response(JSON.stringify({ error: 'Erro ao criar jornada' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      jornada = newJornada;
    }

  let preAwardResult = null;
  if (isFormSubmission && form_data) {
      console.log('[CONSULTOR-CHAT] Form submission detected, updating context...');
      const currentContext = jornada.contexto_coleta || {};
      const updatedContext = { ...currentContext, ...form_data };

      await supabase
        .from('jornadas_consultor')
        .update({ contexto_coleta: updatedContext })
        .eq('id', jornada.id);

      const { data: jornadaAtualizada } = await supabase
        .from('jornadas_consultor')
        .select('*')
        .eq('id', jornada.id)
        .single();

      if (jornadaAtualizada) jornada = jornadaAtualizada;

      const frameworkGuide = new FrameworkGuide(supabase);
      if (form_data.nome_empresa || form_data.nome_usuario || form_data.empresa_nome) {
        await frameworkGuide.markEvent(conversation_id, 'anamnese_preenchida');
      } else if (form_data.parcerias_chave || form_data.segmentos_clientes) {
        await frameworkGuide.markEvent(conversation_id, 'canvas_preenchido');
      } else if (form_data.atividades_primarias || form_data.atividades_suporte) {
        await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_preenchida');
      } else if (form_data.processos && Array.isArray(form_data.processos)) {
        await frameworkGuide.markEvent(conversation_id, 'matriz_preenchida');
      }

      const markerProcessor = new MarkerProcessor(supabase);
      try {
        // tentar premiar XP e capturar resultado para retornar ao frontend
        // algumas implementações retornam objeto, outras apenas executam RPCs
        // guardamos o retorno se houver
        // @ts-ignore
        preAwardResult = await markerProcessor.autoAwardXP(conversation_id, 'formulario_preenchido');
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] preAward XP failed:', e);
      }

      // Ensure the LLM sees the submitted form data: append a synthetic user message
      try {
        const formSummary = `Formulário submetido (${String(form_type || 'generico')}): ${JSON.stringify(form_data)}`;
        if (!conversationHistory || !Array.isArray(conversationHistory)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (conversationHistory as any) = [];
        }
        // push summary so the prompt builder includes it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (conversationHistory as any).push({ role: 'user', content: formSummary });
      } catch (e) {
        // ignore if summarization fails
      }
    }

    const { data: gamification } = await supabase
      .from('gamificacao_consultor')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    const frameworkGuide = new FrameworkGuide(supabase);
    const checklistContext = await frameworkGuide.getGuideContext(conversation_id);

    const promptBuilder = new IntelligentPromptBuilder(supabase);
    const systemPrompt = await promptBuilder.buildSystemPrompt(jornada, gamification, checklistContext, conversationHistory || []);
    const userPrompt = await promptBuilder.buildUserPrompt(message, conversationHistory || []);

    console.log('[CONSULTOR-CHAT] Calling LLM with enhanced prompts...');
    const llmResponse = await callLLM(systemPrompt, userPrompt, openaiKey);
    console.log('[CONSULTOR-CHAT] LLM response received');

    const markerProcessor = new MarkerProcessor(supabase);
    const { displayContent, actions } = markerProcessor.processResponse(llmResponse);

    // Heuristic fallback: if LLM promises to open a form but markers are missing, infer actions
    if ((!actions || actions.length === 0) && /abrir o formulário|vou abrir o formulário|vou abrir o form/i.test(llmResponse)) {
      const inferred: any[] = [];
      if (/anamnese/i.test(llmResponse)) inferred.push({ type: 'exibir_formulario', params: { tipo: 'anamnese' } });
      if (/canvas/i.test(llmResponse)) inferred.push({ type: 'exibir_formulario', params: { tipo: 'canvas' } });
      if (/cadeia/i.test(llmResponse) || /cadeia de valor/i.test(llmResponse)) inferred.push({ type: 'exibir_formulario', params: { tipo: 'cadeia_valor' } });
      if (/matriz/i.test(llmResponse) || /prioriza/i.test(llmResponse)) inferred.push({ type: 'exibir_formulario', params: { tipo: 'matriz_priorizacao' } });
      if (inferred.length > 0) {
        console.log('[CONSULTOR-CHAT] Inferred actions from LLM text:', inferred.map(i=>i.params.tipo));
        actions.push(...inferred);
      }
    }

    console.log('[CONSULTOR-CHAT] Detected actions:', actions.map(a => a.type));

    // Filter out forms already filled and apply heuristics similar to consolidated handler
    const ctxNow = (jornada && jornada.contexto_coleta) ? jornada.contexto_coleta : {};
    const filteredActions = actions.filter((a: any) => {
      if (a.type !== 'exibir_formulario') return true;
      const tipo = String(a.params?.tipo || '');
      return !isFormAlreadyFilled(tipo, ctxNow);
    });

    // Convert matriz form into deliverable if needed
    for (const a of actions) {
      if (a.type === 'exibir_formulario' && (a.params?.tipo === 'matriz_priorizacao' || a.params?.tipo === 'matriz-priorizacao')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
    }

    // If we already have cadeia_valor + anamnese/canvas, auto-generate matriz and escopo
    const hasCadeia = !!(ctxNow && (ctxNow.cadeia_valor || ctxNow.cadeia));
    const hasCanvasOrAnamnese = !!(ctxNow && (ctxNow.canvas || ctxNow.anamnese || ctxNow.empresa));
    if ((jornada.etapa_atual === 'modelagem' || jornada.etapa_atual === 'mapeamento') && hasCadeia && hasCanvasOrAnamnese) {
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='matriz_priorizacao')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='escopo_projeto')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'escopo_projeto' } });
      }
      if (!filteredActions.some((a:any)=> a.type==='set_validacao' && a.params?.tipo==='modelagem')) {
        filteredActions.push({ type: 'set_validacao', params: { tipo: 'modelagem' } });
      }
    }

    const { updates, gamificationResult } = await markerProcessor.executeActions(
      filteredActions,
      jornada,
      conversation_id,
      user_id
    );

    const formActions = filteredActions.filter(a => a.type === 'exibir_formulario');
    for (const formAction of formActions) {
      const tipo = formAction.params.tipo;
      if (tipo === 'anamnese') {
        await frameworkGuide.markEvent(conversation_id, 'anamnese_exibida');
      } else if (tipo === 'canvas') {
        await frameworkGuide.markEvent(conversation_id, 'canvas_exibido');
      } else if (tipo === 'cadeia_valor') {
        await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_exibida');
      } else if (tipo === 'matriz_priorizacao') {
        await frameworkGuide.markEvent(conversation_id, 'matriz_exibida');
      }
    }

    const gamificationActions = actions.filter(a => a.type === 'gamificacao');
    for (const gamAction of gamificationActions) {
      const evento = gamAction.params.evento;
      if (evento.includes('anamnese')) {
        await frameworkGuide.markEvent(conversation_id, 'xp_anamnese');
      } else if (evento.includes('canvas')) {
        await frameworkGuide.markEvent(conversation_id, 'xp_canvas');
      } else if (evento.includes('cadeia')) {
        await frameworkGuide.markEvent(conversation_id, 'xp_cadeia');
      } else if (evento.includes('matriz')) {
        await frameworkGuide.markEvent(conversation_id, 'xp_matriz');
      }
    }

    const deliverableActions = actions.filter(a => a.type === 'gerar_entregavel');
    if (deliverableActions.length > 0) {
      console.log('[CONSULTOR-CHAT] Generating deliverables...');
      const deliverableGenerator = new DeliverableGenerator(supabase, openaiKey);

      for (const action of deliverableActions) {
        try {
          const { html, nome } = await deliverableGenerator.generateDeliverable(
            action.params.tipo,
            jornada,
            llmResponse
          );

          await deliverableGenerator.saveDeliverable(
            jornada.id,
            action.params.tipo,
            nome,
            html,
            jornada.etapa_atual
          );

          console.log(`[CONSULTOR-CHAT] Deliverable generated: ${nome}`);
        } catch (err) {
          console.error(`[CONSULTOR-CHAT] Error generating deliverable ${action.params.tipo}:`, err);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      jornada = { ...jornada, ...updates };
    }

    await saveMessages(supabase, conversation_id, user_id, message, displayContent);

    const response = {
      response: displayContent,
      jornada_id: jornada.id,
      etapa_atual: jornada.etapa_atual,
      actions: actions.map(a => ({ type: a.type, params: a.params })),
      // preferir retorno do prêmio feito no handling do formulário, se disponível
      gamification: preAwardResult ?? gamificationResult ?? null
    };

    console.log('[CONSULTOR-CHAT] Request completed successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[CONSULTOR-CHAT ERROR]', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
