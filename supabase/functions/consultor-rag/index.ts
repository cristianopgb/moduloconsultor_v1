/**
 * CONSULTOR RAG - ORQUESTRADOR COMPLETO DE CONSULTORIA
 *
 * Sistema inteligente que conduz todo o processo de consultoria:
 * 1. ANAMNESE: Conhecer o profissional e o negócio (7 turnos)
 * 2. MAPEAMENTO: Canvas + Cadeia de Valor (automático após anamnese)
 * 3. PRIORIZAÇÃO: Matriz GUT + Escopo (aguarda validação do usuário)
 * 4. INVESTIGAÇÃO: Ishikawa + 5 Porquês por processo
 * 5. MAPEAMENTO PROCESSOS: SIPOC + BPMN AS-IS
 * 6. DIAGNÓSTICO: Consolidação de achados
 * 7. EXECUÇÃO: Plano 5W2H + Kanban automático
 *
 * O sistema gera entregáveis automaticamente ao final de cada fase.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getSystemPrompt } from './consultor-prompts.ts';
import { getTemplateForType } from '../_shared/deliverable-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

interface RequestBody {
  sessao_id: string;
  message: string;
}

// Mapeamento de fases para próxima fase
// Fluxo correto: anamnese → mapeamento (Canvas) → investigacao → priorizacao → mapeamento_processos (SIPOC) → diagnostico → execucao
const PHASE_FLOW: Record<string, string> = {
  'coleta': 'mapeamento',  // Alias antigo
  'anamnese': 'mapeamento',
  'modelagem': 'investigacao',  // Alias antigo (modelagem = mapeamento)
  'mapeamento': 'investigacao',
  'investigacao': 'priorizacao',
  'priorizacao': 'mapeamento_processos',
  'mapeamento_processos': 'diagnostico',
  'diagnostico': 'execucao',
  'execucao': 'concluido'
};

// Normalização de nomes de fase (database -> interno)
// Suporta aliases antigos para retrocompatibilidade
const PHASE_NORMALIZE: Record<string, string> = {
  'coleta': 'anamnese',  // Alias antigo
  'anamnese': 'anamnese',
  'modelagem': 'mapeamento',  // Alias antigo
  'mapeamento': 'mapeamento',  // Canvas + Cadeia de Valor
  'investigacao': 'investigacao',
  'priorizacao': 'priorizacao',
  'mapeamento_processos': 'mapeamento_processos',  // SIPOC + BPMN
  'diagnostico': 'diagnostico',
  'execucao': 'execucao',
  'concluido': 'concluido'
};

// Mapeamento de progresso por fase
const PHASE_PROGRESS: Record<string, number> = {
  'coleta': 10,  // Alias
  'anamnese': 15,
  'modelagem': 30,  // Alias
  'mapeamento': 30,  // Canvas + Cadeia
  'investigacao': 45,
  'priorizacao': 55,
  'mapeamento_processos': 70,  // SIPOC + BPMN
  'diagnostico': 85,
  'execucao': 100,
  'concluido': 100
};

Deno.serve(async (req: Request) => {
  console.log('[CONSULTOR] 🚀 VERSÃO 2.0 - COM DETECTORES E TIMELINE AUTOMÁTICA');

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

    const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
    const body: RequestBody = await req.json();

    if (!body.sessao_id || !body.message) {
      return new Response(
        JSON.stringify({ error: 'sessao_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONSULTOR] Processing message for session:', body.sessao_id);

    // 1. Buscar sessão
    const { data: sessao, error: sessaoError } = await supabase
      .from('consultor_sessoes')
      .select('*')
      .eq('id', body.sessao_id)
      .maybeSingle();

    if (sessaoError || !sessao) {
      console.error('[CONSULTOR] Session not found:', sessaoError);
      return new Response(
        JSON.stringify({ error: 'Sessão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Detectar fase atual e normalizar nome
    const contexto = sessao.contexto_coleta || {};
    let faseAtual = PHASE_NORMALIZE[sessao.estado_atual || 'anamnese'] || 'anamnese';

    // Verificar se está aguardando validação de escopo
    const aguardandoValidacao = sessao.aguardando_validacao;
    if (aguardandoValidacao === 'escopo') {
      console.log('[CONSULTOR] Waiting for scope validation');
      // Usuário ainda pode conversar para ajustar escopo
      faseAtual = 'priorizacao';
    }

    console.log('[CONSULTOR] Current phase:', faseAtual);

    // 3. Carregar histórico de mensagens
    const { data: historico, error: histError } = await supabase
      .from('consultor_mensagens')
      .select('role, content, created_at')
      .eq('sessao_id', body.sessao_id)
      .order('created_at', { ascending: true });

    if (histError) {
      console.error('[CONSULTOR] Error loading history:', histError);
    }

    const messages = historico || [];
    console.log('[CONSULTOR] Loaded', messages.length, 'previous messages');

    // 4. Buscar knowledge base relevante e adapters de setor
    let kbContext = '';

    // 4.1. Buscar adapter de setor
    if (sessao.setor) {
      const { data: adapter } = await supabase
        .from('adapters_setor')
        .select('kpis, perguntas, metodologias')
        .ilike('setor', `%${sessao.setor}%`)
        .limit(1)
        .maybeSingle();

      if (adapter) {
        kbContext += `\n\nCONTEXTO DO SETOR ${sessao.setor}:\n`;
        kbContext += `KPIs relevantes: ${adapter.kpis?.slice(0, 5).join(', ') || 'N/A'}\n`;
        kbContext += `Metodologias recomendadas: ${adapter.metodologias?.slice(0, 3).join(', ') || 'N/A'}\n`;
      }
    }

    // 4.2. Buscar exemplos de ferramentas na knowledge base para a fase atual
    const ferramentasPorFase: Record<string, string[]> = {
      'mapeamento': ['canvas', 'cadeia de valor', 'value chain'],
      'investigacao': ['ishikawa', '5 porques', 'causa raiz'],
      'priorizacao': ['matriz gut', 'priorizacao', 'matriz de decisao'],
      'mapeamento_processos': ['sipoc', 'bpmn', 'fluxograma', 'processo'],
      'execucao': ['5w2h', 'plano de acao', 'pdca']
    };

    const ferramentas = ferramentasPorFase[faseAtual];
    if (ferramentas && ferramentas.length > 0) {
      try {
        const { data: kbItems } = await supabase
          .from('rag_knowledge_base')
          .select('titulo, conteudo, categoria')
          .in('categoria', ferramentas)
          .limit(3);

        if (kbItems && kbItems.length > 0) {
          kbContext += `\n\nEXEMPLOS DE FERRAMENTAS (Knowledge Base):\n`;
          for (const item of kbItems) {
            kbContext += `\n--- ${item.titulo} ---\n`;
            kbContext += `${item.conteudo.slice(0, 300)}...\n`;
          }
        }
      } catch (e) {
        console.warn('[CONSULTOR] Error fetching knowledge base (non-fatal):', e);
      }
    }

    // 5. Montar contexto já coletado de forma legível
    const contextoStr = Object.entries(contexto)
      .filter(([k]) => !['fase_atual', 'progresso'].includes(k))
      .map(([k, v]) => {
        if (typeof v === 'object') {
          return `  - ${k}: ${JSON.stringify(v, null, 2)}`;
        }
        return `  - ${k}: ${v}`;
      })
      .join('\n');

    const contextoSection = contextoStr
      ? `\n\n═══ CONTEXTO JÁ COLETADO (NÃO PERGUNTE NOVAMENTE) ═══\n${contextoStr}\n═══════════════════════════════════════════════════════\n`
      : '\n\nNenhum dado coletado ainda. Comece pela primeira pergunta.\n';

    // 6. Carregar prompt específico da fase
    const systemPrompt = getSystemPrompt(faseAtual) + contextoSection + kbContext;

    // 7. Construir array de mensagens para LLM
    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Adicionar histórico completo
    for (const msg of messages) {
      if (msg.role !== 'system') {
        llmMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }

    // Adicionar mensagem atual do usuário
    llmMessages.push({
      role: 'user',
      content: body.message
    });

    console.log('[CONSULTOR] Calling LLM with', llmMessages.length, 'messages');

    // 8. Chamar OpenAI com JSON mode forçado
    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: llmMessages,
        temperature: 0.5,
        max_tokens: 2500,
        response_format: { type: 'json_object' }
      })
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('[CONSULTOR] LLM error:', errorText);
      throw new Error(`LLM API error: ${llmResponse.status}`);
    }

    const llmData = await llmResponse.json();
    const fullResponse = llmData?.choices?.[0]?.message?.content || '';

    console.log('[CONSULTOR] LLM response length:', fullResponse.length);
    console.log('[CONSULTOR] LLM response preview:', fullResponse.substring(0, 300));

    // 9. Parser multi-estratégia robusto
    let parsedResponse: any = null;
    let parseStrategy = 'none';

    // Estratégia 1: Parse direto (JSON mode)
    try {
      parsedResponse = JSON.parse(fullResponse);
      parseStrategy = 'direct_json';
      console.log('[CONSULTOR] Strategy 1 (direct JSON) succeeded');
    } catch (e) {
      // Estratégia 2: Buscar por [PARTE B] com JSON
      const parteBMatch = fullResponse.match(/\[PARTE B\]([\s\S]*)/i);
      if (parteBMatch) {
        try {
          const jsonStr = parteBMatch[1].trim().replace(/```json|```/g, '').trim();
          parsedResponse = JSON.parse(jsonStr);
          parseStrategy = 'parte_b_marker';
          console.log('[CONSULTOR] Strategy 2 (PARTE B marker) succeeded');
        } catch (e2) {
          console.warn('[CONSULTOR] Strategy 2 failed:', e2);
        }
      }

      // Estratégia 3: Buscar por objeto JSON com "actions"
      if (!parsedResponse) {
        const jsonMatch = fullResponse.match(/\{[\s\S]*"actions"[\s\S]*\}/i);
        if (jsonMatch) {
          try {
            parsedResponse = JSON.parse(jsonMatch[0]);
            parseStrategy = 'actions_search';
            console.log('[CONSULTOR] Strategy 3 (actions search) succeeded');
          } catch (e3) {
            console.warn('[CONSULTOR] Strategy 3 failed:', e3);
          }
        }
      }

      // Estratégia 4: Extrair último bloco JSON válido
      if (!parsedResponse) {
        const jsonBlocks = fullResponse.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
        if (jsonBlocks && jsonBlocks.length > 0) {
          for (let i = jsonBlocks.length - 1; i >= 0; i--) {
            try {
              const candidate = JSON.parse(jsonBlocks[i]);
              if (candidate.actions || candidate.contexto_incremental) {
                parsedResponse = candidate;
                parseStrategy = 'last_valid_json';
                console.log('[CONSULTOR] Strategy 4 (last valid JSON) succeeded');
                break;
              }
            } catch {}
          }
        }
      }
    }

    // 10. Extrair dados do response parseado
    let responseText = '';
    let contextoIncremental: any = {};
    let actions: any[] = [];
    let progressoAtualizado = PHASE_PROGRESS[faseAtual] || 0;

    if (parsedResponse) {
      responseText = parsedResponse.resposta_usuario || parsedResponse.reply || '';
      contextoIncremental = parsedResponse.contexto_incremental || {};
      actions = parsedResponse.actions || [];
      progressoAtualizado = parsedResponse.progresso || progressoAtualizado;

      // Fallback: se não tem resposta_usuario, extrair PARTE A do texto
      if (!responseText) {
        const parteAMatch = fullResponse.match(/\[PARTE A\]([\s\S]*?)(\[PARTE B\]|$)/i);
        responseText = parteAMatch ? parteAMatch[1].trim() : fullResponse.split(/\{|\[PARTE B\]/)[0].trim();
      }

      console.log('[CONSULTOR] Successfully parsed response:', {
        strategy: parseStrategy,
        textLength: responseText.length,
        contextoKeys: Object.keys(contextoIncremental).length,
        actionsCount: actions.length,
        progresso: progressoAtualizado
      });
    } else {
      // Fallback total: usar response como texto e criar estrutura vazia
      console.error('[CONSULTOR] ALL PARSING STRATEGIES FAILED');
      console.log('[CONSULTOR] Raw response:', fullResponse.substring(0, 500));
      responseText = fullResponse;
      // Aplicar detectores automáticos abaixo
    }

    console.log('[CONSULTOR] Parsed actions:', actions.length);

    // 11. DETECTORES AUTOMÁTICOS DE COMPLETUDE POR FASE
    // Gerar entregáveis e transições automaticamente quando critérios forem atingidos

    const contextData = { ...contexto, ...contextoIncremental };

    // Detector 1: ANAMNESE COMPLETA
    // Roda SEMPRE na fase anamnese, independente de actions
    if (faseAtual === 'anamnese') {
      const requiredFields = ['nome', 'cargo', 'idade', 'formacao', 'empresa', 'segmento', 'faturamento', 'funcionarios', 'dor_principal', 'expectativa'];
      const contextData = { ...contexto, ...contextoIncremental };

      // Check both root level and nested in anamnese object
      const anamneseData = contextData.anamnese || contextData;
      const collectedFields = requiredFields.filter(field => {
        return anamneseData[field] != null || contextData[field] != null;
      });

      console.log('[CONSULTOR] Anamnese completion check:', {
        required: requiredFields.length,
        collected: collectedFields.length,
        fields: collectedFields,
        hasAnamneseNested: !!contextData.anamnese,
        anamneseKeys: Object.keys(anamneseData).length
      });

      // Check if we have enough data to complete anamnese (at least 8 out of 10 fields)
      const hasTransition = actions.some(a => a.type === 'transicao_estado');
      const hasEntregavel = actions.some(a => a.type === 'gerar_entregavel' && a.params?.tipo === 'anamnese_empresarial');

      if (collectedFields.length >= 8 && !hasTransition && !hasEntregavel) {
        console.log('[CONSULTOR] AUTO-DETECTOR: Anamnese completa, forçando transição para mapeamento');
        actions.push(
          {
            type: 'gerar_entregavel',
            params: {
              tipo: 'anamnese_empresarial',
              contexto: { ...anamneseData, ...contextoIncremental }
            }
          },
          {
            type: 'transicao_estado',
            params: { to: 'mapeamento' }
          }
        );
        progressoAtualizado = 30;
      }
    }

    // Detector 2: PRIORIZAÇÃO COMPLETA (Matriz GUT + Escopo)
    // Roda SEMPRE na fase priorizacao, independente de actions
    if (faseAtual === 'priorizacao') {
      const processos = contextData.processos_identificados || contextData.priorizacao?.processos || [];

      // Verificar se todos os processos têm pontuação GUT
      const todosComGUT = processos.length > 0 && processos.every((p: any) =>
        p.gravidade != null && p.urgencia != null && p.tendencia != null
      );

      const hasEscopoAction = actions.some(a => a.type === 'gerar_entregavel' && (a.params?.tipo === 'matriz_priorizacao' || a.params?.tipo === 'escopo'));

      if (todosComGUT && !contextData.escopo_definido && !hasEscopoAction) {
        console.log('[CONSULTOR] AUTO-DETECTOR: Matriz GUT completa, gerando entregáveis');

        // Calcular scores
        const processosComScore = processos.map((p: any) => ({
          ...p,
          score: (p.gravidade || 0) * (p.urgencia || 0) * (p.tendencia || 0)
        })).sort((a: any, b: any) => b.score - a.score);

        // Definir escopo: top 3-5 processos
        const escopo = processosComScore.slice(0, Math.min(5, processosComScore.length));

        actions.push(
          {
            type: 'gerar_entregavel',
            params: {
              tipo: 'matriz_priorizacao',
              contexto: { processos: processosComScore }
            }
          },
          {
            type: 'gerar_entregavel',
            params: {
              tipo: 'escopo',
              contexto: {
                processos_escopo: escopo.map((p: any) => p.nome),
                justificativa: `Selecionados ${escopo.length} processos com maior impacto (scores: ${escopo.map((p: any) => p.score).join(', ')})`
              }
            }
          }
        );

        // Marcar aguardando validação do escopo
        contextoIncremental.escopo_definido = escopo.map((p: any) => p.nome);
        contextoIncremental.aguardando_validacao_escopo = true;
        progressoAtualizado = 55;

        console.log('[CONSULTOR] Escopo definido:', escopo.map((p: any) => p.nome));
      }
    }

    // Detector 3: VALIDAÇÃO DE ESCOPO (usuário aprovou)
    if (faseAtual === 'priorizacao' && aguardandoValidacao === 'escopo') {
      const mensagemLower = body.message.toLowerCase();
      const aprovado = mensagemLower.includes('sim') ||
                       mensagemLower.includes('ok') ||
                       mensagemLower.includes('concordo') ||
                       mensagemLower.includes('perfeito') ||
                       mensagemLower.includes('correto');

      const hasTransition = actions.some(a => a.type === 'transicao_estado');

      if (aprovado && !hasTransition) {
        console.log('[CONSULTOR] AUTO-DETECTOR: Escopo aprovado, transicionando para mapeamento de processos');
        actions.push({
          type: 'transicao_estado',
          params: { to: 'mapeamento_processos' }
        });
        contextoIncremental.escopo_aprovado = true;
        progressoAtualizado = 60;
      }
    }

    // Detector 4: MAPEAMENTO DE PROCESSOS COMPLETO (SIPOC)
    // Roda SEMPRE na fase mapeamento_processos, independente de actions
    if (faseAtual === 'mapeamento_processos') {
      const processosEscopo = contextData.escopo_definido || [];
      const sipocData = contextData.sipoc || {};

      if (processosEscopo.length > 0) {
        const todosComSIPOC = processosEscopo.every((pNome: string) => {
          const sipoc = sipocData[pNome];
          return sipoc && sipoc.suppliers && sipoc.inputs && sipoc.process && sipoc.outputs && sipoc.customers;
        });

        if (todosComSIPOC) {
          console.log('[CONSULTOR] AUTO-DETECTOR: SIPOC completo para todos processos, gerando entregáveis');

          // Gerar entregável para cada processo
          processosEscopo.forEach((pNome: string) => {
            actions.push({
              type: 'gerar_entregavel',
              params: {
                tipo: 'sipoc',
                contexto: {
                  processo_nome: pNome,
                  ...sipocData[pNome]
                }
              }
            });
          });

          // Transicionar para diagnóstico
          actions.push({
            type: 'transicao_estado',
            params: { to: 'diagnostico' }
          });

          progressoAtualizado = 80;
        }
      }
    }

    // Detector 5: VALIDAÇÃO DE TRANSIÇÃO DE FASE
    // Garantir que fluxo correto seja seguido
    const proximaFaseAction = actions.find((a: any) => a.type === 'transicao_estado');
    if (proximaFaseAction) {
      const proximaFaseDesejada = proximaFaseAction.params?.to;
      const proximaFaseEsperada = PHASE_FLOW[faseAtual];

      if (proximaFaseDesejada !== proximaFaseEsperada) {
        console.warn('[CONSULTOR] CORREÇÃO DE FLUXO: Transição inválida detectada');
        console.log(`[CONSULTOR] Desejada: ${faseAtual} → ${proximaFaseDesejada}`);
        console.log(`[CONSULTOR] Corrigindo para: ${faseAtual} → ${proximaFaseEsperada}`);
        proximaFaseAction.params.to = proximaFaseEsperada;
      }
    }

    // 12. Salvar mensagem do usuário no histórico
    await supabase.from('consultor_mensagens').insert({
      sessao_id: body.sessao_id,
      role: 'user',
      content: body.message
    });

    // 13. Salvar resposta do assistente no histórico
    await supabase.from('consultor_mensagens').insert({
      sessao_id: body.sessao_id,
      role: 'assistant',
      content: responseText
    });

    // 14. ATUALIZAR TIMELINE (SEMPRE, EM TODA INTERAÇÃO)
    console.log('[CONSULTOR] Registrando na timeline...');
    const { error: timelineError } = await supabase.from('timeline_consultor').insert({
      sessao_id: body.sessao_id,
      fase: faseAtual,
      evento: `Interação na fase ${faseAtual}`,
      metadata: {
        mensagem_usuario: body.message.substring(0, 100),
        actions_detectadas: actions.length,
        contexto_atualizado: Object.keys(contextoIncremental).length > 0,
        progresso_atual: progressoAtualizado,
        parse_strategy: parseStrategy || 'fallback'
      },
      created_at: new Date().toISOString()
    });

    if (timelineError) {
      console.error('[CONSULTOR] ❌ Erro ao registrar timeline:', timelineError);
    } else {
      console.log('[CONSULTOR] ✅ Timeline registrada com sucesso');
    }

    // 15. Processar actions
    let novaFase = faseAtual;
    let aguardandoValidacaoNova: string | null = aguardandoValidacao;
    const entregaveisGerados: string[] = [];

    for (const action of actions) {
      const actionType = action.type;

      if (actionType === 'gerar_entregavel') {
        // Gerar entregável automaticamente usando templates profissionais
        const tipoEntregavel = action.params?.tipo || 'relatorio';
        const contextoEntregavel = action.params?.contexto || contexto;

        console.log('[CONSULTOR] Generating deliverable:', tipoEntregavel);

        try {
          // Gerar HTML usando template profissional
          const htmlContent = getTemplateForType(tipoEntregavel, {
            ...contextoEntregavel,
            empresa: sessao.setor || contextoEntregavel.empresa || 'Empresa',
            data_geracao: new Date().toLocaleDateString('pt-BR')
          });

          // Salvar diretamente em entregaveis_consultor
          const { data: entregavel } = await supabase
            .from('entregaveis_consultor')
            .insert({
              sessao_id: body.sessao_id,
              nome: tipoEntregavel,
              titulo: `${tipoEntregavel} - ${sessao.setor || 'Consultoria'}`,
              tipo: 'html',
              conteudo_html: htmlContent,
              etapa_origem: faseAtual,
              visualizado: false,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (entregavel) {
            entregaveisGerados.push(entregavel.id);
            console.log('[CONSULTOR] Deliverable saved:', entregavel.id);

            // Registrar na timeline
            await supabase.from('timeline_consultor').insert({
              sessao_id: body.sessao_id,
              fase: faseAtual,
              evento: `Entregável gerado: ${tipoEntregavel}`,
              metadata: {
                entregavel_id: entregavel.id,
                tipo: tipoEntregavel
              },
              created_at: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error('[CONSULTOR] Error generating deliverable:', e);
        }
      }

      if (actionType === 'transicao_estado') {
        // Transição para próxima fase
        const proximaFase = action.params?.to || PHASE_FLOW[faseAtual];
        if (proximaFase) {
          novaFase = proximaFase;
          console.log('[CONSULTOR] Phase transition:', faseAtual, '->', novaFase);

          // Se transicionando para priorizacao, aguardar validação de escopo
          if (novaFase === 'mapeamento_processos') {
            aguardandoValidacaoNova = 'escopo';
            console.log('[CONSULTOR] Waiting for scope validation');
          } else {
            aguardandoValidacaoNova = null;
          }
        }
      }

      if (actionType === 'update_kanban') {
        // Criar cards no Kanban
        const plano = action.params?.plano;
        if (plano?.cards) {
          console.log('[CONSULTOR] Creating Kanban cards:', plano.cards.length);

          for (const card of plano.cards) {
            try {
              // Criar ação em acoes_plano
              const { data: acao } = await supabase
                .from('acoes_plano')
                .insert({
                  sessao_id: body.sessao_id,
                  nome: card.title,
                  descricao: card.description,
                  responsavel: card.assignee,
                  prazo: card.due,
                  status: 'pendente'
                })
                .select()
                .single();

              if (acao) {
                // Criar card no Kanban
                await supabase
                  .from('kanban_cards')
                  .insert({
                    sessao_id: body.sessao_id,
                    acao_id: acao.id,
                    titulo: card.title,
                    descricao: card.description,
                    status: 'a_fazer',
                    prioridade: 'media'
                  });
              }
            } catch (e) {
              console.error('[CONSULTOR] Error creating Kanban card:', e);
            }
          }
        }
      }
    }

    // 14. Atualizar contexto acumulado na sessão (estruturado por fases)
    if (Object.keys(contextoIncremental).length > 0 || novaFase !== faseAtual) {
      // Estruturar contexto por fase
      const novoContexto = {
        ...contexto,
        // Manter estrutura organizada por fase
        [faseAtual]: {
          ...(contexto[faseAtual] || {}),
          ...contextoIncremental
        },
        // Metadados gerais
        fase_atual: novaFase,
        progresso: progressoAtualizado,
        ultima_atualizacao: new Date().toISOString()
      };

      // Se mudou de fase, criar seção vazia para nova fase
      if (novaFase !== faseAtual && !novoContexto[novaFase]) {
        novoContexto[novaFase] = {};
      }

      const { error: updateError } = await supabase
        .from('consultor_sessoes')
        .update({
          contexto_coleta: novoContexto,
          estado_atual: novaFase,
          progresso: progressoAtualizado,
          aguardando_validacao: aguardandoValidacaoNova,
          updated_at: new Date().toISOString()
        })
        .eq('id', body.sessao_id);

      if (updateError) {
        console.error('[CONSULTOR] Failed to update session:', updateError);
      } else {
        console.log('[CONSULTOR] Context updated. New phase:', novaFase);
      }

      // Registrar na timeline se mudou de fase
      if (novaFase !== faseAtual) {
        await supabase
          .from('timeline_consultor')
          .insert({
            sessao_id: body.sessao_id,
            fase: novaFase,
            evento: `Avançou para fase: ${novaFase}`,
            metadata: {
              fase_anterior: faseAtual,
              progresso: progressoAtualizado
            },
            created_at: new Date().toISOString()
          });

        // Atualizar gamificação com XP por conclusão de fase
        try {
          const { data: gamif } = await supabase
            .from('gamificacao_consultor')
            .select('xp_total')
            .eq('sessao_id', body.sessao_id)
            .maybeSingle();

          const xpAtual = gamif?.xp_total || 0;
          const xpFase = PHASE_PROGRESS[faseAtual] || 10;

          await supabase
            .from('gamificacao_consultor')
            .upsert({
              sessao_id: body.sessao_id,
              xp_total: xpAtual + xpFase,
              nivel: Math.floor((xpAtual + xpFase) / 100) + 1,
              ultima_fase_concluida: faseAtual
            }, {
              onConflict: 'sessao_id'
            });

          console.log('[CONSULTOR] XP awarded for phase completion:', xpFase);
        } catch (e) {
          console.warn('[CONSULTOR] Error awarding XP (non-fatal):', e);
        }
      }
    }

    // 15. Retornar resposta
    return new Response(
      JSON.stringify({
        reply: responseText,
        fase: novaFase,
        estado: novaFase,
        progresso: progressoAtualizado,
        aguardando_validacao: aguardandoValidacaoNova,
        entregaveis_gerados: entregaveisGerados.length,
        actions_processadas: actions.length,
        actions: actions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[CONSULTOR] ERROR:', error);
    return new Response(
      JSON.stringify({
        reply: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
