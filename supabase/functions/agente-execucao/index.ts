import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

interface RequestBody {
  jornada_id: string;
  message: string;
  file_context?: string;
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

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        userId = decoded.sub || null;
      } catch (e) {
        console.warn('[AGENTE-EXECUCAO] Could not extract user from token:', e);
      }
    }

    const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
    const body: RequestBody = await req.json();

    if (!body.jornada_id || !body.message) {
      return new Response(
        JSON.stringify({ error: 'jornada_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AGENTE-EXECUCAO] Processing message for jornada:', body.jornada_id);

    const { data: jornada, error: jornadaError } = await supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('id', body.jornada_id)
      .single();

    if (jornadaError || !jornada) {
      throw new Error('Jornada não encontrada');
    }

    const { data: acoes, error: acoesError } = await supabase
      .from('kanban_cards')
      .select('*')
      .eq('jornada_id', body.jornada_id)
      .order('created_at', { ascending: false });

    if (acoesError) {
      console.error('Erro ao buscar ações:', acoesError);
    }

    const context = {
      empresa: jornada.empresa_nome,
      etapa_atual: jornada.etapa_atual,
      progresso_geral: jornada.progresso_geral,
      total_acoes: acoes?.length || 0,
      acoes_concluidas: acoes?.filter(a => a.status === 'done').length || 0,
      acoes_em_andamento: acoes?.filter(a => a.status === 'in_progress').length || 0,
      acoes_bloqueadas: acoes?.filter(a => a.status === 'blocked').length || 0,
      acoes_lista: acoes?.slice(0, 10).map(a => ({
        id: a.id,
        titulo: a.titulo,
        status: a.status,
        responsavel: a.responsavel,
        prazo: a.prazo,
        progresso: a.progresso
      }))
    };

    const systemPrompt = `Você é o Agente Executor, um assistente inteligente especializado em gestão de projetos e execução de ações.

Seu papel é ajudar o usuário a:
1. **Atualizar status de ações**: Quando o usuário mencionar conclusão, início ou bloqueio de ações
2. **Modificar prazos e responsáveis**: Quando houver solicitação de mudança
3. **Registrar progresso**: Atualizar percentual de conclusão
4. **Fornecer insights**: Análise de andamento, riscos e recomendações
5. **Analisar documentos**: Quando arquivos são anexados, fornecer análise relevante

CONTEXTO DO PROJETO:
- Empresa: ${context.empresa}
- Etapa: ${context.etapa_atual}
- Progresso Geral: ${context.progresso_geral}%
- Total de Ações: ${context.total_acoes}
- Concluídas: ${context.acoes_concluidas}
- Em Andamento: ${context.acoes_em_andamento}
- Bloqueadas: ${context.acoes_bloqueadas}

AÇÕES RECENTES:
${JSON.stringify(context.acoes_lista, null, 2)}

INSTRUÇÕES:
- Seja proativo e identifique intenções implícitas
- Quando o usuário mencionar ações, entenda o contexto e sugira mudanças
- Sempre confirme antes de fazer alterações críticas
- Forneça feedback claro sobre ações realizadas
- Use linguagem clara, profissional mas amigável
- Se detectar possíveis problemas ou atrasos, alerte o usuário

FORMATO DE RESPOSTA:
- Use markdown para formatação
- Para listas, use bullet points
- Para ações específicas, mencione o título da ação
- Seja conciso mas informativo`;

    const userMessage = body.file_context
      ? `${body.message}\n\n[Arquivos anexados: ${body.file_context}]`
      : body.message;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.text();
      console.error('[AGENTE-EXECUCAO] OpenAI error:', errorData);
      throw new Error('Erro ao processar com OpenAI');
    }

    const openAIData = await openAIResponse.json();
    const assistantResponse = openAIData.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

    const intentKeywords = {
      concluir: ['conclu', 'finaliz', 'termina', 'pronto', 'feito', 'finalizar', 'completar', 'terminei'],
      iniciar: ['inicia', 'começa', 'comecar', 'vou fazer', 'começar', 'andamento', 'em andamento'],
      bloquear: ['bloque', 'parado', 'impedido', 'travad', 'bloqueado', 'obstáculo', 'obstaculo'],
      desbloquear: ['desbloque', 'libera', 'continua', 'resolver'],
      alterar_prazo: ['prazo', 'data', 'posterga', 'antecipa', 'adiamento', 'adiar'],
      progresso: ['progresso', 'andamento', '%', 'porcentagem', 'avanço', 'avanco'],
      responsavel: ['responsavel', 'responsável', 'encarregado', 'atribuir'],
      observacao: ['observação', 'observacao', 'nota', 'comentário', 'comentario', 'obs']
    };

    function normalizeText(text: string): string {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    const messageLower = normalizeText(body.message);
    let autoActions: string[] = [];

    const effectiveUserId = userId || jornada.user_id;

    if (acoes && acoes.length > 0) {
      for (const acao of acoes) {
        const acaoTituloNorm = normalizeText(acao.titulo);
        const palavrasAcao = acaoTituloNorm.split(' ').filter(p => p.length > 3);

        const acaoMencionada = messageLower.includes(acaoTituloNorm) ||
                              palavrasAcao.some(palavra => messageLower.includes(palavra)) ||
                              messageLower.includes('primeira acao') ||
                              messageLower.includes('primeira ação') ||
                              messageLower.includes('1');

        if (acaoMencionada) {
          console.log(`[AGENTE-EXECUCAO] Ação mencionada: ${acao.titulo}`);

          if (intentKeywords.concluir.some(k => messageLower.includes(k))) {
            const { error } = await supabase
              .from('kanban_cards')
              .update({ status: 'done', progresso: 100, updated_at: new Date().toISOString() })
              .eq('id', acao.id);

            if (!error && effectiveUserId) {
              await supabase.from('acao_historico').insert({
                acao_id: acao.id,
                campo_alterado: 'status',
                valor_anterior: acao.status,
                valor_novo: 'done',
                alterado_por: effectiveUserId,
                origem: 'agente_executor'
              });
            }

            autoActions.push(`✅ Ação "${acao.titulo}" marcada como concluída`);
          }
          else if (intentKeywords.iniciar.some(k => messageLower.includes(k))) {
            const { error } = await supabase
              .from('kanban_cards')
              .update({ status: 'in_progress', progresso: 25, updated_at: new Date().toISOString() })
              .eq('id', acao.id);

            if (!error && effectiveUserId) {
              await supabase.from('acao_historico').insert({
                acao_id: acao.id,
                campo_alterado: 'status',
                valor_anterior: acao.status,
                valor_novo: 'in_progress',
                alterado_por: effectiveUserId,
                origem: 'agente_executor'
              });
            }

            autoActions.push(`▶️ Ação "${acao.titulo}" iniciada (em andamento)`);
          }
          else if (intentKeywords.bloquear.some(k => messageLower.includes(k))) {
            const { error } = await supabase
              .from('kanban_cards')
              .update({ status: 'blocked', updated_at: new Date().toISOString() })
              .eq('id', acao.id);

            if (!error && effectiveUserId) {
              await supabase.from('acao_historico').insert({
                acao_id: acao.id,
                campo_alterado: 'status',
                valor_anterior: acao.status,
                valor_novo: 'blocked',
                alterado_por: effectiveUserId,
                origem: 'agente_executor'
              });
            }

            autoActions.push(`🚫 Ação "${acao.titulo}" bloqueada`);
          }
          else if (intentKeywords.desbloquear.some(k => messageLower.includes(k))) {
            const { error } = await supabase
              .from('kanban_cards')
              .update({ status: 'in_progress', updated_at: new Date().toISOString() })
              .eq('id', acao.id);

            if (!error && effectiveUserId) {
              await supabase.from('acao_historico').insert({
                acao_id: acao.id,
                campo_alterado: 'status',
                valor_anterior: acao.status,
                valor_novo: 'in_progress',
                alterado_por: effectiveUserId,
                origem: 'agente_executor'
              });
            }

            autoActions.push(`✅ Ação "${acao.titulo}" desbloqueada`);
          }
          else if (intentKeywords.observacao.some(k => messageLower.includes(k))) {
            const obsMatch = body.message.match(/observa[çc][aã]o[:\s]+(.+)/i);
            if (obsMatch) {
              const observacao = obsMatch[1].trim();
              const { error } = await supabase
                .from('kanban_cards')
                .update({
                  observacoes: observacao,
                  updated_at: new Date().toISOString()
                })
                .eq('id', acao.id);

              if (!error) {
                autoActions.push(`📝 Observação adicionada à ação "${acao.titulo}"`);
              }
            }
          }
        }
      }
    }

    let finalResponse = assistantResponse;
    if (autoActions.length > 0) {
      finalResponse = `${assistantResponse}\n\n**Ações Automáticas Executadas:**\n${autoActions.join('\n')}`;
    }

    return new Response(
      JSON.stringify({ response: finalResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AGENTE-EXECUCAO] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
