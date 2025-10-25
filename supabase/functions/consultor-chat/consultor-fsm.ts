/**
 * ConsultorFSM - Finite State Machine para controle determinístico do fluxo do Proceda Consultor
 *
 * RESPONSABILIDADES:
 * - Única fonte de verdade sobre o estado do fluxo
 * - Determina próximas ações independente da IA
 * - Garante transições válidas entre estados
 * - Previne loops e estados inválidos
 *
 * ESTADOS: anamnese → modelagem → priorizacao → execucao → concluido
 */

export type ConsultorState = 'anamnese' | 'modelagem' | 'priorizacao' | 'execucao' | 'concluido';

export type ConsultorEvent =
  | 'anamnese_preenchida'
  | 'canvas_preenchido'
  | 'cadeia_valor_preenchida'
  | 'matriz_gerada'
  | 'escopo_validado'
  | 'atributos_preenchido'
  | 'bpmn_validado'
  | 'diagnostico_gerado';

export interface FSMAction {
  type: 'exibir_formulario' | 'gerar_entregavel' | 'set_validacao' | 'avancar_fase' | 'noop';
  params?: any;
  reason?: string;
}

export interface FSMContext {
  jornada: any;
  contexto_coleta: any;
  aguardando_validacao: string | null;
  checklist?: any;
}

export class ConsultorFSM {
  /**
   * Define as transições válidas entre estados
   */
  private static readonly TRANSITIONS: Record<ConsultorState, Partial<Record<ConsultorEvent, ConsultorState>>> = {
    anamnese: {
      anamnese_preenchida: 'modelagem'
    },
    modelagem: {
      canvas_preenchido: 'modelagem',  // Permanece em modelagem até cadeia_valor
      cadeia_valor_preenchida: 'modelagem',  // Permanece até gerar matriz
      matriz_gerada: 'priorizacao'
    },
    priorizacao: {
      escopo_validado: 'execucao'
    },
    execucao: {
      atributos_preenchido: 'execucao',
      bpmn_validado: 'execucao',
      diagnostico_gerado: 'execucao'
    },
    concluido: {}
  };

  /**
   * Retorna o próximo estado dado o estado atual e o evento
   */
  static transition(currentState: ConsultorState, event: ConsultorEvent): ConsultorState {
    const transitions = this.TRANSITIONS[currentState];
    const nextState = transitions?.[event];

    if (!nextState) {
      console.log(`[FSM] No transition defined for ${currentState} + ${event}, staying in ${currentState}`);
      return currentState;
    }

    console.log(`[FSM] Transition: ${currentState} --[${event}]--> ${nextState}`);
    return nextState;
  }

  /**
   * CORE: Determina as próximas ações baseado no estado e contexto
   * Esta função SEMPRE retorna ações corretas, independente do que a IA disse
   */
  static getNextActions(context: FSMContext): FSMAction[] {
    const { jornada, contexto_coleta, aguardando_validacao, checklist } = context;
    const currentState = jornada.etapa_atual || 'anamnese';
    const actions: FSMAction[] = [];

    console.log(`[FSM] getNextActions for state: ${currentState}, aguardando: ${aguardando_validacao}`);

    // Se aguardando validação, NÃO avançar até validar
    if (aguardando_validacao === 'priorizacao') {
      console.log('[FSM] Waiting for prioritization validation, no actions');
      return [{ type: 'set_validacao', params: { tipo: 'priorizacao' }, reason: 'awaiting_user_validation' }];
    }

    switch (currentState) {
      case 'anamnese':
        return this.handleAnamneseState(contexto_coleta, checklist);

      case 'modelagem':
        return this.handleModelagemState(contexto_coleta, checklist);

      case 'priorizacao':
        return this.handlePriorizacaoState(contexto_coleta, aguardando_validacao);

      case 'execucao':
        return this.handleExecucaoState(contexto_coleta, checklist);

      case 'concluido':
        return [{ type: 'noop', reason: 'journey_completed' }];

      default:
        console.warn(`[FSM] Unknown state: ${currentState}`);
        return [];
    }
  }

  /**
   * Estado: ANAMNESE
   * Ação: Exibir formulário de anamnese se ainda não preenchido
   */
  private static handleAnamneseState(contexto: any, checklist: any): FSMAction[] {
    const hasAnamnese = !!(contexto?.anamnese || contexto?.empresa);
    const anamnesePreenchida = checklist?.anamnese_preenchida;
    const anamneseExibida = checklist?.anamnese_formulario_exibido;

    if (hasAnamnese || anamnesePreenchida) {
      console.log('[FSM] Anamnese already filled, should advance to modelagem');
      return [{ type: 'avancar_fase', params: { fase: 'modelagem' }, reason: 'anamnese_complete' }];
    }

    if (!anamneseExibida) {
      console.log('[FSM] Opening anamnese form');
      return [{ type: 'exibir_formulario', params: { tipo: 'anamnese' }, reason: 'anamnese_needed' }];
    }

    return [];
  }

  /**
   * Estado: MODELAGEM
   * Sequência: Canvas → Cadeia de Valor → Matriz + Escopo (automático)
   */
  private static handleModelagemState(contexto: any, checklist: any): FSMAction[] {
    const actions: FSMAction[] = [];

    // 1. Verificar Canvas
    const hasCanvas = !!(contexto?.canvas);
    const canvasPreenchido = checklist?.canvas_preenchido;
    const canvasExibido = checklist?.canvas_formulario_exibido;

    if (!hasCanvas && !canvasPreenchido) {
      if (!canvasExibido) {
        console.log('[FSM] Opening canvas form');
        return [{ type: 'exibir_formulario', params: { tipo: 'canvas' }, reason: 'canvas_needed' }];
      }
      console.log('[FSM] Canvas form already shown, waiting for user to fill');
      return [];
    }

    // 2. Verificar Cadeia de Valor
    const hasCadeia = !!(contexto?.cadeia_valor || contexto?.cadeia);
    const cadeiaPreenchida = checklist?.cadeia_valor_preenchida;
    const cadeiaExibida = checklist?.cadeia_valor_formulario_exibida;

    if (!hasCadeia && !cadeiaPreenchida) {
      if (!cadeiaExibida) {
        console.log('[FSM] Canvas filled, opening cadeia_valor form');
        return [{ type: 'exibir_formulario', params: { tipo: 'cadeia_valor' }, reason: 'cadeia_needed_after_canvas' }];
      }
      console.log('[FSM] Cadeia form already shown, waiting for user to fill');
      return [];
    }

    // 3. Se ambos preenchidos, gerar Matriz + Escopo automaticamente
    if ((hasCanvas || canvasPreenchido) && (hasCadeia || cadeiaPreenchida)) {
      console.log('[FSM] Canvas + Cadeia complete, generating matriz + escopo');
      actions.push({
        type: 'gerar_entregavel',
        params: { tipo: 'matriz_priorizacao' },
        reason: 'auto_generate_after_cadeia'
      });
      actions.push({
        type: 'gerar_entregavel',
        params: { tipo: 'escopo_projeto' },
        reason: 'auto_generate_with_matriz'
      });
      actions.push({
        type: 'set_validacao',
        params: { tipo: 'priorizacao' },
        reason: 'request_user_validation'
      });
      return actions;
    }

    return [];
  }

  /**
   * Estado: PRIORIZAÇÃO
   * Aguarda validação do usuário para avançar para execução
   */
  private static handlePriorizacaoState(contexto: any, aguardando: string | null): FSMAction[] {
    if (aguardando === 'priorizacao') {
      console.log('[FSM] Waiting for user to validate prioritization');
      return [{ type: 'set_validacao', params: { tipo: 'priorizacao' }, reason: 'user_must_validate' }];
    }

    // Se não está aguardando validação, pode avançar para execução
    console.log('[FSM] Prioritization validated, advancing to execucao');
    return [{ type: 'avancar_fase', params: { fase: 'execucao' }, reason: 'prioritization_validated' }];
  }

  /**
   * Estado: EXECUÇÃO
   * Processar cada processo priorizado: Atributos → BPMN → Diagnóstico (auto)
   */
  private static handleExecucaoState(contexto: any, checklist: any): FSMAction[] {
    // Verificar se existe escopo com processos priorizados
    const escopo = contexto?.escopo_projeto || contexto?.escopo || contexto?.matriz_priorizacao;

    if (!escopo || !escopo.processos || escopo.processos.length === 0) {
      console.log('[FSM] No prioritized processes found in execucao');
      return [];
    }

    // Pegar o primeiro processo (pode ser expandido para processar múltiplos)
    const primeiroProcesso = escopo.processos[0];
    const processoNome = primeiroProcesso?.nome || primeiroProcesso?.processo_nome;

    if (!processoNome) {
      console.log('[FSM] First process has no name, cannot proceed');
      return [];
    }

    // Verificar se atributos do processo já foram preenchidos
    const atributos = contexto?.atributos_processo;
    const hasAtributos = atributos && atributos[processoNome];

    if (!hasAtributos) {
      console.log(`[FSM] Opening atributos_processo form for: ${processoNome}`);
      return [{
        type: 'exibir_formulario',
        params: {
          tipo: 'atributos_processo',
          processo: processoNome
        },
        reason: 'atributos_needed_for_first_process'
      }];
    }

    // Se atributos preenchidos, verificar se BPMN foi gerado
    // (BPMN é gerado via outra edge function, não é form)

    // Se BPMN existe, gerar diagnóstico automaticamente
    // (Diagnóstico NÃO é formulário, é gerado automaticamente)

    console.log('[FSM] Atributos filled, waiting for BPMN generation by user request');
    return [];
  }

  /**
   * Valida se uma transição é permitida
   */
  static canTransition(from: ConsultorState, to: ConsultorState): boolean {
    const validTransitions = this.TRANSITIONS[from];
    if (!validTransitions) return false;

    return Object.values(validTransitions).includes(to);
  }

  /**
   * Detecta qual evento ocorreu baseado no form_type submetido
   */
  static detectEvent(formType: string): ConsultorEvent | null {
    const eventMap: Record<string, ConsultorEvent> = {
      'anamnese': 'anamnese_preenchida',
      'canvas': 'canvas_preenchido',
      'cadeia_valor': 'cadeia_valor_preenchida',
      'atributos_processo': 'atributos_preenchido'
    };

    return eventMap[formType] || null;
  }

  /**
   * Retorna uma mensagem amigável sobre o estado atual
   */
  static getStateMessage(state: ConsultorState, context: FSMContext): string {
    const messages: Record<ConsultorState, string> = {
      anamnese: 'Iniciando a jornada com a anamnese empresarial.',
      modelagem: 'Mapeando o modelo de negócio e processos.',
      priorizacao: 'Priorizando áreas e processos para transformação.',
      execucao: 'Executando melhorias nos processos priorizados.',
      concluido: 'Jornada de transformação concluída!'
    };

    return messages[state] || 'Processando...';
  }
}
