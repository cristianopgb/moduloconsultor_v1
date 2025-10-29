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
 * Gera hash deterministico do plano baseado em conteudo
 * Ignora: timestamps, IDs, responsaveis (campos volateis)
 * Usa: tipo + area + titulos ordenados alfabeticamente
 */
function generatePlanHash(plano: any, sessaoId: string): string {
  const cards = plano.cards || [];

  const titulos = cards
    .map((c: any) => (c.title || c.titulo || c.What || c.o_que || '').trim().toLowerCase())
    .filter(Boolean)
    .sort();

  const hashInput = JSON.stringify({
    tipo: plano.tipo || 'geral',
    area: plano.area || 'todas',
    sessao_id: sessaoId,
    titulos: titulos
  });

  // Simple hash function (for browser compatibility)
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
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
 * Busca cards existentes por hash e sessao
 */
async function getCardsByHash(sessaoId: string, hash: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('*')
    .eq('sessao_id', sessaoId)
    .eq('plano_hash', hash)
    .eq('deprecated', false)
    .order('plano_version', { ascending: false });

  if (error) {
    console.error('[RAG-EXECUTOR] Erro ao buscar cards por hash:', error);
    return [];
  }

  return data || [];
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
      throw new Error('TemplateService returned null');
    }

    // Prepare data for insertion - ALWAYS use sessao_id
    const entregavelData: any = {
      sessao_id: sessaoId,
      tipo: tipoEntregavel,
      nome: resultado.nome || p.contexto?.tema || p.tema || `${tipoEntregavel} - ${new Date().toLocaleDateString('pt-BR')}`,
      html_conteudo: resultado.html_conteudo || '',
      etapa_origem: contexto.estado_atual || 'diagnostico',
      visualizado: false
    };

    // Add XML for BPMN
    if (resultado.conteudo_xml) {
      entregavelData.conteudo_xml = resultado.conteudo_xml;
    }

    // Add Markdown if available
    if (resultado.conteudo_md) {
      entregavelData.conteudo_md = resultado.conteudo_md;
    }

    // Insert into database
    const { data: entregavel, error } = await supabase
      .from('entregaveis_consultor')
      .insert(entregavelData)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    console.log('[RAG-EXECUTOR] Deliverable created:', entregavel.id);

    return {
      success: true,
      entregavel_id: entregavel.id
    };

  } catch (error: any) {
    console.error('[RAG-EXECUTOR] Failed to generate deliverable:', error);
    return {
      success: false,
      error: `Failed to generate ${tipoEntregavel}: ${error.message}`
    };
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

    if (!resultado) {
      throw new Error('TemplateService returned null');
    }

    const { data, error } = await supabase.from('entregaveis_consultor').insert({
      sessao_id: sessaoId,
      tipo: tipo,
      nome: resultado?.nome || `Processo ${style.toUpperCase()}`,
      conteudo_xml: resultado?.conteudo_xml || null,
      conteudo_md: resultado?.conteudo_md || null,
      html_conteudo: resultado?.html_conteudo || '',
      created_by: userId
    } as any).select('id').single();

    if (error) throw error;

    return { success: true, entregavel_id: data.id };
  } catch (error: any) {
    console.error('[RAG-EXECUTOR] design_process_map error', error);
    return { success: false, error: error.message };
  }
}

/**
 * HANDLER: Transição de estado
 * Aceita: to, novo_estado, estado
 */
async function executeTransicaoEstado(
  action: RAGAction,
  sessaoId: string
): Promise<ExecutionResult> {
  const p = action.params || action;
  const novoEstado = p.to || p.novo_estado || p.estado;

  if (!novoEstado) {
    return { success: false, error: 'No target state provided' };
  }

  console.log('[RAG-EXECUTOR] Transitioning state to:', novoEstado);

  try {
    // Update sessao state
    const { error } = await supabase
      .from('consultor_sessoes')
      .update({ estado_atual: novoEstado })
      .eq('id', sessaoId);

    if (error) {
      throw error;
    }

    console.log('[RAG-EXECUTOR] State transitioned successfully');

    return {
      success: true,
      estado_novo: novoEstado
    };

  } catch (error: any) {
    console.error('[RAG-EXECUTOR] Failed to transition state:', error);
    return {
      success: false,
      error: `Failed to transition state: ${error.message}`
    };
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
        due_at: card.due || card.due_at || card.When || card.quando || null,
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
      return {
        success: true,
        kanban_cards_created: data.length
      };
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
        due_at: card.due || card.due_at || card.When || card.quando || null,
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

    return {
      success: true,
      kanban_cards_created: totalOperations
    };

  } catch (error: any) {
    console.error('[RAG-EXECUTOR] Failed to update Kanban:', error);
    return {
      success: false,
      error: `Failed to update Kanban: ${error.message}`
    };
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
    const { data, error } = await supabase.from('entregaveis_consultor').insert({
      sessao_id: sessaoId,
      tipo: 'evidencia_memo',
      nome: `Evidência: ${action.type}`,
      conteudo_md: pretty,
      html_conteudo: `<pre>${pretty}</pre>`,
      created_by: userId
    } as any).select('id').single();

    if (error) throw error;

    return { success: true, evidence_id: data.id };
  } catch (error: any) {
    console.error('[RAG-EXECUTOR] evidence memo error', error);
    return { success: false, error: error.message };
  }
}

// Re-export secure session client
export { updateSessaoContext } from './session-client';
