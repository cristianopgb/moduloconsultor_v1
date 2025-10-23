// supabase/functions/consultor-chat/index.ts
// CONSOLIDATED VERSION - Combining modular architecture with robust anti-loop logic,
// explicit LLM behavior rules, intelligent fallbacks, and automatic process persistence.
//
// Key improvements from consolidated version:
// - Explicit CRITICAL RULES for LLM behavior (never repeat intro, never ask collected data, etc)
// - Robust userId validation before XP RPCs to prevent null errors
// - Intelligent fallback when LLM promises forms but doesn't generate markers
// - Automatic matriz/escopo generation when data exists (no user form needed)
// - Persistent processo storage in cadeia_valor_processos table
// - Enhanced prioritization confirmation detection with expanded regex
// - Anti-loop system prevents re-displaying filled forms
// - Automatic areas_trabalho creation from escopo processos

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

// Helper anti-loop para formularios já preenchidos
function isFormAlreadyFilled(tipo: string, ctx: any) {
  const c = ctx || {};
  return (tipo === 'anamnese' && c.anamnese) ||
         (tipo === 'canvas' && c.canvas) ||
         (tipo === 'cadeia_valor' && c.cadeia_valor) ||
         (tipo === 'matriz_priorizacao' && c.matriz_priorizacao) ||
         (tipo === 'atributos_processo' && c.atributos_processo);
}

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
        temperature: 0.5,
        max_tokens: 1500
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

    // histórico
    const { data: _conversationHistory } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });
    // allow reassigning conversationHistory later (we may reload it after form submission)
    let conversationHistory = _conversationHistory;

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

    // Check if user is confirming prioritization validation (EXPANDED REGEX)
    if (jornada && jornada.aguardando_validacao === 'priorizacao' && !isFormSubmission) {
      const confirmWords = /valido|confirmo|validar|concordo|ok|sim|vamos|pode.*avanc|seguir|próxim|correto|perfeito|tudo.*certo/i;
      if (confirmWords.test(message)) {
        console.log('[CONSULTOR-CHAT] User confirmed prioritization, advancing to execution phase');

        await supabase
          .from('jornadas_consultor')
          .update({
            aguardando_validacao: null,
            etapa_atual: 'execucao'
          })
          .eq('id', jornada.id);

        // Reload jornada to get updated state
        const { data: jornadaAtualizada } = await supabase
          .from('jornadas_consultor')
          .select('*')
          .eq('id', jornada.id)
          .single();

        if (jornadaAtualizada) jornada = jornadaAtualizada;

        console.log('[CONSULTOR-CHAT] Jornada advanced to execucao phase');
      }
    }

    if (!jornada) {
      console.log('[CONSULTOR-CHAT] Creating new jornada...');
      const { data: newJornada, error: createError } = await supabase
        .from('jornadas_consultor')
        .insert({
          user_id: user_id,
          conversation_id: conversation_id,
          etapa_atual: 'anamnese',
          contexto_coleta: {},
          aguardando_validacao: null,
          progresso_geral: 0
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

      // evento inicial da timeline em anamnese
      try {
        await supabase.rpc('add_timeline_event', {
          p_jornada_id: jornada.id,
          p_evento: 'Fase iniciada: anamnese',
          p_fase: 'anamnese'
        });
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] timeline init warn:', e);
      }
    }

    // CTA Detection and Confirmation System (from framework-guide)
    const frameworkGuide = new FrameworkGuide(supabase);
    const awaitingStatus = await frameworkGuide.isAwaitingConfirmation(conversation_id);

    if (awaitingStatus.awaiting && !isFormSubmission) {
      console.log(`[CONSULTOR-CHAT] Awaiting confirmation for: ${awaitingStatus.type}`);

      // Detect if user message contains confirmation
      if (frameworkGuide.isUserConfirmation(message)) {
        console.log(`[CONSULTOR-CHAT] User confirmed: ${awaitingStatus.type}`);

        // Mark confirmation in checklist
        if (awaitingStatus.type === 'anamnese') {
          await frameworkGuide.markEvent(conversation_id, 'anamnese_confirmada');
        } else if (awaitingStatus.type === 'canvas') {
          await frameworkGuide.markEvent(conversation_id, 'canvas_confirmado');
        } else if (awaitingStatus.type === 'cadeia_valor') {
          await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_confirmada');
        } else if (awaitingStatus.type === 'escopo') {
          await frameworkGuide.markEvent(conversation_id, 'escopo_validado');
        } else if (awaitingStatus.type?.startsWith('atributos:')) {
          const processoNome = awaitingStatus.type.split(':')[1];
          await frameworkGuide.markProcessoEvent(conversation_id, processoNome, 'atributos_confirmado');
        }

        console.log(`[CONSULTOR-CHAT] Confirmation marked for ${awaitingStatus.type}`);
      }
    }

    // Persistência de formulário
    let preAwardResult = null;
    if (isFormSubmission && form_data) {
      console.log('[CONSULTOR-CHAT] Form submission detected, updating context...');
      const currentContext = jornada.contexto_coleta || {};
      const updatedContext = { ...currentContext, [String(form_type || 'generico')]: form_data };

      await supabase.from('jornadas_consultor')
        .update({ contexto_coleta: updatedContext })
        .eq('id', jornada.id);

      // Atualiza etapa/validação conforme formulário
      if (form_type === 'anamnese') {
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'anamnese', aguardando_validacao: 'anamnese' })
          .eq('id', jornada.id);
      }
      if (form_type === 'canvas' || form_type === 'cadeia_valor') {
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'modelagem', aguardando_validacao: null })
          .eq('id', jornada.id);
      }
      if (form_type === 'matriz_priorizacao') {
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'priorizacao', aguardando_validacao: 'priorizacao' })
          .eq('id', jornada.id);
      }
      if (form_type === 'atributos_processo') {
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'execucao', aguardando_validacao: null })
          .eq('id', jornada.id);
      }

      // refresh jornada
      const { data: jornadaAtualizada } = await supabase.from('jornadas_consultor').select('*').eq('id', jornada.id).single();
      if (jornadaAtualizada) jornada = jornadaAtualizada;

      // Gamificação (evento formulário)
      const markerProcessorForForm = new MarkerProcessor(supabase);
      try {
        preAwardResult = await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'formulario_preenchido', conversation_id);
        console.log('[CONSULTOR-CHAT] preAwardResult:', preAwardResult);
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] preAward XP failed:', e);
      }

      // Ensure the LLM sees the submitted form data: append a synthetic user message
      try {
        const formSummary = `Formulário submetido (${String(form_type || 'generico')}): ${JSON.stringify(form_data)}`;
        if (!conversationHistory || !Array.isArray(conversationHistory)) {
          (conversationHistory as any) = [];
        }
        // push summary so the prompt builder includes it
        (conversationHistory as any).push({ role: 'user', content: formSummary });
        // Persist an assistant acknowledgement in the messages table so subsequent reads include it
        try {
          const ack = `Recebi o formulário ${String(form_type || 'generico')} e atualizei o contexto.`;
          await supabase.from('messages').insert([{ conversation_id: conversation_id, role: 'assistant', content: ack, user_id: user_id }]);
          console.log('[CONSULTOR-CHAT] persisted assistant ack message to messages table');
        } catch (e) {
          console.warn('[CONSULTOR-CHAT] failed to persist assistant ack message (non-fatal):', e);
        }
      } catch (e) {
        // ignore if summarization fails
      }

      // After processing the form and saving context, re-fetch conversation messages
      try {
        let { data: refreshedHistory } = await supabase
          .from('messages').select('*')
          .eq('conversation_id', conversation_id)
          .order('created_at', { ascending: true });
        // retry once if empty (some setups may have eventual consistency/RLS delay)
        if (!Array.isArray(refreshedHistory) || refreshedHistory.length === 0) {
          try {
            await new Promise(res => setTimeout(res, 200));
            const r = await supabase
              .from('messages').select('*')
              .eq('conversation_id', conversation_id)
              .order('created_at', { ascending: true });
            refreshedHistory = r.data;
            console.log('[CONSULTOR-CHAT] retried message reload, messages count:', (refreshedHistory || []).length);
          } catch (e) {
            // ignore retry failures
          }
        }
        if (Array.isArray(refreshedHistory)) {
          (conversationHistory as any) = refreshedHistory;
          console.log('[CONSULTOR-CHAT] conversationHistory reloaded after form submission, messages:', ((refreshedHistory || []).length));
          try {
            (conversationHistory as any).push({ role: 'assistant', content: `Recebi o formulário ${String(form_type || 'generico')} e atualizei o contexto. Vou analisar os dados e gerar os próximos passos.` });
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] falha ao recarregar conversationHistory após form submission:', e);
      }

      // Persistir processos enviados via formulário de cadeia_valor na tabela específica
      const ctx = updatedContext;
      if (form_type === 'cadeia_valor') {
        try {
          // Normalize different possible shapes submitted by the frontend into a flat array
          const normalizeProcesses = (data: any) => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (data.processos && Array.isArray(data.processos)) return data.processos;
            // If sections were provided as keys, flatten them
            const out: any[] = [];
            for (const k of Object.keys(data)) {
              const v = data[k];
              if (Array.isArray(v)) out.push(...v);
              else if (v && typeof v === 'object' && Array.isArray(v.processos)) out.push(...v.processos);
            }
            return out;
          };

          const processosArray = normalizeProcesses(form_data);
          if (Array.isArray(processosArray) && processosArray.length > 0) {
            try {
              await supabase.from('cadeia_valor_processos').delete().eq('jornada_id', jornada.id);
            } catch (e) { /* ignore delete errors */ }
            const toInsert = processosArray.map((p: any) => ({
              jornada_id: jornada.id,
              nome: p.nome || p.process_name || String(p).slice(0, 200),
              descricao: p.descricao || p.descricao_curta || null,
              impacto: p.impacto ?? (p.impact || null),
              criticidade: p.criticidade ?? p.criticality ?? null,
              esforco: p.esforco ?? p.esforco_estimado ?? null
            }));
            try {
              const { data: ins, error: insErr } = await supabase.from('cadeia_valor_processos').insert(toInsert).select('id');
              if (insErr) console.warn('[CONSULTOR-CHAT] falha ao inserir processos cadeia_valor:', insErr);
              else console.log('[CONSULTOR-CHAT] inserted cadeia_valor_processos count:', (ins || []).length);
            } catch (e) { console.warn('[CONSULTOR-CHAT] falha ao inserir processos cadeia_valor (exception):', e); }
          }
        } catch (e) {
          console.warn('[CONSULTOR-CHAT] erro ao persistir cadeia_valor_processos:', e);
        }
      }

      // Se escopo existir, criar áreas
      if (ctx?.escopo?.processos || ctx?.escopo_projeto?.processos || ctx?.priorizacao?.processos) {
        await markerProcessorForForm.ensureAreasFromScope(jornada.id);
      }

      // If we have collected canvas/anamnese/cadeia_valor in contexto_coleta but the corresponding
      // entregaveis aren't present, auto-generate them so the flow can continue to priorizacao.
      try {
        const hasAnamneseData = !!(ctx && (ctx.anamnese || ctx.empresa));
        const hasCanvasData = !!(ctx && ctx.canvas);
        const hasCadeiaData = !!(ctx && (ctx.cadeia_valor || ctx.cadeia));

        if ((hasAnamneseData || hasCanvasData || hasCadeiaData)) {
          const deliverableGenerator = new DeliverableGenerator(supabase, openaiKey);
          // check existing entregaveis
          const { data: existing } = await supabase.from('entregaveis_consultor').select('tipo').eq('jornada_id', jornada.id);
          const tiposExistentes = new Set((existing || []).map((e:any)=> e.tipo));

          if (hasAnamneseData && !tiposExistentes.has('anamnese')) {
            try {
              const { html, nome } = await deliverableGenerator.generateDeliverable('anamnese', jornada, '');
              await deliverableGenerator.saveDeliverable(jornada.id, 'anamnese', nome, html, jornada.etapa_atual);
              await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);
            } catch (e) { console.warn('[CONSULTOR-CHAT] falha ao gerar anamnese automaticamente:', e); }
          }
          if (hasCanvasData && !tiposExistentes.has('canvas')) {
            try {
              const { html, nome } = await deliverableGenerator.generateDeliverable('canvas', jornada, '');
              await deliverableGenerator.saveDeliverable(jornada.id, 'canvas', nome, html, jornada.etapa_atual);
              await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);
            } catch (e) { console.warn('[CONSULTOR-CHAT] falha ao gerar canvas automaticamente:', e); }
          }
          if (hasCadeiaData && !tiposExistentes.has('cadeia_valor')) {
            try {
              const { html, nome } = await deliverableGenerator.generateDeliverable('cadeia_valor', jornada, '');
              await deliverableGenerator.saveDeliverable(jornada.id, 'cadeia_valor', nome, html, jornada.etapa_atual);
              await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);
            } catch (e) { console.warn('[CONSULTOR-CHAT] falha ao gerar cadeia_valor automaticamente:', e); }
          }
        }
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] Erro ao auto-gerar entregaveis após form submission:', e);
      }

      // Mark form events in framework checklist
      if (form_data.nome_empresa || form_data.nome_usuario || form_data.empresa_nome) {
        await frameworkGuide.markEvent(conversation_id, 'anamnese_preenchida');
        console.log('[CONSULTOR-CHAT] Marked anamnese_preenchida');
      } else if (form_data.parcerias_chave || form_data.segmentos_clientes) {
        await frameworkGuide.markEvent(conversation_id, 'canvas_preenchido');
        console.log('[CONSULTOR-CHAT] Marked canvas_preenchido');
      } else if (form_type === 'cadeia_valor' || (form_data.processos && form_data.outputs)) {
        await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_preenchida');
        console.log('[CONSULTOR-CHAT] Marked cadeia_valor_preenchida');
      } else if (form_data.processos && Array.isArray(form_data.processos) && form_type !== 'cadeia_valor') {
        await frameworkGuide.markEvent(conversation_id, 'matriz_preenchida');
        console.log('[CONSULTOR-CHAT] Marked matriz_preenchida');
      }
    }

    const { data: gamification } = await supabase
      .from('gamificacao_consultor')
      .select('*')
      .eq('jornada_id', jornada.id)
      .maybeSingle();

    // If user message contains direct markers (user clicked a button), handle them immediately
    const userMarkerActions: any[] = [];
    const formRegex = /\[EXIBIR_FORMULARIO:(\w+)\]/g;
    const deliverableRegex = /\[GERAR_ENTREGAVEL:([\w-]+)\]/g;
    const validationRegex = /\[SET_VALIDACAO:(\w+)\]/g;
    const phaseRegex = /\[AVANCAR_FASE:(\w+)\]/g;
    const gamificationRegex = /\[GAMIFICACAO:([^:]+):(\d+)\]/g;
    let m: RegExpExecArray | null;
    while((m = formRegex.exec(message)) !== null) userMarkerActions.push({ type: 'exibir_formulario', params: { tipo: m[1] } });
    while((m = deliverableRegex.exec(message)) !== null) userMarkerActions.push({ type: 'gerar_entregavel', params: { tipo: m[1] } });
    while((m = validationRegex.exec(message)) !== null) userMarkerActions.push({ type: 'set_validacao', params: { tipo: m[1] } });
    while((m = phaseRegex.exec(message)) !== null) userMarkerActions.push({ type: 'avancar_fase', params: { fase: m[1] } });
    while((m = gamificationRegex.exec(message)) !== null) userMarkerActions.push({ type: 'gamificacao', params: { evento: m[1], xp: Number(m[2]) } });

    if (userMarkerActions.length > 0) {
      // execute immediately and return current state (no LLM call)
      const markerProcessor = new MarkerProcessor(supabase);
      const { updates: ua, gamificationResult: ugr, postActions: up } = await markerProcessor.execute(userMarkerActions, jornada, user_id, conversation_id) as any;
      // refresh jornada
      const { data: refreshed } = await supabase.from('jornadas_consultor').select('*').eq('id', jornada.id).single();
      jornada = refreshed || jornada;
      const mergedActions = [...userMarkerActions];
      if (Array.isArray(up) && up.length>0) mergedActions.push(...up);
      return new Response(JSON.stringify({
        response: 'Ação processada',
        jornada_id: jornada.id,
        etapa_atual: jornada.etapa_atual,
        aguardando_validacao: jornada.aguardando_validacao,
        actions: mergedActions,
        gamification: ugr ?? null
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const checklistContext = await frameworkGuide.getGuideContext(conversation_id);

    const promptBuilder = new IntelligentPromptBuilder(supabase);
    const systemPrompt = await promptBuilder.buildSystemPrompt(jornada, gamification, checklistContext, conversationHistory || []);
    const userPrompt = await promptBuilder.buildUserPrompt(message, conversationHistory || []);

    console.log('[CONSULTOR-CHAT] Calling LLM with enhanced prompts...');
    const llmResponse = await callLLM(systemPrompt, userPrompt, openaiKey);
    console.log('[CONSULTOR-CHAT] LLM response received');

    const markerProcessor = new MarkerProcessor(supabase);
    const { displayContent, actions } = markerProcessor.processResponse(llmResponse);

    // Fallback: se o LLM escreveu que vai abrir um formulário mas não gerou a marker explicitamente,
    // tentamos inferir a ação por heurística simples (palavras-chave) para não travar o fluxo.
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

    // -------- Fallbacks para não travar fluxo ----------
    const ctxNow = (jornada && jornada.contexto_coleta) ? jornada.contexto_coleta : {};
    const filteredActions = actions.filter((a: any) => {
      if (a.type !== 'exibir_formulario') return true;
      const tipo = String(a.params?.tipo || '');
      return !isFormAlreadyFilled(tipo, ctxNow);
    });

    // 1) Matriz de Priorização nunca como formulário
    //    Se LLM tentar exibir como formulário, convertemos em gerar_entregavel (priorização automática)
    for (const a of actions) {
      if (a.type === 'exibir_formulario' && (a.params?.tipo === 'matriz_priorizacao' || a.params?.tipo === 'matriz-priorizacao')) {
        console.log('[CONSULTOR-CHAT] Interceptando pedido de formulário de matriz_priorizacao — convertendo para gerar_entregavel');
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
    }

    // If we're in modelagem and we already have cadeia_valor and anamnese/canvas in contexto_coleta,
    // we should generate 'matriz_priorizacao' and 'escopo_projeto' automatically (LLM should compute them)
    const hasCadeia = !!(ctxNow && (ctxNow.cadeia_valor || ctxNow.cadeia));
    const hasCanvasOrAnamnese = !!(ctxNow && (ctxNow.canvas || ctxNow.anamnese || ctxNow.empresa));
    if ((jornada.etapa_atual === 'modelagem' || jornada.etapa_atual === 'mapeamento') && hasCadeia && hasCanvasOrAnamnese) {
      // ensure we don't duplicate if already present
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='matriz_priorizacao')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='escopo_projeto')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'escopo_projeto' } });
      }
      // also set validation for modelagem once generated
      if (!filteredActions.some((a:any)=> a.type==='set_validacao' && a.params?.tipo==='modelagem')) {
        filteredActions.push({ type: 'set_validacao', params: { tipo: 'modelagem' } });
      }
    }

    // 2) Em MODELAGEM/MAPEAMENTO: garantir Cadeia de Valor (se ainda não foi preenchida)
    if ((jornada.etapa_atual === 'modelagem' || jornada.etapa_atual === 'mapeamento')
        && !isFormAlreadyFilled('cadeia_valor', ctxNow)
        && !filteredActions.some((a:any)=> a.type==='exibir_formulario' && a.params?.tipo==='cadeia_valor')) {
      filteredActions.push({ type: 'exibir_formulario', params: { tipo: 'cadeia_valor' } });
    }

    // 3) Após existir Cadeia de Valor: sugerir Atributos do Processo quando for iniciar Execução
    if ((jornada.etapa_atual === 'execucao' || jornada.etapa_atual === 'priorizacao')
        && ctxNow?.cadeia_valor
        && !isFormAlreadyFilled('atributos_processo', ctxNow)
        && !filteredActions.some((a:any)=> a.type==='exibir_formulario' && a.params?.tipo==='atributos_processo')) {
      filteredActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
    }
    // ----------------------------------------------------

    // Execute filtered actions
    const { updates, gamificationResult, postActions } =
      await markerProcessor.execute(filteredActions, jornada, user_id, conversation_id) as any;

    // Merge postActions (avoiding duplicates)
    if (Array.isArray(postActions) && postActions.length > 0) {
      for (const pa of postActions) {
        if (!filteredActions.some((a:any)=> a.type === pa.type && JSON.stringify(a.params) === JSON.stringify(pa.params))) {
          filteredActions.push(pa);
        }
      }
    }

    // GERAR ENTREGÁVEIS
    let generatedMatriz = false;
    const deliverableActions = filteredActions.filter((a: any)=>a.type === 'gerar_entregavel');
    if (deliverableActions.length > 0) {
      const deliverableGenerator = new DeliverableGenerator(supabase, openaiKey);
      for (const action of deliverableActions){
        try {
          const rawTipo = action.params.tipo;
          // normalização de slug
          const tipo = (rawTipo === 'matriz' ? 'matriz_priorizacao' : rawTipo).replace(/-/g, '_');
          const { html, nome } = await deliverableGenerator.generateDeliverable(tipo, jornada, llmResponse);
          await deliverableGenerator.saveDeliverable(jornada.id, tipo, nome, html, jornada.etapa_atual);
          await markerProcessor.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);
          if (tipo === 'escopo_projeto') await markerProcessor.ensureAreasFromScope(jornada.id);

          // If we just generated the prioritization matrix, compute concrete priorities from cadeia_valor_processos
          if (tipo === 'matriz_priorizacao') {
            try {
              console.log('[CONSULTOR-CHAT] Gerando matriz_priorizacao automaticamente (computando scores)');
              const { data: processos } = await supabase
                .from('cadeia_valor_processos')
                .select('id, nome, impacto, criticidade, esforco, descricao')
                .eq('jornada_id', jornada.id);

              const computed = (processos || []).map((p:any) => {
                const impacto = Number(p.impacto || 1);
                const criticidade = Number(p.criticidade || 1);
                const esforco = Number(p.esforco || 1) || 1;
                const complexidade = Number((p as any).complexidade || 1);
                const urgencia = Number((p as any).urgencia || 1);
                const score = ((impacto * criticidade) + (urgencia * complexidade)) / Math.max(1, esforco);
                return { id: p.id, nome: p.nome, impacto, criticidade, esforco, complexidade, urgencia, score, descricao: p.descricao || '' };
              }).sort((a:any,b:any)=> b.score - a.score);

              // persist computed matrix into contexto_coleta.matriz_priorizacao
              const newCtx = { ...(jornada.contexto_coleta || {}), matriz_priorizacao: { processos: computed, generated_at: new Date().toISOString() } };
              await supabase.from('jornadas_consultor').update({ contexto_coleta: newCtx, aguardando_validacao: 'priorizacao' }).eq('id', jornada.id);
              jornada.contexto_coleta = newCtx;
              jornada.aguardando_validacao = 'priorizacao';

              // Do NOT move to 'execucao' yet and do NOT enqueue atributos_processo.
              // The user must VALIDATE the priorização first. Once they validate, the frontend
              // will call the backend with a SET_VALIDACAO:priorizacao action to advance.
              console.log('[CONSULTOR-CHAT] matriz_priorizacao persistida e jornada marcada aguardando_validacao: priorizacao');
              // Ensure the assistant asks the user to review and validate the matrix
              if (!filteredActions.some((a:any)=> a.type === 'set_validacao' && a.params?.tipo === 'priorizacao')) {
                filteredActions.push({ type: 'set_validacao', params: { tipo: 'priorizacao' } });
              }
              generatedMatriz = true;
            } catch (e) {
              console.error('[CONSULTOR-CHAT] Error computing matriz_priorizacao details:', e);
            }
          }
        } catch (err) {
          console.error(`[CONSULTOR-CHAT] Error generating deliverable ${action.params?.tipo}:`, err);
        }
      }
    }

    // If we generated a matrix automatically, prepare a clear review/validation CTA
    let responseContent = displayContent;
    try {
      if (generatedMatriz) {
        const reviewNote = `\n\nAtenção: gerei automaticamente a *Matriz de Priorização* e o *Escopo do Projeto* com base nos dados fornecidos. Por favor, revise os entregáveis na aba "Entregáveis" e, se concordar com as prioridades sugeridas, use o botão "Validar Priorização" disponível na conversa para avançarmos. Ao validar, iniciaremos a execução: primeiro faremos a coleta de atributos do primeiro processo priorizado e depois modelagem AS-IS e BPMN.`;
        responseContent = (responseContent || '') + reviewNote;
        // Ensure frontend receives set_validacao to render CTA buttons
        if (!filteredActions.some((a:any)=> a.type === 'set_validacao' && a.params?.tipo === 'priorizacao')) {
          filteredActions.push({ type: 'set_validacao', params: { tipo: 'priorizacao' } });
        }
      }
    } catch (e) {
      // ignore
    }

    // Mark form and gamification events in checklist
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

    if (Object.keys(updates).length > 0) {
      jornada = { ...jornada, ...updates };
    }

    await saveMessages(supabase, conversation_id, user_id, message, responseContent);

    // RESPOSTA
    return new Response(JSON.stringify({
      response: responseContent,
      jornada_id: jornada.id,
      etapa_atual: jornada.etapa_atual,
      aguardando_validacao: jornada.aguardando_validacao,
      actions: filteredActions.map(a => ({ type: a.type, params: a.params })),
      gamification: preAwardResult ?? gamificationResult ?? null
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
