// supabase/functions/consultor-chat/framework-guide.ts
/**
 * FrameworkGuide - Sistema de Orientação Inteligente para Framework Proceda
 *
 * Funciona como um consultor experiente que:
 * - Sabe exatamente onde está no framework
 * - Responde dúvidas livremente sem travar o diálogo
 * - Retoma gentilmente quando necessário
 * - Nunca repete etapas concluídas
 * - Suporta N processos em paralelo sem travar ou entrar em loop
 */

export interface ProcessoChecklist {
  id: string;
  framework_checklist_id: string;
  conversation_id: string;
  processo_nome: string;
  processo_ordem: number;
  atributos_preenchidos: boolean;
  atributos_cta_enviado?: boolean;
  atributos_usuario_confirmou?: boolean;
  bpmn_as_is_mapeado: boolean;
  diagnostico_preenchido: boolean;
  processo_completo: boolean;
  estado_processo?: string;
  iteracoes_processo?: number;
  xp_atributos_concedido: boolean;
  xp_bpmn_concedido: boolean;
  xp_diagnostico_concedido: boolean;
}

export interface FrameworkChecklistData {
  id: string;
  apresentacao_feita: boolean;
  anamnese_preenchida: boolean;
  anamnese_analisada: boolean;
  anamnese_formulario_exibido: boolean;
  anamnese_cta_enviado?: boolean;
  anamnese_usuario_confirmou?: boolean;
  canvas_preenchido: boolean;
  canvas_formulario_exibido: boolean;
  canvas_cta_enviado?: boolean;
  canvas_usuario_confirmou?: boolean;
  cadeia_valor_preenchida: boolean;
  cadeia_valor_formulario_exibida: boolean;
  cadeia_valor_cta_enviado?: boolean;
  cadeia_valor_usuario_confirmou?: boolean;
  processos_identificados: boolean;
  escopo_priorizacao_definido: boolean;
  escopo_quantidade_processos: number;
  escopo_processos_nomes: string[];
  matriz_priorizacao_preenchida: boolean;
  matriz_priorizacao_formulario_exibido: boolean;
  escopo_validado_pelo_usuario?: boolean;
  aguardando_validacao_escopo?: boolean;
  todos_processos_concluidos: boolean;
  plano_acao_gerado: boolean;
  fase_atual?: string;
  iteracoes_fase_atual?: number;
  xp_anamnese_concedido: boolean;
  xp_canvas_concedido: boolean;
  xp_cadeia_valor_concedido: boolean;
  xp_matriz_priorizacao_concedido: boolean;
  xp_plano_acao_concedido: boolean;
  xp_conclusao_concedido: boolean;
}

export class FrameworkGuide {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Gera contexto de orientação para a LLM (não instruções rígidas)
   */
  async getGuideContext(conversationId: string): Promise<string> {
    let { data: checklist, error: checklistError } = await this.supabase
      .from('framework_checklist')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    // Se checklist não existe, criar automaticamente
    if (!checklist && !checklistError) {
      console.log('[FRAMEWORK_GUIDE] Checklist não existe, criando automaticamente...');
      const { data: newChecklist, error: createError } = await this.supabase
        .from('framework_checklist')
        .insert({
          conversation_id: conversationId,
          apresentacao_feita: false,
          anamnese_preenchida: false,
          anamnese_analisada: false,
          anamnese_formulario_exibido: false,
          canvas_preenchido: false,
          canvas_formulario_exibido: false,
          cadeia_valor_preenchida: false,
          cadeia_valor_formulario_exibida: false,
          processos_identificados: false,
          escopo_priorizacao_definido: false,
          escopo_quantidade_processos: 0,
          escopo_processos_nomes: [],
          matriz_priorizacao_preenchida: false,
          matriz_priorizacao_formulario_exibido: false,
          todos_processos_concluidos: false,
          plano_acao_gerado: false,
          xp_anamnese_concedido: false,
          xp_canvas_concedido: false,
          xp_cadeia_valor_concedido: false,
          xp_matriz_priorizacao_concedido: false,
          xp_plano_acao_concedido: false,
          xp_conclusao_concedido: false
        })
        .select()
        .single();

      if (createError) {
        console.error('[FRAMEWORK_GUIDE] Erro ao criar checklist:', createError);
        return "";
      }
      checklist = newChecklist;
      console.log('[FRAMEWORK_GUIDE] Checklist criado com sucesso');
    }

    if (checklistError || !checklist) {
      console.error('[FRAMEWORK_GUIDE] Erro ao buscar checklist:', checklistError);
      return "";
    }

    const { data: processos } = await this.supabase
      .from('processo_checklist')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('processo_ordem');

    const context = `
=== SEU CONTEXTO INTERNO (Framework Proceda) ===
Use isso como ORIENTAÇÃO, não como script rígido. Você é um consultor experiente.

📍 ONDE ESTAMOS:
${this.buildCurrentState(checklist as FrameworkChecklistData, (processos || []) as ProcessoChecklist[])}

🎯 ESCOPO DEFINIDO:
${this.buildScopeInfo(checklist as FrameworkChecklistData, (processos || []) as ProcessoChecklist[])}

💭 PRÓXIMO OBJETIVO NATURAL:
${this.suggestNextStep(checklist as FrameworkChecklistData, (processos || []) as ProcessoChecklist[])}

⚠️ EVITE:
${this.buildAvoidanceList(checklist as FrameworkChecklistData, (processos || []) as ProcessoChecklist[])}

🎮 GAMIFICAÇÃO PENDENTE:
${this.buildPendingXP(checklist as FrameworkChecklistData, (processos || []) as ProcessoChecklist[])}

📋 PRINCÍPIOS DO DIÁLOGO:
- SEMPRE responda dúvidas do cliente, mesmo fora da sequência
- Seja natural e conversacional
- Use o checklist para NÃO repetir o que já foi feito
- Retome gentilmente quando cliente se desviar muito
- Se cliente perguntar algo de etapa futura, explique com contexto
`;

    return context;
  }

  private buildCurrentState(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    const steps: string[] = [];

    if (checklist.apresentacao_feita) steps.push("✅ Apresentação feita");
    if (checklist.anamnese_preenchida) steps.push("✅ Anamnese completa");
    if (checklist.canvas_preenchido) steps.push("✅ Canvas mapeado");
    if (checklist.cadeia_valor_preenchida) steps.push("✅ Cadeia de Valor definida");
    if (checklist.processos_identificados) steps.push("✅ Processos identificados");
    if (checklist.escopo_priorizacao_definido) steps.push("✅ Escopo definido");
    if (checklist.matriz_priorizacao_preenchida) steps.push("✅ Matriz de Priorização feita");

    processos.forEach((p, idx) => {
      if (p.processo_completo) {
        steps.push(`✅ Processo ${idx + 1}: ${p.processo_nome} - Concluído`);
      } else if (p.diagnostico_preenchido) {
        steps.push(`🔄 Processo ${idx + 1}: ${p.processo_nome} - Diagnóstico ok`);
      } else if (p.bpmn_as_is_mapeado) {
        steps.push(`🔄 Processo ${idx + 1}: ${p.processo_nome} - BPMN mapeado`);
      } else if (p.atributos_preenchidos) {
        steps.push(`🔄 Processo ${idx + 1}: ${p.processo_nome} - Atributos ok`);
      }
    });

    if (checklist.plano_acao_gerado) steps.push("✅ Plano de Ação entregue");

    return steps.length > 0 ? steps.join("\n") : "🆕 Início da jornada";
  }

  private buildScopeInfo(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    if (!checklist.escopo_priorizacao_definido) {
      return "❌ Escopo ainda não definido. Após matriz de priorização, discuta com cliente QUANTOS e QUAIS processos mapear.";
    }

    const total = processos.length;
    const completos = processos.filter(p => p.processo_completo).length;

    let info = `✅ Escopo: ${total} processo(s) para mapear\n`;
    info += `📊 Progresso: ${completos}/${total} processos concluídos\n\n`;

    processos.forEach((p, idx) => {
      const status = p.processo_completo ? '✅ Completo' :
                     p.diagnostico_preenchido ? '🔄 Aguardando conclusão' :
                     p.bpmn_as_is_mapeado ? '🔄 BPMN ok, falta diagnóstico' :
                     p.atributos_preenchidos ? '🔄 Atributos ok, falta BPMN' :
                     '⏳ Pendente';
      info += `${idx + 1}. ${p.processo_nome}: ${status}\n`;
    });

    return info;
  }

  private suggestNextStep(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    if (!checklist.apresentacao_feita) {
      return "Apresentar-se brevemente e pedir permissão para iniciar.";
    }
    if (!checklist.anamnese_cta_enviado) {
      return "Propor de forma conversacional: 'Posso enviar um formulário rápido de anamnese?' (não envie o form ainda!)";
    }
    if (checklist.anamnese_cta_enviado && !checklist.anamnese_usuario_confirmou) {
      return "⏸️ AGUARDANDO: Usuário confirmar que quer preencher anamnese. NÃO envie o formulário até ele responder positivamente. SE o usuário já disse 'sim' ou 'pode' anteriormente, detecte isso e envie o formulário IMEDIATAMENTE.";
    }
    if (checklist.anamnese_usuario_confirmou && !checklist.anamnese_formulario_exibido) {
      return "✅ USUÁRIO CONFIRMOU! Enviar formulário de anamnese AGORA: [EXIBIR_FORMULARIO:anamnese]";
    }
    if (checklist.anamnese_formulario_exibido && !checklist.anamnese_preenchida) {
      return "Aguardando cliente preencher anamnese. Responda dúvidas se houver.";
    }
    if (checklist.anamnese_preenchida && !checklist.anamnese_analisada) {
      return "Fazer análise dos dados da anamnese e introduzir Business Model Canvas.";
    }
    if (checklist.anamnese_analisada && !checklist.canvas_cta_enviado) {
      return "Propor de forma conversacional: 'Que tal mapearmos seu modelo de negócio no Canvas?' (não envie o form ainda!)";
    }
    if (checklist.canvas_cta_enviado && !checklist.canvas_usuario_confirmou) {
      return "⏸️ AGUARDANDO: Usuário confirmar que quer preencher Canvas. NÃO envie o formulário até ele responder.";
    }
    if (checklist.canvas_usuario_confirmou && !checklist.canvas_formulario_exibido) {
      return "Enviar formulário de Canvas agora: [EXIBIR_FORMULARIO:canvas]";
    }
    if (checklist.canvas_formulario_exibido && !checklist.canvas_preenchido) {
      return "Aguardando Canvas. Tire dúvidas se necessário.";
    }
    if (checklist.canvas_preenchido && !checklist.cadeia_valor_cta_enviado) {
      return "Introduzir Cadeia de Valor de Porter e perguntar: 'Posso enviar o formulário de Cadeia de Valor?' (não envie ainda!)";
    }
    if (checklist.cadeia_valor_cta_enviado && !checklist.cadeia_valor_usuario_confirmou) {
      return "⏸️ AGUARDANDO: Usuário confirmar que quer preencher Cadeia de Valor. NÃO envie o formulário.";
    }
    if (checklist.cadeia_valor_usuario_confirmou && !checklist.cadeia_valor_formulario_exibida) {
      return "Enviar formulário de Cadeia de Valor agora: [EXIBIR_FORMULARIO:cadeia_valor]";
    }
    if (checklist.cadeia_valor_formulario_exibida && !checklist.cadeia_valor_preenchida) {
      return "Aguardando Cadeia de Valor.";
    }
    if (checklist.cadeia_valor_preenchida && !checklist.processos_identificados) {
      return "Ajudar a identificar processos-chave da empresa baseado na cadeia.";
    }
    if (checklist.processos_identificados && !checklist.escopo_priorizacao_definido) {
      return "DEFINIR ESCOPO: Perguntar ao cliente QUANTOS processos ele quer mapear (sugestão: 2-5 processos). Liste os candidatos e deixe ele escolher.";
    }
    if (checklist.escopo_priorizacao_definido && !checklist.matriz_priorizacao_preenchida) {
      return "GERAR MATRIZ AUTOMATICAMENTE: Analise os processos da cadeia de valor, calcule prioridades (impacto × criticidade / esforço) e gere a matriz: [GERAR_ENTREGAVEL:matriz_priorizacao]";
    }
    if (checklist.matriz_priorizacao_preenchida && !checklist.aguardando_validacao_escopo) {
      return "Apresentar matriz de priorização e escopo sugerido. Perguntar: 'Você concorda com essa priorização?' e enviar botão: [ACAO_USUARIO:validar_escopo]";
    }
    if (checklist.aguardando_validacao_escopo && !checklist.escopo_validado_pelo_usuario) {
      return "⏸️ AGUARDANDO: Usuário validar o escopo proposto. NÃO avance para execução até ele validar.";
    }

    if (processos.length > 0) {
      const processoAtual = processos.find(p => !p.processo_completo);

      if (!processoAtual) {
        if (!checklist.plano_acao_gerado) {
          return "🎉 TODOS processos mapeados! Gerar Plano de Ação consolidado com todas melhorias priorizadas: [GERAR_ENTREGAVEL:plano_acao]";
        }
        return "✅ Framework completo! Manter disponibilidade para ajustes e dúvidas.";
      }

      if (!processoAtual.atributos_cta_enviado) {
        return `Propor coleta de atributos do processo "${processoAtual.processo_nome}": 'Vamos coletar os atributos deste processo?' (Processo ${processoAtual.processo_ordem}/${processos.length})`;
      }
      if (processoAtual.atributos_cta_enviado && !processoAtual.atributos_usuario_confirmou) {
        return `⏸️ AGUARDANDO: Usuário confirmar coleta de atributos do processo "${processoAtual.processo_nome}". NÃO envie formulário.`;
      }
      if (processoAtual.atributos_usuario_confirmou && !processoAtual.atributos_preenchidos) {
        return `Enviar formulário de atributos do processo "${processoAtual.processo_nome}": [EXIBIR_FORMULARIO:atributos] (Processo ${processoAtual.processo_ordem}/${processos.length})`;
      }
      if (!processoAtual.bpmn_as_is_mapeado) {
        return `Mapear BPMN AS-IS do processo "${processoAtual.processo_nome}": [GERAR_ENTREGAVEL:bpmn_as_is] (Processo ${processoAtual.processo_ordem}/${processos.length})`;
      }
      if (!processoAtual.diagnostico_preenchido) {
        return `Realizar diagnóstico do processo "${processoAtual.processo_nome}": [EXIBIR_FORMULARIO:diagnostico] (Processo ${processoAtual.processo_ordem}/${processos.length})`;
      }

      return `Processo "${processoAtual.processo_nome}" concluído! Passando para próximo processo do escopo.`;
    }

    return "Prosseguir naturalmente na conversa.";
  }

  private buildAvoidanceList(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    const avoid: string[] = [];

    if (checklist.apresentacao_feita) avoid.push("- NÃO se apresente novamente");
    if (checklist.anamnese_preenchida) avoid.push("- NÃO peça dados que já estão na anamnese");
    if (checklist.anamnese_formulario_exibido) avoid.push("- NÃO envie formulário de anamnese novamente");
    if (checklist.canvas_preenchido) avoid.push("- NÃO peça Canvas novamente");
    if (checklist.canvas_formulario_exibido) avoid.push("- NÃO envie formulário de Canvas novamente");
    if (checklist.cadeia_valor_preenchida) avoid.push("- NÃO peça Cadeia de Valor novamente");
    if (checklist.cadeia_valor_formulario_exibida) avoid.push("- NÃO envie formulário de Cadeia de Valor novamente");
    if (checklist.matriz_priorizacao_preenchida) avoid.push("- NÃO gere matriz novamente - ela já foi gerada");

    if (!checklist.escopo_priorizacao_definido && checklist.processos_identificados) {
      avoid.push("- NÃO pule a definição de escopo - pergunte QUAIS processos priorizar");
    }

    processos.forEach(p => {
      if (!p.bpmn_as_is_mapeado && p.atributos_preenchidos) {
        avoid.push(`- NÃO pule o BPMN AS-IS do processo "${p.processo_nome}"`);
      }
    });

    return avoid.length > 0 ? avoid.join("\n") : "- Nenhuma restrição no momento";
  }

  private buildPendingXP(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    const pending: string[] = [];

    if (checklist.anamnese_preenchida && !checklist.xp_anamnese_concedido) {
      pending.push("🎁 [GAMIFICACAO:anamnese_completa:50]");
    }
    if (checklist.canvas_preenchido && !checklist.xp_canvas_concedido) {
      pending.push("🎁 [GAMIFICACAO:canvas_completo:75]");
    }
    if (checklist.cadeia_valor_preenchida && !checklist.xp_cadeia_valor_concedido) {
      pending.push("🎁 [GAMIFICACAO:cadeia_valor_completa:60]");
    }
    if (checklist.matriz_priorizacao_preenchida && !checklist.xp_matriz_priorizacao_concedido) {
      pending.push("🎁 [GAMIFICACAO:matriz_completa:80]");
    }

    processos.forEach(p => {
      const processoSlug = p.processo_nome.toLowerCase().replace(/\s+/g, '_');
      if (p.atributos_preenchidos && !p.xp_atributos_concedido) {
        pending.push(`🎁 [GAMIFICACAO:atributos_${processoSlug}:50]`);
      }
      if (p.bpmn_as_is_mapeado && !p.xp_bpmn_concedido) {
        pending.push(`🎁 [GAMIFICACAO:bpmn_${processoSlug}:100]`);
      }
      if (p.diagnostico_preenchido && !p.xp_diagnostico_concedido) {
        pending.push(`🎁 [GAMIFICACAO:diagnostico_${processoSlug}:90]`);
      }
    });

    if (checklist.plano_acao_gerado && !checklist.xp_plano_acao_concedido) {
      pending.push("🎁 [GAMIFICACAO:plano_acao_gerado:150]");
    }
    if (checklist.todos_processos_concluidos && checklist.plano_acao_gerado && !checklist.xp_conclusao_concedido) {
      pending.push("🎁 [GAMIFICACAO:framework_completo:200]");
    }

    return pending.length > 0
      ? "USE estes marcadores na sua próxima resposta:\n" + pending.join("\n")
      : "✅ Nenhum XP pendente no momento.";
  }

  /**
   * Marca evento geral do framework
   */
  async markEvent(conversationId: string, event: string, metadata?: any): Promise<void> {
    const updates: any = { ultima_interacao: new Date().toISOString(), updated_at: new Date().toISOString() };

    const eventMap: Record<string, any> = {
      'apresentacao': { apresentacao_feita: true, apresentacao_ts: new Date().toISOString() },
      'anamnese_cta_enviado': { anamnese_cta_enviado: true },
      'anamnese_confirmada': { anamnese_usuario_confirmou: true },
      'anamnese_exibida': { anamnese_formulario_exibido: true },
      'anamnese_preenchida': { anamnese_preenchida: true, anamnese_ts: new Date().toISOString() },
      'anamnese_analisada': { anamnese_analisada: true },
      'canvas_cta_enviado': { canvas_cta_enviado: true },
      'canvas_confirmado': { canvas_usuario_confirmou: true },
      'canvas_exibido': { canvas_formulario_exibido: true },
      'canvas_preenchido': { canvas_preenchido: true, canvas_ts: new Date().toISOString() },
      'cadeia_valor_cta_enviado': { cadeia_valor_cta_enviado: true },
      'cadeia_valor_confirmada': { cadeia_valor_usuario_confirmou: true },
      'cadeia_valor_exibida': { cadeia_valor_formulario_exibida: true },
      'cadeia_valor_preenchida': { cadeia_valor_preenchida: true, cadeia_valor_ts: new Date().toISOString() },
      'processos_identificados': { processos_identificados: true, processos_identificados_ts: new Date().toISOString() },
      'matriz_gerada': { matriz_priorizacao_preenchida: true, matriz_priorizacao_ts: new Date().toISOString(), aguardando_validacao_escopo: true },
      'escopo_validado': { escopo_validado_pelo_usuario: true, escopo_validacao_ts: new Date().toISOString(), aguardando_validacao_escopo: false },
      'plano_gerado': { plano_acao_gerado: true, plano_acao_ts: new Date().toISOString() },
      'xp_anamnese': { xp_anamnese_concedido: true },
      'xp_canvas': { xp_canvas_concedido: true },
      'xp_cadeia': { xp_cadeia_valor_concedido: true },
      'xp_matriz': { xp_matriz_priorizacao_concedido: true },
      'xp_plano': { xp_plano_acao_concedido: true },
      'xp_conclusao': { xp_conclusao_concedido: true },
    };

    const eventUpdates = eventMap[event];
    if (eventUpdates) {
      Object.assign(updates, eventUpdates);
    }

    const { error } = await this.supabase
      .from('framework_checklist')
      .update(updates)
      .eq('conversation_id', conversationId);

    if (error) {
      console.error(`[FRAMEWORK_GUIDE] Erro ao marcar evento ${event}:`, error);
    } else {
      console.log(`[FRAMEWORK_GUIDE] Evento registrado: ${event}`);
    }
  }

  /**
   * Define escopo após priorização
   */
  async definirEscopo(conversationId: string, processosNomes: string[]): Promise<void> {
    const { data: checklist } = await this.supabase
      .from('framework_checklist')
      .select('id')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!checklist) {
      console.error('[FRAMEWORK_GUIDE] Checklist não encontrado para definir escopo');
      return;
    }

    await this.supabase
      .from('framework_checklist')
      .update({
        escopo_priorizacao_definido: true,
        escopo_quantidade_processos: processosNomes.length,
        escopo_processos_nomes: processosNomes,
        escopo_ts: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', checklist.id);

    const { error: rpcError } = await this.supabase.rpc('create_processo_checklists', {
      p_framework_checklist_id: checklist.id,
      p_conversation_id: conversationId,
      p_processos_nomes: processosNomes
    });

    if (rpcError) {
      console.error('[FRAMEWORK_GUIDE] Erro ao criar processo checklists:', rpcError);
    } else {
      console.log(`[FRAMEWORK_GUIDE] Escopo definido: ${processosNomes.length} processos`);
    }
  }

  /**
   * Marca evento em processo específico
   */
  async markProcessoEvent(conversationId: string, processoNome: string, event: string): Promise<void> {
    const updates: any = { updated_at: new Date().toISOString() };

    switch(event) {
      case 'atributos_cta_enviado':
        updates.atributos_cta_enviado = true;
        break;
      case 'atributos_confirmado':
        updates.atributos_usuario_confirmou = true;
        break;
      case 'atributos_exibidos':
        updates.atributos_formulario_exibido = true;
        break;
      case 'atributos_preenchidos':
        updates.atributos_preenchidos = true;
        updates.atributos_ts = new Date().toISOString();
        updates.estado_processo = 'BPMN';
        break;
      case 'bpmn_solicitado':
        updates.bpmn_as_is_solicitado = true;
        break;
      case 'bpmn_mapeado':
        updates.bpmn_as_is_mapeado = true;
        updates.bpmn_as_is_ts = new Date().toISOString();
        updates.estado_processo = 'DIAGNOSTICO';
        break;
      case 'diagnostico_exibido':
        updates.diagnostico_formulario_exibido = true;
        break;
      case 'diagnostico_preenchido':
        updates.diagnostico_preenchido = true;
        updates.diagnostico_ts = new Date().toISOString();
        updates.processo_completo = true;
        updates.processo_completo_ts = new Date().toISOString();
        updates.estado_processo = 'COMPLETO';
        break;
      case 'xp_atributos':
        updates.xp_atributos_concedido = true;
        break;
      case 'xp_bpmn':
        updates.xp_bpmn_concedido = true;
        break;
      case 'xp_diagnostico':
        updates.xp_diagnostico_concedido = true;
        break;
    }

    const { error } = await this.supabase
      .from('processo_checklist')
      .update(updates)
      .eq('conversation_id', conversationId)
      .eq('processo_nome', processoNome);

    if (error) {
      console.error(`[FRAMEWORK_GUIDE] Erro ao marcar evento de processo ${processoNome}:`, error);
    } else {
      console.log(`[FRAMEWORK_GUIDE] Processo ${processoNome}: ${event}`);
    }
  }

  /**
   * Detecta se mensagem do usuário contém confirmação positiva
   */
  isUserConfirmation(message: string): boolean {
    const lowerMsg = message.toLowerCase().trim();
    const confirmPatterns = [
      /^sim$/,
      /^ok$/,
      /^pode$/,
      /^claro$/,
      /^vamos/,
      /^concordo/,
      /^aceito/,
      /pode sim/,
      /vamos lá/,
      /com certeza/,
      /vamos em frente/,
      /pode enviar/,
      /pode mandar/,
      /sim.*pode/,
      /já falei que (sim|pode)/,
      /pode começar/,
      /bora/,
      /beleza/,
      /tudo bem/,
      /positivo/,
      /confirmo/,
    ];
    return confirmPatterns.some(pattern => pattern.test(lowerMsg));
  }

  /**
   * Verifica se está aguardando confirmação de algum CTA
   */
  async isAwaitingConfirmation(conversationId: string): Promise<{awaiting: boolean, type?: string}> {
    const { data: checklist } = await this.supabase
      .from('framework_checklist')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!checklist) return { awaiting: false };

    if (checklist.anamnese_cta_enviado && !checklist.anamnese_usuario_confirmou) {
      return { awaiting: true, type: 'anamnese' };
    }
    if (checklist.canvas_cta_enviado && !checklist.canvas_usuario_confirmou) {
      return { awaiting: true, type: 'canvas' };
    }
    if (checklist.cadeia_valor_cta_enviado && !checklist.cadeia_valor_usuario_confirmou) {
      return { awaiting: true, type: 'cadeia_valor' };
    }
    if (checklist.aguardando_validacao_escopo && !checklist.escopo_validado_pelo_usuario) {
      return { awaiting: true, type: 'escopo' };
    }

    const { data: processos } = await this.supabase
      .from('processo_checklist')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('processo_ordem');

    if (processos) {
      const processoAguardando = processos.find(p =>
        p.atributos_cta_enviado && !p.atributos_usuario_confirmou
      );
      if (processoAguardando) {
        return { awaiting: true, type: `atributos:${processoAguardando.processo_nome}` };
      }
    }

    return { awaiting: false };
  }

  /**
   * Verifica se uma etapa pode ser executada
   */
  async canExecuteStep(conversationId: string, step: string): Promise<boolean> {
    const { data: checklist } = await this.supabase
      .from('framework_checklist')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!checklist) return false;

    switch(step) {
      case 'anamnese':
        return checklist.apresentacao_feita;
      case 'canvas':
        return checklist.anamnese_preenchida;
      case 'cadeia_valor':
        return checklist.canvas_preenchido;
      case 'processos':
        return checklist.cadeia_valor_preenchida;
      case 'escopo':
        return checklist.processos_identificados;
      case 'matriz':
        return checklist.escopo_priorizacao_definido;
      case 'atributos':
        return checklist.matriz_priorizacao_preenchida;
      case 'plano_acao':
        return checklist.todos_processos_concluidos;
      default:
        return true;
    }
  }
}
