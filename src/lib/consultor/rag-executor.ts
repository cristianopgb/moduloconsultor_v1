/**
 * RAG Action Executor
 *
 * Executes actions returned by the RAG backend (consultor-rag)
 * This is the CRITICAL missing piece that connects RAG to actual deliverables
 */

import { supabase } from '../supabase';
import { TemplateService } from './template-service';

export interface RAGAction {
  type: 'gerar_entregavel' | 'transicao_estado' | 'ensure_kanban' | 'coletar_info' | 'aplicar_metodologia';
  params: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  entregavel_id?: string;
  kanban_cards_created?: number;
  estado_novo?: string;
  error?: string;
}

/**
 * Execute all actions returned by RAG
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

      switch (action.type) {
        case 'gerar_entregavel':
          result = await executeGerarEntregavel(action, sessaoId, userId, contexto);
          break;

        case 'transicao_estado':
          result = await executeTransicaoEstado(action, sessaoId);
          break;

        case 'ensure_kanban':
          result = await executeEnsureKanban(action, sessaoId, userId);
          break;

        case 'coletar_info':
        case 'aplicar_metodologia':
          // These are informational only, no execution needed
          result = { success: true };
          break;

        default:
          console.warn('[RAG-EXECUTOR] Unknown action type:', action.type);
          result = { success: false, error: `Unknown action type: ${action.type}` };
      }

      results.push(result);

      if (!result.success) {
        console.error('[RAG-EXECUTOR] Action failed:', action.type, result.error);
      } else {
        console.log('[RAG-EXECUTOR] Action succeeded:', action.type);
      }

    } catch (error: any) {
      console.error('[RAG-EXECUTOR] Exception executing action:', action.type, error);
      results.push({ success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Generate a deliverable using TemplateService
 */
async function executeGerarEntregavel(
  action: RAGAction,
  sessaoId: string,
  userId: string,
  contexto: any
): Promise<ExecutionResult> {
  const tipoEntregavel = action.params.deliverableType || action.params.tipo_entregavel || action.params.tipo || 'diagnostico';

  console.log('[RAG-EXECUTOR] Generating deliverable:', tipoEntregavel);

  try {
    // Generate content using TemplateService
    const resultado = await TemplateService.gerar(tipoEntregavel, contexto);

    if (!resultado) {
      throw new Error('TemplateService returned null');
    }

    // Prepare data for insertion - ALWAYS use sessao_id
    const entregavelData: any = {
      sessao_id: sessaoId, // Standardize on sessao_id
      tipo: tipoEntregavel,
      nome: resultado.nome || action.params.contexto?.tema || `${tipoEntregavel} - ${new Date().toLocaleDateString('pt-BR')}`,
      html_conteudo: resultado.html_conteudo || '',
      etapa_origem: contexto.estado_atual || 'diagnostico',
      visualizado: false
    };

    // Add XML for BPMN
    if (resultado.conteudo_xml) {
      entregavelData.conteudo_xml = resultado.conteudo_xml;
      entregavelData.bpmn_xml = resultado.conteudo_xml; // Compatibility
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

    // Update sessao with generated entregavel
    await supabase
      .from('consultor_sessoes')
      .update({
        entregaveis_gerados: supabase.sql`array_append(entregaveis_gerados, ${entregavel.id}::uuid)`
      })
      .eq('id', sessaoId);

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
 * Transition sessao to new state
 */
async function executeTransicaoEstado(
  action: RAGAction,
  sessaoId: string
): Promise<ExecutionResult> {
  const novoEstado = action.params.novo_estado || action.params.to;

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
 * Create Kanban cards from action plan
 */
async function executeEnsureKanban(
  action: RAGAction,
  sessaoId: string,
  userId: string
): Promise<ExecutionResult> {
  const plano = action.params.plano;

  // Handle runtime sessaoId
  const targetSessaoId = action.params.sessaoId === 'RUNTIME' ? sessaoId : (action.params.sessaoId || sessaoId);

  if (!plano || !plano.cards || plano.cards.length === 0) {
    console.log('[RAG-EXECUTOR] No cards in plan, skipping Kanban creation');
    return { success: true, kanban_cards_created: 0 };
  }

  console.log('[RAG-EXECUTOR] Creating', plano.cards.length, 'Kanban cards');

  try {
    // Prepare cards for insertion - ALWAYS use sessao_id
    const cardsToInsert = plano.cards.map((card: any, index: number) => ({
      sessao_id: targetSessaoId, // Standardize on sessao_id
      titulo: card.title || card.What || card.o_que || 'Ação',
      descricao: card.description || card.Why || card.por_que || '',
      responsavel: card.assignee || card.Who || card.quem || 'Responsável',
      prazo: card.due || card.When || card.quando || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'todo' as const,
      ordem: index,
      dados_5w2h: {
        o_que: card.What || card.o_que || card.title,
        por_que: card.Why || card.por_que || card.description,
        quem: card.Who || card.quem || card.assignee,
        quando: card.When || card.quando || card.due,
        onde: card.Where || card.onde || '',
        como: card.How || card.como || '',
        quanto: card.HowMuch || card.quanto || ''
      }
    }));

    // Check if cards already exist for this sessao
    const { data: existing } = await supabase
      .from('kanban_cards')
      .select('id')
      .eq('sessao_id', targetSessaoId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('[RAG-EXECUTOR] Kanban cards already exist for this sessao');
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
 * Update sessao context with form data (called externally)
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
