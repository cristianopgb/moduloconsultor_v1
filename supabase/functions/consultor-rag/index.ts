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
import {
  searchRelevantHints,
  formatHintsForPrompt,
  logHintUsage,
  determineABGroup
} from './hints-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

// ====== CONFIG DE QUALIDADE (anti-genérico) ======
const MIN_ACTIONS = 4;                // mínimo de ações na saída
const MIN_5W2H_STEPS = 7;             // mínimo de passos HOW em cada ação 5W2H
const MAX_FIX_ATTEMPTS = 1;           // 1 reemissão automática
const MAX_TOKENS = 2500;              // teto safety

// Fluxo correto: anamnese → mapeamento → investigacao → priorizacao → mapeamento_processos → diagnostico → execucao → concluido
const PHASE_FLOW: Record<string, keyof typeof PHASE_PROGRESS> = {
  coleta: 'mapeamento',
  anamnese: 'mapeamento',
  modelagem: 'investigacao',
  mapeamento: 'investigacao',
  investigacao: 'priorizacao',
  priorizacao: 'mapeamento_processos',
  mapeamento_processos: 'diagnostico',
  diagnostico: 'execucao',
  execucao: 'concluido'
};

// Normalização de nomes de fase (database -> interno) com retrocompatibilidade
const PHASE_NORMALIZE: Record<string, keyof typeof PHASE_PROGRESS> = {
  coleta: 'anamnese',
  anamnese: 'anamnese',
  modelagem: 'mapeamento',
  mapeamento: 'mapeamento',
  investigacao: 'investigacao',
  priorizacao: 'priorizacao',
  mapeamento_processos: 'mapeamento_processos',
  diagnostico: 'diagnostico',
  execucao: 'execucao',
  concluido: 'concluido'
};

// Progresso por fase
const PHASE_PROGRESS = {
  coleta: 10,
  anamnese: 15,
  modelagem: 30,
  mapeamento: 30,
  investigacao: 45,
  priorizacao: 55,
  mapeamento_processos: 70,
  diagnostico: 85,
  execucao: 100,
  concluido: 100
} as const;

// Util: remove duplicatas por string hash
function uniqBy<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

// Valida qualidade do bloco de ações
function assessActionQuality(parsed: any) {
  const actions: any[] = Array.isArray(parsed?.actions) ? parsed.actions : [];
  const count = actions.length;

  // heurística de 5W2H: se existir entregável 5w2h, cada ação deve conter what/why/how/who/when
  let weak5w2h = false;
  const five = ['what', 'o_que', 'why', 'por_que', 'how', 'como', 'who', 'quem', 'when', 'quando'];
  const has5w2hDeliverable = actions.some(a => a?.type === 'gerar_entregavel' && (a.params?.tipo === '5w2h' || a.params?.tipo === 'plano_acao'));

  if (has5w2hDeliverable) {
    const ctx = actions.find(a => a?.type === 'gerar_entregavel' && (a.params?.tipo === '5w2h' || a.params?.tipo === 'plano_acao'))?.params?.contexto || {};
    const acoes = Array.isArray(ctx?.acoes) ? ctx.acoes : [];
    if (acoes.length < MIN_ACTIONS) weak5w2h = true;
    for (const ac of acoes) {
      const keys = Object.keys(ac || {});
      const hasCore = five.some(f => keys.includes(f));
      const howText = (ac.how || ac.como || '') as string;
      if (!hasCore || (howText.split(/\s+/).filter(Boolean).length < MIN_5W2H_STEPS)) {
        weak5w2h = true;
        break;
      }
    }
  }

  const ok = count >= MIN_ACTIONS && !weak5w2h;
  return { ok, has5w2hDeliverable, weak5w2h, actionCount: count };
}

// Gera um prompt de correção (fix) para reemissão automática
function buildFixPrompt(fullResponse: string, faseAtual: string) {
  return [
    {
      role: 'system',
      content:
        `Você é um verificador de qualidade do PROCEDA. Reescreva a resposta em JSON ESTRITO, melhorando a completude:\n` +
        `- Inclua no mínimo ${MIN_ACTIONS} ações no total.\n` +
        `- Se houver 5W2H, cada ação deve trazer HOW com pelo menos ${MIN_5W2H_STEPS} passos práticos (bullets).\n` +
        `- Evite linguagem genérica, traga ferramentas e números-alvo (metas/KPIs, prazos e responsáveis).\n` +
        `- NÃO mude a fase atual indevidamente; respeite a fase "${faseAtual}".\n` +
        `- Mantenha o contrato: { "resposta_usuario": string, "contexto_incremental": object, "actions": Action[], "progresso": number }`
    },
    {
      role: 'user',
      content:
        `Aqui está a resposta anterior para corrigir (texto completo da LLM):\n\n` +
        fullResponse
    }
  ];
}

Deno.serve(async (req) => {
  console.log('[CONSULTOR] 🚀 VERSÃO 2.2 - Hints + AntiGenérico + Kanban Guard');
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPA_URL = Deno.env.get('SUPABASE_URL');
    const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not configured');

    const supabase = createClient(SUPA_URL!, SUPA_KEY!, { auth: { persistSession: false } });

    const body = await req.json();
    if (!body.sessao_id || !body.message) {
      return new Response(JSON.stringify({ error: 'sessao_id and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[CONSULTOR] Processing message for session:', body.sessao_id);

    // 1) Sessão
    const { data: sessao, error: sessaoError } = await supabase
      .from('consultor_sessoes')
      .select('*')
      .eq('id', body.sessao_id)
      .maybeSingle();

    if (sessaoError || !sessao) {
      console.error('[CONSULTOR] Session not found:', sessaoError);
      return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2) Fase
    const contexto = sessao.contexto_coleta || {};
    let faseAtual = PHASE_NORMALIZE[sessao.estado_atual || 'anamnese'] || 'anamnese';

    // Aguardar validação de escopo
    const aguardandoValidacao = sessao.aguardando_validacao;
    if (aguardandoValidacao === 'escopo') faseAtual = 'priorizacao';

    console.log('[CONSULTOR] Current phase:', faseAtual);

    // 3) Histórico
    const { data: historico } = await supabase
      .from('consultor_mensagens')
      .select('role, content, created_at')
      .eq('sessao_id', body.sessao_id)
      .order('created_at', { ascending: true });

    const messages = historico || [];
    console.log('[CONSULTOR] Loaded', messages.length, 'previous messages');

    // 4) Knowledge base do setor + Hints
    let kbContext = '';

    // 4.1 adapter setor
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

    // 4.2 Hints semânticos (A/B)
    let hintsUsed: { id: string; score: number }[] = [];
    const grupoAB = determineABGroup();
    console.log('[CONSULTOR] A/B Group:', grupoAB.group, 'max hints:', grupoAB.maxHints);

    try {
      const hintContext: any = {
        segmento: sessao.setor || contexto.segmento || contexto.anamnese?.segmento,
        dor_principal: contexto.dor_principal || contexto.anamnese?.dor_principal,
        achados: [],
        expressoes_usuario: []
      };

      if (contexto.canvas_proposta_valor) hintContext.achados?.push(contexto.canvas_proposta_valor);
      if (contexto.processos_identificados)
        hintContext.achados?.push(...(contexto.processos_identificados.slice(0, 3) || []));

      const ultimasMensagens = messages.filter((m: any) => m.role === 'user').slice(-3).map((m: any) => m.content);
      hintContext.expressoes_usuario = ultimasMensagens;

      const hints = await searchRelevantHints(supabase, body.sessao_id, hintContext, grupoAB.maxHints);
      if (hints?.length) {
        console.log('[CONSULTOR] Found', hints.length, 'relevant hints');
        kbContext += formatHintsForPrompt(hints);
        hintsUsed = hints.map((h: any) => ({ id: h.id, score: h.score }));
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
        console.log('[CONSULTOR] No relevant hints found');
      }
    } catch (err) {
      console.warn('[CONSULTOR] Error fetching hints (non-fatal):', err);
    }

    // 4.3 exemplos de ferramentas por fase (RAG KB)
    const ferramentasPorFase: Record<string, string[]> = {
      mapeamento: ['canvas', 'cadeia de valor', 'value chain'],
      investigacao: ['ishikawa', '5 porques', 'causa raiz'],
      priorizacao: ['matriz gut', 'priorizacao', 'matriz de decisao'],
      mapeamento_processos: ['sipoc', 'bpmn', 'fluxograma', 'processo'],
      execucao: ['5w2h', 'plano de acao', 'pdca']
    };

    const ferramentas = ferramentasPorFase[faseAtual] || [];
    if (ferramentas.length) {
      try {
        const { data: kbItems } = await supabase
          .from('rag_knowledge_base')
          .select('titulo, conteudo, categoria')
          .in('categoria', ferramentas)
          .limit(3);

        if (kbItems?.length) {
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

    // 5) Contexto já coletado
    const contextoStr = Object.entries(contexto)
      .filter(([k]) => !['fase_atual', 'progresso'].includes(k))
      .map(([k, v]) => (typeof v === 'object' ? `  - ${k}: ${JSON.stringify(v, null, 2)}` : `  - ${k}: ${v}`))
      .join('\n');

    const contextoSection = contextoStr
      ? `\n\n═══ CONTEXTO JÁ COLETADO (NÃO PERGUNTE NOVAMENTE) ═══\n${contextoStr}\n═══════════════════════════════════════════════════════\n`
      : '\n\nNenhum dado coletado ainda. Comece pela primeira pergunta.\n';

    // 6) Prompt por fase
    const systemPrompt = getSystemPrompt(faseAtual) + contextoSection + kbContext;

    // 7) Mensagens para LLM
    const baseMessages: any[] = [{ role: 'system', content: systemPrompt }];
    for (const msg of messages) {
      if (msg.role !== 'system') {
        baseMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
      }
    }
    baseMessages.push({ role: 'user', content: body.message });

    // ===== Função de chamada à OpenAI (para reutilizar também na reemissão) =====
    async function callLLM(messages: any[]) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          temperature: 0.5,
          max_tokens: MAX_TOKENS,
          response_format: { type: 'json_object' }
        })
      });
      if (!r.ok) {
        const errorText = await r.text();
        console.error('[CONSULTOR] LLM error:', errorText);
        throw new Error(`LLM API error: ${r.status}`);
      }
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content || '';
      return String(content);
    }

    // 8) Chamada inicial
    console.log('[CONSULTOR] Calling LLM with', baseMessages.length, 'messages');
    let fullResponse = await callLLM(baseMessages);
    console.log('[CONSULTOR] LLM response length:', fullResponse.length);
    console.log('[CONSULTOR] LLM response preview:', fullResponse.substring(0, 300));

    // 9) Parser robusto (multi-estratégia)
    function tryParse(jsonText: string) {
      try {
        return { parsed: JSON.parse(jsonText), strategy: 'direct_json' as const };
      } catch {
        const parteBMatch = jsonText.match(/\[PARTE B\]([\s\S]*)/i);
        if (parteBMatch) {
          try {
            const jsonStr = parteBMatch[1].trim().replace(/```json|```/g, '').trim();
            return { parsed: JSON.parse(jsonStr), strategy: 'parte_b_marker' as const };
          } catch {}
        }
        const jsonMatch = jsonText.match(/\{[\s\S]*"actions"[\s\S]*\}/i);
        if (jsonMatch) {
          try {
            return { parsed: JSON.parse(jsonMatch[0]), strategy: 'actions_search' as const };
          } catch {}
        }
        const jsonBlocks = jsonText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
        if (jsonBlocks && jsonBlocks.length > 0) {
          for (let i = jsonBlocks.length - 1; i >= 0; i--) {
            try {
              const candidate = JSON.parse(jsonBlocks[i]);
              if (candidate.actions || candidate.contexto_incremental) {
                return { parsed: candidate, strategy: 'last_valid_json' as const };
              }
            } catch {}
          }
        }
        return { parsed: null, strategy: 'none' as const };
      }
    }

    let { parsed: parsedResponse, strategy: parseStrategy } = tryParse(fullResponse);
    if (!parsedResponse) {
      console.error('[CONSULTOR] ❌ ALL PARSING STRATEGIES FAILED');
      console.log('[CONSULTOR] Raw response:', fullResponse.substring(0, 500));
    } else {
      console.log('[CONSULTOR] ✅ Parsed using strategy:', parseStrategy);
    }

    // ===== 9.1) Reemissão automática se resposta estiver fraca =====
    let fixAttempts = 0;
    while (parsedResponse) {
      const quality = assessActionQuality(parsedResponse);
      if (quality.ok) break;

      if (fixAttempts >= MAX_FIX_ATTEMPTS) {
        console.warn('[CONSULTOR] Quality still weak, but attempts exhausted:', quality);
        break;
      }

      fixAttempts++;
      console.log('[CONSULTOR] 🔁 Re-issuing for quality (attempt', fixAttempts, ') ->', quality);

      const fixMsgs = buildFixPrompt(fullResponse, faseAtual);
      // Mantém o system original como contexto adicional (dá “norte”)
      const repairMessages = [
        { role: 'system', content: 'Siga estritamente o contrato JSON. Nada fora de JSON.' },
        ...fixMsgs,
        { role: 'assistant', content: 'OK, gere agora a versão corrigida em JSON válido.' }
      ];

      fullResponse = await callLLM(repairMessages);
      const parsed = tryParse(fullResponse);
      parsedResponse = parsed.parsed;
      parseStrategy = parsed.strategy;
      console.log('[CONSULTOR] Fix parse strategy:', parseStrategy);
      if (!parsedResponse) break;
    }

    // 10) Extrair dados
    let responseText = '';
    let contextoIncremental: Record<string, any> = {};
    let actions: any[] = [];
    let progressoAtualizado = PHASE_PROGRESS[faseAtual] || 0;

    if (parsedResponse) {
      responseText = parsedResponse.resposta_usuario || parsedResponse.reply || '';
      contextoIncremental = parsedResponse.contexto_incremental || {};
      actions = Array.isArray(parsedResponse.actions) ? parsedResponse.actions : [];
      progressoAtualizado = parsedResponse.progresso || progressoAtualizado;

      // deduplicar actions por (type + tipo + título/what)
      actions = uniqBy(actions, (a) => {
        const t = a?.type || '';
        const tp = a?.params?.tipo || '';
        const w = a?.params?.contexto?.what || a?.params?.contexto?.o_que || '';
        return `${t}|${tp}|${w}`.toLowerCase();
      });

      if (!responseText) {
        const parteAMatch = fullResponse.match(/\[PARTE A\]([\s\S]*?)(\[PARTE B\]|$)/i);
        responseText = parteAMatch ? parteAMatch[1].trim() : fullResponse.split(/\{|\[PARTE B\]/)[0].trim();
      }

      console.log('[CONSULTOR] ✅ Parsed summary:', {
        strategy: parseStrategy,
        textLength: responseText.length,
        contextoKeys: Object.keys(contextoIncremental).length,
        actionsCount: actions.length,
        progresso: progressoAtualizado
      });
    } else {
      responseText = fullResponse; // fallback total
      console.log('[CONSULTOR] 🤖 Proceeding with raw text (no JSON).');
    }

    console.log('[CONSULTOR] Parsed actions:', actions.length);

    // 11) Detectores automáticos de completude por fase
    const contextData = { ...contexto, ...contextoIncremental };

    // ANAMNESE
    if (faseAtual === 'anamnese') {
      const requiredFields = [
        'nome', 'cargo', 'idade', 'formacao', 'empresa',
        'segmento', 'faturamento', 'funcionarios', 'dor_principal', 'expectativa_sucesso'
      ];
      const anamneseData: any = contextData.anamnese || contextData;
      const collectedFields = requiredFields.filter((field) => {
        let valor = anamneseData[field] || (contextData as any)[field] || (contextoIncremental as any)[field];
        if (field === 'expectativa_sucesso' && !valor) {
          valor = anamneseData['expectativa'] || (contextData as any)['expectativa'] || (contextoIncremental as any)['expectativa'];
        }
        return valor != null && valor !== '';
      });

      const hasTransition = actions.some((a) => a.type === 'transicao_estado');
      const hasEntregavel = actions.some(
        (a) => a.type === 'gerar_entregavel' && a.params?.tipo === 'anamnese_empresarial'
      );

      if (collectedFields.length === 10 && !hasTransition && !hasEntregavel) {
        const anamneseCompleta = {
          nome: anamneseData.nome || (contextData as any).nome,
          cargo: anamneseData.cargo || (contextData as any).cargo,
          idade: anamneseData.idade || (contextData as any).idade,
          formacao: anamneseData.formacao || (contextData as any).formacao,
          empresa: anamneseData.empresa || (contextData as any).empresa,
          segmento: anamneseData.segmento || (contextData as any).segmento,
          faturamento: anamneseData.faturamento || (contextData as any).faturamento,
          funcionarios: anamneseData.funcionarios || (contextData as any).funcionarios,
          dor_principal:
            anamneseData.dor_principal ||
            (contextData as any).dor_principal ||
            (contextoIncremental as any).dor_principal,
          expectativa_sucesso:
            anamneseData.expectativa_sucesso ||
            (contextData as any).expectativa_sucesso ||
            (contextoIncremental as any).expectativa_sucesso ||
            anamneseData.expectativa ||
            (contextData as any).expectativa ||
            (contextoIncremental as any).expectativa
        };

        actions.push(
          { type: 'gerar_entregavel', params: { tipo: 'anamnese_empresarial', contexto: anamneseCompleta } },
          { type: 'transicao_estado', params: { to: 'mapeamento' } }
        );
        progressoAtualizado = 30;
      }
    }

    // MAPEAMENTO (Canvas + Cadeia de Valor)
    if (faseAtual === 'mapeamento') {
      const canvasFields = [
        'canvas_proposta_valor', 'canvas_segmentos_cliente', 'canvas_canais', 'canvas_relacionamento',
        'canvas_receitas', 'canvas_recursos', 'canvas_atividades', 'canvas_parcerias', 'canvas_custos'
      ];
      const canvasCompleto = canvasFields.every((f) => (contextData as any)[f] || (contextoIncremental as any)[f]);

      const processosPrimarios = (contextData as any).processos_primarios || (contextoIncremental as any).processos_primarios || [];
      const processosApoio = (contextData as any).processos_apoio || (contextoIncremental as any).processos_apoio || [];
      const processosGestao = (contextData as any).processos_gestao || (contextoIncremental as any).processos_gestao || [];
      const cadeiaCompleta = processosPrimarios.length > 0 && processosApoio.length > 0 && processosGestao.length > 0;

      const hasTransition = actions.some((a) => a.type === 'transicao_estado');
      const hasCanvasEntregavel = actions.some((a) => a.type === 'gerar_entregavel' && a.params?.tipo === 'canvas');
      const hasCadeiaEntregavel = actions.some((a) => a.type === 'gerar_entregavel' && a.params?.tipo === 'cadeia_valor');

      if (canvasCompleto && cadeiaCompleta && !hasTransition) {
        // Canvas
        if (!hasCanvasEntregavel) {
          const canvasData: any = {};
          for (const field of canvasFields) {
            const key = field.replace('canvas_', '');
            canvasData[key] = (contextData as any)[field] || (contextoIncremental as any)[field];
          }
          actions.push({
            type: 'gerar_entregavel',
            params: { tipo: 'canvas', contexto: { canvas: canvasData, empresa: (contextData as any).empresa || (contextData as any).anamnese?.empresa } }
          });
        }

        // Cadeia
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
                  canvas_proposta_valor: (contextData as any).canvas_proposta_valor || (contextoIncremental as any).canvas_proposta_valor,
                  empresa: (contextData as any).empresa || (contextData as any).anamnese?.empresa
                }
              }
            }
          });
        }

        actions.push({ type: 'transicao_estado', params: { to: 'investigacao' } });
        (contextoIncremental as any).mapeamento_completo = true;
        progressoAtualizado = 45;
      }
    }

    // PRIORIZAÇÃO (GUT + Escopo)
    let escopoDefinidoAgora = false;
    if (faseAtual === 'priorizacao') {
      const processos = (contextData as any).processos_identificados || (contextData as any).priorizacao?.processos || [];
      const todosComGUT =
        processos.length > 0 && processos.every((p: any) => p.gravidade != null && p.urgencia != null && p.tendencia != null);

      const hasEscopoAction = actions.some(
        (a) => a.type === 'gerar_entregavel' && (a.params?.tipo === 'matriz_priorizacao' || a.params?.tipo === 'escopo')
      );

      if (todosComGUT && !(contextData as any).escopo_definido && !hasEscopoAction) {
        const processosComScore = processos
          .map((p: any) => ({ ...p, score: (p.gravidade || 0) * (p.urgencia || 0) * (p.tendencia || 0) }))
          .sort((a: any, b: any) => b.score - a.score);

        const escopo = processosComScore.slice(0, Math.min(5, processosComScore.length));

        actions.push(
          { type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao', contexto: { processos: processosComScore } } },
          {
            type: 'gerar_entregavel',
            params: {
              tipo: 'escopo',
              contexto: { processos_escopo: escopo.map((p: any) => p.nome), justificativa: `Selecionados ${escopo.length} processos com maior impacto` }
            }
          }
        );

        (contextoIncremental as any).escopo_definido = escopo.map((p: any) => p.nome);
        (contextoIncremental as any).aguardando_validacao_escopo = true;
        escopoDefinidoAgora = true;
        progressoAtualizado = 55;
      }

      // Validação de escopo (quando aguardando)
      if (aguardandoValidacao === 'escopo') {
        const mensagemLower = String(body.message || '').toLowerCase().trim();
        const termosAprovacao = [
          'sim','ok','okay','yes','concordo','perfeito','certo','correto','bora','vamos','pode','seguir','aprovado',
          'aprovar','confirmo','beleza','show','tranquilo','legal','tudo bem','tá bom','está bom','vamos lá','pode seguir',
          'vamos seguir','pode ir','pode continuar','continuar','avançar','próximo','próxima','positivo','afirmativo'
        ];
        const aprovado = termosAprovacao.some((t) => mensagemLower.includes(t));
        const mensagemCurta = mensagemLower.length < 15 && !mensagemLower.includes('não') && !mensagemLower.includes('nao');
        const hasTransition = actions.some((a) => a.type === 'transicao_estado');
        if ((aprovado || mensagemCurta) && !hasTransition) {
          actions.push({ type: 'transicao_estado', params: { to: 'mapeamento_processos' } });
          (contextoIncremental as any).escopo_aprovado = true;
          progressoAtualizado = 60;
        }
      }
    }

    // MAPEAMENTO DE PROCESSOS (SIPOC)
    if (faseAtual === 'mapeamento_processos') {
      const processosEscopo: string[] = (contextData as any).escopo_definido || [];
      const sipocData = (contextData as any).sipoc || {};
      if (processosEscopo.length > 0) {
        const todosComSIPOC = processosEscopo.every((pNome) => {
          const s = sipocData[pNome];
          return s && s.suppliers && s.inputs && s.process && s.outputs && s.customers;
        });

        if (todosComSIPOC) {
          for (const pNome of processosEscopo) {
            actions.push({ type: 'gerar_entregavel', params: { tipo: 'sipoc', contexto: { processo_nome: pNome, ...(sipocData[pNome] || {}) } } });
          }
          actions.push({ type: 'transicao_estado', params: { to: 'diagnostico' } });
          progressoAtualizado = 80;
        }
      }
    }

    // EXECUÇÃO (5W2H -> Kanban)
    if (faseAtual === 'execucao') {
      const has5W2H = actions.some((a) => a.type === 'gerar_entregavel' && a.params?.tipo === '5w2h');
      const hasKanban = actions.some((a) => a.type === 'update_kanban');

      if (has5W2H && !hasKanban) {
        const action5W2H = actions.find((a) => a.type === 'gerar_entregavel' && a.params?.tipo === '5w2h');
        const contexto5W2H = action5W2H?.params?.contexto || {};
        const acoes5W2H = Array.isArray(contexto5W2H.acoes) ? contexto5W2H.acoes : [];

        if (acoes5W2H.length > 0) {
          const kanbanCards = acoes5W2H.map((acao: any) => ({
            title: acao.what || acao.o_que || 'Ação sem título',
            description: `${acao.why || acao.por_que || ''}\n\n**Como:** ${acao.how || acao.como || ''}\n**Onde:** ${acao.where || acao.onde || ''}\n**Custo:** ${acao.how_much || acao.quanto || 'N/A'}`,
            assignee: acao.who || acao.quem || 'Não definido',
            due: acao.when || acao.quando || '+30d'
          }));

          actions.push({ type: 'update_kanban', params: { plano: { cards: kanbanCards } } });
        } else {
          console.warn('[CONSULTOR] 5W2H sem ações definidas, não é possível criar Kanban');
        }
      }
    }

    // 11.6) Validar transição
    const proximaFaseAction = actions.find((a) => a.type === 'transicao_estado');
    if (proximaFaseAction) {
      const proximaFaseDesejada = proximaFaseAction.params?.to as string;
      const proximaFaseEsperada = PHASE_FLOW[faseAtual];
      if (proximaFaseDesejada !== proximaFaseEsperada) {
        console.warn('[CONSULTOR] CORREÇÃO: Transição inválida', proximaFaseDesejada, '→', proximaFaseEsperada);
        proximaFaseAction.params.to = proximaFaseEsperada;
      }
    }

    // 12) Persistência das mensagens
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

    // 13) Timeline
    await supabase.from('timeline_consultor').insert({
      jornada_id: sessao.jornada_id,
      sessao_id: body.sessao_id,
      fase: faseAtual,
      tipo_evento: `Interação na fase ${faseAtual}`,
      detalhe: {
        mensagem_usuario: String(body.message || '').substring(0, 100),
        actions_detectadas: actions.length,
        progresso_atual: progressoAtualizado
      }
    });

    // 14) Processar actions
    let novaFase = faseAtual;
    let aguardandoValidacaoNova = aguardandoValidacao;
    const entregaveisGerados: string[] = [];
    const dadosExtraidosActions: Record<string, any> = {};

    // normalizar comandos de Kanban antes (evitar duplicatas por título)
    function normalizeCards(cards: any[]) {
      const cleaned = (cards || []).map((c) => ({
        title: (c.title || '').toString().trim(),
        description: (c.description || '').toString().trim(),
        assignee: (c.assignee || 'Não definido').toString().trim(),
        due: (c.due || '+30d').toString().trim()
      })).filter((c) => c.title);
      return uniqBy(cleaned, (c) => c.title.toLowerCase());
    }

    for (const action of actions) {
      const actionType = action.type;

      if (actionType === 'gerar_entregavel') {
        const tipoEntregavel = action.params?.tipo || 'relatorio';
        const contextoEspecifico = action.params?.contexto || {};

        // extrair dados úteis do entregável
        if (Object.keys(contextoEspecifico).length > 0) {
          if (['5w2h', 'plano_acao'].includes(tipoEntregavel)) {
            dadosExtraidosActions.plano_acao = contextoEspecifico;
            if (contextoEspecifico.acoes) dadosExtraidosActions.acoes = contextoEspecifico.acoes;
          } else if (['matriz_priorizacao', 'escopo'].includes(tipoEntregavel)) {
            if (!dadosExtraidosActions.priorizacao) dadosExtraidosActions.priorizacao = {};
            Object.assign(dadosExtraidosActions.priorizacao, contextoEspecifico);
          } else if (['diagnostico_executivo', 'diagnostico'].includes(tipoEntregavel)) {
            dadosExtraidosActions.diagnostico = contextoEspecifico;
          }
        }

        // mesclar contexto final para template
        const contextoCompleto: any = {
          ...contexto,
          ...contextData,
          ...contextoEspecifico,
          mapeamento: { ...(contexto as any).mapeamento || {}, ...(contextData as any).mapeamento || {}, ...(contextoEspecifico as any).mapeamento || {} },
          anamnese: { ...(contexto as any).anamnese || {}, ...(contextData as any).anamnese || {}, ...(contextoEspecifico as any).anamnese || {} }
        };

        const contextoFinal: any = {
          ...contextoCompleto,
          empresa: contextoCompleto.empresa || contextoCompleto.anamnese?.empresa || 'Empresa',
          setor: sessao.setor || contextoCompleto.setor || contextoCompleto.anamnese?.segmento,
          data_geracao: new Date().toLocaleDateString('pt-BR')
        };

        // unificar expectativa
        if (contextoFinal.anamnese) {
          if (contextoFinal.anamnese.expectativa_sucesso && !contextoFinal.anamnese.expectativa)
            contextoFinal.anamnese.expectativa = contextoFinal.anamnese.expectativa_sucesso;
          if (contextoFinal.anamnese.expectativa && !contextoFinal.anamnese.expectativa_sucesso)
            contextoFinal.anamnese.expectativa_sucesso = contextoFinal.anamnese.expectativa;
          if (!contextoFinal.expectativa && contextoFinal.anamnese.expectativa)
            contextoFinal.expectativa = contextoFinal.anamnese.expectativa;
          if (!contextoFinal.expectativa_sucesso && contextoFinal.anamnese.expectativa_sucesso)
            contextoFinal.expectativa_sucesso = contextoFinal.anamnese.expectativa_sucesso;
        }
        if (contextoFinal.expectativa_sucesso && !contextoFinal.expectativa)
          contextoFinal.expectativa = contextoFinal.expectativa_sucesso;
        if (contextoFinal.expectativa && !contextoFinal.expectativa_sucesso)
          contextoFinal.expectativa_sucesso = contextoFinal.expectativa;

        try {
          const htmlContent = getTemplateForType(tipoEntregavel, contextoFinal);
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
            await supabase.from('timeline_consultor').insert({
              jornada_id: sessao.jornada_id,
              sessao_id: body.sessao_id,
              fase: faseAtual,
              tipo_evento: `Entregável gerado: ${tipoEntregavel}`,
              detalhe: { entregavel_id: entregavel.id, tipo: tipoEntregavel }
            });
          }
        } catch (e) {
          console.error('[CONSULTOR] Error generating deliverable:', e);
        }
      }

      if (actionType === 'transicao_estado') {
        const proximaFase = action.params?.to || PHASE_FLOW[faseAtual];
        if (proximaFase) {
          novaFase = proximaFase as any;
          aguardandoValidacaoNova = null;
        }
      }

      if (actionType === 'update_kanban') {
        const params = action.params || {};
        let cards: any[] = [];
        if (params.plano?.cards) {
          cards = params.plano.cards;
        } else if (params.cards) {
          cards = params.cards;
        } else if (params.etapas) {
          cards = params.etapas.map((e: any) => ({
            title: e.nome || e.title || 'Ação sem título',
            description: e.descricao || e.description || 'Sem descrição',
            assignee: e.responsavel || e.assignee || 'Não definido',
            due: e.prazo || e.due || '+30d'
          }));
        } else if (params.acoes) {
          cards = params.acoes.map((a: any) => ({
            title: a.what || a.o_que || 'Ação sem título',
            description: `${a.why || a.por_que || ''}\n\n**Como:** ${a.how || a.como || ''}\n**Onde:** ${a.where || a.onde || ''}\n**Custo:** ${a.how_much || a.quanto || 'N/A'}`,
            assignee: a.who || a.quem || 'Não definido',
            due: a.when || a.quando || '+30d'
          }));
        }

        cards = normalizeCards(cards);

        if (!cards.length) {
          console.error('[CONSULTOR] ❌ No valid cards found in update_kanban action');
        } else {
          for (const card of cards) {
            try {
              // acoes_plano
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
                continue;
              }

              // kanban_cards
              const { error: cardError } = await supabase.from('kanban_cards').insert({
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
              }
            } catch (e) {
              console.error('[CONSULTOR] ❌ Exception creating Kanban card:', e);
            }
          }
        }
      }
    }

    // 15) Atualizar contexto
    const temDadosParaSalvar =
      Object.keys(contextoIncremental).length > 0 ||
      Object.keys(dadosExtraidosActions).length > 0 ||
      novaFase !== faseAtual ||
      escopoDefinidoAgora;

    if (temDadosParaSalvar) {
      const novoContexto: any = {
        ...contexto,
        [faseAtual]: { ...(contexto as any)[faseAtual] || {}, ...contextoIncremental, ...dadosExtraidosActions },
        fase_atual: novaFase,
        progresso: progressoAtualizado,
        ultima_atualizacao: new Date().toISOString()
      };

      if (novaFase !== faseAtual && !novoContexto[novaFase]) novoContexto[novaFase] = {};

      let finalAguardandoValidacao = aguardandoValidacaoNova;
      if (escopoDefinidoAgora) finalAguardandoValidacao = 'escopo';

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

      // Timeline de fase
      if (novaFase !== faseAtual) {
        await supabase.from('timeline_consultor').insert({
          jornada_id: sessao.jornada_id,
          sessao_id: body.sessao_id,
          fase: novaFase,
          tipo_evento: `Avançou para fase: ${novaFase}`,
          detalhe: { fase_anterior: faseAtual, progresso: progressoAtualizado }
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

          await supabase.from('gamificacao_consultor').upsert(
            {
              sessao_id: body.sessao_id,
              xp_total: xpAtual + xpFase,
              nivel: Math.floor((xpAtual + xpFase) / 100) + 1,
              ultima_fase_concluida: faseAtual
            },
            { onConflict: 'sessao_id' }
          );
        } catch (e) {
          console.warn('[CONSULTOR] Error awarding XP:', e);
        }
      }
    }

    // 16) Retorno
    return new Response(
      JSON.stringify({
        reply: responseText,
        fase: novaFase,
        estado: novaFase,
        progresso: progressoAtualizado,
        aguardando_validacao: aguardandoValidacaoNova,
        entregaveis_gerados: entregaveisGerados.length,
        actions_processadas: actions.length,
        actions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CONSULTOR] ERROR:', error);
    return new Response(
      JSON.stringify({
        reply: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        error: String(error?.message || error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
