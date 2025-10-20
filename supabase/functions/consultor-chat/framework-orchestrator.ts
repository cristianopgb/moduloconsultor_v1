/**
 * Framework Orchestrator - Controle Rigoroso do Fluxo do Proceda Consultor
 *
 * FRAMEWORK ESTRUTURADO:
 * 1. Apresentação → 2. Anamnese → 3. Mapeamento → 4. Priorização → 5. Execução
 *
 * REGRAS CRÍTICAS:
 * - NUNCA pular etapas
 * - NUNCA avançar sem validação completa
 * - SEMPRE gerar entregáveis ao concluir etapa
 * - SEMPRE chamar gatilhos de gamificação
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  canAdvance: boolean;
  nextStage?: string;
  message: string;
}

interface StageTransition {
  from: string;
  to: string;
  deliverables: string[];
  gamificationTrigger: string;
}

export class FrameworkOrchestrator {
  private supabase: any;

  // Definição rigorosa das etapas do framework
  private static readonly STAGES = [
    'apresentacao',
    'anamnese',
    'mapeamento',
    'priorizacao',
    'execucao'
  ] as const;

  // Transições permitidas entre etapas
  private static readonly STAGE_TRANSITIONS: Record<string, StageTransition> = {
    'apresentacao->anamnese': {
      from: 'apresentacao',
      to: 'anamnese',
      deliverables: [],
      gamificationTrigger: 'none'
    },
    'anamnese->mapeamento': {
      from: 'anamnese',
      to: 'mapeamento',
      deliverables: ['anamnese-empresarial'],
      gamificationTrigger: 'anamnese'
    },
    'mapeamento->priorizacao': {
      from: 'mapeamento',
      to: 'priorizacao',
      deliverables: ['business-canvas', 'cadeia-valor'],
      gamificationTrigger: 'mapeamento'
    },
    'priorizacao->execucao': {
      from: 'priorizacao',
      to: 'execucao',
      deliverables: ['matriz-priorizacao'],
      gamificationTrigger: 'priorizacao'
    }
  };

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Valida se a etapa atual está completa e pode avançar
   */
  async validateCurrentStage(jornadaId: string): Promise<ValidationResult> {
    const { data: jornada } = await this.supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('id', jornadaId)
      .single();

    if (!jornada) {
      return {
        isValid: false,
        missingFields: ['Jornada não encontrada'],
        canAdvance: false,
        message: 'Erro ao carregar jornada'
      };
    }

    const currentStage = jornada.etapa_atual || 'apresentacao';

    switch (currentStage) {
      case 'apresentacao':
        return this.validateApresentacao(jornada);
      case 'anamnese':
        return this.validateAnamnese(jornada);
      case 'mapeamento':
        return this.validateMapeamento(jornada);
      case 'priorizacao':
        return this.validatePriorizacao(jornadaId, jornada);
      case 'execucao':
        return this.validateExecucao(jornadaId);
      default:
        return {
          isValid: false,
          missingFields: ['Etapa desconhecida'],
          canAdvance: false,
          message: 'Etapa não reconhecida pelo framework'
        };
    }
  }

  /**
   * Apresentação - Sempre pode avançar para anamnese
   */
  private validateApresentacao(jornada: any): ValidationResult {
    return {
      isValid: true,
      missingFields: [],
      canAdvance: true,
      nextStage: 'anamnese',
      message: 'Pronto para iniciar anamnese'
    };
  }

  /**
   * Anamnese - Validação RIGOROSA de campos obrigatórios
   */
  private validateAnamnese(jornada: any): ValidationResult {
    const contexto = jornada.contexto_coleta || {};

    const requiredFields = [
      { key: 'nome_usuario', label: 'Nome completo do usuário' },
      { key: 'cargo', label: 'Cargo/Função na empresa' },
      { key: 'empresa_nome', label: 'Nome da empresa' },
      { key: 'segmento', label: 'Segmento de atuação' },
      { key: 'porte', label: 'Porte da empresa (micro/pequena/média/grande)' },
      { key: 'tempo_mercado', label: 'Tempo de mercado' },
      { key: 'tamanho_equipe', label: 'Tamanho da equipe' },
      { key: 'desafios_principais', label: 'Pelo menos 2 desafios principais' }
    ];

    const missing: string[] = [];

    requiredFields.forEach(field => {
      const value = contexto[field.key];

      // Validação especial para desafios (precisa ter pelo menos 2)
      if (field.key === 'desafios_principais') {
        const desafios = Array.isArray(value) ? value : [];
        if (desafios.length < 2) {
          missing.push(`${field.label} (tem ${desafios.length}, precisa 2)`);
        }
      } else if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        missing.push(field.label);
      }
    });

    const isComplete = missing.length === 0;

    return {
      isValid: isComplete,
      missingFields: missing,
      canAdvance: isComplete,
      nextStage: isComplete ? 'mapeamento' : undefined,
      message: isComplete
        ? '✅ Anamnese completa! Pronto para mapear processos.'
        : `❌ Anamnese incompleta. Faltam: ${missing.join(', ')}`
    };
  }

  /**
   * Mapeamento - DEVE ter no mínimo 3 áreas mapeadas completamente
   */
  private validateMapeamento(jornada: any): ValidationResult {
    const contexto = jornada.contexto_coleta || {};
    const areasMapeadas = Array.isArray(contexto.areas_mapeadas) ? contexto.areas_mapeadas : [];

    const MINIMO_AREAS = 3;

    // Validar que cada área tem os campos obrigatórios
    const areasCompletas = areasMapeadas.filter((area: any) => {
      return (
        area?.nome &&
        area?.existe !== undefined &&
        area?.principais_atividades &&
        (area?.desafios && area.desafios.length > 0)
      );
    });

    const isComplete = areasCompletas.length >= MINIMO_AREAS;

    return {
      isValid: isComplete,
      missingFields: isComplete ? [] : [
        `Mapear ${MINIMO_AREAS - areasCompletas.length} área(s) adicional(is) completamente`
      ],
      canAdvance: isComplete,
      nextStage: isComplete ? 'priorizacao' : undefined,
      message: isComplete
        ? `✅ Mapeamento completo! ${areasCompletas.length} áreas identificadas.`
        : `❌ Mapeadas ${areasCompletas.length} de ${MINIMO_AREAS} áreas mínimas.`
    };
  }

  /**
   * Priorização - DEVE ter áreas ordenadas por prioridade
   */
  private async validatePriorizacao(jornadaId: string, jornada: any): Promise<ValidationResult> {
    const { data: areas } = await this.supabase
      .from('areas_trabalho')
      .select('id, nome_area, posicao_prioridade')
      .eq('jornada_id', jornadaId)
      .order('posicao_prioridade', { ascending: true });

    if (!areas || areas.length === 0) {
      return {
        isValid: false,
        missingFields: ['Nenhuma área de trabalho criada ainda'],
        canAdvance: false,
        message: '❌ Aguardando criação de áreas de trabalho'
      };
    }

    // Verificar se todas têm posição definida
    const areaPrioritized = areas.every((a: any) => a.posicao_prioridade !== null && a.posicao_prioridade !== undefined);

    return {
      isValid: areaPrioritized,
      missingFields: areaPrioritized ? [] : ['Definir ordem de priorização das áreas'],
      canAdvance: areaPrioritized,
      nextStage: areaPrioritized ? 'execucao' : undefined,
      message: areaPrioritized
        ? `✅ Priorização definida! ${areas.length} áreas ordenadas.`
        : `❌ Aguardando priorização de ${areas.length} áreas`
    };
  }

  /**
   * Execução - Validação do progresso das áreas
   */
  private async validateExecucao(jornadaId: string): Promise<ValidationResult> {
    const { data: areas } = await this.supabase
      .from('areas_trabalho')
      .select('id, nome_area, etapa_area')
      .eq('jornada_id', jornadaId);

    if (!areas || areas.length === 0) {
      return {
        isValid: false,
        missingFields: ['Nenhuma área em execução'],
        canAdvance: false,
        message: 'Erro: áreas não encontradas'
      };
    }

    const areasConcluidas = areas.filter((a: any) => a.etapa_area === 'concluida').length;
    const todasConcluidas = areasConcluidas === areas.length;

    return {
      isValid: true,
      missingFields: [],
      canAdvance: todasConcluidas,
      message: todasConcluidas
        ? `✅ Todas ${areas.length} áreas concluídas! Transformação completa.`
        : `⏳ Progresso: ${areasConcluidas}/${areas.length} áreas concluídas`
    };
  }

  /**
   * Avança para a próxima etapa (COM VALIDAÇÃO RIGOROSA)
   */
  async advanceStage(jornadaId: string, forceAdvance: boolean = false): Promise<{
    success: boolean;
    newStage?: string;
    deliverables?: string[];
    gamificationTrigger?: string;
    message: string;
  }> {
    // Validar etapa atual
    const validation = await this.validateCurrentStage(jornadaId);

    if (!validation.canAdvance && !forceAdvance) {
      return {
        success: false,
        message: `Não pode avançar: ${validation.message}. Faltam: ${validation.missingFields.join(', ')}`
      };
    }

    const { data: jornada } = await this.supabase
      .from('jornadas_consultor')
      .select('etapa_atual')
      .eq('id', jornadaId)
      .single();

    const currentStage = jornada?.etapa_atual || 'apresentacao';
    const nextStage = validation.nextStage;

    if (!nextStage) {
      return {
        success: false,
        message: 'Não há próxima etapa definida'
      };
    }

    // Buscar transição
    const transitionKey = `${currentStage}->${nextStage}`;
    const transition = FrameworkOrchestrator.STAGE_TRANSITIONS[transitionKey];

    if (!transition) {
      return {
        success: false,
        message: `Transição inválida: ${currentStage} → ${nextStage}`
      };
    }

    // Atualizar etapa no banco
    const { error } = await this.supabase
      .from('jornadas_consultor')
      .update({
        etapa_atual: nextStage,
        updated_at: new Date().toISOString()
      })
      .eq('id', jornadaId);

    if (error) {
      console.error('[Framework] Erro ao avançar etapa:', error);
      return {
        success: false,
        message: 'Erro ao atualizar etapa no banco de dados'
      };
    }

    console.log(`[Framework] ✅ Avançado: ${currentStage} → ${nextStage}`);

    return {
      success: true,
      newStage: nextStage,
      deliverables: transition.deliverables,
      gamificationTrigger: transition.gamificationTrigger,
      message: `Avançado para: ${nextStage}`
    };
  }

  /**
   * Retorna a próxima pergunta do framework baseada na etapa e contexto
   */
  getNextFrameworkQuestion(stage: string, contexto: any): string {
    switch (stage) {
      case 'apresentacao':
        return 'Olá! Sou o Proceda Consultor IA, especialista em transformação empresarial. Antes de começarmos, qual é o seu nome completo?';

      case 'anamnese':
        return this.getNextAnamneseQuestion(contexto);

      case 'mapeamento':
        return this.getNextMapeamentoQuestion(contexto);

      case 'priorizacao':
        return 'Agora vamos priorizar as áreas mapeadas. Qual área você considera mais urgente ou crítica para começar?';

      case 'execucao':
        return 'Vamos iniciar a execução da primeira área priorizada. Pronto para mapear os processos em detalhe?';

      default:
        return 'Como posso ajudar?';
    }
  }

  private getNextAnamneseQuestion(contexto: any): string {
    if (!contexto.nome_usuario) {
      return 'Qual é o seu nome completo?';
    }
    if (!contexto.cargo) {
      return `Prazer, ${contexto.nome_usuario}! Qual é o seu cargo na empresa?`;
    }
    if (!contexto.empresa_nome) {
      return 'Qual é o nome da empresa que você representa?';
    }
    if (!contexto.segmento) {
      return `Ótimo! Em qual segmento a ${contexto.empresa_nome} atua?`;
    }
    if (!contexto.porte) {
      return 'Qual é o porte da empresa? (Micro, Pequena, Média ou Grande)';
    }
    if (!contexto.tempo_mercado) {
      return 'Há quanto tempo a empresa está no mercado?';
    }
    if (!contexto.tamanho_equipe) {
      return 'Quantos colaboradores trabalham na empresa atualmente?';
    }
    if (!contexto.desafios_principais || (Array.isArray(contexto.desafios_principais) && contexto.desafios_principais.length < 2)) {
      return 'Quais são os 2-3 principais desafios que a empresa enfrenta hoje?';
    }

    return 'Anamnese completa! Vamos avançar para o mapeamento de processos.';
  }

  private getNextMapeamentoQuestion(contexto: any): string {
    const areasMapeadas = Array.isArray(contexto.areas_mapeadas) ? contexto.areas_mapeadas : [];

    if (areasMapeadas.length === 0) {
      return 'Vamos mapear as principais áreas da empresa. Começando: como funciona a área COMERCIAL/VENDAS? Existe? Quem cuida? Quais as principais atividades?';
    }

    if (areasMapeadas.length === 1) {
      return 'Ótimo! Agora vamos para a área OPERACIONAL/PRODUÇÃO. Como funciona? Quem é o responsável? Quais os principais processos?';
    }

    if (areasMapeadas.length === 2) {
      return 'Perfeito! Última área essencial: FINANCEIRO. Como é feito o controle financeiro? Quem cuida? Quais ferramentas usam?';
    }

    return 'Mapeamento das 3 áreas essenciais concluído! Pronto para priorizar?';
  }
}
