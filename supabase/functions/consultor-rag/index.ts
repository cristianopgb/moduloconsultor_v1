/**
 * Consultor RAG - Nova Implementação com RAG + Orquestração
 *
 * Esta edge function implementa o novo sistema de consultoria
 * baseado em RAG (Retrieval-Augmented Generation) + Orquestração
 *
 * Fluxo:
 * 1. Recebe mensagem do usuário
 * 2. Identifica/cria sessão de consultoria
 * 3. Orquestrador determina próximas ações
 * 4. RAG busca conhecimento relevante
 * 5. LLM processa com contexto enriquecido
 * 6. Retorna resposta + ações para o front
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno';
import { ConsultorOrchestrator } from './orchestrator.ts';
import { RAGEngine } from './rag-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

interface RequestBody {
  message: string;
  conversation_id?: string;
  user_id: string;
  sessao_id?: string;
  form_data?: any;
  action?: string;
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
    const body: RequestBody = await req.json();

    const { message, conversation_id, user_id, sessao_id, form_data, action } = body;

    if (!message || !user_id) {
      return new Response(
        JSON.stringify({ error: 'message e user_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONSULTOR-RAG] Request:', {
      user_id,
      conversation_id,
      sessao_id,
      has_form: !!form_data,
      action
    });

    // Inicializa componentes
    const orchestrator = new ConsultorOrchestrator(supabase, openaiKey);
    const ragEngine = new RAGEngine(supabase, openaiKey);

    // Busca ou cria sessão
    let sessao = await buscarOuCriarSessao(
      supabase,
      user_id,
      conversation_id,
      sessao_id,
      message
    );

    console.log('[CONSULTOR-RAG] Sessão:', {
      id: sessao.id,
      estado: sessao.estado_atual,
      progresso: sessao.progresso
    });

    // Atualiza contexto se houver form_data
    if (form_data && Object.keys(form_data).length > 0) {
      sessao = await atualizarContextoSessao(supabase, sessao, form_data);
    }

    // Determina próximas ações via orquestrador
    const acoesOrquestradas = await orchestrator.determinarProximasAcoes(sessao);

    console.log('[CONSULTOR-RAG] Ações orquestradas:', acoesOrquestradas.length);

    // Busca conhecimento relevante via RAG
    const resultadoRAG = await ragEngine.buscarDocumentos(
      `${sessao.titulo_problema} ${message}`,
      {
        categorias: ['metodologia', 'framework', 'best_practice'],
        limite: 3
      }
    );

    console.log('[CONSULTOR-RAG] RAG:', {
      documentos: resultadoRAG.documentos.length,
      tokens: resultadoRAG.tokens_usados
    });

    // Constrói prompt para LLM com contexto enriquecido
    const promptSystem = construirPromptSystem(sessao, resultadoRAG, acoesOrquestradas);
    const promptUser = construirPromptUser(message, sessao);

    // Chama LLM
    const respostaLLM = await chamarLLM(promptSystem, promptUser, openaiKey);

    // Processa ações pendentes
    let acoesFront: any[] = [];
    if (acoesOrquestradas.length > 0) {
      const acaoPrincipal = acoesOrquestradas[0];

      // Executa ação principal
      const resultadoAcao = await orchestrator.executarAcao(sessao, acaoPrincipal);

      // Converte para formato do front-end
      acoesFront = converterAcoesParaFront(resultadoAcao, acaoPrincipal);
    }

    // Atualiza progresso
    const novoProgresso = await orchestrator.atualizarProgresso(sessao);

    // Salva mensagens
    await salvarMensagens(supabase, conversation_id, user_id, message, respostaLLM);

    // Resposta
    return new Response(
      JSON.stringify({
        response: respostaLLM,
        sessao_id: sessao.id,
        estado_atual: sessao.estado_atual,
        progresso: novoProgresso,
        actions: acoesFront,
        rag_info: {
          documentos_usados: resultadoRAG.documentos.length,
          tempo_busca: resultadoRAG.tempo_busca_ms
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CONSULTOR-RAG ERROR]', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function buscarOuCriarSessao(
  supabase: any,
  userId: string,
  conversationId?: string,
  sessaoId?: string,
  message?: string
): Promise<any> {
  // Tenta buscar sessão existente
  if (sessaoId) {
    const { data, error } = await supabase
      .from('consultor_sessoes')
      .select('*')
      .eq('id', sessaoId)
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      return data;
    }
  }

  // Tenta buscar por conversation_id
  if (conversationId) {
    const { data, error } = await supabase
      .from('consultor_sessoes')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('ativo', true)
      .single();

    if (!error && data) {
      return data;
    }
  }

  // Cria nova sessão
  const tituloProblem a = message ? extrairTitulo(message) : 'Nova Consultoria';

  const { data: novaSessao, error: createError } = await supabase
    .from('consultor_sessoes')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      titulo_problema: tituloProblem a,
      estado_atual: 'coleta',
      contexto_negocio: {},
      metodologias_aplicadas: [],
      documentos_usados: [],
      historico_rag: [],
      entregaveis_gerados: [],
      progresso: 0,
      ativo: true
    })
    .select()
    .single();

  if (createError) {
    throw new Error(`Erro ao criar sessão: ${createError.message}`);
  }

  return novaSessao;
}

async function atualizarContextoSessao(
  supabase: any,
  sessao: any,
  formData: any
): Promise<any> {
  const contextoAtualizado = {
    ...sessao.contexto_negocio,
    ...formData,
    ultima_atualizacao: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('consultor_sessoes')
    .update({ contexto_negocio: contextoAtualizado })
    .eq('id', sessao.id)
    .select()
    .single();

  if (error) {
    console.error('[CONSULTOR-RAG] Erro ao atualizar contexto:', error);
    return sessao;
  }

  return data;
}

function construirPromptSystem(
  sessao: any,
  resultadoRAG: any,
  acoes: any[]
): string {
  let prompt = `# Você é o Proceda AI Consultant

Especialista sênior em consultoria empresarial com 20+ anos de experiência em BPM, estratégia, processos e metodologias de melhoria contínua.

## Contexto da Sessão
- **Problema:** ${sessao.titulo_problema}
- **Estado Atual:** ${sessao.estado_atual}
- **Progresso:** ${sessao.progresso}%
- **Metodologias Aplicadas:** ${sessao.metodologias_aplicadas.join(', ') || 'Nenhuma ainda'}

## Contexto do Negócio
${JSON.stringify(sessao.contexto_negocio, null, 2)}

## Conhecimento Disponível (RAG)
${resultadoRAG.contexto_construido}

## Próximas Ações Recomendadas
${acoes.map((a, i) => `${i + 1}. ${a.descricao} (${a.tipo})`).join('\n')}

## Seu Papel
- Seja direto, consultivo e prático
- Use o conhecimento da base (RAG) para fundamentar suas recomendações
- Siga as ações recomendadas pelo orquestrador
- Adapte sua comunicação ao perfil do cliente
- Não repita informações já coletadas
- Seja proativo em identificar problemas ocultos

## Tom
Profissional, motivador, sem rodeios, focado em resultados.
`;

  return prompt;
}

function construirPromptUser(message: string, sessao: any): string {
  return `Mensagem do cliente: "${message}"

Por favor, responda de forma contextual e relevante, considerando o estado atual da sessão e as próximas ações recomendadas.`;
}

async function chamarLLM(
  systemPrompt: string,
  userPrompt: string,
  openaiKey: string
): Promise<string> {
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
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('[CONSULTOR-RAG] LLM call failed:', err);
    throw err;
  }
}

function converterAcoesParaFront(resultadoAcao: any, acao: any): any[] {
  const acoes: any[] = [];

  if (resultadoAcao.tipo === 'pergunta') {
    // Não retorna action, deixa LLM fazer a pergunta naturalmente
    return [];
  }

  if (resultadoAcao.tipo === 'metodologia_aplicada') {
    // Pode exibir modal com instruções da metodologia
    acoes.push({
      type: 'exibir_metodologia',
      params: {
        metodologia: resultadoAcao.metodologia,
        instrucoes: resultadoAcao.instrucoes
      }
    });
  }

  if (resultadoAcao.tipo === 'entregavel_pendente') {
    acoes.push({
      type: 'gerar_entregavel',
      params: {
        tipo: resultadoAcao.tipo_entregavel
      }
    });
  }

  return acoes;
}

async function salvarMensagens(
  supabase: any,
  conversationId: string | undefined,
  userId: string,
  userMsg: string,
  assistantMsg: string
): Promise<void> {
  if (!conversationId) return;

  try {
    await supabase.from('messages').insert([
      {
        conversation_id: conversationId,
        role: 'user',
        content: userMsg,
        user_id: userId,
        message_type: 'text'
      },
      {
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantMsg,
        user_id: userId,
        message_type: 'text'
      }
    ]);
  } catch (err) {
    console.error('[CONSULTOR-RAG] Erro ao salvar mensagens:', err);
  }
}

function extrairTitulo(message: string): string {
  // Extrai título do problema da mensagem
  const palavrasChave = ['problema', 'desafio', 'dificuldade', 'melhorar', 'otimizar'];

  for (const palavra of palavrasChave) {
    if (message.toLowerCase().includes(palavra)) {
      // Pega até 50 caracteres após a palavra-chave
      const index = message.toLowerCase().indexOf(palavra);
      const titulo = message.substring(index, Math.min(index + 50, message.length));
      return titulo.trim();
    }
  }

  // Fallback: primeiras 50 caracteres
  return message.substring(0, Math.min(50, message.length)).trim() + '...';
}
