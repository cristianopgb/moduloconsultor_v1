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
      { conversation_id: conversationId, role: 'user', content: userMsg, user_id: userId, message_type: 'text' },
      { conversation_id: conversationId, role: 'assistant', content: assistantMsg, user_id: userId, message_type: 'text' }
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

    console.log('[CONSULTOR-CHAT] Request received:', { user_id, conversation_id, has_form_data: !!form_data, message_preview: message?.substring(0, 50) });

    const isFormSubmission = Boolean(form_data && Object.keys(form_data).length > 0);

    // DEBOUNCE: Block if last form was submitted less than 5 seconds ago
    if (isFormSubmission) {
      const { data: ultimoForm } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conversation_id)
        .eq('role', 'user')
        .ilike('content', '%Formulário%enviado%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimoForm) {
        const diff = Date.now() - new Date(ultimoForm.created_at).getTime();
        if (diff < 5000) {
          console.log('[DEBOUNCE] ⏸️ Bloqueando submissão rápida demais');
          return new Response(JSON.stringify({ error: 'Aguarde antes de enviar outro formulário' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

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

    // Marcar apresentação como feita após primeira resposta do assistente
    const { data: checklistData } = await supabase
      .from('framework_checklist')
      .select('apresentacao_feita')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    const hasAssistantReplied = Array.isArray(conversationHistory) && conversationHistory.some((m: any) => m.role === 'assistant');
    if (hasAssistantReplied && checklistData && !checklistData.apresentacao_feita) {
      // Marcar apresentação como feita
      await frameworkGuide.markEvent(conversation_id, 'apresentacao');
      console.log('[CONSULTOR-CHAT] ✅ Marcada apresentacao_feita = true no checklist');
    }

    const awaitingStatus = await frameworkGuide.isAwaitingConfirmation(conversation_id);

    // ANTI-LOOP ESCAPE HATCH: Count recent assistant messages asking about the same form
    if (awaitingStatus.awaiting && !isFormSubmission) {
      const recentMessages = (conversationHistory || []).slice(-10);
      const recentAssistantMessages = recentMessages.filter((m: any) => m.role === 'assistant');
      const formType = awaitingStatus.type;
      const ctaKeywords = ['formul', 'anamnese', 'canvas', 'cadeia', 'posso enviar', 'vou enviar'];
      const repeatedCTACount = recentAssistantMessages.filter((m: any) => {
        const content = (m.content || '').toLowerCase();
        return ctaKeywords.some(kw => content.includes(kw));
      }).length;

      if (repeatedCTACount >= 2) {
        console.log(`[CONSULTOR-CHAT] 🚨 ANTI-LOOP: Detected ${repeatedCTACount} CTA requests. Force-confirming ${formType} and opening form immediately.`);

        // Force confirmation to break the loop
        if (formType === 'anamnese') {
          await frameworkGuide.markEvent(conversation_id, 'anamnese_confirmada');
        } else if (formType === 'canvas') {
          await frameworkGuide.markEvent(conversation_id, 'canvas_confirmado');
        } else if (formType === 'cadeia_valor') {
          await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_confirmada');
        }

        console.log(`[CONSULTOR-CHAT] 🚨 ANTI-LOOP: Force-confirmed ${formType}, returning form action immediately`);

        // Return immediately with form action to break the loop
        return new Response(JSON.stringify({
          response: `Perfeito, vamos em frente.`,
          jornada_id: jornada.id,
          etapa_atual: jornada.etapa_atual,
          aguardando_validacao: jornada.aguardando_validacao,
          actions: [{ type: 'exibir_formulario', params: { tipo: formType } }],
          gamification: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (awaitingStatus.awaiting && !isFormSubmission) {
      console.log(`[CONSULTOR-CHAT] Awaiting confirmation for: ${awaitingStatus.type}`);

      // Detect if user message contains confirmation
      if (frameworkGuide.isUserConfirmation(message)) {
        console.log(`[CONSULTOR-CHAT] ✅ User confirmed: ${awaitingStatus.type}`);

        // Mark confirmation in checklist
        if (awaitingStatus.type === 'anamnese') {
          await frameworkGuide.markEvent(conversation_id, 'anamnese_confirmada');
          console.log('[CONSULTOR-CHAT] ✅ Marked anamnese_usuario_confirmou = true');
        } else if (awaitingStatus.type === 'canvas') {
          await frameworkGuide.markEvent(conversation_id, 'canvas_confirmado');
          console.log('[CONSULTOR-CHAT] ✅ Marked canvas_usuario_confirmou = true');
        } else if (awaitingStatus.type === 'cadeia_valor') {
          await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_confirmada');
          console.log('[CONSULTOR-CHAT] ✅ Marked cadeia_valor_usuario_confirmou = true');
        } else if (awaitingStatus.type === 'escopo') {
          await frameworkGuide.markEvent(conversation_id, 'escopo_validado');
        } else if (awaitingStatus.type?.startsWith('atributos:')) {
          const processoNome = awaitingStatus.type.split(':')[1];
          await frameworkGuide.markProcessoEvent(conversation_id, processoNome, 'atributos_confirmado');
        }

        console.log(`[CONSULTOR-CHAT] ✅ Confirmation marked for ${awaitingStatus.type}, continuing to LLM call`);
      } else {
        console.log(`[CONSULTOR-CHAT] ⏸️ User message did NOT match confirmation patterns: "${message.substring(0, 50)}"`);
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

      // Atualiza etapa/validação conforme formulário - SEGUINDO ORDEM DO FRAMEWORK RIGOROSAMENTE
      if (form_type === 'anamnese') {
        // Após anamnese, manter em modelagem para solicitar Canvas
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'modelagem', aguardando_validacao: null })
          .eq('id', jornada.id);
        console.log('[CONSULTOR-CHAT] Anamnese preenchida, avançando para modelagem (Canvas será o próximo)');
      } else if (form_type === 'canvas') {
        // Após canvas, manter em modelagem para solicitar Cadeia de Valor
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'modelagem', aguardando_validacao: null })
          .eq('id', jornada.id);
        console.log('[CONSULTOR-CHAT] Canvas preenchido, mantendo em modelagem (Cadeia de Valor será o próximo)');
      } else if (form_type === 'cadeia_valor') {
        // Após cadeia de valor, manter em modelagem para gerar matriz automaticamente
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'modelagem', aguardando_validacao: null })
          .eq('id', jornada.id);
        console.log('[CONSULTOR-CHAT] Cadeia de Valor preenchida, mantendo em modelagem (Matriz será gerada automaticamente)');
      } else if (form_type === 'matriz_priorizacao') {
        // Matriz não deve ser form, mas se vier como form, marcar para priorização
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'priorizacao', aguardando_validacao: 'priorizacao' })
          .eq('id', jornada.id);
        console.log('[CONSULTOR-CHAT] Matriz recebida, aguardando validação do usuário');
      } else if (form_type === 'atributos_processo') {
        // Atributos só devem ser preenchidos na fase de execução
        // NÃO avançar etapa aqui, apenas manter em execução
        // NÃO enfileirar BPMN/diagnóstico automaticamente - deixar a LLM conduzir
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'execucao', aguardando_validacao: null })
          .eq('id', jornada.id);
        console.log('[CONSULTOR-CHAT] ✅ Atributos do processo preenchidos, mantendo em execução (LLM vai propor próximo passo)');

        // Mark processo-level event (if you have markProcessoEvent implemented)
        try {
          const processoNome = form_data?.processo_nome || form_data?.nome || 'processo';
          await frameworkGuide.markProcessoEvent(conversation_id, processoNome, 'atributos_preenchido');
          console.log(`[CONSULTOR-CHAT] ✅ Marked atributos_preenchido for processo: ${processoNome}`);
        } catch (e) {
          console.warn('[CONSULTOR-CHAT] Failed to mark processo event:', e);
        }
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
          await supabase.from('messages').insert([{ conversation_id: conversation_id, role: 'assistant', content: ack, user_id: user_id, message_type: 'text' }]);
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

      // Mark form events in framework checklist BY FORM_TYPE (more reliable)
      try {
        if (form_type === 'anamnese') {
          await frameworkGuide.markEvent(conversation_id, 'anamnese_preenchida');
          await frameworkGuide.markEvent(conversation_id, 'anamnese_analisada');
          console.log('[CONSULTOR-CHAT] ✅ Marked anamnese_preenchida + analisada');
        } else if (form_type === 'canvas') {
          await frameworkGuide.markEvent(conversation_id, 'canvas_preenchido');
          console.log('[CONSULTOR-CHAT] ✅ Marked canvas_preenchido');
        } else if (form_type === 'cadeia_valor') {
          await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_preenchida');
          console.log('[CONSULTOR-CHAT] ✅ Marked cadeia_valor_preenchida');
        } else if (form_type === 'atributos_processo') {
          console.log('[CONSULTOR-CHAT] ✅ Atributos marked (processo-level checklist)');
        }
      } catch (e) {
        console.warn('[CHECKLIST] Failed to mark event by form_type:', e);
      }

      // REGISTER TIMELINE EVENT FOR FORM SUBMISSION
      try {
        await supabase.from('timeline_consultor').insert({
          jornada_id: jornada.id,
          fase: jornada.etapa_atual,
          evento: `Formulário recebido: ${String(form_type)}`
        });
        console.log(`[TIMELINE] ✅ Registered form submission: ${form_type}`);
      } catch (e) {
        console.warn('[TIMELINE] Failed to register form submission:', e);
      }

      // GENERATE DELIVERABLES IMMEDIATELY BY FORM_TYPE
      try {
        const deliverableGenerator = new DeliverableGenerator(supabase, openaiKey);

        if (form_type === 'anamnese') {
          const { html, nome } = await deliverableGenerator.generateDeliverable('anamnese', jornada, '');
          await deliverableGenerator.saveDeliverable(jornada.id, 'anamnese', nome, html, jornada.etapa_atual);
          await supabase.from('timeline_consultor').insert({ jornada_id: jornada.id, fase: jornada.etapa_atual, evento: 'Entregável gerado: anamnese' });
          console.log('[ENTREGAVEL] ✅ Generated anamnese deliverable');
        }

        if (form_type === 'canvas') {
          const { html, nome } = await deliverableGenerator.generateDeliverable('canvas', jornada, '');
          await deliverableGenerator.saveDeliverable(jornada.id, 'canvas', nome, html, jornada.etapa_atual);
          await supabase.from('timeline_consultor').insert({ jornada_id: jornada.id, fase: jornada.etapa_atual, evento: 'Entregável gerado: canvas' });
          console.log('[ENTREGAVEL] ✅ Generated canvas deliverable');
        }

        if (form_type === 'cadeia_valor') {
          const { html, nome } = await deliverableGenerator.generateDeliverable('cadeia_valor', jornada, '');
          await deliverableGenerator.saveDeliverable(jornada.id, 'cadeia_valor', nome, html, jornada.etapa_atual);
          await supabase.from('timeline_consultor').insert({ jornada_id: jornada.id, fase: jornada.etapa_atual, evento: 'Entregável gerado: cadeia_valor' });
          console.log('[ENTREGAVEL] ✅ Generated cadeia_valor deliverable');
        }
      } catch (e) {
        console.warn('[ENTREGAVEIS] Failed immediate generation by form_type:', e);
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

    console.log('[CONSULTOR-CHAT] Fetching checklist context...');
    const checklistContext = await frameworkGuide.getGuideContext(conversation_id);
    console.log('[CONSULTOR-CHAT] Checklist context fetched, length:', checklistContext?.length || 0);

    // Log checklist state for debugging
    const { data: checklistDebug } = await supabase
      .from('framework_checklist')
      .select('anamnese_cta_enviado, anamnese_usuario_confirmou, anamnese_formulario_exibido, anamnese_preenchida')
      .eq('conversation_id', conversation_id)
      .maybeSingle();
    console.log('[CONSULTOR-CHAT] Current checklist state:', checklistDebug);

    const promptBuilder = new IntelligentPromptBuilder(supabase);
    console.log('[CONSULTOR-CHAT] Building prompts...');
    const systemPrompt = await promptBuilder.buildSystemPrompt(jornada, gamification, checklistContext, conversationHistory || []);
    const userPrompt = await promptBuilder.buildUserPrompt(message, conversationHistory || []);
    console.log('[CONSULTOR-CHAT] Prompts built. Calling LLM...');

    const llmResponse = await callLLM(systemPrompt, userPrompt, openaiKey);
    console.log('[CONSULTOR-CHAT] LLM response received, length:', llmResponse?.length || 0);

    // DETECÇÃO AUTOMÁTICA DE CTA: Se LLM pergunta sobre enviar formulário, marcar CTA como enviado
    // Marcar apenas UMA VEZ para evitar repetição de CTAs
    if (/posso enviar.*formul[aá]rio|vou enviar.*formul[aá]rio|enviar.*formul[aá]rio.*anamnese/i.test(llmResponse)) {
      console.log('[CONSULTOR-CHAT] Detectado CTA de anamnese na resposta LLM, marcando...');
      await frameworkGuide.markEvent(conversation_id, 'anamnese_cta_enviado');
    }
    if (/canvas/i.test(llmResponse) && /(posso|podemos).*(enviar|preencher)|vamos.*canvas/i.test(llmResponse)) {
      const { data: canvasCTA } = await supabase
        .from('framework_checklist')
        .select('canvas_cta_enviado')
        .eq('conversation_id', conversation_id)
        .single();

      if (!canvasCTA?.canvas_cta_enviado) {
        console.log('[CONSULTOR-CHAT] Detectado CTA de canvas na resposta LLM (primeira vez), marcando...');
        await frameworkGuide.markEvent(conversation_id, 'canvas_cta_enviado');
      }
    }
    if (/posso enviar.*cadeia.*valor|vou enviar.*cadeia/i.test(llmResponse)) {
      console.log('[CONSULTOR-CHAT] Detectado CTA de cadeia de valor na resposta LLM, marcando...');
      await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_cta_enviado');
    }

    const markerProcessor = new MarkerProcessor(supabase);
    const { displayContent, actions } = markerProcessor.processResponse(llmResponse);

    console.log('[CONSULTOR-CHAT] Detected actions:', actions.map(a => a.type));

    // ========== FALLBACK INTELIGENTE DE MARKERS ==========
    // Detecta quando LLM diz "vou abrir/enviar formulário" mas não incluiu o marker explícito
    // Injeta o marker APENAS se o checklist permitir (CTA confirmado + form não exibido/preenchido)
    // Isso resolve casos onde a LLM promete mas esquece o marker, sem violar o fluxo do framework

    // Buscar checklist ANTES do fallback para validações
    const { data: checklistValidation } = await supabase
      .from('framework_checklist')
      .select('*')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    const hasFormMarker = actions.some((a: any) => a.type === 'exibir_formulario');

    if (!hasFormMarker) {
      const saidThatWillOpenAnamnese = /vou (abrir|enviar|preencher).*(formul[aá]rio|anamnese)/i.test(llmResponse);
      const saidThatWillOpenCanvas = /vou (abrir|enviar|mapear).*(formul[aá]rio|canvas)/i.test(llmResponse);
      const saidThatWillOpenCadeia = /vou (abrir|enviar|mapear).*(formul[aá]rio|cadeia)/i.test(llmResponse);

      const injectAction = (tipo: string) => {
        console.log(`[FALLBACK] 🔧 LLM prometeu ${tipo} mas não gerou marker. Injetando ação...`);
        actions.push({ type: 'exibir_formulario', params: { tipo } });
      };

      // Só injeta se CTA já foi confirmado E formulário não foi exibido/preenchido
      if (saidThatWillOpenAnamnese &&
          checklistValidation?.anamnese_usuario_confirmou &&
          !checklistValidation?.anamnese_formulario_exibido &&
          !checklistValidation?.anamnese_preenchida) {
        injectAction('anamnese');
      }

      if (saidThatWillOpenCanvas &&
          checklistValidation?.canvas_usuario_confirmou &&
          !checklistValidation?.canvas_formulario_exibido &&
          !checklistValidation?.canvas_preenchido) {
        injectAction('canvas');
      }

      if (saidThatWillOpenCadeia &&
          checklistValidation?.cadeia_valor_usuario_confirmou &&
          !checklistValidation?.cadeia_valor_formulario_exibida &&
          !checklistValidation?.cadeia_valor_preenchida) {
        injectAction('cadeia_valor');
      }
    }
    // ========== FIM DO FALLBACK INTELIGENTE ==========

    // -------- Validações Rigorosas de Transição de Fase ----------
    const ctxNow = (jornada && jornada.contexto_coleta) ? jornada.contexto_coleta : {};

    // checklistValidation já foi carregado no fallback acima, não buscar novamente

    // ======== FALLBACK: Injeção automática de formulário baseada no checklist ========
    // Se usuário confirmou mas formulário não foi exibido, injetar action automaticamente
    // IMPORTANTE: Verificar se formulário já foi preenchido antes de injetar
    const ensureFormIfConfirmed = (tipo: 'anamnese'|'canvas'|'cadeia_valor') => {
      const cv = checklistValidation || {};

      // Verificar se formulário já foi preenchido no contexto
      const isAlreadyFilled = isFormAlreadyFilled(tipo, ctxNow);
      if (isAlreadyFilled) {
        console.log(`[FALLBACK] ⏭️ Pulando ${tipo} - já preenchido no contexto`);
        return;
      }

      const needs =
        (tipo === 'anamnese'     && cv.anamnese_usuario_confirmou     && !cv.anamnese_formulario_exibido     && !cv.anamnese_preenchida) ||
        (tipo === 'canvas'       && cv.canvas_usuario_confirmou       && !cv.canvas_formulario_exibido       && !cv.canvas_preenchido)   ||
        (tipo === 'cadeia_valor' && cv.cadeia_valor_usuario_confirmou && !cv.cadeia_valor_formulario_exibida && !cv.cadeia_valor_preenchida);

      if (needs && !actions.some((a: any) => a.type==='exibir_formulario' && a.params?.tipo===tipo)) {
        console.log(`[FALLBACK] ✅ Checklist confirmado para ${tipo}. Injetando exibir_formulario.`);
        actions.push({ type:'exibir_formulario', params:{ tipo } });
      }
    };

    ensureFormIfConfirmed('anamnese');
    ensureFormIfConfirmed('canvas');
    ensureFormIfConfirmed('cadeia_valor');
    // ======== FIM FALLBACK ========

    const filteredActions = actions.filter((a: any) => {
      if (a.type !== 'exibir_formulario') return true;
      const tipo = String(a.params?.tipo || '');

      // ⚠️ CRITICAL: Block ALL forms if awaiting validation
      if (jornada.aguardando_validacao) {
        console.log(`[CONSULTOR-CHAT] ⛔ Bloqueando formulário ${tipo} - aguardando validação: ${jornada.aguardando_validacao}`);
        return false;
      }

      // Bloquear formulários já preenchidos
      if (isFormAlreadyFilled(tipo, ctxNow)) {
        console.log(`[CONSULTOR-CHAT] ⛔ Bloqueando formulário ${tipo} - já preenchido`);
        return false;
      }

      // Bloquear atributos_processo se não estiver em execução
      if (tipo === 'atributos_processo' && jornada.etapa_atual !== 'execucao') {
        console.log(`[CONSULTOR-CHAT] ⛔ Bloqueando atributos_processo - não está em fase de execução (etapa atual: ${jornada.etapa_atual})`);
        return false;
      }

      // Bloquear Canvas se Anamnese não foi preenchida
      if (tipo === 'canvas' && !checklistValidation?.anamnese_preenchida) {
        console.log('[CONSULTOR-CHAT] ⛔ Bloqueando Canvas - Anamnese ainda não preenchida');
        return false;
      }

      // Bloquear Cadeia de Valor se Canvas não foi preenchido
      if (tipo === 'cadeia_valor' && !checklistValidation?.canvas_preenchido) {
        console.log('[CONSULTOR-CHAT] ⛔ Bloqueando Cadeia de Valor - Canvas ainda não preenchido');
        return false;
      }

      return true;
    });

    // 1) Matriz de Priorização nunca como formulário
    //    Se LLM tentar exibir como formulário, convertemos em gerar_entregavel (priorização automática)
    for (const a of actions) {
      const aAny = a as any;
      if (aAny.type === 'exibir_formulario' && (aAny.params?.tipo === 'matriz_priorizacao' || aAny.params?.tipo === 'matriz-priorizacao')) {
        console.log('[CONSULTOR-CHAT] Interceptando pedido de formulário de matriz_priorizacao — convertendo para gerar_entregavel');
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
    }

    // Se estamos em modelagem E já temos Cadeia de Valor preenchida,
    // gerar matriz_priorizacao e escopo_projeto automaticamente
    const hasCadeia = !!(ctxNow && (ctxNow.cadeia_valor || ctxNow.cadeia));
    const hasCanvas = !!(ctxNow && ctxNow.canvas);
    const hasAnamnese = !!(ctxNow && (ctxNow.anamnese || ctxNow.empresa));

    // Verificar se matriz já foi gerada
    const { data: matrizExistente } = await supabase
      .from('entregaveis_consultor')
      .select('id')
      .eq('jornada_id', jornada.id)
      .eq('tipo', 'matriz_priorizacao')
      .maybeSingle();

    if ((jornada.etapa_atual === 'modelagem' || jornada.etapa_atual === 'mapeamento')
        && hasCadeia && hasCanvas && hasAnamnese
        && !matrizExistente) {
      console.log('[CONSULTOR-CHAT] Anamnese + Canvas + Cadeia completos, gerando Matriz automaticamente');

      // Gerar matriz e escopo automaticamente
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='matriz_priorizacao')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='escopo_projeto')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'escopo_projeto' } });
      }
      // Marcar para aguardar validação
      if (!filteredActions.some((a:any)=> a.type==='set_validacao' && a.params?.tipo==='priorizacao')) {
        filteredActions.push({ type: 'set_validacao', params: { tipo: 'priorizacao' } });
      }
    }

    // REMOVED: Auto-push logic that was causing cascade
    // Forms should ONLY open when LLM explicitly requests via CTA and user confirms
    // All auto-suggestion logic has been removed to enforce strict framework flow

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
          const actionAny = action as any;
          const rawTipo = actionAny.params?.tipo;
          // normalização de slug
          const tipo = (rawTipo === 'matriz' ? 'matriz_priorizacao' : rawTipo).replace(/-/g, '_');
          const { html, nome } = await deliverableGenerator.generateDeliverable(tipo, jornada, llmResponse);
          await deliverableGenerator.saveDeliverable(jornada.id, tipo, nome, html, jornada.etapa_atual);
          await markerProcessor.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);

          // Register timeline event for deliverable generation
          try {
            await supabase.from('timeline_consultor').insert({
              jornada_id: jornada.id,
              fase: jornada.etapa_atual,
              evento: `Entregável gerado: ${tipo}`
            });
            console.log(`[TIMELINE] ✅ Registered deliverable generation: ${tipo}`);
          } catch (e) {
            console.warn('[TIMELINE] Failed to register deliverable:', e);
          }

          if (tipo === 'escopo_projeto') {
            await markerProcessor.ensureAreasFromScope(jornada.id);
            // Register escopo timeline event
            try {
              await supabase.from('timeline_consultor').insert({
                jornada_id: jornada.id,
                fase: jornada.etapa_atual,
                evento: 'Entregável gerado: escopo_projeto'
              });
            } catch (e) {
              console.warn('[TIMELINE] Failed to register escopo:', e);
            }
          }

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

              // ⚠️ CRITICAL: Block progression until user validates
              // Do NOT move to 'execucao' yet and do NOT enqueue atributos_processo.
              // The user must VALIDATE the priorização first. Once they validate, the frontend
              // will call the backend with a SET_VALIDACAO:priorizacao action to advance.
              console.log('[CONSULTOR-CHAT] matriz_priorizacao persistida e jornada marcada aguardando_validacao: priorizacao');

              // Register timeline event
              try {
                await supabase.from('timeline_consultor').insert({
                  jornada_id: jornada.id,
                  fase: jornada.etapa_atual,
                  evento: 'Entregável gerado: matriz_priorizacao'
                });
              } catch (e) {
                console.warn('[TIMELINE] Failed to register matriz generation:', e);
              }

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
          const actionAny = action as any;
          console.error(`[CONSULTOR-CHAT] Error generating deliverable ${actionAny.params?.tipo}:`, err);
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
