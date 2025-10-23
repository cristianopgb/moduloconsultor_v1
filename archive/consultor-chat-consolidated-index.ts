import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

class IntelligentContextManager {
  supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async evaluateStageCompletion(jornadaId: string, currentStage: string) {
    const { data: jornada } = await this.supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('id', jornadaId)
      .single();

    if (!jornada) {
      return {
        canAdvance: false,
        missingInfo: ['Jornada não encontrada'],
        confidence: 0,
        summary: 'Erro ao carregar jornada'
      };
    }

    const contexto = jornada.contexto_coleta || {};

    switch (currentStage) {
      case 'anamnese':
        return this.evaluateAnamnese(contexto);
      case 'mapeamento':
        return this.evaluateMapeamento(contexto);
      default:
        return {
          canAdvance: false,
          missingInfo: [],
          confidence: 0,
          summary: 'Etapa desconhecida'
        };
    }
  }

  evaluateAnamnese(contexto: any) {
    const requiredFields = [
      { key: 'nome_usuario', label: 'Nome do usuário' },
      { key: 'cargo', label: 'Cargo' },
      { key: 'empresa_nome', label: 'Nome da empresa' },
      { key: 'segmento', label: 'Segmento de atuação' },
      { key: 'porte', label: 'Porte da empresa' }
    ];

    const missing = requiredFields.filter(f => !contexto[f.key]).map(f => f.label);
    const collected = requiredFields.length - missing.length;
    const confidence = (collected / requiredFields.length) * 100;

    return {
      canAdvance: missing.length === 0,
      missingInfo: missing,
      confidence,
      nextStage: 'mapeamento',
      summary: missing.length === 0 ? 'Anamnese completa!' : `Coletado ${collected} de ${requiredFields.length} informações.`
    };
  }

  evaluateMapeamento(contexto: any) {
    return {
      canAdvance: false,
      missingInfo: [],
      confidence: 0,
      summary: 'Em mapeamento'
    };
  }
}

class IntelligentPromptBuilder {
  buildSystemPrompt(jornada: any, evaluation: any, conversationHistory: any[]) {
    return `Você é o Proceda Consultor IA. ETAPA ATUAL: ${jornada.etapa_atual}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { conversation_id, user_id, jornada_id } = body;
    let message = body.message || '';

    let isFormSubmission = false;
    let formPayload: any = null;
    try {
      const match = message.match(/```json([\s\S]*?)```/i);
      const raw = match ? match[1].trim() : message;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.is_form_submission === true) {
        isFormSubmission = true;
        formPayload = parsed;
      }
    } catch (e) {}

    if (!message || !conversation_id || !user_id) {
      throw new Error('Campos obrigatórios: message, conversation_id, user_id');
    }

    const contextManager = new IntelligentContextManager(supabaseUrl, supabaseKey);
    const promptBuilder = new IntelligentPromptBuilder();

    let jornada = await loadOrCreateJornada(supabase, user_id, conversation_id, jornada_id);

    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = messages || [];

    const apresentacaoJaMostrada = conversationHistory.some((m: any) =>
      m.role !== 'user' &&
      m.content?.includes('Proceda Consultor IA') &&
      m.content?.includes('método estruturado de 5 fases')
    );

    const formularioAnamneseJaMostrado = conversationHistory.some((m: any) =>
      m.role !== 'user' && m.content?.includes('[EXIBIR_FORMULARIO:anamnese]')
    );

    const hasAssistantReply = conversationHistory.some((m: any) => m.role !== 'user');
    const isFirstTurn = !hasAssistantReply && jornada.etapa_atual === 'apresentacao';

    let responseContent = '';

    console.log('[CONSULTOR-CHAT DEBUG]', {
      etapa_atual: jornada.etapa_atual,
      isFirstTurn,
      hasAssistantReply,
      apresentacaoJaMostrada,
      formularioAnamneseJaMostrado,
      totalMessages: conversationHistory.length,
      isFormSubmission
    });

    if (formularioAnamneseJaMostrado && jornada.etapa_atual === 'apresentacao') {
      console.log('[CONSULTOR-CHAT] AVISO: Corrigindo etapa inconsistente');
      await supabase
        .from('jornadas_consultor')
        .update({ etapa_atual: 'anamnese' })
        .eq('id', jornada.id);

      const { data: jornadaAtualizada } = await supabase
        .from('jornadas_consultor')
        .select('*')
        .eq('id', jornada.id)
        .single();

      if (jornadaAtualizada) jornada = jornadaAtualizada;
    }

    if (isFirstTurn) {
      console.log('[CONSULTOR-CHAT] 🎯 PRIMEIRO TURNO DETECTADO! Enviando apresentação...');

      responseContent = `Olá! Sou o **Proceda Consultor IA**, especialista em transformação empresarial.

Vou te guiar por um **método estruturado de 5 fases** para elevar sua empresa ao próximo nível:

**📋 FASE 1 - ANAMNESE**
Conhecer você, sua empresa e seus desafios

**🎨 FASE 2 - MODELAGEM GERAL**
Business Model Canvas + Cadeia de Valor de Porter

**🎯 FASE 3 - PRIORIZAÇÃO**
Matriz de priorização para definir quais processos atacar primeiro

**⚙️ FASE 4 - EXECUÇÃO**
Mapeamento AS-IS + Diagnóstico + Plano de Ação detalhado

**📊 FASE 5 - ACOMPANHAMENTO**
Kanban interativo para implementar as melhorias

Ao final, você terá um **plano completo e executável** para transformar sua operação.

**Pronto para começar?** (Responda qualquer coisa para iniciar)`;

      console.log('[CONSULTOR-CHAT] 📝 ResponseContent definido, length:', responseContent.length);

      await saveMessages(supabase, conversation_id, user_id, message, responseContent);

      console.log('[CONSULTOR-CHAT] ✅ Mensagens salvas, retornando resposta...');

      return new Response(JSON.stringify({
        response: responseContent,
        jornada_id: jornada.id,
        etapa_atual: jornada.etapa_atual
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const deveAvancarParaAnamnese = (
      jornada.etapa_atual === 'apresentacao' &&
      hasAssistantReply &&
      apresentacaoJaMostrada &&
      !formularioAnamneseJaMostrado &&
      !isFormSubmission
    );

    console.log('[CONSULTOR-CHAT] Deve avançar?', deveAvancarParaAnamnese);

    if (deveAvancarParaAnamnese) {
      console.log('[CONSULTOR-CHAT] Avançando de apresentacao para anamnese...');

      await supabase
        .from('jornadas_consultor')
        .update({ etapa_atual: 'anamnese' })
        .eq('id', jornada.id);

      const { data: jornadaAtualizada } = await supabase
        .from('jornadas_consultor')
        .select('*')
        .eq('id', jornada.id)
        .single();

      if (jornadaAtualizada) jornada = jornadaAtualizada;

      responseContent = `Perfeito! Vamos começar pela **Fase 1: Anamnese Empresarial**.

Vou te enviar um formulário rápido (3 minutos) para conhecer você e sua empresa.

[EXIBIR_FORMULARIO:anamnese]`;

      await saveMessages(supabase, conversation_id, user_id, message, responseContent);

      return new Response(JSON.stringify({
        response: responseContent,
        jornada_id: jornada.id,
        etapa_atual: jornada.etapa_atual
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (isFormSubmission && formPayload) {
      const { tipo_form, dados } = formPayload;

      if (tipo_form === 'anamnese' && jornada.etapa_atual === 'anamnese') {
        await supabase
          .from('jornadas_consultor')
          .update({
            etapa_atual: 'mapeamento',
            contexto_coleta: { ...jornada.contexto_coleta, ...dados }
          })
          .eq('id', jornada.id);

        responseContent = `✅ **Anamnese recebida!**

Agora vamos mapear seus processos principais.`;

        await supabase.from('messages').insert({
          conversation_id,
          user_id,
          role: 'assistant',
          content: responseContent
        });

        return new Response(JSON.stringify({
          response: responseContent,
          jornada_id: jornada.id,
          etapa_atual: 'mapeamento'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const evaluation = await contextManager.evaluateStageCompletion(jornada.id, jornada.etapa_atual);
    const systemPrompt = promptBuilder.buildSystemPrompt(jornada, evaluation, conversationHistory);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');

    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openaiMessages,
        temperature: 0.5,
        max_tokens: 2500
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    responseContent = openaiData.choices[0].message.content;

    await saveMessages(supabase, conversation_id, user_id, message, responseContent);

    return new Response(JSON.stringify({
      response: responseContent,
      jornada_id: jornada.id,
      etapa_atual: jornada.etapa_atual
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro no consultor-chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function loadOrCreateJornada(supabase: any, userId: string, conversationId: string, jornadaId?: string) {
  if (jornadaId) {
    const { data } = await supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('id', jornadaId)
      .single();
    if (data) return data;
  }

  const { data: existingJornada } = await supabase
    .from('jornadas_consultor')
    .select('*')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (existingJornada) return existingJornada;

  const { data: newJornada } = await supabase
    .from('jornadas_consultor')
    .upsert({
      user_id: userId,
      conversation_id: conversationId,
      etapa_atual: 'apresentacao',
      progresso_geral: 0,
      contexto_coleta: {},
      resumo_etapa: {}
    }, { onConflict: 'user_id,conversation_id' })
    .select()
    .single();

  return newJornada;
}

async function saveMessages(supabase: any, conversationId: string, userId: string, userMsg: string, assistantMsg: string) {
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    user_id: userId,
    role: 'user',
    content: userMsg
  });

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    user_id: userId,
    role: 'assistant',
    content: assistantMsg
  });
}
