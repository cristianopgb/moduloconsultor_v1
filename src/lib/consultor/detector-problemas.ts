export interface ProblemaOculto {
  titulo: string;
  descricao: string;
  impacto: string;
  evidencia: string;
  solucao_resumida: string;
}

export interface DeteccaoProblemas {
  introducao: string;
  problemas: ProblemaOculto[];
  fechamento: string;
}

export class DetectorProblemasOcultos {
  private static readonly DATABASE_PROBLEMAS: Record<string, DeteccaoProblemas> = {
    'construcao_pequena': {
      introducao: 'Baseado na minha experiência com 150+ construtoras de pequeno porte, empresas no seu perfil enfrentam estes desafios estruturais:',
      problemas: [
        {
          titulo: 'GESTÃO DE OBRAS REATIVA',
          descricao: 'Falta de material em obra, atrasos por falta de planejamento, retrabalhos constantes',
          impacto: '20-30% de aumento no prazo e custo das obras',
          evidencia: '80% das pequenas construtoras têm esse problema',
          solucao_resumida: 'Cronograma detalhado + checklist por etapa'
        },
        {
          titulo: 'ORÇAMENTAÇÃO DEMORADA E IMPRECISA',
          descricao: 'Demora para fazer orçamentos, perda de clientes, margem mal calculada',
          impacto: 'Perda de 40-50% dos leads por demora na resposta',
          evidencia: '90% das pequenas construtoras não têm processo padronizado',
          solucao_resumida: 'Template de orçamento + banco de preços'
        },
        {
          titulo: 'CONTROLE FINANCEIRO INEXISTENTE',
          descricao: 'Não sabe lucro real por obra, decisões baseadas em "achismo"',
          impacto: 'Margem real 30-40% menor que a percebida',
          evidencia: '85% das PMEs da construção não têm DRE gerencial',
          solucao_resumida: 'DRE por obra + indicadores de performance'
        },
        {
          titulo: 'DEPENDÊNCIA TOTAL DO PROPRIETÁRIO',
          descricao: 'Proprietário faz tudo: orçamentos, compras, supervisão',
          impacto: 'Impossível escalar ou tirar férias',
          evidencia: '70% das pequenas construtoras param se o dono sair',
          solucao_resumida: 'Delegação estruturada + processos padronizados'
        }
      ],
      fechamento: 'Reconhece alguns desses padrões na {empresa_nome}? Vou aplicar meu diagnóstico estruturado para confirmar e quantificar esses gaps.'
    },

    'ecommerce_micro': {
      introducao: 'Baseado na minha experiência com 200+ e-commerces de pequeno porte, empresas no seu perfil geralmente enfrentam 4 problemas críticos:',
      problemas: [
        {
          titulo: 'FUNIL COMERCIAL DESORGANIZADO',
          descricao: 'Leads se perdem entre Instagram, TikTok e WhatsApp sem controle estruturado',
          impacto: '60-70% dos interessados não viram clientes',
          evidencia: 'Padrão em 80% dos e-commerces micro sem CRM',
          solucao_resumida: 'CRM gratuito + funil estruturado'
        },
        {
          titulo: 'PRECIFICAÇÃO SEM METODOLOGIA',
          descricao: 'Preço definido baseado só na concorrência, sem cálculo real de custos',
          impacto: 'Margem baixa ou prejuízo oculto por produto',
          evidencia: '90% das micro empresas não calculam custo real',
          solucao_resumida: 'Planilha de custos + markup estratégico'
        },
        {
          titulo: 'LOGÍSTICA IMPROVISADA',
          descricao: 'Sem controle de estoque, falta de produto, capital parado em estoque excessivo',
          impacto: 'Perda de vendas ou capital imobilizado',
          evidencia: '75% dos e-commerces pequenos não têm controle de estoque',
          solucao_resumida: 'Sistema de gestão + curva ABC'
        },
        {
          titulo: 'MARKETING SEM ESTRATÉGIA',
          descricao: 'Posta nas redes sociais sem planejamento, sem análise de resultados',
          impacto: 'Dinheiro gasto sem retorno mensurável',
          evidencia: '85% das micro empresas não medem ROI de marketing',
          solucao_resumida: 'Calendário editorial + métricas de conversão'
        }
      ],
      fechamento: 'Esses são os problemas clássicos do seu segmento. Vamos confirmar quais se aplicam à {empresa_nome}?'
    },

    'servicos_pequena': {
      introducao: 'Com base em 150+ empresas de serviços de pequeno porte que transformei, empresas no seu perfil enfrentam estes desafios estruturais:',
      problemas: [
        {
          titulo: 'OPERAÇÃO DEPENDENTE DO DONO',
          descricao: 'Processos na cabeça do proprietário, empresa para se ele sair',
          impacto: 'Impossibilidade de escalar ou vender a empresa',
          evidencia: '70% das pequenas empresas de serviço têm esse problema',
          solucao_resumida: 'Mapeamento de processos + delegação'
        },
        {
          titulo: 'PRECIFICAÇÃO BASEADA EM HORA',
          descricao: 'Cobra por hora sem considerar valor entregue ao cliente',
          impacto: 'Limita faturamento ao número de horas disponíveis',
          evidencia: '80% das empresas de serviço pequenas cobram por hora',
          solucao_resumida: 'Precificação por valor + pacotes'
        },
        {
          titulo: 'PROSPECÇÃO IRREGULAR',
          descricao: 'Só busca cliente quando está sem trabalho, montanha-russa de faturamento',
          impacto: 'Instabilidade financeira e estresse constante',
          evidencia: '65% das pequenas empresas têm faturamento irregular',
          solucao_resumida: 'Funil de prospecção contínuo + pipeline'
        }
      ],
      fechamento: 'Esses padrões se repetem em empresas de serviços do seu porte. Vamos investigar a fundo na {empresa_nome}?'
    }
  };

  static detectarProblemas(
    segmento: string,
    porte: string,
    contexto?: Record<string, any>
  ): DeteccaoProblemas {
    const chave = `${segmento.toLowerCase()}_${porte.toLowerCase()}`;
    const problemas = this.DATABASE_PROBLEMAS[chave];

    if (problemas) {
      return problemas;
    }

    // Fallback para problemas genéricos
    return this.gerarProblemasGenericos(segmento, porte);
  }

  private static gerarProblemasGenericos(
    segmento: string,
    porte: string
  ): DeteccaoProblemas {
    return {
      introducao: `Baseado na minha experiência com empresas do segmento ${segmento}, identifiquei alguns padrões comuns em empresas de porte ${porte}:`,
      problemas: [
        {
          titulo: 'GESTÃO FINANCEIRA REATIVA',
          descricao: 'Falta de controle sobre fluxo de caixa e rentabilidade real',
          impacto: 'Decisões baseadas em intuição, não em dados',
          evidencia: '80% das PMEs não têm dashboard gerencial',
          solucao_resumida: 'Controles financeiros + indicadores'
        },
        {
          titulo: 'PROCESSOS NÃO PADRONIZADOS',
          descricao: 'Cada funcionário faz de um jeito, dependência de pessoas específicas',
          impacto: 'Qualidade inconsistente e dificuldade para escalar',
          evidencia: '75% das pequenas empresas têm esse problema',
          solucao_resumida: 'Mapeamento + padronização de processos'
        },
        {
          titulo: 'ESTRATÉGIA POUCO CLARA',
          descricao: 'Sem visão de longo prazo, trabalhando sempre no operacional',
          impacto: 'Crescimento lento ou estagnação',
          evidencia: '70% das PMEs não têm planejamento estratégico',
          solucao_resumida: 'Definição de visão + plano estratégico'
        }
      ],
      fechamento: 'Vou investigar se esses padrões se aplicam à {empresa_nome} durante nossa análise.'
    };
  }

  static formatarApresentacaoProblemas(
    problemasDetectados: DeteccaoProblemas,
    empresaNome: string
  ): string {
    let apresentacao = problemasDetectados.introducao + '\n\n';

    problemasDetectados.problemas.forEach((problema, index) => {
      apresentacao += `**${index + 1}. ${problema.titulo}**\n`;
      apresentacao += `${problema.descricao}\n`;
      apresentacao += `💥 *Impacto:* ${problema.impacto}\n`;
      apresentacao += `📊 *Evidência:* ${problema.evidencia}\n`;
      apresentacao += `✅ *Solução:* ${problema.solucao_resumida}\n\n`;
    });

    apresentacao += problemasDetectados.fechamento.replace('{empresa_nome}', empresaNome);

    return apresentacao;
  }

  static adicionarProblemaCustomizado(
    chave: string,
    problemas: DeteccaoProblemas
  ): void {
    this.DATABASE_PROBLEMAS[chave] = problemas;
  }
}
