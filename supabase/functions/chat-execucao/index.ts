/**
 * CHAT DE EXECUÇÃO - Chat único para todas as ações no Kanban
 *
 * Contexto dinâmico baseado no card selecionado:
 * - Carrega detalhes da ação (5W2H)
 * - Histórico de observações da ação
 * - Contexto completo da sessão/jornada
 * - Atualiza status automaticamente baseado em palavras-chave
 * - Registra progresso na timeline
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  sessao_id: string;
  acao_id?: string; // ID da ação/card selecionado (opcional se perguntas gerais)
  message: string;
}

const PROMPT_EXECUCAO = (contextoJornada: any, acaoAtual: any) => `
Você é o PROCEDA | Assistente de Execução.

Sua função é auxiliar na execução prática das ações do plano de consultoria.

═══════════════════════════════════════════════════════════════
CONTEXTO DA JORNADA:
═══════════════════════════════════════════════════════════════

EMPRESA: ${contextoJornada.empresa || 'N/A'}
SEGMENTO: ${contextoJornada.segmento || 'N/A'}
PORTE: ${contextoJornada.faturamento || 'N/A'} / ${contextoJornada.funcionarios || 'N/A'} colaboradores
DESAFIO PRINCIPAL: ${contextoJornada.dor_principal || 'N/A'}

${acaoAtual ? `
═══════════════════════════════════════════════════════════════
AÇÃO EM FOCO:
═══════════════════════════════════════════════════════════════

NOME: ${acaoAtual.nome}
STATUS ATUAL: ${acaoAtual.status}

DETALHAMENTO (5W2H):
- O quê: ${acaoAtual.o_que || acaoAtual.descricao || 'N/A'}
- Por quê: ${acaoAtual.por_que || 'Resolver problema identificado no diagnóstico'}
- Quem: ${acaoAtual.quem || acaoAtual.responsavel || 'A definir'}
- Quando: ${acaoAtual.quando || acaoAtual.prazo || 'A definir'}
- Onde: ${acaoAtual.onde || acaoAtual.area || 'N/A'}
- Como: ${acaoAtual.como || 'A definir método de execução'}
- Quanto (custo): ${acaoAtual.quanto_custa || 'A estimar'}
- Quanto (tempo): ${acaoAtual.quanto_tempo || 'A estimar'}

OBSERVAÇÕES ANTERIORES:
${acaoAtual.observacoes || 'Nenhuma observação registrada ainda.'}
` : `
═══════════════════════════════════════════════════════════════
NENHUMA AÇÃO SELECIONADA
═══════════════════════════════════════════════════════════════

Você pode responder perguntas gerais sobre o plano de ação ou orientar sobre qual ação priorizar.
`}

═══════════════════════════════════════════════════════════════
SUAS RESPONSABILIDADES:
═══════════════════════════════════════════════════════════════

1. TIRAR DÚVIDAS: Responder perguntas sobre como executar a ação
2. DAR FEEDBACK: Avaliar progresso e sugerir melhorias
3. ATUALIZAR STATUS: Detectar quando ação avança ou é concluída
4. DESBLOQUEAR: Ajudar a superar obstáculos
5. VALIDAR: Confirmar se a ação foi executada corretamente

═══════════════════════════════════════════════════════════════
REGRAS DE CONDUTA:
═══════════════════════════════════════════════════════════════

- Seja PRÁTICO e DIRETO
- Forneça orientações EXECUTÁVEIS
- Reconheça progresso: "Excelente! Você já completou X"
- Se usuário reportar conclusão, SEMPRE pergunte: "Pode descrever o resultado?"
- Atualize observações com informações importantes do diálogo
- Use tom de parceria: "vamos", "nosso objetivo", "juntos"

═══════════════════════════════════════════════════════════════
DETECÇÃO AUTOMÁTICA DE STATUS:
═══════════════════════════════════════════════════════════════

Quando usuário disser:
- "comecei", "iniciei", "estou fazendo" → STATUS: em_andamento
- "concluí", "terminei", "finalizei", "pronto", "feito" → STATUS: concluido
- "está travado", "não consigo", "bloqueado" → STATUS: bloqueado

Inclua na resposta JSON:
{
  "status_sugerido": "em_andamento" | "concluido" | "bloqueado",
  "justificativa": "breve explicação do que foi feito/relatado"
}

═══════════════════════════════════════════════════════════════
FORMATO DE RESPOSTA:
═══════════════════════════════════════════════════════════════

[PARTE A]
Sua resposta prática e objetiva ao usuário (máximo 8 linhas).
Forneça orientação clara e executável.

[PARTE B]
{
  "observacao_adicional": "registro técnico do que foi discutido",
  "status_sugerido": "em_andamento" | "concluido" | "bloqueado" | null,
  "progresso_percentual": 0-100
}
`.trim();

function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
    }
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { sessao_id, acao_id, message }: RequestBody = await req.json();

    if (!sessao_id || !message) {
      return new Response(
        JSON.stringify({ error: 'sessao_id e message são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CHAT-EXECUCAO] Processing message:', { sessao_id, acao_id });

    // 1. Buscar sessão
    const { data: sessao, error: sessaoError } = await supabase
      .from('consultor_sessoes')
      .select('*')
      .eq('id', sessao_id)
      .maybeSingle();

    if (sessaoError || !sessao) {
      throw new Error('Sessão não encontrada');
    }

    // 2. Buscar ação (se selecionada)
    let acao: any = null;
    if (acao_id) {
      const { data: acaoData, error: acaoError } = await supabase
        .from('acoes_plano')
        .select('*')
        .eq('id', acao_id)
        .maybeSingle();

      if (acaoError) {
        console.warn('[CHAT-EXECUCAO] Action not found:', acaoError);
      } else {
        acao = acaoData;
      }
    }

    // 3. Montar contexto da jornada
    const contexto = sessao.contexto_coleta || {};
    const contextoJornada = {
      empresa: contexto.empresa || contexto.empresa_nome,
      segmento: contexto.segmento,
      faturamento: contexto.faturamento,
      funcionarios: contexto.funcionarios || contexto.num_funcionarios,
      dor_principal: contexto.dor_principal || contexto.desafios_principais
    };

    // 4. Montar prompt
    const systemPrompt = PROMPT_EXECUCAO(contextoJornada, acao);

    // 5. Chamar LLM
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.6,
        max_tokens: 1000,
      }),
    });

    if (!openaiResp.ok) {
      const errorText = await openaiResp.text();
      throw new Error(`Erro na API OpenAI: ${openaiResp.status} ${errorText}`);
    }

    const openaiData = await openaiResp.json();
    const fullResponse = openaiData?.choices?.[0]?.message?.content || '';

    // 6. Extrair partes
    const parteAMatch = fullResponse.match(/\[PARTE A\]([\s\S]*?)(\[PARTE B\]|$)/i);
    const responseText = parteAMatch
      ? parteAMatch[1].trim()
      : fullResponse.split('[PARTE B]')[0].trim() || fullResponse;

    let observacaoAdicional = '';
    let statusSugerido: string | null = null;
    let progressoPercentual = 0;

    const parteBMatch = fullResponse.match(/\[PARTE B\]([\s\S]*)/i);
    if (parteBMatch) {
      try {
        const jsonStr = parteBMatch[1]
          .trim()
          .replace(/```json|```/g, '')
          .trim();
        const parsed = JSON.parse(jsonStr);
        observacaoAdicional = parsed.observacao_adicional || '';
        statusSugerido = parsed.status_sugerido || null;
        progressoPercentual = parsed.progresso_percentual || 0;
      } catch (e) {
        console.warn('[CHAT-EXECUCAO] Failed to parse PARTE B:', e);
      }
    }

    // 7. Atualizar ação se houver mudança de status
    if (acao_id && acao) {
      const novasObservacoes = acao.observacoes
        ? `${acao.observacoes}\n\n[${new Date().toLocaleString('pt-BR')}] ${message}\n→ ${observacaoAdicional || responseText}`
        : `[${new Date().toLocaleString('pt-BR')}] ${message}\n→ ${observacaoAdicional || responseText}`;

      const updateData: any = {
        observacoes: novasObservacoes,
        updated_at: new Date().toISOString()
      };

      if (statusSugerido && ['em_andamento', 'concluido', 'bloqueado'].includes(statusSugerido)) {
        updateData.status = statusSugerido;
        console.log('[CHAT-EXECUCAO] Updating status to:', statusSugerido);
      }

      if (progressoPercentual > 0) {
        updateData.progresso = progressoPercentual;
      }

      await supabase
        .from('acoes_plano')
        .update(updateData)
        .eq('id', acao_id);

      // Se concluído, registrar na timeline e dar XP
      if (statusSugerido === 'concluido') {
        console.log('[CHAT-EXECUCAO] Action completed! Recording event and awarding XP');

        // Timeline
        await supabase
          .from('timeline_consultor')
          .insert({
            sessao_id: sessao_id,
            fase: 'execucao',
            evento: `Ação concluída: ${acao.nome}`,
            created_at: new Date().toISOString()
          });

        // XP
        try {
          const { data: gamif } = await supabase
            .from('gamificacao_consultor')
            .select('xp_total')
            .eq('sessao_id', sessao_id)
            .maybeSingle();

          const xpAtual = gamif?.xp_total || 0;

          await supabase
            .from('gamificacao_consultor')
            .upsert({
              sessao_id: sessao_id,
              xp_total: xpAtual + 50,
              nivel: Math.floor((xpAtual + 50) / 100) + 1
            }, {
              onConflict: 'sessao_id'
            });
        } catch (e) {
          console.warn('[CHAT-EXECUCAO] Error awarding XP (non-fatal):', e);
        }
      }
    }

    // 8. Retornar resposta
    return new Response(
      JSON.stringify({
        reply: responseText,
        acao_id: acao_id,
        status_atualizado: statusSugerido,
        progresso: progressoPercentual,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CHAT-EXECUCAO] ERROR:', error);

    const fallbackResposta =
      'Entendi sua mensagem. Continue trabalhando e me atualize sobre o progresso. ' +
      'Estou aqui para ajudar com qualquer dúvida ou obstáculo.';

    return new Response(
      JSON.stringify({
        reply: fallbackResposta,
        fallback: true,
        error: error?.message || 'Erro desconhecido',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
