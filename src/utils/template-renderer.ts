/**
 * Sistema de Renderização de Templates Mustache
 * Processa templates HTML com variáveis e loops
 */

interface TemplateData {
  [key: string]: any;
}

/**
 * Renderiza um template Mustache com os dados fornecidos
 * Suporta: variáveis simples {{var}}, loops {{#array}}...{{/array}}, condicionais
 */
export function renderTemplate(template: string, data: TemplateData): string {
  let result = template;

  // Processar loops primeiro ({{#array}}...{{/array}})
  result = processLoops(result, data);

  // Processar variáveis simples ({{var}})
  result = processVariables(result, data);

  return result;
}

function processLoops(template: string, data: TemplateData): string {
  const loopRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

  return template.replace(loopRegex, (match, arrayName, content) => {
    const arrayData = data[arrayName];

    // Se não existe ou não é array, remover o bloco
    if (!arrayData || !Array.isArray(arrayData) || arrayData.length === 0) {
      return '';
    }

    // Renderizar o conteúdo para cada item do array
    return arrayData.map(item => {
      let itemContent = content;

      // Se o item é um objeto, processar suas propriedades
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => {
          const value = item[key];
          // Substituir {{key}} pelo valor
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          itemContent = itemContent.replace(regex, String(value || ''));
        });
      } else {
        // Se é valor primitivo, substituir {{.}}
        itemContent = itemContent.replace(/\{\{\.\}\}/g, String(item || ''));
      }

      return itemContent;
    }).join('');
  });
}

function processVariables(template: string, data: TemplateData): string {
  const varRegex = /\{\{(\w+)\}\}/g;

  return template.replace(varRegex, (match, varName) => {
    const value = data[varName];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Carrega um template HTML do servidor
 */
export async function loadTemplate(templateName: string): Promise<string> {
  try {
    const response = await fetch(`/src/templates/${templateName}.html`);
    if (!response.ok) {
      throw new Error(`Template ${templateName} não encontrado`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Erro ao carregar template ${templateName}:`, error);
    throw error;
  }
}

/**
 * Renderiza um template carregando do servidor
 */
export async function renderTemplateFromFile(
  templateName: string,
  data: TemplateData
): Promise<string> {
  const template = await loadTemplate(templateName);
  return renderTemplate(template, data);
}

/**
 * Formata data para exibição em português
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Helper para preparar dados de anamnese
 */
export function prepareAnamneseData(contexto: any): TemplateData {
  return {
    empresa_nome: contexto.empresa_nome || 'Empresa',
    nome_usuario: contexto.nome_usuario || '',
    cargo: contexto.cargo || '',
    experiencia: contexto.experiencia || 'Não informado',
    segmento: contexto.segmento || '',
    porte: contexto.porte || '',
    tempo_mercado: contexto.tempo_mercado || '',
    faturamento: contexto.faturamento || 'Não informado',
    tamanho_equipe: contexto.tamanho_equipe || 'Não informado',
    desafios_principais: Array.isArray(contexto.desafios_principais)
      ? contexto.desafios_principais
      : [contexto.desafios_principais].filter(Boolean),
    metas_curto_prazo: Array.isArray(contexto.metas_curto_prazo)
      ? contexto.metas_curto_prazo
      : [contexto.metas_curto_prazo].filter(Boolean),
    metas_medio_prazo: Array.isArray(contexto.metas_medio_prazo)
      ? contexto.metas_medio_prazo
      : [contexto.metas_medio_prazo].filter(Boolean),
    metas_longo_prazo: Array.isArray(contexto.metas_longo_prazo)
      ? contexto.metas_longo_prazo
      : [contexto.metas_longo_prazo].filter(Boolean),
    data_geracao: formatDate(new Date())
  };
}

/**
 * Helper para preparar dados de Business Canvas
 */
export function prepareCanvasData(contexto: any): TemplateData {
  return {
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
    data_geracao: formatDate(new Date())
  };
}

/**
 * Helper para preparar dados de Cadeia de Valor
 */
export function prepareCadeiaValorData(contexto: any): TemplateData {
  return {
    empresa_nome: contexto.empresa_nome || 'Empresa',
    processos_finalisticos: contexto.processos_finalisticos || [],
    processos_gestao: contexto.processos_gestao || [],
    processos_apoio: contexto.processos_apoio || [],
    data_geracao: formatDate(new Date())
  };
}

/**
 * Helper para preparar dados de Matriz de Priorização
 */
export function prepareMatrizData(contexto: any): TemplateData {
  return {
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
    data_geracao: formatDate(new Date())
  };
}

/**
 * Helper para preparar dados de Diagnóstico
 */
export function prepareDiagnosticoData(contexto: any): TemplateData {
  return {
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
    data_geracao: formatDate(new Date())
  };
}

/**
 * Helper para preparar dados de Plano de Ação 5W2H
 */
export function preparePlanoAcaoData(contexto: any): TemplateData {
  const acoes = (contexto.acoes || []).map((acao: any, index: number) => ({
    numero: index + 1,
    what: acao.what || '',
    why: acao.why || '',
    where: acao.where_field || acao.where || '',
    when_inicio: acao.when_inicio || 'A definir',
    when_prazo: acao.when_prazo || acao.when_field || 'A definir',
    who: acao.who || '',
    how_steps: Array.isArray(acao.how) ? acao.how : [acao.how].filter(Boolean),
    how_much: acao.how_much || 'A definir',
    prioridade: acao.prioridade || 'media',
    prioridade_label: getPrioridadeLabel(acao.prioridade),
    progresso: acao.progresso || 0,
    metricas_sucesso: acao.metricas_sucesso || null
  }));

  return {
    empresa_nome: contexto.empresa_nome || 'Empresa',
    area_nome: contexto.area_nome || 'Área',
    acoes,
    total_acoes: acoes.length,
    acoes_alta_prioridade: acoes.filter((a: any) => a.prioridade === 'alta').length,
    prazo_estimado: contexto.prazo_estimado || 'A definir',
    investimento_total: contexto.investimento_total || 'A definir',
    data_geracao: formatDate(new Date())
  };
}

function getPrioridadeLabel(prioridade: string): string {
  const labels: Record<string, string> = {
    'alta': 'ALTA PRIORIDADE',
    'media': 'MÉDIA PRIORIDADE',
    'baixa': 'BAIXA PRIORIDADE'
  };
  return labels[prioridade] || 'MÉDIA PRIORIDADE';
}
