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

/**
 * Limpa a resposta do LLM removendo qualquer conteúdo técnico vazado
 */
function cleanResponse(response: string): string {
  let cleaned = response;

  // Remove blocos JSON isolados
  cleaned = cleaned.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '');
  cleaned = cleaned.replace(/\{[\s\n]*"campo"[\s\S]*?\}/g, '');
  cleaned = cleaned.replace(/\{[\s\n]*"tipo"[\s\S]*?\}/g, '');

  // Remove marcadores técnicos
  cleaned = cleaned.replace(/PRÓXIMA AÇÃO RECOMENDADA:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '');
  cleaned = cleaned.replace(/Tipo:\s*(coletar_info|aplicar_metodologia|gerar_entregavel|transicao_estado)/gi, '');
  cleaned = cleaned.replace(/\btype:\s*["']?\w+["']?/gi, '');
  cleaned = cleaned.replace(/\bcampo:\s*["']?\w+["']?/gi, '');
  cleaned = cleaned.replace(/\bentrada:\s*\{[\s\S]*?\}/gi, '');

  // Remove linhas que são claramente JSON
  cleaned = cleaned.split('\n').filter(line => {
    const trimmed = line.trim();
    return !trimmed.match(/^[\{\}\[\],]$/) &&
           !trimmed.match(/^"[\w_]+"\s*:/) &&
           !trimmed.match(/^\w+_\w+:/);
  }).join('\n');

  // Remove múltiplas linhas vazias consecutivas
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');

  // Remove espaços no início e fim
  cleaned = cleaned.trim();

  // Log warning se detectou limpeza
  if (cleaned !== response) {
    console.warn('[CLEAN-RESPONSE] Technical content removed from LLM response');
    console.warn('[CLEAN-RESPONSE] Original length:', response.length, 'Cleaned length:', cleaned.length);
  }

  return cleaned;
}

interface RequestBody {
  message: string;
  conversation_id?: string;
  user_id: string;
  sessao_id?: string;
  form_data?: any;
  action?: string;
  conversation_history?: Array<{role: string, content: string}>;
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

    const { message, conversation_id, user_id, sessao_id, form_data, action, conversation_history } = body;

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

    // Traduzir ação do orquestrador para instrução natural
    let instrucoesNaturais = '';
    if (acaoPrincipal) {
      switch (acaoPrincipal.tipo_acao) {
        case 'coletar_info':
          const campo = acaoPrincipal.entrada?.campo || 'informação';
          const pergunta = acaoPrincipal.entrada?.pergunta || `Pergunte sobre ${campo}`;
          instrucoesNaturais = `Você precisa coletar a seguinte informação: ${campo}. Use uma abordagem natural e conversacional. Sugestão de pergunta: "${pergunta}"`;
          break;
        case 'aplicar_metodologia':
          instrucoesNaturais = `Você deve aplicar a metodologia ${acaoPrincipal.entrada?.metodologia || 'recomendada'} para ajudar o cliente. Explique de forma natural como essa metodologia pode ajudar.`;
          break;
        case 'gerar_entregavel':
          instrucoesNaturais = `É hora de gerar um entregável do tipo ${acaoPrincipal.entrada?.tipo_entregavel || 'diagnóstico'}. Prepare o cliente para isso de forma natural.`;
          break;
        case 'transicao_estado':
          instrucoesNaturais = `A consultoria está avançando para a próxima fase: ${acaoPrincipal.entrada?.novo_estado || 'análise'}. Comunique isso de forma natural e positiva.`;
          break;
        default:
          instrucoesNaturais = 'Continue a conversa de forma natural baseada no contexto.';
      }
    }

    const promptSistema = orchestrator.getSystemPrompt() + `\n\nINFORMAÇÕES COLETADAS ATÉ AGORA:
${Object.keys(sessao.contexto_negocio || {}).length > 0 ? Object.entries(sessao.contexto_negocio).map(([key, value]) => `- ${key}: ${value}`).join('\n') : '- Nenhuma informação coletada ainda'}

FASE ATUAL DA CONSULTORIA: ${sessao.estado_atual}
PROGRESSO: ${sessao.progresso}%
METODOLOGIAS APLICADAS: ${sessao.metodologias_aplicadas?.join(', ') || 'Nenhuma ainda'}

CONHECIMENTO RELEVANTE DA BASE:
${resultadoRAG.documentos.map(doc => `
## ${doc.title}
${doc.content.substring(0, 500)}...`).join('\n')}

${orchestrator.getFewShotExample()}`;

    // 5. Construir histórico de mensagens para LLM
    const llmMessages: Array<{role: string, content: string}> = [
      { role: 'system', content: promptSistema }
    ];

    // Adicionar histórico da conversa se disponível
    if (conversation_history && conversation_history.length > 0) {
      llmMessages.push(...conversation_history);
    }

    // Adicionar mensagem atual
    llmMessages.push({ role: 'user', content: message });

    // 6. Chamar LLM
    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: llmMessages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!llmResponse.ok) {
      const error = await llmResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const llmData = await llmResponse.json();
    let respostaCompleta = llmData.choices[0].message.content;

    // Parse actions from response
    let { actions, contexto_incremental } = orchestrator.parseActionsBlock(respostaCompleta);

    // Enforcer: if no actions, synthesize fallback
    if (!Array.isArray(actions) || actions.length === 0) {
      console.warn('[ENFORCER] LLM did not provide actions, synthesizing fallback...');
      actions = orchestrator.synthesizeFallbackActions(sessao.estado_atual, message);
    }

    // Extract clean response (text before ---)
    let resposta = respostaCompleta.split('\n---')[0].trim();

    // Limpar resposta de qualquer conteúdo técnico vazado
    resposta = cleanResponse(resposta);

    // 6. Extrair informações do contexto da mensagem do usuário
    const contextoAtualizado = { ...sessao.contexto_negocio };
    let contextChanged = false;

    // Extração simples de informações chave
    const msgLower = message.toLowerCase();

    // Detectar nome da empresa (padrões comuns)
    if (!contextoAtualizado.empresa_nome) {
      // Padrões: "empresa X", "trabalho na X", "sou da X", "na X", ou simplesmente "X" em mensagens curtas
      const empresaPatterns = [
        /(?:empresa|trabalho na|sou da|na|da empresa)\s+([A-Za-z0-9À-ÿ\s]+?)(?:\s*,|\s*\.|\s*$)/i,
        /^([A-Za-z0-9À-ÿ]+(?:\s+[A-Za-z0-9À-ÿ]+){0,3})(?:\s*,|\s+e\s+|$)/i
      ];

      for (const pattern of empresaPatterns) {
        const match = message.match(pattern);
        if (match && match[1] && match[1].trim().length > 2) {
          contextoAtualizado.empresa_nome = match[1].trim();
          contextChanged = true;
          console.log('[CONTEXT-EXTRACT] Empresa detectada:', contextoAtualizado.empresa_nome);
          break;
        }
      }
    }

    // Detectar segmento
    if (!contextoAtualizado.segmento) {
      const segmentos = ['e-commerce', 'varejo', 'indústria', 'serviços', 'saúde', 'educação', 'tecnologia',
                        'logística', 'transportes', 'alimentos', 'construção', 'consultoria', 'financeiro'];
      for (const seg of segmentos) {
        if (msgLower.includes(seg)) {
          contextoAtualizado.segmento = seg;
          contextChanged = true;
          console.log('[CONTEXT-EXTRACT] Segmento detectado:', seg);
          break;
        }
      }
    }

    // Detectar porte
    if (!contextoAtualizado.porte) {
      if (msgLower.includes('micro') || msgLower.includes('pequena') || msgLower.includes('pme')) {
        contextoAtualizado.porte = 'pequena';
        contextChanged = true;
      } else if (msgLower.includes('média')) {
        contextoAtualizado.porte = 'média';
        contextChanged = true;
      } else if (msgLower.includes('grande')) {
        contextoAtualizado.porte = 'grande';
        contextChanged = true;
      }
    }

    // Atualizar sessão se contexto mudou
    if (contextChanged) {
      await supabase
        .from('consultor_sessoes')
        .update({ contexto_negocio: contextoAtualizado })
        .eq('id', sessao.id);

      console.log('[CONTEXT-EXTRACT] Contexto atualizado:', contextoAtualizado);
    }

    // 7. Executar ação principal
    let acaoExecutada = null;
    if (acaoPrincipal && action !== 'skip_action') {
      acaoExecutada = await orchestrator.executarAcao(sessao, acaoPrincipal);
    }

    // CRÍTICO: Adicionar markers na resposta para compatibilidade com frontend
    // O frontend detecta tanto actions quanto markers no texto
    if (acaoPrincipal && acaoPrincipal.tipo_acao === 'coletar_info') {
      const tipoForm = acaoPrincipal.entrada?.tipo_form;
      if (tipoForm === 'anamnese' || tipoForm === 'matriz_priorizacao') {
        // Adiciona marker invisível no final para o frontend detectar
        resposta = resposta + `\n[EXIBIR_FORMULARIO:${tipoForm}]`;
      }
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

    // 9. Retornar resposta completa com actions do enforcer
    return new Response(
      JSON.stringify({
        response: resposta,
        sessao_id: sessao.id,
        estado_atual: acaoExecutada?.novo_estado || sessao.estado_atual,
        progresso: Math.min(sessao.progresso + (acaoExecutada ? 20 : 5), 100),
        actions: actions, // Use parsed/enforced actions
        contexto_incremental: contexto_incremental,
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