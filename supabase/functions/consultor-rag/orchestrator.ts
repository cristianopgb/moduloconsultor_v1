/**
 * Orquestrador de Fluxo do Consultor
 *
 * Responsável por:
 * 1. Determinar próxima ação baseado no estado da sessão
 * 2. Decidir quais metodologias aplicar via RAG
 * 3. Gerenciar transições de estado
 * 4. Coordenar coleta de informações
 * 5. Acionar geração de entregáveis
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno';

export interface SessaoConsultor {
  id: string;
  user_id: string;
  conversation_id: string | null;
  titulo_problema: string;
  contexto_negocio: any;
  metodologias_aplicadas: string[];
  estado_atual: string;
  documentos_usados: string[];
  historico_rag: any[];
  entregaveis_gerados: string[];
  progresso: number;
  ativo: boolean;
}

export interface AcaoOrquestrador {
  tipo_acao: 'coletar_info' | 'aplicar_metodologia' | 'gerar_entregavel' | 'validar' | 'transicao_estado';
  prioridade: number;
  descricao: string;
  entrada: any;
  requer_confirmacao?: boolean;
}

export class ConsultorOrchestrator {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  /**
   * System prompt with strong anti-interrogation rules
   */
  getSystemPrompt(): string {
    return `Você é o Consultor Proceda. Sua missão é CONDUZIR o projeto com método e gerar entregáveis úteis.

Regras duras:
1) No MÁXIMO 1 pergunta objetiva por turno, e só se for CRÍTICA para avançar. Se faltar dado não-crítico, ASSUMA uma hipótese razoável e anote needsValidation:true.
2) Sempre que houver insumo suficiente, EMITA ações:
   - gerar_entregavel: ishikawa | sipoc | bpmn_as_is | bpmn_to_be | gut | 5w2h | okr | bsc | escopo | diagnostico
   - transicao_estado: anamnese | as_is | diagnostico | to_be | plano | execucao
   - ensure_kanban: cards do plano (5W2H/OKR) por sessão
3) Saída OBRIGATÓRIA em duas partes:
[PARTE A: texto consultivo claro, aplicado ao caso]
---
[PARTE B: JSON estrito]
{ "actions": [...], "contexto_incremental": {...} }
4) Anti-loop: NÃO repita a mesma pergunta no turno seguinte; avance com hipótese + needsValidation:true.
5) Aplique RAG (playbook Proceda + boas práticas por área) SEM copiar trechos; sintetize ao caso do cliente.`;
  }

  /**
   * Few-shot example for logistics sector
   */
  getFewShotExample(): string {
    return `[EXEMPLO – TRANSPORTES/LOGÍSTICA]
Usuário: "Sou transportadora fracionada, minhas vendas não escalam e o financeiro está desorganizado."
Assistente (modelo de resposta correta):
[PARTE A]
Vamos atacar duas frentes em paralelo:
1) Comercial: hipóteses — funil fraco (prospecção manual), proposta não padronizada, ICP inexistente.
   Entregáveis: GUT (gargalos de conversão) + SIPOC do processo comercial AS IS.
2) Financeiro: hipóteses — DRE inconsistente, prazos/recebíveis sem política, rateio logístico ausente.
   Entregáveis: 5W2H com 6 itens de correção (política por cliente, checklist de faturamento, calendário de prazos).
---
{
  "actions":[
    {"type":"gerar_entregavel","deliverableType":"gut","contexto":{"tema":"Gargalos de conversão comercial"}},
    {"type":"gerar_entregavel","deliverableType":"sipoc","contexto":{"process":"Pré-venda → Proposta → Fechamento → Onboarding"}},
    {"type":"gerar_entregavel","deliverableType":"5w2h","contexto":{"itens":[{"what":"Padronizar proposta","who":"Comercial","when":"7d"}]}},
    {"type":"transicao_estado","to":"diagnostico"}
  ],
  "contexto_incremental":{"setor_prioritario":"Comercial+Financeiro","needsValidation":true}
}`;
  }

  /**
   * Parse actions from LLM response
   */
  parseActionsBlock(textoLLM: string): { actions: any[], contexto_incremental: any } {
    let idx = textoLLM.indexOf('\n---');

    if (idx === -1) {
      const jsonMatch = textoLLM.match(/\{[\s\S]*"actions"[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
            contexto_incremental: parsed?.contexto_incremental || {}
          };
        } catch {
          return { actions: [], contexto_incremental: {} };
        }
      }
      return { actions: [], contexto_incremental: {} };
    }

    const jsonStr = textoLLM.slice(idx + 4).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
        contexto_incremental: parsed?.contexto_incremental || {}
      };
    } catch {
      return { actions: [], contexto_incremental: {} };
    }
  }

  /**
   * Synthesize fallback actions when LLM doesn't comply
   */
  synthesizeFallbackActions(estadoAtual: string, userMsg: string): any[] {
    if (estadoAtual === 'anamnese' || estadoAtual === 'coleta') {
      return [
        { type: 'gerar_entregavel', deliverableType: 'escopo', contexto: { resumo: userMsg } },
        { type: 'transicao_estado', to: 'as_is' }
      ];
    }
    if (estadoAtual === 'as_is') {
      return [
        { type: 'gerar_entregavel', deliverableType: 'sipoc', contexto: { process: 'Comercial: Pré-venda → Proposta → Fechamento → Onboarding' } },
        { type: 'gerar_entregavel', deliverableType: 'bpmn_as_is', contexto: { nome: 'Comercial – AS IS' } },
        { type: 'transicao_estado', to: 'diagnostico' }
      ];
    }
    if (estadoAtual === 'diagnostico') {
      return [
        { type: 'gerar_entregavel', deliverableType: 'ishikawa', contexto: { problema: 'Conversão baixa e retrabalho financeiro' } },
        { type: 'gerar_entregavel', deliverableType: 'gut', contexto: { tema: 'Priorização Comercial/Financeiro' } },
        { type: 'transicao_estado', to: 'to_be' }
      ];
    }
    if (estadoAtual === 'to_be') {
      return [
        { type: 'gerar_entregavel', deliverableType: 'bpmn_to_be', contexto: { nome: 'Comercial – TO BE' } },
        { type: 'transicao_estado', to: 'plano' }
      ];
    }
    if (estadoAtual === 'plano') {
      return [
        { type: 'gerar_entregavel', deliverableType: '5w2h', contexto: { itens: [] } },
        { type: 'ensure_kanban', sessaoId: 'RUNTIME', plano: { cards: [] } },
        { type: 'transicao_estado', to: 'execucao' }
      ];
    }
    return [];
  }

  /**
   * Determina próximas ações baseado no estado da sessão
   */
  async determinarProximasAcoes(sessao: SessaoConsultor): Promise<AcaoOrquestrador[]> {
    const acoes: AcaoOrquestrador[] = [];

    // Análise do estado atual
    switch (sessao.estado_atual) {
      case 'coleta':
        acoes.push(...await this.acoesParaColeta(sessao));
        break;

      case 'analise':
        acoes.push(...await this.acoesParaAnalise(sessao));
        break;

      case 'diagnostico':
        acoes.push(...await this.acoesParaDiagnostico(sessao));
        break;

      case 'recomendacao':
        acoes.push(...await this.acoesParaRecomendacao(sessao));
        break;

      case 'execucao':
        acoes.push(...await this.acoesParaExecucao(sessao));
        break;
    }

    // Ordena por prioridade
    return acoes.sort((a, b) => b.prioridade - a.prioridade);
  }

  /**
   * Ações para fase de coleta
   */
  private async acoesParaColeta(sessao: SessaoConsultor): Promise<AcaoOrquestrador[]> {
    const acoes: AcaoOrquestrador[] = [];
    const contexto = sessao.contexto_negocio || {};

    // Verifica informações essenciais faltantes
    const infoEssenciais = [
      { campo: 'empresa_nome', pergunta: 'Como se chama sua empresa?' },
      { campo: 'segmento', pergunta: 'Qual o segmento/ramo de atuação?' },
      { campo: 'porte', pergunta: 'Qual o porte da empresa? (micro, pequena, média, grande)' },
      { campo: 'descricao_problema', pergunta: 'Descreva o problema ou desafio que está enfrentando' },
      { campo: 'objetivo_principal', pergunta: 'Qual o principal objetivo que deseja alcançar?' }
    ];

    for (const info of infoEssenciais) {
      if (!contexto[info.campo]) {
        acoes.push({
          tipo_acao: 'coletar_info',
          prioridade: 10,
          descricao: `Coletar: ${info.campo}`,
          entrada: {
            campo: info.campo,
            pergunta: info.pergunta,
            tipo_resposta: 'texto'
          }
        });
      }
    }

    // Se todas essas informações foram coletadas, transiciona para análise
    const todasColetadas = infoEssenciais.every(info => contexto[info.campo]);
    if (todasColetadas) {
      acoes.push({
        tipo_acao: 'transicao_estado',
        prioridade: 9,
        descricao: 'Transicionar para análise',
        entrada: {
          novo_estado: 'analise',
          motivo: 'Informações básicas coletadas'
        },
        requer_confirmacao: false
      });
    }

    return acoes;
  }

  /**
   * Ações para fase de análise
   */
  private async acoesParaAnalise(sessao: SessaoConsultor): Promise<AcaoOrquestrador[]> {
    const acoes: AcaoOrquestrador[] = [];

    // Consulta RAG para identificar metodologias aplicáveis
    const metodologiasRecomendadas = await this.buscarMetodologiasAplicaveis(sessao);

    for (const metodologia of metodologiasRecomendadas) {
      // Verifica se já foi aplicada
      if (!sessao.metodologias_aplicadas.includes(metodologia.title)) {
        acoes.push({
          tipo_acao: 'aplicar_metodologia',
          prioridade: 8,
          descricao: `Aplicar metodologia: ${metodologia.title}`,
          entrada: {
            documento_id: metodologia.id,
            metodologia: metodologia.title,
            categoria: metodologia.category
          },
          requer_confirmacao: true
        });
      }
    }

    // Se pelo menos uma metodologia foi aplicada, pode ir para diagnóstico
    if (sessao.metodologias_aplicadas.length > 0) {
      acoes.push({
        tipo_acao: 'transicao_estado',
        prioridade: 7,
        descricao: 'Transicionar para diagnóstico',
        entrada: {
          novo_estado: 'diagnostico',
          motivo: 'Metodologias aplicadas, pronto para diagnóstico'
        }
      });
    }

    return acoes;
  }

  /**
   * Ações para fase de diagnóstico
   */
  private async acoesParaDiagnostico(sessao: SessaoConsultor): Promise<AcaoOrquestrador[]> {
    const acoes: AcaoOrquestrador[] = [];

    // Gerar diagnóstico baseado nas metodologias aplicadas
    acoes.push({
      tipo_acao: 'gerar_entregavel',
      prioridade: 9,
      descricao: 'Gerar diagnóstico situacional',
      entrada: {
        tipo_entregavel: 'diagnostico',
        baseado_em: sessao.metodologias_aplicadas
      }
    });

    // Identificar gaps e oportunidades
    acoes.push({
      tipo_acao: 'aplicar_metodologia',
      prioridade: 8,
      descricao: 'Análise de gaps',
      entrada: {
        metodologia: 'analise_gaps',
        objetivo: 'Identificar lacunas entre estado atual e desejado'
      }
    });

    // Transição para recomendação
    acoes.push({
      tipo_acao: 'transicao_estado',
      prioridade: 7,
      descricao: 'Transicionar para recomendações',
      entrada: {
        novo_estado: 'recomendacao',
        motivo: 'Diagnóstico concluído'
      },
      requer_confirmacao: true
    });

    return acoes;
  }

  /**
   * Ações para fase de recomendação
   */
  private async acoesParaRecomendacao(sessao: SessaoConsultor): Promise<AcaoOrquestrador[]> {
    const acoes: AcaoOrquestrador[] = [];

    // Gerar plano de ação 5W2H
    acoes.push({
      tipo_acao: 'gerar_entregavel',
      prioridade: 10,
      descricao: 'Gerar plano de ação (5W2H)',
      entrada: {
        tipo_entregavel: 'plano_acao',
        metodologia: '5W2H'
      }
    });

    // Priorização de ações
    acoes.push({
      tipo_acao: 'aplicar_metodologia',
      prioridade: 9,
      descricao: 'Matriz de priorização',
      entrada: {
        metodologia: 'matriz_priorizacao',
        criterios: ['impacto', 'esforco', 'urgencia']
      }
    });

    // Transição para execução
    acoes.push({
      tipo_acao: 'transicao_estado',
      prioridade: 8,
      descricao: 'Transicionar para execução',
      entrada: {
        novo_estado: 'execucao',
        motivo: 'Plano de ação definido'
      },
      requer_confirmacao: true
    });

    return acoes;
  }

  /**
   * Ações para fase de execução
   */
  private async acoesParaExecucao(sessao: SessaoConsultor): Promise<AcaoOrquestrador[]> {
    const acoes: AcaoOrquestrador[] = [];

    // Acompanhamento de ações
    acoes.push({
      tipo_acao: 'aplicar_metodologia',
      prioridade: 10,
      descricao: 'Acompanhar execução',
      entrada: {
        metodologia: 'kanban',
        objetivo: 'Acompanhar progresso das ações'
      }
    });

    // Validação de resultados
    acoes.push({
      tipo_acao: 'validar',
      prioridade: 9,
      descricao: 'Validar resultados',
      entrada: {
        tipo_validacao: 'resultados',
        criterios: ['meta_atingida', 'prazo_cumprido', 'qualidade']
      }
    });

    return acoes;
  }

  /**
   * Busca metodologias aplicáveis via RAG
   */
  private async buscarMetodologiasAplicaveis(sessao: SessaoConsultor): Promise<any[]> {
    const contexto = sessao.contexto_negocio || {};

    // Monta query para RAG
    const query = `
      Problema: ${sessao.titulo_problema}
      Segmento: ${contexto.segmento || 'não informado'}
      Objetivo: ${contexto.objetivo_principal || 'não informado'}
      Descrição: ${contexto.descricao_problema || 'não informado'}
    `;

    // Busca documentos relevantes
    // TODO: Implementar busca semântica com embeddings
    // Por enquanto, busca por texto completo
    const { data, error } = await this.supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('ativo', true)
      .in('category', ['metodologia', 'framework'])
      .limit(5);

    if (error) {
      console.error('[ORCHESTRATOR] Erro ao buscar metodologias:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Executa uma ação determinada
   */
  async executarAcao(sessao: SessaoConsultor, acao: AcaoOrquestrador): Promise<any> {
    const startTime = Date.now();
    let resultado: any = {};
    let sucesso = true;

    try {
      switch (acao.tipo_acao) {
        case 'coletar_info':
          resultado = await this.executarColetaInfo(sessao, acao);
          break;

        case 'aplicar_metodologia':
          resultado = await this.executarAplicacaoMetodologia(sessao, acao);
          break;

        case 'gerar_entregavel':
          resultado = await this.executarGeracaoEntregavel(sessao, acao);
          break;

        case 'transicao_estado':
          resultado = await this.executarTransicaoEstado(sessao, acao);
          break;

        case 'validar':
          resultado = await this.executarValidacao(sessao, acao);
          break;
      }
    } catch (error: any) {
      sucesso = false;
      resultado = { erro: error.message };
      console.error('[ORCHESTRATOR] Erro ao executar ação:', error);
    }

    // Registra ação no log
    const tempoExecucao = Date.now() - startTime;
    await this.registrarAcao(sessao.id, acao, resultado, sucesso, tempoExecucao);

    return resultado;
  }

  private async executarColetaInfo(sessao: SessaoConsultor, acao: AcaoOrquestrador): Promise<any> {
    return {
      tipo: 'pergunta',
      campo: acao.entrada.campo,
      pergunta: acao.entrada.pergunta,
      aguardando_resposta: true
    };
  }

  private async executarAplicacaoMetodologia(sessao: SessaoConsultor, acao: AcaoOrquestrador): Promise<any> {
    // Busca documento da metodologia
    const { data: documento } = await this.supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('id', acao.entrada.documento_id)
      .single();

    return {
      tipo: 'metodologia_aplicada',
      metodologia: acao.entrada.metodologia,
      documento: documento,
      instrucoes: documento?.content
    };
  }

  private async executarGeracaoEntregavel(sessao: SessaoConsultor, acao: AcaoOrquestrador): Promise<any> {
    return {
      tipo: 'entregavel_pendente',
      tipo_entregavel: acao.entrada.tipo_entregavel,
      aguardando_geracao: true
    };
  }

  private async executarTransicaoEstado(sessao: SessaoConsultor, acao: AcaoOrquestrador): Promise<any> {
    // Atualiza estado da sessão
    const { error } = await this.supabase
      .from('consultor_sessoes')
      .update({ estado_atual: acao.entrada.novo_estado })
      .eq('id', sessao.id);

    if (error) {
      throw new Error(`Erro ao transicionar estado: ${error.message}`);
    }

    return {
      tipo: 'transicao_concluida',
      estado_anterior: sessao.estado_atual,
      novo_estado: acao.entrada.novo_estado,
      motivo: acao.entrada.motivo
    };
  }

  private async executarValidacao(sessao: SessaoConsultor, acao: AcaoOrquestrador): Promise<any> {
    return {
      tipo: 'validacao_pendente',
      tipo_validacao: acao.entrada.tipo_validacao,
      criterios: acao.entrada.criterios
    };
  }

  /**
   * Registra ação executada no log
   */
  private async registrarAcao(
    sessaoId: string,
    acao: AcaoOrquestrador,
    resultado: any,
    sucesso: boolean,
    tempoMs: number
  ): Promise<void> {
    await this.supabase.from('orquestrador_acoes').insert({
      sessao_id: sessaoId,
      tipo_acao: acao.tipo_acao,
      entrada: acao.entrada,
      documentos_consultados: [],
      saida: resultado,
      sucesso,
      tempo_execucao_ms: tempoMs
    });
  }

  /**
   * Atualiza progresso da sessão
   */
  async atualizarProgresso(sessao: SessaoConsultor): Promise<number> {
    // Calcula progresso baseado no estado e ações completadas
    const pesos = {
      'coleta': 20,
      'analise': 40,
      'diagnostico': 60,
      'recomendacao': 80,
      'execucao': 90,
      'concluido': 100
    };

    const progressoBase = pesos[sessao.estado_atual as keyof typeof pesos] || 0;

    // Ajusta baseado em entregáveis gerados
    const ajuste = Math.min(sessao.entregaveis_gerados.length * 5, 10);

    const progressoTotal = Math.min(progressoBase + ajuste, 100);

    // Atualiza no banco
    await this.supabase
      .from('consultor_sessoes')
      .update({ progresso: progressoTotal })
      .eq('id', sessao.id);

    return progressoTotal;
  }
}
