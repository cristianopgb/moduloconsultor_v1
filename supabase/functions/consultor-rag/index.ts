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

    if (!user_id || !message) {
      return new Response(
        JSON.stringify({ error: 'user_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar componentes
    const orchestrator = new ConsultorOrchestrator(supabase);
    const ragEngine = new RAGEngine(supabase, openaiKey);

    // 1. Buscar ou criar sessão
    let sessao;
    if (sessao_id) {
      const { data } = await supabase
        .from('consultor_sessoes')
        .select('*')
        .eq('id', sessao_id)
        .eq('user_id', user_id)
        .single();
      sessao = data;
    }

    if (!sessao) {
      // Criar nova sessão
      const { data, error } = await supabase
        .from('consultor_sessoes')
        .insert({
          user_id,
          conversation_id,
          titulo_problema: message.substring(0, 100),
          contexto_negocio: form_data || {},
          estado_atual: 'coleta',
          progresso: 0
        })
        .select()
        .single();

      if (error) throw error;
      sessao = data;
    } else if (form_data) {
      // Atualizar contexto com form_data
      const novoContexto = { ...sessao.contexto_negocio, ...form_data };
      const { data } = await supabase
        .from('consultor_sessoes')
        .update({ contexto_negocio: novoContexto })
        .eq('id', sessao.id)
        .select()
        .single();
      sessao = data;
    }

    // 2. Orquestrador determina próximas ações
    const acoes = await orchestrator.determinarProximasAcoes(sessao);
    const acaoPrincipal = acoes[0];

    // 3. RAG busca conhecimento relevante
    const resultadoRAG = await ragEngine.buscarDocumentos(
      message + ' ' + (acaoPrincipal?.entrada?.query || ''),
      {
        contexto: sessao.contexto_negocio,
        estado: sessao.estado_atual
      }
    );

    // 4. Construir prompt enriquecido
    const promptSistema = `Você é um consultor empresarial expert em BPM e gestão de processos.

ESTADO DA CONSULTORIA:
- Fase atual: ${sessao.estado_atual}
- Progresso: ${sessao.progresso}%
- Problema: ${sessao.titulo_problema}

CONTEXTO DO NEGÓCIO:
${JSON.stringify(sessao.contexto_negocio, null, 2)}

METODOLOGIAS JÁ APLICADAS:
${sessao.metodologias_aplicadas?.join(', ') || 'Nenhuma ainda'}

PRÓXIMA AÇÃO RECOMENDADA:
Tipo: ${acaoPrincipal?.tipo_acao}
${acaoPrincipal?.entrada ? JSON.stringify(acaoPrincipal.entrada, null, 2) : ''}

CONHECIMENTO RELEVANTE DA BASE:
${resultadoRAG.documentos.map(doc => `
## ${doc.title}
${doc.content.substring(0, 500)}...`).join('\n')}

Sua resposta deve:
1. Ser conversacional e empática
2. Usar o conhecimento da base quando aplicável
3. Seguir a ação recomendada pelo orquestrador
4. Ser concisa mas completa
5. Fazer perguntas específicas quando necessário`;

    // 5. Chamar LLM
    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!llmResponse.ok) {
      const error = await llmResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const llmData = await llmResponse.json();
    const resposta = llmData.choices[0].message.content;

    // 6. Executar ação principal
    let acaoExecutada = null;
    if (acaoPrincipal && action !== 'skip_action') {
      acaoExecutada = await orchestrator.executarAcao(sessao, acaoPrincipal);
    }

    // 7. Log da ação no orquestrador
    await supabase.from('orquestrador_acoes').insert({
      sessao_id: sessao.id,
      tipo_acao: acaoPrincipal?.tipo_acao || 'resposta_livre',
      entrada: { message, ...acaoPrincipal?.entrada },
      documentos_consultados: resultadoRAG.documentos.map(d => d.id),
      saida: { resposta, acao_executada: acaoExecutada },
      sucesso: true
    });

    // 8. Atualizar progresso
    if (acaoExecutada?.novo_estado) {
      await supabase
        .from('consultor_sessoes')
        .update({
          estado_atual: acaoExecutada.novo_estado,
          progresso: Math.min(sessao.progresso + 20, 100)
        })
        .eq('id', sessao.id);
    }

    // 9. Retornar resposta completa
    return new Response(
      JSON.stringify({
        response: resposta,
        sessao_id: sessao.id,
        estado_atual: acaoExecutada?.novo_estado || sessao.estado_atual,
        progresso: Math.min(sessao.progresso + (acaoExecutada ? 20 : 5), 100),
        actions: acoes.slice(0, 3).map(a => ({
          type: a.tipo_acao,
          params: a.entrada
        })),
        rag_info: {
          documentos_usados: resultadoRAG.documentos.map(d => d.title),
          tokens_usados: resultadoRAG.tokens_usados,
          tempo_busca_ms: resultadoRAG.tempo_busca_ms
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in consultor-rag:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});