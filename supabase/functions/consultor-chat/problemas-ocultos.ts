export const PROBLEMAS_OCULTOS_POR_SEGMENTO: Record<string, {
  introducao: string;
  problemas: Array<{
    titulo: string;
    descricao: string;
    impacto: string;
  }>;
}> = {
  'E-commerce': {
    introducao: 'Baseado em décadas de consultoria com e-commerces, identifico padrões críticos neste segmento:',
    problemas: [
      {
        titulo: 'Funil de Vendas Desorganizado',
        descricao: 'Falta de clareza nas etapas de conversão (visitante → lead → cliente). Não há métricas por etapa do funil.',
        impacto: 'Até 70% de perda de vendas por não saber onde cliente desiste'
      },
      {
        titulo: 'Precificação Sem Custo Real',
        descricao: 'Preço baseado na concorrência sem calcular custos fixos, variáveis, taxas e logística.',
        impacto: 'Pode estar vendendo no prejuízo sem perceber'
      },
      {
        titulo: 'Controle de Estoque Manual',
        descricao: 'Sem integração entre vendas e estoque. Vende produtos esgotados causando cancelamentos.',
        impacto: 'Insatisfação do cliente + retrabalho + custos ocultos'
      },
      {
        titulo: 'Falta de Automação',
        descricao: 'Processos manuais em pós-venda, recuperação de carrinhos, recompra e comunicação.',
        impacto: 'Tempo desperdiçado em tarefas repetitivas que poderiam gerar vendas'
      }
    ]
  },
  'Construção': {
    introducao: 'Construtoras enfrentam desafios específicos que impactam diretamente a rentabilidade:',
    problemas: [
      {
        titulo: 'Gestão Reativa de Obras',
        descricao: 'Apagando incêndios ao invés de prevenir problemas. Falta de planejamento preventivo.',
        impacto: 'Atrasos frequentes + custos não previstos + stress'
      },
      {
        titulo: 'Orçamentação Lenta e Imprecisa',
        descricao: 'Demora para responder clientes. Orçamentos sem margem realista ou padronização.',
        impacto: 'Perda de clientes para concorrentes + margem apertada'
      },
      {
        titulo: 'Controle Financeiro Fraco',
        descricao: 'Não separa custos por obra. Mistura fluxo de caixa da empresa com obras específicas.',
        impacto: 'Não sabe qual obra dá lucro/prejuízo de verdade'
      },
      {
        titulo: 'Centralização no Proprietário',
        descricao: 'Dono precisa estar em tudo. Sem processos claros para equipe seguir.',
        impacto: 'Não consegue crescer pois não consegue delegar'
      }
    ]
  },
  'Serviços': {
    introducao: 'Empresas de serviços geralmente sofrem com problemas de escala e padronização:',
    problemas: [
      {
        titulo: 'Serviço Dependente de Pessoas-Chave',
        descricao: 'Qualidade depende de quem atende. Sem padronização de processos.',
        impacto: 'Impossível escalar mantendo qualidade'
      },
      {
        titulo: 'Precificação por Feeling',
        descricao: 'Preço baseado no "achismo" sem calcular horas, custos e margem desejada.',
        impacto: 'Trabalha muito e lucra pouco'
      },
      {
        titulo: 'Falta de Recorrência',
        descricao: 'Precisa "caçar" clientes todo mês. Não constrói base de clientes recorrentes.',
        impacto: 'Faturamento imprevisível + esforço constante em vendas'
      },
      {
        titulo: 'Pós-Venda Inexistente',
        descricao: 'Entrega o serviço e "tchau". Não mantém relacionamento para recompra.',
        impacto: 'Perde 80% do potencial de vendas recorrentes'
      }
    ]
  },
  'Indústria': {
    introducao: 'Indústrias têm desafios específicos de produção e eficiência operacional:',
    problemas: [
      {
        titulo: 'Setup Elevado',
        descricao: 'Muito tempo perdido na troca de produtos/ferramentas. Produção em lotes grandes.',
        impacto: 'Capital parado em estoque + baixa flexibilidade'
      },
      {
        titulo: 'Retrabalho e Refugo',
        descricao: 'Sem controle de qualidade na linha. Descoberta de defeitos apenas no final.',
        impacto: 'Custos ocultos de até 20% do faturamento'
      },
      {
        titulo: 'Falta de Indicadores',
        descricao: 'Não mede OEE, ciclo, lead time. Gestão baseada em "sentimento".',
        impacto: 'Não sabe onde melhorar para ganhar produtividade'
      },
      {
        titulo: 'Gargalos Não Identificados',
        descricao: 'Não sabe qual máquina/processo limita a capacidade de produção.',
        impacto: 'Investe em equipamentos errados'
      }
    ]
  },
  'Varejo': {
    introducao: 'Varejistas enfrentam desafios de gestão de estoque e experiência do cliente:',
    problemas: [
      {
        titulo: 'Estoque Desbalanceado',
        descricao: 'Ruptura em produtos de giro rápido + excesso em produtos encalhados.',
        impacto: 'Perda de vendas + capital parado'
      },
      {
        titulo: 'Precificação sem Inteligência',
        descricao: 'Não usa dados de venda para ajustar preços dinamicamente.',
        impacto: 'Margem abaixo do potencial'
      },
      {
        titulo: 'Experiência de Compra Fraca',
        descricao: 'Atendimento não padronizado. Layout de loja não otimizado.',
        impacto: 'Cliente compra menos do que poderia'
      },
      {
        titulo: 'Fidelização Inexistente',
        descricao: 'Sem programa de relacionamento. Cliente compra uma vez e some.',
        impacto: 'CAC alto + LTV baixo = prejuízo'
      }
    ]
  }
};

export function getProblemasOcultos(segmento?: string, porte?: string): typeof PROBLEMAS_OCULTOS_POR_SEGMENTO[string] | null {
  if (!segmento) return null;

  // Normalizar segmento
  const segmentoNormalizado = segmento.toLowerCase();

  for (const [key, value] of Object.entries(PROBLEMAS_OCULTOS_POR_SEGMENTO)) {
    if (key.toLowerCase().includes(segmentoNormalizado) || segmentoNormalizado.includes(key.toLowerCase())) {
      return value;
    }
  }

  return null;
}
