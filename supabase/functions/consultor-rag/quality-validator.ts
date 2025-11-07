/**
 * Validador de Qualidade de Ações
 *
 * Valida se o plano gerado atende aos critérios:
 * - 4-8 ações
 * - 7-10 etapas no HOW por ação
 * - 2-4 KPIs por ação
 * - Sem linguagem genérica
 */

export interface Action {
  what?: string;
  o_que?: string;
  why?: string;
  por_que?: string;
  who?: string;
  quem?: string;
  when?: string;
  quando?: string;
  where?: string;
  onde?: string;
  how?: string;
  como?: string;
  how_much?: string;
  quanto?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    actionCount: number;
    avgHowDepth: number;
    kpisCount: number;
  };
}

/**
 * Valida qualidade das ações geradas
 */
export function validateActionQuality(actions: Action[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalHowSteps = 0;
  let totalKpis = 0;

  // 1. Validar densidade de ações (4-8)
  if (actions.length < 4) {
    errors.push(`Apenas ${actions.length} ações geradas. MÍNIMO 4 ações obrigatório.`);
  } else if (actions.length > 8) {
    warnings.push(`${actions.length} ações geradas. Considere consolidar para máximo 8.`);
  }

  // 2. Validar cada ação
  actions.forEach((action, index) => {
    const actionNum = index + 1;
    const what = action.what || action.o_que || '';
    const how = action.how || action.como || '';
    const why = action.why || action.por_que || '';

    // 2.1. Validar profundidade do HOW (7-10 etapas)
    const howSteps = countHowSteps(how);
    totalHowSteps += howSteps;

    if (howSteps < 7) {
      errors.push(
        `Ação ${actionNum} "${what.substring(0, 40)}..." tem apenas ${howSteps} etapas no HOW. MÍNIMO 7 obrigatório.`
      );
    }

    // 2.2. Validar linguagem genérica
    const genericPatterns = [
      /^melhorar\s+\w+$/i,
      /^treinar\s+(equipe|time|funcionários?)$/i,
      /^contratar\s+sistema$/i,
      /^investir\s+em\s+\w+$/i,
      /^implementar\s+\w+\s*$/i, // "implementar X" sem detalhe
    ];

    if (genericPatterns.some(pattern => pattern.test(what.trim()))) {
      errors.push(
        `Ação ${actionNum} "${what}" é GENÉRICA DEMAIS. Detalhe O QUE especificamente.`
      );
    }

    // 2.3. Validar KPIs (2-4 por ação)
    const kpis = countKPIs(why + ' ' + how);
    totalKpis += kpis;

    if (kpis < 2) {
      errors.push(
        `Ação ${actionNum} tem apenas ${kpis} KPI(s) mensuráveis. MÍNIMO 2 obrigatório.`
      );
    }

    // 2.4. Validar ferramentas nomeadas
    if (how.toLowerCase().includes('sistema') && !how.match(/(crm|erp|bi|wms|aps|mes|scada|tipo|exemplo|similar)/i)) {
      warnings.push(
        `Ação ${actionNum}: Use CATEGORIA de ferramenta (ex: "CRM tipo HubSpot"), não apenas "sistema".`
      );
    }
  });

  // 3. Calcular métricas
  const avgHowDepth = actions.length > 0 ? totalHowSteps / actions.length : 0;

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    metrics: {
      actionCount: actions.length,
      avgHowDepth: Math.round(avgHowDepth * 10) / 10,
      kpisCount: totalKpis
    }
  };
}

/**
 * Conta etapas no HOW
 * Procura por: números, bullets, separadores
 */
function countHowSteps(how: string): number {
  if (!how || how.length < 10) return 0;

  // Remover espaços extras
  const text = how.trim();

  // Método 1: Contar números explícitos (1., 2., 1), 2), etc)
  const numberedSteps = text.match(/\d+[\.\)]/g);
  if (numberedSteps && numberedSteps.length >= 4) {
    return numberedSteps.length;
  }

  // Método 2: Separadores (vírgula, ponto-vírgula, quebras)
  const separators = text.match(/[,;]|\.(?=\s+[A-Z])/g);
  if (separators) {
    return separators.length + 1; // +1 para a última parte
  }

  // Método 3: Bullets ou traços
  const bullets = text.match(/[-•*]\s/g);
  if (bullets && bullets.length >= 4) {
    return bullets.length;
  }

  // Fallback: contar frases (impreciso)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  return Math.min(sentences.length, 15); // Cap em 15
}

/**
 * Conta KPIs mensuráveis
 * Procura por: números + %, R$, unidades, verbos de meta
 */
function countKPIs(text: string): number {
  if (!text) return 0;

  let count = 0;

  // Padrão 1: Percentuais (aumentar X%, reduzir Y%)
  const percentMatches = text.match(/\d+\s*%/g);
  if (percentMatches) count += percentMatches.length;

  // Padrão 2: Valores monetários (R$ X, custo de R$ Y)
  const moneyMatches = text.match(/R\$\s*[\d.,]+/gi);
  if (moneyMatches) count += moneyMatches.length;

  // Padrão 3: Números com unidades (X dias, Y clientes, Z vendas)
  const unitMatches = text.match(/\d+\s+(dias?|horas?|clientes?|vendas?|leads?|conversões?|tickets?|pedidos?)/gi);
  if (unitMatches) count += unitMatches.length;

  // Padrão 4: Comparações (de X para Y, passar de A para B)
  const comparisonMatches = text.match(/(de\s+\d+.*?para\s+\d+|passar\s+de.*?para)/gi);
  if (comparisonMatches) count += comparisonMatches.length;

  // Padrão 5: Metas explícitas (meta de X, objetivo de Y)
  const goalMatches = text.match(/(meta|objetivo|alvo)\s+(de|:)\s*\d+/gi);
  if (goalMatches) count += goalMatches.length;

  return Math.min(count, 10); // Cap em 10 para evitar false positives
}

/**
 * Gera mensagem de reissue para a LLM
 */
export function generateReissuePrompt(validation: ValidationResult): string {
  const { errors, metrics } = validation;

  let prompt = '🔴 VALIDAÇÃO FALHOU - REFAÇA O PLANO:\n\n';

  // Listar erros
  if (errors.length > 0) {
    prompt += 'ERROS CRÍTICOS:\n';
    errors.forEach((error, i) => {
      prompt += `${i + 1}. ${error}\n`;
    });
    prompt += '\n';
  }

  // Situação atual
  prompt += 'SITUAÇÃO ATUAL:\n';
  prompt += `- Ações geradas: ${metrics.actionCount} (ALVO: 4-8)\n`;
  prompt += `- Profundidade média HOW: ${metrics.avgHowDepth} etapas (ALVO: 7-10)\n`;
  prompt += `- KPIs identificados: ${metrics.kpisCount} (ALVO: 2-4 por ação)\n\n`;

  // Instruções
  prompt += 'INSTRUÇÕES PARA CORREÇÃO:\n';
  if (metrics.actionCount < 4) {
    prompt += `✅ ADICIONE ${4 - metrics.actionCount} ações complementares distintas\n`;
  }
  if (metrics.avgHowDepth < 7) {
    prompt += `✅ DETALHE o HOW de cada ação com 7-10 etapas práticas\n`;
  }
  if (metrics.kpisCount < metrics.actionCount * 2) {
    prompt += `✅ ADICIONE métricas mensuráveis (números, %, R$, prazos) em cada ação\n`;
  }
  prompt += '✅ ELIMINE linguagem genérica tipo "melhorar X", "treinar equipe"\n';
  prompt += '✅ USE categorias de ferramentas (CRM, ERP, BI) com exemplos, não marcas fixas\n\n';

  prompt += '🔴 REFAÇA o JSON completo com TODAS as ações corrigidas e retorne APENAS o JSON.';

  return prompt;
}

/**
 * Extrai métricas de telemetria do validation result
 */
export function extractTelemetryMetrics(validation: ValidationResult) {
  return {
    acao_density: validation.metrics.actionCount,
    how_depth_avg: validation.metrics.avgHowDepth,
    kpis_count: validation.metrics.kpisCount
  };
}
