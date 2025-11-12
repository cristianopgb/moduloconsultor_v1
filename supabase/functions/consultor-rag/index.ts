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
import { getTemplateForType } from './deliverable-templates.ts';
import {
  searchRelevantHints,
  formatHintsForPrompt,
  logHintUsage,
  determineABGroup,
  shouldDisplayHints,
  type HintSearchContext
} from './hints-engine.ts';
import {
  validateActionQuality,
  generateReissuePrompt,
  extractTelemetryMetrics,
  type Action
} from './quality-validator.ts';

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
  console.log('[CONSULTOR] 🚀 VERSÃO 2.1 - FIX CANVAS + CADEIA');

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

    // 4. Buscar knowledge base relevante, adapters de setor e hints
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

    // 4.2. Buscar hints semânticos relevantes (NOVO)
    let hintsUsed: Array<{ id: string, score: number }> = [];
    const grupoAB = determineABGroup();
    console.log('[CONSULTOR] A/B Group:', grupoAB.group, 'max hints:', grupoAB.maxHints);

    try {
      // Montar contexto de busca COMPLETO (FIX: extrair de múltiplos locais)
      const hintContext: HintSearchContext = {
        segmento: sessao.setor || contexto.segmento || contexto.anamnese?.segmento || contexto.mapeamento?.segmento,
        dor_principal: contexto.dor_principal || contexto.anamnese?.dor_principal || contexto.mapeamento?.dor_principal,
        achados: [],
        expressoes_usuario: []
      };

      // Adicionar achados do mapeamento se disponíveis
      if (contexto.canvas_proposta_valor) {
        hintContext.achados?.push(contexto.canvas_proposta_valor);
      }

      // Adicionar problemas identificados no canvas/mapeamento
      if (contexto.canvas_dores_ganha_dores) {
        hintContext.achados?.push(contexto.canvas_dores_ganha_dores);
      }

      // Adicionar gaps identificados
      if (contexto.gaps_identificados && Array.isArray(contexto.gaps_identificados)) {
        hintContext.achados?.push(...contexto.gaps_identificados.slice(0, 5));
      }

      // Adicionar processos críticos com suas descrições/problemas
      if (contexto.processos_identificados && Array.isArray(contexto.processos_identificados)) {
        contexto.processos_identificados.slice(0, 3).forEach((p: any) => {
          if (typeof p === 'object') {
            const desc = `${p.nome || p.processo || ''}: ${p.problema || p.descricao || p.gap || ''}`.trim();
            if (desc.length > 5) hintContext.achados?.push(desc);
          } else {
            hintContext.achados?.push(String(p));
          }
        });
      }

      // Adicionar processos primários da cadeia de valor com descrição
      if (contexto.processos_primarios && Array.isArray(contexto.processos_primarios)) {
        contexto.processos_primarios.slice(0, 3).forEach((p: any) => {
          if (typeof p === 'object') {
            const desc = `${p.nome || ''}: ${p.descricao || p.problema || ''}`.trim();
            if (desc.length > 5) hintContext.achados?.push(desc);
          } else {
            hintContext.achados?.push(String(p));
          }
        });
      }

      // Adicionar processos do escopo (priorizados) com scores GUT
      if (contexto.matriz_gut && Array.isArray(contexto.matriz_gut)) {
        contexto.matriz_gut.slice(0, 5).forEach((item: any) => {
          const desc = `${item.processo || ''} (GUT: ${item.score || 0}): ${item.problema || item.descricao || ''}`.trim();
          if (desc.length > 5) hintContext.achados?.push(desc);
        });
      } else if (contexto.escopo_definido && Array.isArray(contexto.escopo_definido)) {
        hintContext.achados?.push(...contexto.escopo_definido.slice(0, 3));
      }

      // NOVO: Adicionar achados de Ishikawa (causas raiz)
      if (contexto.ishikawa_causas && Array.isArray(contexto.ishikawa_causas)) {
        contexto.ishikawa_causas.slice(0, 5).forEach((causa: any) => {
          if (typeof causa === 'object') {
            const desc = `Causa: ${causa.categoria || ''} - ${causa.descricao || causa.causa || ''}`.trim();
            if (desc.length > 10) hintContext.achados?.push(desc);
          } else {
            hintContext.achados?.push(String(causa));
          }
        });
      }

      // NOVO: Adicionar conclusões de 5 Porquês
      if (contexto.cinco_porques_conclusao) {
        hintContext.achados?.push(`Raiz do problema: ${contexto.cinco_porques_conclusao}`);
      }
      if (contexto.cinco_porques && Array.isArray(contexto.cinco_porques)) {
        const ultimoPorque = contexto.cinco_porques[contexto.cinco_porques.length - 1];
        if (ultimoPorque) {
          hintContext.achados?.push(`Causa raiz (5 Porquês): ${ultimoPorque}`);
        }
      }

      // NOVO: Adicionar achados da investigação
      if (contexto.investigacao_achados && Array.isArray(contexto.investigacao_achados)) {
        hintContext.achados?.push(...contexto.investigacao_achados.slice(0, 5));
      }

      // NOVO: Adicionar problemas do diagnóstico
      if (contexto.diagnostico) {
        if (contexto.diagnostico.principais_dores && Array.isArray(contexto.diagnostico.principais_dores)) {
          hintContext.achados?.push(...contexto.diagnostico.principais_dores.slice(0, 3));
        }
        if (contexto.diagnostico.problemas_identificados && Array.isArray(contexto.diagnostico.problemas_identificados)) {
          hintContext.achados?.push(...contexto.diagnostico.problemas_identificados.slice(0, 5));
        }
      }

      // Adicionar últimas mensagens do usuário como expressões
      const ultimasMensagens = messages
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content);
      hintContext.expressoes_usuario = ultimasMensagens;

      // AUDIT LOG: Log do contexto de busca
      console.log('[HINTS-AUDIT] Search context:', {
        segmento: hintContext.segmento,
        dor_principal: hintContext.dor_principal?.substring(0, 50),
        achados_count: hintContext.achados?.length || 0,
        expressoes_count: hintContext.expressoes_usuario?.length || 0
      });

      // Buscar hints (respeitando grupo A/B)
      const hints = await searchRelevantHints(
        supabase,
        body.sessao_id,
        hintContext,
        grupoAB.maxHints
      );

      if (hints && hints.length > 0) {
        console.log('[CONSULTOR] Found', hints.length, 'relevant hints');

        // AUDIT LOG: Hints encontrados
        console.log('[HINTS-AUDIT] Hints found:', hints.map(h => ({
          id: h.id,
          title: h.title,
          score: h.score,
          segmentos: h.segmentos,
          dominios: h.dominios
        })));

        // FIX: Verificar confiança antes de mostrar
        const confidenceCheck = shouldDisplayHints(hints);
        console.log('[HINTS-AUDIT] Confidence check:', confidenceCheck);

        if (confidenceCheck.display) {
          // Formatar para prompt com confiança
          const hintsBlock = formatHintsForPrompt(hints, confidenceCheck.confidence);
          kbContext += hintsBlock;

          // Guardar IDs e scores para telemetria
          hintsUsed = hints.map(h => ({ id: h.id, score: h.score }));

          // AUDIT LOG: Hints sendo injetados no prompt
          console.log('[HINTS-AUDIT] Injecting', hints.length, 'hints into LLM prompt with confidence:', confidenceCheck.confidence);

          // Log inicial de uso (usado_em_acao = false por padrão)
          for (const hint of hints) {
            await logHintUsage(
              supabase,
              body.sessao_id,
              hint.id,
              faseAtual,
              hintContext,
              hint.score,
              grupoAB.group
            );
          }
        } else {
          // AUDIT LOG: Hints descartados por baixa confiança
          console.log('[HINTS-AUDIT] Hints discarded due to low confidence (avg score < 50)');
        }
      } else {
        console.log('[CONSULTOR] No relevant hints found');
        // AUDIT LOG: Nenhum hint encontrado
        console.log('[HINTS-AUDIT] No hints found for context:', {
          has_segmento: !!hintContext.segmento,
          has_dor: !!hintContext.dor_principal,
          achados_count: hintContext.achados?.length || 0
        });
      }
    } catch (hintsError) {
      console.warn('[CONSULTOR] Error fetching hints (non-fatal):', hintsError);
      // Continua sem hints
    }

    // 4.3. Buscar exemplos de ferramentas na knowledge base para a fase atual
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

      console.log('[CONSULTOR] ✅ Successfully parsed response:', {
        strategy: parseStrategy,
        textLength: responseText.length,
        contextoKeys: Object.keys(contextoIncremental).length,
        actionsCount: actions.length,
        progresso: progressoAtualizado
      });
    } else {
      // Fallback total: usar response como texto e criar estrutura vazia
      console.error('[CONSULTOR] ❌ ALL PARSING STRATEGIES FAILED');
      console.log('[CONSULTOR] Raw response:', fullResponse.substring(0, 500));
      responseText = fullResponse;
      console.log('[CONSULTOR] 🤖 Detectores automáticos continuarão funcionando');
    }

    console.log('[CONSULTOR] Parsed actions:', actions.length);

    // 10.5. VALIDAÇÃO DE QUALIDADE E REISSUE AUTOMÁTICO (FASE EXECUÇÃO)
    let reissueCount = 0;
    let qualityMetrics = null;

    if (faseAtual === 'execucao' && actions.length > 0 && actions[0].tipo === '5w2h' && actions[0].contexto?.acoes) {
      const acoes: Action[] = actions[0].contexto.acoes;
      console.log('[CONSULTOR] Validando qualidade de', acoes.length, 'ações...');

      const validation = validateActionQuality(acoes);
      qualityMetrics = extractTelemetryMetrics(validation);

      console.log('[CONSULTOR] Validation result:', {
        isValid: validation.isValid,
        errors: validation.errors.length,
        warnings: validation.warnings.length,
        metrics: validation.metrics
      });

      // Se validação falhar, fazer reissue automático (máximo 2 tentativas)
      const MAX_REISSUES = 2;

      while (!validation.isValid && reissueCount < MAX_REISSUES) {
        reissueCount++;
        console.log(`[CONSULTOR] ⚠️ Qualidade insuficiente. Reissue #${reissueCount}...`);

        // Gerar prompt de correção
        const reissuePrompt = generateReissuePrompt(validation);

        // Adicionar mensagem de reissue ao histórico
        llmMessages.push({
          role: 'assistant',
          content: fullResponse
        });
        llmMessages.push({
          role: 'user',
          content: reissuePrompt
        });

        console.log('[CONSULTOR] Sending reissue prompt...');

        // Fazer nova chamada à LLM
        const reissueResponse = await fetch(llmConfig.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.apiKey}` },
          body: JSON.stringify({
            model: llmConfig.model,
            messages: llmMessages,
            temperature: 0.4,
            max_tokens: 4000
          })
        });

        if (!reissueResponse.ok) {
          console.error('[CONSULTOR] Reissue failed:', await reissueResponse.text());
          break;
        }

        const reissueData = await reissueResponse.json();
        fullResponse = reissueData.choices[0].message.content.trim();

        // Re-parse
        try {
          parsedResponse = JSON.parse(fullResponse);
          if (parsedResponse.actions && parsedResponse.actions[0]?.contexto?.acoes) {
            actions = parsedResponse.actions;
            const novasAcoes: Action[] = actions[0].contexto.acoes;

            // Re-validar
            const newValidation = validateActionQuality(novasAcoes);
            qualityMetrics = extractTelemetryMetrics(newValidation);

            console.log(`[CONSULTOR] Reissue #${reissueCount} validation:`, {
              isValid: newValidation.isValid,
              errors: newValidation.errors.length,
              metrics: newValidation.metrics
            });

            if (newValidation.isValid) {
              console.log('[CONSULTOR] ✅ Reissue successful! Quality improved.');
              break;
            }

            // Atualizar validation para próxima iteração
            Object.assign(validation, newValidation);
          }
        } catch (e) {
          console.error('[CONSULTOR] Reissue parse failed:', e);
          break;
        }
      }

      if (!validation.isValid) {
        console.warn('[CONSULTOR] ⚠️ Max reissues reached. Proceeding with current quality.');
      }
    }

    // 11. DETECTORES AUTOMÁTICOS DE COMPLETUDE POR FASE
    const contextData = { ...contexto, ...contextoIncremental };

    // Detector 1: ANAMNESE COMPLETA (10 campos obrigatórios)
    if (faseAtual === 'anamnese') {
      const requiredFields = ['nome', 'cargo', 'idade', 'formacao', 'empresa', 'segmento', 'faturamento', 'funcionarios', 'dor_principal', 'expectativa_sucesso'];
      const anamneseData = contextData.anamnese || contextData;
      const collectedFields = requiredFields.filter(field => {
        // Verificar múltiplos locais para garantir que o dado foi coletado
        let valor = anamneseData[field] || contextData[field] || contextoIncremental[field];

        // Alias: expectativa_sucesso pode vir como expectativa
        if (field === 'expectativa_sucesso' && !valor) {
          valor = anamneseData['expectativa'] || contextData['expectativa'] || contextoIncremental['expectativa'];
        }

        return valor != null && valor !== '';
      });

      console.log('[CONSULTOR] Anamnese completion check:', {
        required: requiredFields.length,
        collected: collectedFields.length,
        fields: collectedFields
      });

      const hasTransition = actions.some(a => a.type === 'transicao_estado');
      const hasEntregavel = actions.some(a => a.type === 'gerar_entregavel' && a.params?.tipo === 'anamnese_empresarial');

      // CRITICAL: Must have ALL 10 fields
      if (collectedFields.length === 10 && !hasTransition && !hasEntregavel) {
        console.log('[CONSULTOR] AUTO-DETECTOR: Anamnese completa (10/10), forçando transição');

        const anamneseCompleta = {
          nome: anamneseData.nome || contextData.nome,
          cargo: anamneseData.cargo || contextData.cargo,
          idade: anamneseData.idade || contextData.idade,
          formacao: anamneseData.formacao || contextData.formacao,
          empresa: anamneseData.empresa || contextData.empresa,
          segmento: anamneseData.segmento || contextData.segmento,
          faturamento: anamneseData.faturamento || contextData.faturamento,
          funcionarios: anamneseData.funcionarios || contextData.funcionarios,
          dor_principal: anamneseData.dor_principal || contextData.dor_principal || contextoIncremental.dor_principal,
          expectativa_sucesso: anamneseData.expectativa_sucesso || contextData.expectativa_sucesso || contextoIncremental.expectativa_sucesso || anamneseData.expectativa || contextData.expectativa || contextoIncremental.expectativa
        };

        actions.push(
          {
            type: 'gerar_entregavel',
            params: {
              tipo: 'anamnese_empresarial',
              contexto: anamneseCompleta
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

    // Detector 2: MAPEAMENTO COMPLETO (Canvas + Cadeia de Valor)
    if (faseAtual === 'mapeamento') {
      const canvasFields = ['canvas_proposta_valor', 'canvas_segmentos_cliente', 'canvas_canais', 'canvas_relacionamento', 'canvas_receitas', 'canvas_recursos', 'canvas_atividades', 'canvas_parcerias', 'canvas_custos'];
      const canvasCompleto = canvasFields.every(field => contextData[field] || contextoIncremental[field]);

      const processosPrimarios = contextData.processos_primarios || contextoIncremental.processos_primarios || [];
      const processosApoio = contextData.processos_apoio || contextoIncremental.processos_apoio || [];
      const processosGestao = contextData.processos_gestao || contextoIncremental.processos_gestao || [];

      const cadeiaCompleta = processosPrimarios.length > 0 && processosApoio.length > 0 && processosGestao.length > 0;

      console.log('[CONSULTOR] Mapeamento completion check:', {
        canvasCompleto,
        processosPrimarios: processosPrimarios.length,
        processosApoio: processosApoio.length,
        processosGestao: processosGestao.length,
        primarios_sample: processosPrimarios.slice(0, 2),
        apoio_sample: processosApoio.slice(0, 2),
        gestao_sample: processosGestao.slice(0, 2)
      });

      const hasTransition = actions.some(a => a.type === 'transicao_estado');
      const hasCanvasEntregavel = actions.some(a => a.type === 'gerar_entregavel' && a.params?.tipo === 'canvas');
      const hasCadeiaEntregavel = actions.some(a => a.type === 'gerar_entregavel' && a.params?.tipo === 'cadeia_valor');

      if (canvasCompleto && cadeiaCompleta && !hasTransition) {
        console.log('[CONSULTOR] AUTO-DETECTOR: Mapeamento completo, gerando entregáveis');

        // Gerar Canvas
        if (!hasCanvasEntregavel) {
          const canvasData: any = {};
          canvasFields.forEach(field => {
            const key = field.replace('canvas_', '');
            canvasData[key] = contextData[field] || contextoIncremental[field];
          });

          actions.push({
            type: 'gerar_entregavel',
            params: {
              tipo: 'canvas',
              contexto: {
                canvas: canvasData,
                empresa: contextData.empresa || contextData.anamnese?.empresa
              }
            }
          });
        }

        // Gerar Cadeia de Valor
        if (!hasCadeiaEntregavel) {
          actions.push({
            type: 'gerar_entregavel',
            params: {
              tipo: 'cadeia_valor',
              contexto: {
                mapeamento: {
                  processos_primarios: processosPrimarios,
                  processos_apoio: processosApoio,
                  processos_gestao: processosGestao,
                  canvas_proposta_valor: contextData.canvas_proposta_valor || contextoIncremental.canvas_proposta_valor,
                  empresa: contextData.empresa || contextData.anamnese?.empresa
                }
              }
            }
          });
        }

        // Transição para investigação
        actions.push({
          type: 'transicao_estado',
          params: { to: 'investigacao' }
        });

        contextoIncremental.mapeamento_completo = true;
        progressoAtualizado = 45;
      }
    }

    // Detector 3: PRIORIZAÇÃO COMPLETA (Matriz GUT + Escopo)
    let escopoDefinidoAgora = false;
    if (faseAtual === 'priorizacao') {
      const processos = contextData.processos_identificados || contextData.priorizacao?.processos || [];

      const todosComGUT = processos.length > 0 && processos.every((p: any) =>
        p.gravidade != null && p.urgencia != null && p.tendencia != null
      );

      const hasEscopoAction = actions.some(a => a.type === 'gerar_entregavel' && (a.params?.tipo === 'matriz_priorizacao' || a.params?.tipo === 'escopo'));

      if (todosComGUT && !contextData.escopo_definido && !hasEscopoAction) {
        console.log('[CONSULTOR] AUTO-DETECTOR: Matriz GUT completa, gerando entregáveis');

        const processosComScore = processos.map((p: any) => ({
          ...p,
          score: (p.gravidade || 0) * (p.urgencia || 0) * (p.tendencia || 0)
        })).sort((a: any, b: any) => b.score - a.score);

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
                justificativa: `Selecionados ${escopo.length} processos com maior impacto`
              }
            }
          }
        );

        contextoIncremental.escopo_definido = escopo.map((p: any) => p.nome);
        contextoIncremental.aguardando_validacao_escopo = true;
        escopoDefinidoAgora = true;
        progressoAtualizado = 55;
      }
    }

    // Detector 3: VALIDAÇÃO DE ESCOPO (usuário aprovou)
    if (faseAtual === 'priorizacao' && aguardandoValidacao === 'escopo') {
      const mensagemLower = body.message.toLowerCase().trim();

      // Lista expandida de termos de aprovação
      const termosAprovacao = [
        'sim', 'ok', 'okay', 'yes',
        'concordo', 'perfeito', 'certo', 'correto',
        'bora', 'vamos', 'pode', 'seguir',
        'aprovado', 'aprovar', 'confirmo',
        'beleza', 'show', 'tranquilo', 'legal',
        'tudo bem', 'tá bom', 'está bom',
        'vamos lá', 'pode seguir', 'vamos seguir',
        'pode ir', 'pode continuar', 'continuar',
        'avançar', 'próximo', 'próxima',
        'positivo', 'afirmativo'
      ];

      const aprovado = termosAprovacao.some(termo => mensagemLower.includes(termo));

      // Também detectar mensagens muito curtas como aprovação
      const mensagemCurta = mensagemLower.length < 15 && !mensagemLower.includes('não') && !mensagemLower.includes('nao');

      const hasTransition = actions.some(a => a.type === 'transicao_estado');

      if ((aprovado || mensagemCurta) && !hasTransition) {
        console.log('[CONSULTOR] ✅ AUTO-DETECTOR: Escopo aprovado!');
        actions.push({
          type: 'transicao_estado',
          params: { to: 'mapeamento_processos' }
        });
        contextoIncremental.escopo_aprovado = true;
        progressoAtualizado = 60;
      }
    }

    // Detector 4: MAPEAMENTO DE PROCESSOS COMPLETO
    if (faseAtual === 'mapeamento_processos') {
      const processosEscopo = contextData.escopo_definido || [];
      const sipocData = contextData.sipoc || {};

      if (processosEscopo.length > 0) {
        const todosComSIPOC = processosEscopo.every((pNome: string) => {
          const sipoc = sipocData[pNome];
          return sipoc && sipoc.suppliers && sipoc.inputs && sipoc.process && sipoc.outputs && sipoc.customers;
        });

        if (todosComSIPOC) {
          console.log('[CONSULTOR] AUTO-DETECTOR: SIPOC completo');

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

          actions.push({
            type: 'transicao_estado',
            params: { to: 'diagnostico' }
          });

          progressoAtualizado = 80;
        }
      }
    }

    // Detector 5: EXECUÇÃO COMPLETA (5W2H + Kanban)
    if (faseAtual === 'execucao') {
      const has5W2H = actions.some(a => a.type === 'gerar_entregavel' && a.params?.tipo === '5w2h');
      const hasKanban = actions.some(a => a.type === 'update_kanban');

      // Se tem 5W2H mas não tem Kanban, extrair ações e criar Kanban automaticamente
      if (has5W2H && !hasKanban) {
        console.log('[CONSULTOR] AUTO-DETECTOR: 5W2H gerado sem Kanban, criando cards automaticamente');

        const action5W2H = actions.find(a => a.type === 'gerar_entregavel' && a.params?.tipo === '5w2h');
        const contexto5W2H = action5W2H?.params?.contexto || {};

        // Extrair ações do contexto 5W2H
        const acoes5W2H = contexto5W2H.acoes || [];

        if (acoes5W2H.length > 0) {
          const kanbanCards = acoes5W2H.map((acao: any) => ({
            title: acao.what || acao.o_que || 'Ação sem título',
            description: `${acao.why || acao.por_que || ''}\n\n**Como:** ${acao.how || acao.como || ''}\n**Onde:** ${acao.where || acao.onde || ''}\n**Custo:** ${acao.how_much || acao.quanto || 'N/A'}`,
            assignee: acao.who || acao.quem || 'Não definido',
            due: acao.when || acao.quando || '+30d'
          }));

          console.log('[CONSULTOR] Criando', kanbanCards.length, 'cards automaticamente');

          actions.push({
            type: 'update_kanban',
            params: {
              plano: {
                cards: kanbanCards
              }
            }
          });
        } else {
          console.warn('[CONSULTOR] 5W2H sem ações definidas, não é possível criar Kanban');
        }
      }
    }

    // Detector 6: VALIDAÇÃO DE TRANSIÇÃO
    const proximaFaseAction = actions.find((a: any) => a.type === 'transicao_estado');
    if (proximaFaseAction) {
      const proximaFaseDesejada = proximaFaseAction.params?.to;
      const proximaFaseEsperada = PHASE_FLOW[faseAtual];

      if (proximaFaseDesejada !== proximaFaseEsperada) {
        console.warn('[CONSULTOR] CORREÇÃO: Transição inválida');
        proximaFaseAction.params.to = proximaFaseEsperada;
      }
    }

    // 12. Salvar mensagens
    await supabase.from('consultor_mensagens').insert({
      sessao_id: body.sessao_id,
      role: 'user',
      content: body.message
    });

    await supabase.from('consultor_mensagens').insert({
      sessao_id: body.sessao_id,
      role: 'assistant',
      content: responseText
    });

    // 12.5. ATUALIZAR TELEMETRIA COM MÉTRICAS DE QUALIDADE
    if (qualityMetrics && hintsUsed.length > 0) {
      console.log('[CONSULTOR] Updating hints telemetry with quality metrics...');

      // AUDIT LOG: Métricas de qualidade detectadas
      console.log('[HINTS-AUDIT] Quality metrics detected:', qualityMetrics);

      for (const hint of hintsUsed) {
        try {
          // Atualizar registro existente com métricas (FIX: usado_em_acao = true)
          const { data: updated, error: updateError } = await supabase
            .from('proceda_hints_telemetry')
            .update({
              usado_em_acao: true,
              acao_density: qualityMetrics.acao_density,
              how_depth_avg: qualityMetrics.how_depth_avg,
              kpis_count: qualityMetrics.kpis_count,
              reissue_count: reissueCount
            })
            .eq('hint_id', hint.id)
            .eq('sessao_id', body.sessao_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .select();

          if (updateError) {
            console.warn('[HINTS-AUDIT] Telemetry update error:', updateError);
          } else {
            // AUDIT LOG: Telemetria atualizada com sucesso
            console.log('[HINTS-AUDIT] Telemetry updated for hint:', hint.id, 'usado_em_acao = true');
          }
        } catch (telemetryError) {
          console.warn('[CONSULTOR] Error updating telemetry (non-fatal):', telemetryError);
        }
      }

      console.log('[CONSULTOR] Telemetry updated with metrics:', qualityMetrics);
    } else if (hintsUsed.length > 0 && !qualityMetrics) {
      // AUDIT LOG: Hints usados mas sem métricas (não é fase de execução)
      console.log('[HINTS-AUDIT] Hints used but no quality metrics (phase:', faseAtual, ')');
    }

    // 13. ATUALIZAR TIMELINE
    console.log('[CONSULTOR] Registrando na timeline...');
    await supabase.from('timeline_consultor').insert({
      jornada_id: sessao.jornada_id,
      sessao_id: body.sessao_id,
      fase: faseAtual,
      tipo_evento: `Interação na fase ${faseAtual}`,
      detalhe: {
        mensagem_usuario: body.message.substring(0, 100),
        actions_detectadas: actions.length,
        progresso_atual: progressoAtualizado
      }
    });

    // 14. Processar actions
    let novaFase = faseAtual;
    let aguardandoValidacaoNova: string | null = aguardandoValidacao;
    const entregaveisGerados: string[] = [];
    const dadosExtraidosActions: any = {};  // Acumular dados dos actions

    for (const action of actions) {
      const actionType = action.type;

      if (actionType === 'gerar_entregavel') {
        const tipoEntregavel = action.params?.tipo || 'relatorio';
        const contextoEspecifico = action.params?.contexto || {};

        // CRÍTICO: Salvar dados do action no contexto acumulado
        if (Object.keys(contextoEspecifico).length > 0) {
          console.log('[CONSULTOR] Extracting data from action:', tipoEntregavel, Object.keys(contextoEspecifico));

          // Salvar baseado no tipo de entregável
          if (tipoEntregavel === '5w2h' || tipoEntregavel === 'plano_acao') {
            dadosExtraidosActions.plano_acao = contextoEspecifico;
            if (contextoEspecifico.acoes) {
              dadosExtraidosActions.acoes = contextoEspecifico.acoes;
            }
          } else if (tipoEntregavel === 'matriz_priorizacao' || tipoEntregavel === 'escopo') {
            if (!dadosExtraidosActions.priorizacao) dadosExtraidosActions.priorizacao = {};
            Object.assign(dadosExtraidosActions.priorizacao, contextoEspecifico);
          } else if (tipoEntregavel === 'diagnostico_executivo' || tipoEntregavel === 'diagnostico') {
            dadosExtraidosActions.diagnostico = contextoEspecifico;
          }
        }

        console.log('[CONSULTOR] Generating deliverable:', tipoEntregavel);

        // VALIDAÇÃO CRÍTICA: BPMN requer SIPOC com passos do processo
        if (tipoEntregavel === 'bpmn' || tipoEntregavel === 'bpmn_as_is' || tipoEntregavel === 'bpmn_to_be') {
          const sipocData = contextoEspecifico.sipoc || contextData.sipoc || contexto.sipoc;
          let processSteps = sipocData?.process_steps || sipocData?.process || [];

          // Fallback: verificar se process_steps está no nível raiz do contexto
          if ((!processSteps || processSteps.length < 3) && contextoEspecifico.process_steps) {
            processSteps = contextoEspecifico.process_steps;
            console.log('[CONSULTOR] Found process_steps at root level of contextoEspecifico');
          }

          // Fallback: verificar se etapas está presente (alias antigo)
          if ((!processSteps || processSteps.length < 3) && contextoEspecifico.etapas) {
            processSteps = contextoEspecifico.etapas;
            console.log('[CONSULTOR] Found etapas at root level (using as process_steps)');
          }

          if (!processSteps || processSteps.length < 3) {
            console.error('[CONSULTOR] ❌ BPMN validation failed: Missing SIPOC process steps');
            console.error('[CONSULTOR] SIPOC data:', JSON.stringify(sipocData, null, 2));
            console.error('[CONSULTOR] contextoEspecifico keys:', Object.keys(contextoEspecifico));
            console.error('[CONSULTOR] Skipping BPMN generation - LLM must provide sipoc.process_steps array with at least 3 steps');
            continue; // Pular este action e não gerar BPMN inválido
          }

          // Se encontrou process_steps em outro local, injetar no sipocData para o template
          if (sipocData && !sipocData.process_steps) {
            sipocData.process_steps = processSteps;
            console.log('[CONSULTOR] Injected process_steps into sipocData for template');
          }

          console.log('[CONSULTOR] ✅ BPMN validation passed:', processSteps.length, 'steps found');
        }

        // VALIDAÇÃO: Canvas requer pelo menos 7 dos 9 campos preenchidos
        if (tipoEntregavel === 'canvas' || tipoEntregavel === 'canvas_model') {
          const canvasFields = ['canvas_proposta_valor', 'canvas_segmentos_cliente', 'canvas_canais', 'canvas_relacionamento', 'canvas_receitas', 'canvas_recursos', 'canvas_atividades', 'canvas_custos'];
          const filledFields = canvasFields.filter(field => {
            const value = contextoEspecifico[field] || contextData[field] || contexto[field] || contextoEspecifico.mapeamento?.[field] || contextData.mapeamento?.[field];
            return value && value !== 'N/A' && value !== 'Não especificado' && String(value).trim().length > 0;
          });

          console.log('[CONSULTOR] Canvas validation:', filledFields.length, '/', canvasFields.length, 'fields filled');
          if (filledFields.length < 7) {
            console.warn('[CONSULTOR] ⚠️ Canvas has only', filledFields.length, 'fields filled. Missing:', canvasFields.filter(f => !filledFields.includes(f)));
          }
        }

        // CRÍTICO: Mesclar contexto completo (todo contexto acumulado + contexto específico do action)
        const contextoCompleto = {
          ...contexto,  // Contexto base da sessão
          ...contextData,  // Contexto atual com incrementais
          ...contextoEspecifico,  // Contexto específico deste entregável
          // Garantir que mapeamento está disponível para Canvas e Cadeia
          mapeamento: {
            ...(contexto.mapeamento || {}),
            ...(contextData.mapeamento || {}),
            ...(contextoEspecifico.mapeamento || {})
          },
          anamnese: {
            ...(contexto.anamnese || {}),
            ...(contextData.anamnese || {}),
            ...(contextoEspecifico.anamnese || {}),
            // CRÍTICO: Se LLM enviar campos direto (sem wrapper anamnese), incluir também
            ...(tipoEntregavel === 'anamnese_empresarial' ? {
              nome: contextoEspecifico.nome || contextoEspecifico.anamnese?.nome,
              cargo: contextoEspecifico.cargo || contextoEspecifico.anamnese?.cargo,
              idade: contextoEspecifico.idade || contextoEspecifico.anamnese?.idade,
              formacao: contextoEspecifico.formacao || contextoEspecifico.anamnese?.formacao,
              empresa: contextoEspecifico.empresa || contextoEspecifico.anamnese?.empresa,
              segmento: contextoEspecifico.segmento || contextoEspecifico.anamnese?.segmento,
              faturamento: contextoEspecifico.faturamento || contextoEspecifico.anamnese?.faturamento,
              funcionarios: contextoEspecifico.funcionarios || contextoEspecifico.anamnese?.funcionarios,
              dor_principal: contextoEspecifico.dor_principal || contextoEspecifico.anamnese?.dor_principal,
              expectativa_sucesso: contextoEspecifico.expectativa_sucesso || contextoEspecifico.expectativa || contextoEspecifico.anamnese?.expectativa_sucesso || contextoEspecifico.anamnese?.expectativa
            } : {})
          }
        };

        console.log('[CONSULTOR] Context keys for template:', Object.keys(contextoCompleto));
        console.log('[CONSULTOR] DEBUG - Anamnese fields:', {
          expectativa_sucesso: contextoCompleto.anamnese?.expectativa_sucesso,
          dor_principal: contextoCompleto.anamnese?.dor_principal,
          from_contextoEspecifico: contextoEspecifico.expectativa_sucesso,
          from_wrapper: contextoEspecifico.anamnese?.expectativa_sucesso
        });

        try {
          // CRÍTICO: empresa é EMPRESA, setor é SETOR (não usar setor como fallback de empresa)
          const contextoFinal = {
            ...contextoCompleto,
            empresa: contextoCompleto.empresa || contextoCompleto.anamnese?.empresa || 'Empresa',
            setor: sessao.setor || contextoCompleto.setor || contextoCompleto.anamnese?.segmento,
            data_geracao: new Date().toLocaleDateString('pt-BR')
          };

          // Padronizar campo expectativa (unificar expectativa_sucesso ↔ expectativa em ambas direções)
          if (contextoFinal.anamnese) {
            // Se tem expectativa_sucesso mas não tem expectativa
            if (contextoFinal.anamnese.expectativa_sucesso && !contextoFinal.anamnese.expectativa) {
              contextoFinal.anamnese.expectativa = contextoFinal.anamnese.expectativa_sucesso;
            }
            // Se tem expectativa mas não tem expectativa_sucesso
            if (contextoFinal.anamnese.expectativa && !contextoFinal.anamnese.expectativa_sucesso) {
              contextoFinal.anamnese.expectativa_sucesso = contextoFinal.anamnese.expectativa;
            }
            // Garantir no nível raiz também
            if (!contextoFinal.expectativa && contextoFinal.anamnese.expectativa) {
              contextoFinal.expectativa = contextoFinal.anamnese.expectativa;
            }
            if (!contextoFinal.expectativa_sucesso && contextoFinal.anamnese.expectativa_sucesso) {
              contextoFinal.expectativa_sucesso = contextoFinal.anamnese.expectativa_sucesso;
            }
          }
          // Se estiver no nível raiz mas não no anamnese
          if (contextoFinal.expectativa_sucesso && !contextoFinal.expectativa) {
            contextoFinal.expectativa = contextoFinal.expectativa_sucesso;
          }
          if (contextoFinal.expectativa && !contextoFinal.expectativa_sucesso) {
            contextoFinal.expectativa_sucesso = contextoFinal.expectativa;
          }

          // Preferir HTML gerado pela LLM (se estiver presente no parsedResponse) antes de usar template mock
          let htmlContent: string | null = null;

          try {
            // 1) parsedResponse may include explicit fields for deliverable HTML
            if (parsedResponse && (parsedResponse.entregavel_html || parsedResponse.html || (parsedResponse.entregavel && parsedResponse.entregavel.html))) {
              htmlContent = parsedResponse.entregavel_html || parsedResponse.html || parsedResponse.entregavel.html;
              console.log('[CONSULTOR] Using HTML from parsed LLM response for deliverable');
            }

            // 2) fallback: if the responseText itself *looks like* full HTML, use it
            if (!htmlContent && responseText && /<!doctype|<html|^\s*<\w+/i.test(responseText)) {
              htmlContent = responseText;
              console.log('[CONSULTOR] Using responseText as HTML deliverable (detected HTML in LLM reply)');
            }
          } catch (e) {
            console.warn('[CONSULTOR] Error while checking LLM-derived HTML for deliverable:', e);
            htmlContent = null;
          }

          // 3) Se ainda não tivermos HTML gerado pela LLM, gerar via templates locais (mock/procedural)
          if (!htmlContent) {
            htmlContent = getTemplateForType(tipoEntregavel, contextoFinal);
            console.log('[CONSULTOR] Using local template for deliverable (fallback)');
          }

          const { data: entregavel } = await supabase
            .from('entregaveis_consultor')
            .insert({
              sessao_id: body.sessao_id,
              jornada_id: sessao.jornada_id,
              nome: tipoEntregavel,
              titulo: `${tipoEntregavel} - ${sessao.setor || 'Consultoria'}`,
              tipo: tipoEntregavel,
              html_conteudo: htmlContent,
              etapa_origem: faseAtual,
              visualizado: false
            })
            .select()
            .single();

          if (entregavel) {
            entregaveisGerados.push(entregavel.id);
            console.log('[CONSULTOR] Deliverable saved:', entregavel.id);

            await supabase.from('timeline_consultor').insert({
              jornada_id: sessao.jornada_id,
              sessao_id: body.sessao_id,
              fase: faseAtual,
              tipo_evento: `Entregável gerado: ${tipoEntregavel}`,
              detalhe: {
                entregavel_id: entregavel.id,
                tipo: tipoEntregavel
              }
            });
          }
        } catch (e) {
          console.error('[CONSULTOR] Error generating deliverable:', e);
        }
      }

      if (actionType === 'transicao_estado') {
        const proximaFase = action.params?.to || PHASE_FLOW[faseAtual];
        if (proximaFase) {
          novaFase = proximaFase;
          console.log('[CONSULTOR] Phase transition:', faseAtual, '->', novaFase);

          // CRÍTICO: Limpar flag de validação ao transicionar
          aguardandoValidacaoNova = null;
        }
      }

      if (actionType === 'update_kanban') {
        const params = action.params || {};

        console.log('[CONSULTOR] 📋 Processing update_kanban action');
        console.log('[CONSULTOR] Params structure keys:', Object.keys(params));
        console.log('[CONSULTOR] Full params:', JSON.stringify(params, null, 2));

        // Normalizar estrutura - aceitar múltiplas variações
        let cards = [];

        if (params.plano?.cards) {
          console.log('[CONSULTOR] ✅ Found plano.cards structure');
          cards = params.plano.cards;
        } else if (params.cards) {
          console.log('[CONSULTOR] ✅ Found direct cards structure');
          cards = params.cards;
        } else if (params.etapas) {
          console.log('[CONSULTOR] ⚠️ Found etapas structure, converting to cards');
          cards = params.etapas.map((etapa: any) => ({
            title: etapa.nome || etapa.title || 'Ação sem título',
            description: etapa.descricao || etapa.description || 'Sem descrição',
            assignee: etapa.responsavel || etapa.assignee || 'Não definido',
            due: etapa.prazo || etapa.due || '+30d'
          }));
        } else if (params.acoes) {
          console.log('[CONSULTOR] ⚠️ Found acoes structure, converting to cards');
          cards = params.acoes.map((acao: any) => ({
            title: acao.what || acao.o_que || 'Ação sem título',
            description: `${acao.why || acao.por_que || ''}\n\n**Como:** ${acao.how || acao.como || ''}\n**Onde:** ${acao.where || acao.onde || ''}\n**Custo:** ${acao.how_much || acao.quanto || 'N/A'}`,
            assignee: acao.who || acao.quem || 'Não definido',
            due: acao.when || acao.quando || '+30d'
          }));
        }

        if (cards.length === 0) {
          console.error('[CONSULTOR] ❌ No valid cards found in update_kanban action');
          console.error('[CONSULTOR] Params received:', JSON.stringify(params, null, 2));
        } else {
          console.log('[CONSULTOR] ✅ Processing', cards.length, 'Kanban cards (before deduplication)');

          // DEDUPLICAÇÃO LOCAL: Remover duplicatas dentro do próprio array de cards
          const uniqueCards: any[] = [];
          const seenTitles = new Set<string>();

          for (const card of cards) {
            if (!card.title) continue;

            // Normalizar título para comparação (lowercase, sem espaços extras, sem pontuação)
            const normalizedTitle = card.title
              .toLowerCase()
              .trim()
              .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
              .replace(/\s+/g, ' ');

            if (!seenTitles.has(normalizedTitle)) {
              seenTitles.add(normalizedTitle);
              uniqueCards.push(card);
            } else {
              console.warn('[CONSULTOR] ⚠️ Duplicate card detected in array, skipping:', card.title);
            }
          }

          console.log('[CONSULTOR] ✅ After local deduplication:', uniqueCards.length, 'unique cards');

          for (const card of uniqueCards) {
            try {
              console.log('[CONSULTOR] Processing card:', card.title);

              // Normalizar título para comparação com banco
              const normalizedTitle = card.title
                .toLowerCase()
                .trim()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                .replace(/\s+/g, ' ');

              // VERIFICAÇÃO DE DUPLICATA NO BANCO: Buscar cards existentes e fazer matching fuzzy
              const { data: existingCards } = await supabase
                .from('kanban_cards')
                .select('id, titulo')
                .eq('sessao_id', body.sessao_id);

              let isDuplicate = false;
              if (existingCards && existingCards.length > 0) {
                for (const existing of existingCards) {
                  const existingNormalized = existing.titulo
                    .toLowerCase()
                    .trim()
                    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
                    .replace(/\s+/g, ' ');

                  // Comparação exata após normalização
                  if (existingNormalized === normalizedTitle) {
                    console.warn('[CONSULTOR] ⚠️ Exact match found in database, skipping:', card.title);
                    isDuplicate = true;
                    break;
                  }

                  // Comparação de similaridade (pelo menos 80% das palavras em comum)
                  const titleWords = normalizedTitle.split(' ');
                  const existingWords = existingNormalized.split(' ');
                  const commonWords = titleWords.filter(w => existingWords.includes(w));
                  const similarity = commonWords.length / Math.max(titleWords.length, existingWords.length);

                  if (similarity >= 0.8) {
                    console.warn('[CONSULTOR] ⚠️ Similar card found (similarity:', Math.round(similarity * 100) + '%), skipping:', card.title, '(similar to:', existing.titulo + ')');
                    isDuplicate = true;
                    break;
                  }
                }
              }

              if (isDuplicate) {
                continue;
              }

              console.log('[CONSULTOR] Creating new card:', card.title);

              // Criar ação em acoes_plano
              const { data: acao, error: acaoError } = await supabase
                .from('acoes_plano')
                .insert({
                  sessao_id: body.sessao_id,
                  area_id: null,
                  what: card.title,
                  why: card.description || '',
                  where_field: 'Empresa',
                  who: card.assignee || 'Não definido',
                  how: card.description || '',
                  how_much: 'A definir',
                  status: 'a_fazer',
                  prioridade: 'media'
                })
                .select()
                .single();

              if (acaoError) {
                console.error('[CONSULTOR] ❌ Error inserting into acoes_plano:', acaoError);
                console.error('[CONSULTOR] Card data:', card);
                continue;
              }

              console.log('[CONSULTOR] ✅ Created acao_plano:', acao.id);

              if (acao) {
                // Criar card no Kanban
                const { error: cardError } = await supabase
                  .from('kanban_cards')
                  .insert({
                    sessao_id: body.sessao_id,
                    jornada_id: sessao.jornada_id,
                    area_id: null,
                    titulo: card.title,
                    descricao: card.description || '',
                    responsavel: card.assignee || 'Não definido',
                    prazo: card.due || '+30d',
                    status: 'todo',
                    ordem: 0,
                    dados_5w2h: {
                      o_que: card.title,
                      por_que: card.description || '',
                      quem: card.assignee || '',
                      quando: card.due || '',
                      onde: 'Empresa',
                      como: card.description || '',
                      quanto: 'A definir'
                    }
                  });

                if (cardError) {
                  console.error('[CONSULTOR] ❌ Error inserting into kanban_cards:', cardError);
                  console.error('[CONSULTOR] Card data:', card);
                } else {
                  console.log('[CONSULTOR] ✅ Created kanban_card:', card.title);
                }
              }
            } catch (e) {
              console.error('[CONSULTOR] ❌ Exception creating Kanban card:', e);
              console.error('[CONSULTOR] Card data:', card);
            }
          }

          console.log('[CONSULTOR] ✅ Kanban update completed');
        }
      }
    }

    // 15. Atualizar contexto
    const temDadosParaSalvar = Object.keys(contextoIncremental).length > 0 ||
                               Object.keys(dadosExtraidosActions).length > 0 ||
                               novaFase !== faseAtual ||
                               escopoDefinidoAgora;

    if (temDadosParaSalvar) {
      console.log('[CONSULTOR] Saving context. Extracted from actions:', Object.keys(dadosExtraidosActions));

      const novoContexto = {
        ...contexto,
        [faseAtual]: {
          ...(contexto[faseAtual] || {}),
          ...contextoIncremental,
          ...dadosExtraidosActions  // CRÍTICO: Incluir dados extraídos dos actions
        },
        fase_atual: novaFase,
        progresso: progressoAtualizado,
        ultima_atualizacao: new Date().toISOString()
      };

      if (novaFase !== faseAtual && !novoContexto[novaFase]) {
        novoContexto[novaFase] = {};
      }

      let finalAguardandoValidacao = aguardandoValidacaoNova;
      if (escopoDefinidoAgora) {
        finalAguardandoValidacao = 'escopo';
      }

      await supabase
        .from('consultor_sessoes')
        .update({
          contexto_coleta: novoContexto,
          estado_atual: novaFase,
          progresso: progressoAtualizado,
          aguardando_validacao: finalAguardandoValidacao,
          updated_at: new Date().toISOString()
        })
        .eq('id', body.sessao_id);

      console.log('[CONSULTOR] ✅ Context updated. New phase:', novaFase);

      if (novaFase !== faseAtual) {
        await supabase
          .from('timeline_consultor')
          .insert({
            jornada_id: sessao.jornada_id,
            sessao_id: body.sessao_id,
            fase: novaFase,
            tipo_evento: `Avançou para fase: ${novaFase}`,
            detalhe: {
              fase_anterior: faseAtual,
              progresso: progressoAtualizado
            }
          });

        // Gamificação
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

          console.log('[CONSULTOR] XP awarded:', xpFase);
        } catch (e) {
          console.warn('[CONSULTOR] Error awarding XP:', e);
        }
      }
    }

    // 16. Retornar resposta
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
