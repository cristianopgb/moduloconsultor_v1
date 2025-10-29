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
 * HANDLER: Cria cards no Kanban
 * Aceita: plano.cards, cards
 */
async function executeUpdateKanban(
  action: RAGAction,
  sessaoId: string
): Promise<ExecutionResult> {
  const p = action.params || action;
  const plano = p.plano || p;

  // Handle runtime sessaoId
  const targetSessaoId = p.sessaoId === 'RUNTIME' ? sessaoId : (p.sessaoId || sessaoId);

  if (!plano || !plano.cards || plano.cards.length === 0) {
    console.log('[RAG-EXECUTOR] No cards in plan, skipping Kanban creation');
    return { success: true, kanban_cards_created: 0 };
  }

  console.log('[RAG-EXECUTOR] Creating', plano.cards.length, 'Kanban cards');

  try {
    // Preparar cards para inserção - aceita múltiplos formatos
    const cardsToInsert = plano.cards.map((card: any, index: number) => ({
      sessao_id: targetSessaoId,
      titulo: card.title || card.titulo || card.What || card.o_que || 'Ação',
      descricao: card.description || card.descricao || card.Why || card.por_que || '',
      responsavel: card.assignee || card.responsavel || card.Who || card.quem || card.owner || 'Time',
      due_at: card.due || card.due_at || card.When || card.quando || null,
      status: 'a_fazer' as const
    }));

    // Verificar se já existem cards para esta sessao
    const { data: existing } = await supabase
      .from('kanban_cards')
      .select('id')
      .eq('sessao_id', targetSessaoId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('[RAG-EXECUTOR] Cards já existem, pulando');
      return { success: true, kanban_cards_created: 0 };
    }

    // Insert cards
    const { data, error } = await supabase
      .from('kanban_cards')
      .insert(cardsToInsert)
      .select('id');

    if (error) {
      throw error;
    }

    console.log('[RAG-EXECUTOR] Created', data.length, 'Kanban cards');

    return {
      success: true,
      kanban_cards_created: data.length
    };

  } catch (error: any) {
    console.error('[RAG-EXECUTOR] Failed to create Kanban cards:', error);
    return {
      success: false,
      error: `Failed to create Kanban cards: ${error.message}`
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

/**
 * UTIL: Atualiza contexto da sessão com dados de formulário
 */
export async function updateSessaoContext(
  sessaoId: string,
  formData: Record<string, any>
): Promise<boolean> {
  try {
    // Get current context
    const { data: sessao, error: fetchError } = await supabase
      .from('consultor_sessoes')
      .select('contexto_negocio')
      .eq('id', sessaoId)
      .single();

    if (fetchError) {
      console.error('[RAG-EXECUTOR] Error fetching sessao:', fetchError);
      return false;
    }

    // Merge with new form data
    const updatedContext = {
      ...(sessao.contexto_negocio || {}),
      ...formData
    };

    // Update sessao
    const { error: updateError } = await supabase
      .from('consultor_sessoes')
      .update({ contexto_negocio: updatedContext })
      .eq('id', sessaoId);

    if (updateError) {
      console.error('[RAG-EXECUTOR] Error updating sessao:', updateError);
      return false;
    }

    console.log('[RAG-EXECUTOR] Updated sessao context with form data');
    return true;

  } catch (error) {
    console.error('[RAG-EXECUTOR] Exception updating sessao context:', error);
    return false;
  }
}
