/**
 * EXECUTOR (Function Registry) - Camada 3 da Arquitetura
 *
 * Executa ações retornadas pelo RAG backend (Estrategista + Tático)
 * Portfólio de capacidades flexíveis que aceita parâmetros variáveis
 *
 * CAPACIDADES:
 * - query_sql, analyze_dataset, compute_kpis
 * - pareto, abc_xyz, forecast_simple, what_if
 * - design_process_map, draft_policy
 * - create_doc (genérico), gerar_entregavel (específico)
 * - update_kanban, schedule_checkin
 * - transicao_estado
 */

import { supabase } from '../supabase';
import { TemplateService } from './template-service';

/**
 * Cache simples para jornada_id por sessão
 */
const _jornadaBySessao: Record<string, string> = {};

/**
 * Parser de datas flexível para Kanban
 * Aceita: +7d, +3w, +1m, +2q, ISO date string
 * Retorna: timestamptz válido do PostgreSQL
 */
function toTimestamp(dateInput: string | null | undefined): string | null {
  if (!dateInput) return null;

  const input = dateInput.toString().trim();
  if (!input) return null;

  // Tentar ISO date string primeiro
  if (input.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const date = new Date(input);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (e) {
      // Continuar para outros formatos
    }
  }

  // Parser de formato relativo: +7d, +3w, +1m, +2q
  const match = input.match(/^\+(\d+)([dwmq])$/i);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const now = new Date();

    switch (unit) {
      case 'd': // days
        now.setDate(now.getDate() + amount);
        break;
      case 'w': // weeks
        now.setDate(now.getDate() + (amount * 7));
        break;
      case 'm': // months
        now.setMonth(now.getMonth() + amount);
        break;
      case 'q': // quarters (3 months)
        now.setMonth(now.getMonth() + (amount * 3));
        break;
    }

    return now.toISOString();
  }

  // Fallback: +7d (uma semana a partir de hoje)
  console.warn('[RAG-EXECUTOR] Invalid date format:', input, '- using +7d fallback');
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return fallback.toISOString();
}

/**
 * Obtém jornada_id a partir de consultor_sessoes (fonte de verdade)
 * MODO NÃO-BLOQUEANTE: retorna null se não encontrar, em vez de throw
 */
async function getJornadaId(sessaoId: string): Promise<string | null> {
  if (_jornadaBySessao[sessaoId]) return _jornadaBySessao[sessaoId];

  try {
    const { data, error } = await supabase
      .from('consultor_sessoes')
      .select('jornada_id')
      .eq('id', sessaoId)
      .single();

    if (error) {
      console.error('[RAG-EXECUTOR] Falha ao obter jornada_id da sessão:', error);
      return null;
    }

    if (!data?.jornada_id) {
      console.warn('[RAG-EXECUTOR] Sessão sem jornada vinculada (jornada_id null)');
      return null;
    }

    _jornadaBySessao[sessaoId] = data.jornada_id;
    return data.jornada_id;
  } catch (err: any) {
    console.error('[RAG-EXECUTOR] Exceção ao buscar jornada_id:', err);
    return null;
  }
}

/**
 * Gera hash deterministico do plano baseado em conteudo
 * Ignora: timestamps, IDs, responsaveis (campos volateis)
 * Usa: tipo + area + titulos ordenados alfabeticamente
 */
function generatePlanHash(plan: {
  area?: string;
  tipo?: string;
  cards: Array<{ titulo?: string; title?: string; What?: string; o_que?: string; descricao?: string; description?: string }>
}): string {
  const tipo = (plan.tipo || '').toLowerCase().trim();
  const area = (plan.area || '').toLowerCase().trim();
  const titles = (plan.cards || [])
    .map(c => (c.titulo || c.title || c.What || c.o_que || '').toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join('|');

  // DJB2 hash algorithm (simple and fast)
  const base = `${tipo}::${area}::${titles}`;
  let hash = 5381;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) + hash) + base.charCodeAt(i);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

interface CardDiff {
  added: any[];
  modified: any[];
  removed: any[];
  unchanged: any[];
}

/**
 * Detecta diferencas entre plano existente e novo plano
 */
function detectPlanDiff(existingCards: any[], newCards: any[]): CardDiff {
  const diff: CardDiff = {
    added: [],
    modified: [],
    removed: [],
    unchanged: []
  };

  const normalize = (card: any) => {
    const titulo = (card.title || card.titulo || card.What || card.o_que || '').trim().toLowerCase();
    const descricao = (card.description || card.descricao || card.Why || card.por_que || '').trim().toLowerCase();
    return { titulo, descricao, original: card };
  };

  const existingNormalized = existingCards.filter(c => !c.deprecated).map(normalize);
  const newNormalized = newCards.map(normalize);

  for (const newCard of newNormalized) {
    const existingMatch = existingNormalized.find(e => e.titulo === newCard.titulo);

    if (!existingMatch) {
      diff.added.push(newCard.original);
    } else if (existingMatch.descricao !== newCard.descricao) {
      diff.modified.push({
        id: existingMatch.original.id,
        newDescription: newCard.original.description || newCard.original.descricao,
        oldDescription: existingMatch.descricao
      });
    } else {
      diff.unchanged.push(existingMatch.original);
    }
  }

  for (const existing of existingNormalized) {
    const newMatch = newNormalized.find(n => n.titulo === existing.titulo);
    if (!newMatch) {
      diff.removed.push(existing.original);
    }
  }

  return diff;
}

/**
 * Query cards by hash from kanban_cards table
 */
async function getCardsByHash(sessaoId: string, hash: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('kanban_cards')
      .select('id, titulo, title, descricao, description, status, plano_hash, plano_version')
      .eq('sessao_id', sessaoId)
      .eq('plano_hash', hash)
      .eq('deprecated', false);

    if (error) {
      console.warn('[RAG-EXECUTOR] Error querying cards by hash:', error);
      return [];
    }

    return data || [];
  } catch (error: any) {
    console.error('[RAG-EXECUTOR] Exception in getCardsByHash:', error);
    return [];
  }
}

/**
 * Upsert inteligente de plano Kanban por hash
 * Garante coluna plano_hash e faz merge incremental
 */
async function upsertKanbanPlan(
  sessaoId: string,
  plan: { area?: string; tipo?: string; cards: Array<{ titulo?: string; title?: string; descricao?: string; description?: string }> }
): Promise<{ created: number; updated: number; plano_hash: string }> {
  const plano_hash = generatePlanHash(plan);

  // Garante coluna plano_hash (idempotente: ignora erro se já existir)
  try {
    await supabase.rpc('exec_sql_json', {
      sql: `
        do $$
        begin
          if not exists (
            select 1 from information_schema.columns
            where table_schema='public' and table_name='kanban_cards' and column_name='plano_hash'
          ) then
            alter table public.kanban_cards add column plano_hash text;
            create index if not exists idx_kanban_cards_hash on public.kanban_cards(plano_hash);
          end if;
        end $$;
      `
    });
  } catch (e) {
    console.warn('[RAG-EXECUTOR] Could not ensure plano_hash column (may already exist):', e);
  }

  // Verifica se já existe plano com esse hash
  const { data: existing } = await supabase
    .from('kanban_cards')
    .select('id, titulo, title, status, plano_hash')
    .eq('sessao_id', sessaoId)
    .eq('plano_hash', plano_hash)
    .limit(1);

  let created = 0;
  let updated = 0;

  if (existing && existing.length > 0) {
    // Atualiza/mescla (upsert por título dentro do mesmo plano_hash)
    for (const card of plan.cards) {
      const titulo = card.titulo || card.title || '';
      const descricao = card.descricao || card.description || null;

      const { error: upsertErr } = await supabase.from('kanban_cards').upsert(
        {
          sessao_id: sessaoId,
          titulo: titulo,
          descricao: descricao,
          plano_hash,
          status: 'a_fazer'
        },
        { onConflict: 'sessao_id,titulo' }
      );

      if (!upsertErr) {
        updated++;
      }
    }
    return { created: 0, updated, plano_hash };
  } else {
    // Insere novos
    for (const card of plan.cards) {
      const titulo = card.titulo || card.title || '';
      const descricao = card.descricao || card.description || null;

      const { error: insertErr } = await supabase.from('kanban_cards').insert({
        sessao_id: sessaoId,
        titulo: titulo,
        descricao: descricao,
        status: 'a_fazer',
        plano_hash
      });

      if (!insertErr) {
        created++;
      }
    }
    return { created, updated: 0, plano_hash };
  }
}

export interface RAGAction {
  type: 'diagnose' | 'analyze_dataset' | 'compute_kpis' | 'what_if' |
        'design_process_map' | 'create_doc' | 'gerar_entregavel' |
        'update_kanban' | 'ensure_kanban' | 'schedule_checkin' |
        'transicao_estado' | 'coletar_info' | 'aplicar_metodologia';
  params?: Record<string, any>;
  // Aliases para compatibilidade
  [key: string]: any;
}

export interface ExecutionResult {
  success: boolean;
  entregavel_id?: string;
  kanban_cards_created?: number;
  estado_novo?: string;
  evidence_id?: string;
  kpis_computed?: string[];
  error?: string;
}

/**
 * Execute all actions returned by RAG (Função principal do Executor)
 */
export async function executeRAGActions(
  actions: RAGAction[],
  sessaoId: string,
  userId: string,
  contexto: any
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  console.log('[RAG-EXECUTOR] Executing', actions.length, 'actions for sessao', sessaoId);

  // CRITICAL: Salvar contexto_incremental ANTES de executar qualquer action
  if (contexto && Object.keys(contexto).length > 0) {
    console.log('[RAG-EXECUTOR] Salvando contexto antes de executar actions:', Object.keys(contexto));

    try {
      // Buscar contexto atual
      const { data: sessaoAtual } = await supabase
        .from('consultor_sessoes')
        .select('contexto_coleta')
        .eq('id', sessaoId)
        .maybeSingle();

      const contextoAtual = sessaoAtual?.contexto_coleta || {};

      // Mesclar contexto atual com novos dados (prioriza novos)
      const contextoAtualizado = {
        ...contextoAtual,
        ...contexto
      };

      // Remover campos que não devem ser salvos
      delete contextoAtualizado.estado_atual;
      delete contextoAtualizado.contexto_negocio;

      // Atualizar no banco
      const { error: updateError } = await supabase
        .from('consultor_sessoes')
        .update({
          contexto_coleta: contextoAtualizado,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessaoId);

      if (updateError) {
        console.error('[RAG-EXECUTOR] Erro salvando contexto:', updateError);
      } else {
        console.log('[RAG-EXECUTOR] Contexto salvo com sucesso:', Object.keys(contextoAtualizado));
      }
    } catch (err) {
      console.error('[RAG-EXECUTOR] Exceção ao salvar contexto:', err);
    }
  }

  for (const action of actions) {
    try {
      let result: ExecutionResult;

      // Normalizar action: pode vir como {type, params} ou direto {type, ...outros campos}
      const normalizedAction = {
        type: action.type,
        params: action.params || action
      };

      switch (normalizedAction.type) {
        case 'gerar_entregavel':
        case 'create_doc':
          result = await executeGerarEntregavel(normalizedAction, sessaoId, userId, contexto);
          break;

        case 'design_process_map':
          result = await executeDesignProcess(normalizedAction, sessaoId, userId, contexto);
          break;

        case 'update_kanban':
        case 'ensure_kanban':
          result = await executeUpdateKanban(normalizedAction, sessaoId);
          break;

        case 'transicao_estado':
          result = await executeTransicaoEstado(normalizedAction, sessaoId);
          break;

        case 'diagnose':
        case 'analyze_dataset':
        case 'compute_kpis':
        case 'what_if':
          // Gera memo de evidência (não bloqueia fluxo)
          result = await insertEvidenceMemo(normalizedAction, sessaoId, userId);
          break;

        case 'coletar_info':
          // Action informacional - contexto já foi salvo no início da função
          result = { success: true };
          break;

        case 'aplicar_metodologia':
        case 'schedule_checkin':
          // Informacionais: não executam nada, apenas registram
          result = { success: true };
          break;

        default:
          console.warn('[RAG-EXECUTOR] Unknown action type:', normalizedAction.type);
          result = { success: false, error: `Unknown action type: ${normalizedAction.type}` };
      }

      results.push(result);

      if (!result.success) {
        console.error('[RAG-EXECUTOR] Action failed:', normalizedAction.type, result.error);
      } else {
        console.log('[RAG-EXECUTOR] Action succeeded:', normalizedAction.type);
      }

    } catch (error: any) {
      console.error('[RAG-EXECUTOR] Exception executing action:', action.type, error);
      results.push({ success: false, error: error.message });
    }
  }

  return results;
}

/**
 * HANDLER: Gera entregável usando TemplateService
 * Aceita: deliverableType, tipo_entregavel, docType, tipo
 */
async function executeGerarEntregavel(
  action: RAGAction,
  sessaoId: string,
  userId: string,
  contexto: any
): Promise<ExecutionResult> {
  const p = action.params || action;
  const tipoEntregavel = p.deliverableType || p.tipo_entregavel || p.docType || p.tipo || 'diagnostico_exec';

  console.log('[RAG-EXECUTOR] Generating deliverable:', tipoEntregavel);

  try {
    // Mescla contexto da ação com contexto geral
    const fullContext = { ...contexto, ...(p.contexto || {}), sections: p.sections, format: p.format };

    // Generate content using TemplateService
    const resultado = await TemplateService.gerar(tipoEntregavel, fullContext);
    if (!resultado) {
      console.warn('[RAG-EXECUTOR] TemplateService returned null for', tipoEntregavel);
      return { success: false, error: `Failed to generate ${tipoEntregavel}: TemplateService returned null` };
    }

    // Tentar obter jornada (não-bloqueante)
    const jornadaId = await getJornadaId(sessaoId);

    if (!jornadaId) {
      console.warn('[RAG-EXECUTOR] No jornada_id found - deliverable not saved but content generated');
      return {
        success: false,
        error: `Deliverable generated but not saved: jornada_id missing. Fix session setup.`
      };
    }

    // Prepare data for insertion - ALWAYS use sessao_id + jornada_id
    const entregavelData: any = {
      sessao_id: sessaoId,
      jornada_id: jornadaId,
      tipo: tipoEntregavel,
      titulo: resultado.titulo || resultado.nome || p.contexto?.tema || p.tema || `${tipoEntregavel} - ${new Date().toLocaleDateString('pt-BR')}`,
      slug: `${tipoEntregavel}-${Date.now()}`,
      html_conteudo: resultado.html_conteudo || '',
      etapa_origem: contexto.estado_atual || 'diagnostico',
      visualizado: false
    };

    if (resultado.conteudo_xml) entregavelData.conteudo_xml = resultado.conteudo_xml;
    if (resultado.conteudo_md)  entregavelData.conteudo_md  = resultado.conteudo_md;

    const { data: entregavel, error } = await supabase
      .from('entregaveis_consultor')
      .insert(entregavelData)
      .select('id')
      .single();

    if (error) {
      console.error('[RAG-EXECUTOR] Insert error:', error);
      return { success: false, error: `Database insert failed: ${error.message}` };
    }

    console.log('[RAG-EXECUTOR] Deliverable created:', entregavel.id);
    return { success: true, entregavel_id: entregavel.id };

  } catch (error: any) {
    console.error('[RAG-EXECUTOR] Failed to generate deliverable:', error);
    return { success: false, error: `Failed to generate ${tipoEntregavel}: ${error.message}` };
  }
}

/**
 * HANDLER: Gera mapa de processo (BPMN ou textual)
 */
async function executeDesignProcess(
  action: RAGAction,
  sessaoId: string,
  userId: string,
  contexto: any
): Promise<ExecutionResult> {
  const p = action.params || action;
  const style = p.style || 'as_is'; // as_is | to_be
  const deliver = p.deliver || 'diagram'; // diagram | text
  const tipo = style === 'to_be' ? 'bpmn_to_be' : 'bpmn_as_is';

  console.log('[RAG-EXECUTOR] Generating process map:', tipo, deliver);

  try {
    const fullContext = { ...contexto, ...(p.contexto || {}), granularity: p.granularity };
    const resultado = await TemplateService.gerar(tipo, fullContext);
    if (!resultado) throw new Error('TemplateService returned null');

    const jornadaId = await getJornadaId(sessaoId);

    const { data, error } = await supabase
      .from('entregaveis_consultor')
      .insert({
        sessao_id: sessaoId,
        jornada_id: jornadaId,
        tipo,
        titulo: resultado?.titulo || resultado?.nome || `Processo ${style.toUpperCase()}`,
        slug: `${tipo}-${Date.now()}`,
        conteudo_xml: resultado?.conteudo_xml || null,
        conteudo_md: resultado?.conteudo_md || null,
        html_conteudo: resultado?.html_conteudo || '',
        etapa_origem: 'diagnostico'
      } as any)
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, entregavel_id: data.id };
  } catch (error: any) {
    console.error('[RAG-EXECUTOR] design_process_map error', error);
    return { success: false, error: error.message };
  }
}

/**
 * HANDLER: Transição de estado
 * Aceita múltiplos aliases e tem fallback seguro se nenhum alvo for fornecido
 */
async function executeTransicaoEstado(
  action: RAGAction,
  sessaoId: string
): Promise<ExecutionResult> {
  const p = action.params || action;

  // Aceita vários aliases e estruturas (com ou sem payload)
  const novoEstadoRaw =
    p.to ??
    p.novo_estado ??
    p.estado ??
    p.target ??
    p.state ??
    p.payload?.to ??
    p.payload?.estado ??
    null;

  // Fallback: mantém estado atual salvo em consultor_sessoes,
  // ou cai para 'coleta' se não achar.
  let novoEstado = (novoEstadoRaw || '').toString().trim().toLowerCase();

  try {
    if (!novoEstado) {
      console.warn('[RAG-EXECUTOR] No target state provided, reading from DB...');
      const { data: sess, error: sessErr } = await supabase
        .from('consultor_sessoes')
        .select('estado_atual')
        .eq('id', sessaoId)
        .maybeSingle();

      if (sessErr) {
        console.warn('[RAG-EXECUTOR] Não consegui ler estado atual, usando coleta:', sessErr);
      }
      novoEstado = (sess?.estado_atual || 'coleta').toString().trim().toLowerCase();
    }

    if (!novoEstado) {
      // último paraquedas
      novoEstado = 'coleta';
    }

    console.log('[RAG-EXECUTOR] Transitioning state to:', novoEstado);

    const { error } = await supabase
      .from('consultor_sessoes')
      .update({ estado_atual: novoEstado })
      .eq('id', sessaoId);

    if (error) throw error;

    console.log('[RAG-EXECUTOR] State transitioned successfully');
    return { success: true, estado_novo: novoEstado };

  } catch (error: any) {
    console.error('[RAG-EXECUTOR] Failed to transition state:', error);
    return { success: false, error: `Failed to transition state: ${error.message}` };
  }
}

/**
 * HANDLER: Cria ou atualiza cards no Kanban com versionamento inteligente
 * - Hash baseado em conteudo
 * - Merge incremental: adiciona novos cards sem perder antigos
 * - Preserva progresso de cards existentes
 */
async function executeUpdateKanban(
  action: RAGAction,
  sessaoId: string
): Promise<ExecutionResult> {
  const p = action.params || action;
  const plano = p.plano || p;

  const targetSessaoId = p.sessaoId === 'RUNTIME' ? sessaoId : (p.sessaoId || sessaoId);

  if (!plano || !plano.cards || plano.cards.length === 0) {
    console.log('[RAG-EXECUTOR] No cards in plan, skipping Kanban creation');
    return { success: true, kanban_cards_created: 0 };
  }

  console.log('[RAG-EXECUTOR] Processing', plano.cards.length, 'Kanban cards');

  try {
    const hash = generatePlanHash(plano, targetSessaoId);
    console.log('[RAG-EXECUTOR] Plan hash:', hash);

    const existingCards = await getCardsByHash(targetSessaoId, hash);

    if (existingCards.length === 0) {
      console.log('[RAG-EXECUTOR] First version of plan, inserting all cards');

      const cardsToInsert = plano.cards.map((card: any) => ({
        sessao_id: targetSessaoId,
        titulo: card.title || card.titulo || card.What || card.o_que || 'Ação',
        descricao: card.description || card.descricao || card.Why || card.por_que || '',
        responsavel: card.assignee || card.responsavel || card.Who || card.quem || card.owner || 'Time',
        due_at: toTimestamp(card.due || card.due_at || card.When || card.quando),
        status: 'a_fazer' as const,
        plano_hash: hash,
        plano_version: 1,
        card_source: 'original',
        deprecated: false
      }));

      const { data, error } = await supabase
        .from('kanban_cards')
        .insert(cardsToInsert)
        .select('id');

      if (error) throw error;

      console.log('[RAG-EXECUTOR] Created', data.length, 'cards (v1)');
      return { success: true, kanban_cards_created: data.length };
    }

    console.log('[RAG-EXECUTOR] Plan exists with', existingCards.length, 'cards, doing incremental merge');

    const diff = detectPlanDiff(existingCards, plano.cards);
    const nextVersion = Math.max(...existingCards.map((c: any) => c.plano_version || 1)) + 1;

    console.log('[RAG-EXECUTOR] Diff:', {
      added: diff.added.length,
      modified: diff.modified.length,
      removed: diff.removed.length,
      unchanged: diff.unchanged.length
    });

    let totalOperations = 0;

    if (diff.added.length > 0) {
      const newCards = diff.added.map((card: any) => ({
        sessao_id: targetSessaoId,
        titulo: card.title || card.titulo || card.What || card.o_que || 'Ação',
        descricao: card.description || card.descricao || card.Why || card.por_que || '',
        responsavel: card.assignee || card.responsavel || card.Who || card.quem || card.owner || 'Time',
        due_at: toTimestamp(card.due || card.due_at || card.When || card.quando),
        status: 'a_fazer' as const,
        plano_hash: hash,
        plano_version: nextVersion,
        card_source: 'incremental',
        deprecated: false
      }));

      const { data, error } = await supabase
        .from('kanban_cards')
        .insert(newCards)
        .select('id');

      if (error) throw error;

      totalOperations += data.length;
      console.log('[RAG-EXECUTOR] Added', data.length, 'new cards (v' + nextVersion + ')');
    }

    if (diff.modified.length > 0) {
      for (const modified of diff.modified) {
        const { error } = await supabase
          .from('kanban_cards')
          .update({
            descricao: modified.newDescription,
            plano_version: nextVersion
          })
          .eq('id', modified.id);

        if (error) {
          console.error('[RAG-EXECUTOR] Erro ao atualizar card:', error);
        } else {
          totalOperations++;
        }
      }

      console.log('[RAG-EXECUTOR] Updated', diff.modified.length, 'modified cards');
    }

    if (diff.removed.length > 0) {
      const removedIds = diff.removed.map((c: any) => c.id);

      const { error } = await supabase
        .from('kanban_cards')
        .update({
          deprecated: true,
          deprecated_version: nextVersion
        })
        .in('id', removedIds);

      if (error) {
        console.error('[RAG-EXECUTOR] Erro ao deprecar cards:', error);
      } else {
        totalOperations += diff.removed.length;
        console.log('[RAG-EXECUTOR] Deprecated', diff.removed.length, 'removed cards');
      }
    }

    return { success: true, kanban_cards_created: totalOperations };

  } catch (error: any) {
    console.error('[RAG-EXECUTOR] Failed to update Kanban:', error);
    return { success: false, error: `Failed to update Kanban: ${error.message}` };
  }
}

/**
 * HANDLER: Insere memo de evidência (para ações de análise)
 * Usado para: diagnose, analyze_dataset, compute_kpis, what_if
 */
async function insertEvidenceMemo(
  action: RAGAction,
  sessaoId: string,
  userId: string
): Promise<ExecutionResult> {
  const pretty = '```json\n' + JSON.stringify(action, null, 2) + '\n```';

  try {
    const jornadaId = await getJornadaId(sessaoId);

    if (!jornadaId) {
      console.warn('[RAG-EXECUTOR] No jornada_id for evidence memo - skipping insert');
      return { success: false, error: 'jornada_id missing - evidence not saved' };
    }

    const { data, error } = await supabase
      .from('entregaveis_consultor')
      .insert({
        sessao_id: sessaoId,
        jornada_id: jornadaId,
        tipo: 'evidencia_memo',
        titulo: `Evidência: ${action.type}`,
        slug: `evidencia-${Date.now()}`,
        conteudo_md: pretty,
        html_conteudo: `<pre>${pretty}</pre>`,
        etapa_origem: 'investigacao'
      } as any)
      .select('id')
      .single();

    if (error) {
      console.error('[RAG-EXECUTOR] evidence insert error', error);
      return { success: false, error: error.message };
    }

    return { success: true, evidence_id: data.id };
  } catch (error: any) {
    console.error('[RAG-EXECUTOR] evidence memo error', error);
    return { success: false, error: error.message };
  }
}

// Re-export secure session client
export { updateSessaoContext } from './session-client';
