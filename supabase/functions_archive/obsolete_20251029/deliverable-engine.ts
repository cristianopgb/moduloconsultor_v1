/**
 * Deliverable Engine - Sistema de Geração de Entregáveis Profissionais
 *
 * Gera documentos HTML prontos para exibição baseados nos templates criados
 */

interface DeliverableData {
  [key: string]: any;
}

export class DeliverableEngine {
  /**
   * Renderiza template Mustache simples
   */
  private static renderTemplate(template: string, data: DeliverableData): string {
    let result = template;

    // Processar loops {{#array}}...{{/array}}
    const loopRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    result = result.replace(loopRegex, (match, arrayName, content) => {
      const arrayData = data[arrayName];

      if (!arrayData || !Array.isArray(arrayData) || arrayData.length === 0) {
        return '';
      }

      return arrayData.map((item: any) => {
        let itemContent = content;

        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(key => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            itemContent = itemContent.replace(regex, String(item[key] || ''));
          });
        } else {
          itemContent = itemContent.replace(/\{\{\.\}\}/g, String(item || ''));
        }

        return itemContent;
      }).join('');
    });

    // Processar variáveis {{var}}
    const varRegex = /\{\{(\w+)\}\}/g;
    result = result.replace(varRegex, (match, varName) => {
      const value = data[varName];
      return value !== undefined && value !== null ? String(value) : '';
    });

    return result;
  }

  /**
   * Formata data em português
   */
  private static formatDate(date?: Date): string {
    const d = date || new Date();
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Gera Anamnese Empresarial
   */
  static async generateAnamnese(contexto: any): Promise<{ title: string; html: string }> {
    const template = await this.loadTemplate('anamnese-empresarial');

    const data = {
      empresa_nome: contexto.empresa_nome || 'Empresa',
      nome_usuario: contexto.nome_usuario || '',
      cargo: contexto.cargo || '',
      experiencia: contexto.experiencia || 'Não informado',
      segmento: contexto.segmento || '',
      porte: contexto.porte || '',
      tempo_mercado: contexto.tempo_mercado || '',
      faturamento: contexto.faturamento || 'Não informado',
      tamanho_equipe: contexto.tamanho_equipe || '',
      desafios_principais: Array.isArray(contexto.desafios_principais)
        ? contexto.desafios_principais
        : [],
      metas_curto_prazo: Array.isArray(contexto.metas_curto_prazo)
        ? contexto.metas_curto_prazo
        : [],
      metas_medio_prazo: Array.isArray(contexto.metas_medio_prazo)
        ? contexto.metas_medio_prazo
        : [],
      metas_longo_prazo: Array.isArray(contexto.metas_longo_prazo)
        ? contexto.metas_longo_prazo
        : [],
      data_geracao: this.formatDate()
    };

    const html = this.renderTemplate(template, data);

    return {
      title: `Anamnese Empresarial - ${data.empresa_nome}`,
      html
    };
  }

  /**
   * Gera Business Model Canvas
   */
  static async generateCanvas(contexto: any): Promise<{ title: string; html: string }> {
    const template = await this.loadTemplate('business-canvas');

    const data = {
      empresa_nome: contexto.empresa_nome || 'Empresa',
      parceiros: contexto.parceiros || [],
      atividades: contexto.atividades || [],
      recursos: contexto.recursos || [],
      proposta_valor: contexto.proposta_valor || [],
      relacionamento: contexto.relacionamento || [],
      canais: contexto.canais || [],
      segmentos_clientes: contexto.segmentos_clientes || [],
      custos: contexto.custos || [],
      receitas: contexto.receitas || [],
      data_geracao: this.formatDate()
    };

    const html = this.renderTemplate(template, data);

    return {
      title: `Business Model Canvas - ${data.empresa_nome}`,
      html
    };
  }

  /**
   * Gera Cadeia de Valor
   */
  static async generateCadeiaValor(contexto: any): Promise<{ title: string; html: string }> {
    const template = await this.loadTemplate('cadeia-valor');

    const data = {
      empresa_nome: contexto.empresa_nome || 'Empresa',
      processos_finalisticos: contexto.processos_finalisticos || [],
      processos_gestao: contexto.processos_gestao || [],
      processos_apoio: contexto.processos_apoio || [],
      data_geracao: this.formatDate()
    };

    const html = this.renderTemplate(template, data);

    return {
      title: `Cadeia de Valor - ${data.empresa_nome}`,
      html
    };
  }

  /**
   * Gera Matriz de Priorização
   */
  static async generateMatriz(contexto: any): Promise<{ title: string; html: string }> {
    const template = await this.loadTemplate('matriz-priorizacao');

    const data = {
      empresa_nome: contexto.empresa_nome || 'Empresa',
      quick_wins: contexto.quick_wins || [],
      estrategicos: contexto.estrategicos || [],
      fill_ins: contexto.fill_ins || [],
      evitar: contexto.evitar || [],
      alto_impacto_medio_esforco: contexto.alto_impacto_medio_esforco || [],
      medio_impacto_alto_esforco: contexto.medio_impacto_alto_esforco || [],
      medio_impacto_medio_esforco: contexto.medio_impacto_medio_esforco || [],
      medio_impacto_baixo_esforco: contexto.medio_impacto_baixo_esforco || [],
      baixo_impacto_medio_esforco: contexto.baixo_impacto_medio_esforco || [],
      baixo_impacto_baixo_esforco: contexto.baixo_impacto_baixo_esforco || [],
      ranking: contexto.ranking || [],
      data_geracao: this.formatDate()
    };

    const html = this.renderTemplate(template, data);

    return {
      title: `Matriz de Priorização - ${data.empresa_nome}`,
      html
    };
  }

  /**
   * Gera Diagnóstico de Área
   */
  static async generateDiagnostico(contexto: any): Promise<{ title: string; html: string }> {
    const template = await this.loadTemplate('diagnostico-area');

    const data = {
      empresa_nome: contexto.empresa_nome || 'Empresa',
      area_nome: contexto.area_nome || 'Área',
      resumo_executivo: contexto.resumo_executivo || '',
      metricas: contexto.metricas || null,
      pontos_fortes: contexto.pontos_fortes || [],
      gaps_criticos: contexto.gaps_criticos || [],
      riscos: contexto.riscos || [],
      oportunidades: contexto.oportunidades || [],
      comparacao_mercado: contexto.comparacao_mercado || null,
      recomendacao_estrategica: contexto.recomendacao_estrategica || '',
      data_geracao: this.formatDate()
    };

    const html = this.renderTemplate(template, data);

    return {
      title: `Diagnóstico - ${data.area_nome} - ${data.empresa_nome}`,
      html
    };
  }

  /**
   * Gera Plano de Ação 5W2H
   */
  static async generatePlanoAcao(contexto: any): Promise<{ title: string; html: string }> {
    const template = await this.loadTemplate('plano-acao-5w2h');

    const acoes = (contexto.acoes || []).map((acao: any, index: number) => ({
      numero: index + 1,
      what: acao.what || '',
      why: acao.why || '',
      where: acao.where || 'Na empresa',
      when_inicio: acao.when_inicio || 'Imediato',
      when_prazo: acao.when_prazo || '30 dias',
      who: acao.who || '',
      how_steps: Array.isArray(acao.how) ? acao.how : [acao.how].filter(Boolean),
      how_much: acao.how_much || 'A definir',
      prioridade: acao.prioridade || 'media',
      prioridade_label: this.getPrioridadeLabel(acao.prioridade),
      progresso: acao.progresso || 0,
      metricas_sucesso: acao.metricas_sucesso || null
    }));

    const data = {
      empresa_nome: contexto.empresa_nome || 'Empresa',
      area_nome: contexto.area_nome || 'Área',
      acoes,
      total_acoes: acoes.length,
      acoes_alta_prioridade: acoes.filter((a: any) => a.prioridade === 'alta').length,
      prazo_estimado: contexto.prazo_estimado || `${acoes.length * 30} dias`,
      investimento_total: contexto.investimento_total || 'A definir',
      data_geracao: this.formatDate()
    };

    const html = this.renderTemplate(template, data);

    return {
      title: `Plano de Ação 5W2H - ${data.area_nome} - ${data.empresa_nome}`,
      html
    };
  }

  private static getPrioridadeLabel(prioridade: string): string {
    const labels: Record<string, string> = {
      'alta': 'ALTA PRIORIDADE',
      'media': 'MÉDIA PRIORIDADE',
      'baixa': 'BAIXA PRIORIDADE'
    };
    return labels[prioridade] || 'MÉDIA PRIORIDADE';
  }

  /**
   * Carrega template do sistema de arquivos
   * NOTA: Em produção, os templates devem estar disponíveis via URL ou embutidos
   */
  private static async loadTemplate(name: string): Promise<string> {
    // Em produção, você pode:
    // 1. Ler de um bucket do Supabase Storage
    // 2. Ter os templates embutidos como strings
    // 3. Fazer fetch de uma URL

    // Por enquanto, vou retornar templates inline simplificados
    // TODO: Integrar com sistema de storage real
    return this.getInlineTemplate(name);
  }

  /**
   * Templates inline (fallback)
   * TODO: Substituir por sistema de storage real
   */
  private static getInlineTemplate(name: string): string {
    const templates: Record<string, string> = {
      'anamnese-empresarial': `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Anamnese - {{empresa_nome}}</title></head>
<body style="font-family: Arial; padding: 40px; max-width: 900px; margin: 0 auto;">
<h1>📋 Anamnese Empresarial</h1>
<h2>{{empresa_nome}}</h2>
<h3>Perfil do Responsável</h3>
<p><strong>Nome:</strong> {{nome_usuario}}</p>
<p><strong>Cargo:</strong> {{cargo}}</p>
<h3>Perfil da Empresa</h3>
<p><strong>Segmento:</strong> {{segmento}}</p>
<p><strong>Porte:</strong> {{porte}}</p>
<p><strong>Tempo de Mercado:</strong> {{tempo_mercado}}</p>
<p><strong>Equipe:</strong> {{tamanho_equipe}} colaboradores</p>
<h3>Desafios Principais</h3>
<ul>{{#desafios_principais}}<li>{{.}}</li>{{/desafios_principais}}</ul>
<p style="margin-top: 40px; color: #666;"><small>Gerado em: {{data_geracao}}</small></p>
</body></html>`,
      'business-canvas': `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Canvas - {{empresa_nome}}</title></head><body><h1>Business Model Canvas - {{empresa_nome}}</h1><p>Documento gerado em {{data_geracao}}</p></body></html>`,
      'cadeia-valor': `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cadeia de Valor - {{empresa_nome}}</title></head><body><h1>Cadeia de Valor - {{empresa_nome}}</h1><p>Documento gerado em {{data_geracao}}</p></body></html>`,
      'matriz-priorizacao': `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Matriz - {{empresa_nome}}</title></head><body><h1>Matriz de Priorização - {{empresa_nome}}</h1><p>Documento gerado em {{data_geracao}}</p></body></html>`,
      'diagnostico-area': `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Diagnóstico - {{area_nome}}</title></head><body><h1>Diagnóstico - {{area_nome}} - {{empresa_nome}}</h1><p>{{resumo_executivo}}</p><p>Gerado em {{data_geracao}}</p></body></html>`,
      'plano-acao-5w2h': `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Plano 5W2H - {{area_nome}}</title></head><body><h1>Plano de Ação 5W2H - {{area_nome}}</h1><p>Total de ações: {{total_acoes}}</p><p>Gerado em {{data_geracao}}</p></body></html>`
    };

    return templates[name] || '<html><body><h1>Template não encontrado</h1></body></html>';
  }
}
