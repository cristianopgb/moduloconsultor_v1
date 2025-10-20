import { createClient } from 'npm:@supabase/supabase-js@2';
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

    const { message, conversation_id, user_id, form_data } = await req.json();

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
      await markerProcessor.autoAwardXP(conversation_id, 'formulario_preenchido');
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

    console.log('[CONSULTOR-CHAT] Detected actions:', actions.map(a => a.type));

    const { updates, gamificationResult } = await markerProcessor.executeActions(
      actions,
      jornada,
      conversation_id,
      user_id
    );

    const formActions = actions.filter(a => a.type === 'exibir_formulario');
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
      gamification: gamificationResult
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
