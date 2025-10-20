/**
 * DIALOGUE MANAGER - Pre-Analysis Conversation System
 *
 * Transforms analytics from automatic analysis into conversational intelligence.
 * Collects context, asks clarifying questions, and ensures sufficient information
 * before triggering expensive analysis operations.
 */

export interface DialogueContext {
  userId: string;
  conversationId: string;
  analysisType?: string; // 'otif', 'sales', 'hr', 'financial', 'generic'

  // Collected information
  timeframe?: { start?: string; end?: string };
  metrics?: string[]; // Which metrics user cares about
  goals?: string[]; // User's goals or benchmarks
  excludeConditions?: string[]; // What to exclude from analysis
  specialInstructions?: string; // Free-form special requests

  // Status
  completeness: number; // 0-100
  missingInfo: string[];
  isReadyForAnalysis: boolean;
}

export interface DialogueResponse {
  shouldAnalyze: boolean;
  needsMoreInfo: boolean;
  questions: string[];
  context?: DialogueContext;
  message: string;
}

export interface DatasetCharacteristics {
  hasDateColumn: boolean;
  hasQuantityColumn: boolean;
  hasPriceColumn: boolean;
  hasStatusColumn: boolean;
  hasCustomerColumn: boolean;
  hasProductColumn: boolean;
  estimatedDomain: string;
  suggestedQuestions: string[];
}

/**
 * Analyze dataset to understand what questions make sense
 */
export function analyzeDatasetCharacteristics(schema: any[]): DatasetCharacteristics {
  const columns = schema.map(s => s.name.toLowerCase());

  // Detect common column patterns
  const hasDateColumn = columns.some(c =>
    c.includes('data') || c.includes('date') || c.includes('dt') ||
    c.includes('dia') || c.includes('mes') || c.includes('ano')
  );

  const hasQuantityColumn = columns.some(c =>
    c.includes('qtd') || c.includes('quantidade') || c.includes('quantity') ||
    c.includes('volume') || c.includes('units') || c.includes('count')
  );

  const hasPriceColumn = columns.some(c =>
    c.includes('preco') || c.includes('price') || c.includes('valor') ||
    c.includes('value') || c.includes('amount') || c.includes('total')
  );

  const hasStatusColumn = columns.some(c =>
    c.includes('status') || c.includes('estado') || c.includes('situacao')
  );

  const hasCustomerColumn = columns.some(c =>
    c.includes('cliente') || c.includes('customer') || c.includes('client') ||
    c.includes('consumidor') || c.includes('comprador')
  );

  const hasProductColumn = columns.some(c =>
    c.includes('produto') || c.includes('product') || c.includes('item') ||
    c.includes('sku') || c.includes('mercadoria')
  );

  // Detect specific domains
  let estimatedDomain = 'generic';
  let suggestedQuestions: string[] = [];

  // OTIF / Logistics
  if (columns.some(c => c.includes('entrega') || c.includes('delivery') || c.includes('pedido') || c.includes('order'))) {
    estimatedDomain = 'logistics';
    suggestedQuestions = [
      'Qual o desempenho de entrega (OTIF)?',
      'Quais são os principais atrasos?',
      'Como está a performance por transportadora?',
      'Qual o lead time médio de entrega?'
    ];
  }
  // Sales
  else if ((hasPriceColumn && hasQuantityColumn) || columns.some(c => c.includes('venda') || c.includes('sales'))) {
    estimatedDomain = 'sales';
    suggestedQuestions = [
      'Qual o total de vendas no período?',
      'Quais são os top 10 produtos mais vendidos?',
      'Como foi a evolução de vendas mês a mês?',
      'Qual o ticket médio por cliente?'
    ];
  }
  // HR
  else if (columns.some(c => c.includes('salario') || c.includes('salary') || c.includes('funcionario') || c.includes('employee'))) {
    estimatedDomain = 'hr';
    suggestedQuestions = [
      'Qual a distribuição salarial por departamento?',
      'Quantos funcionários temos atualmente?',
      'Qual a taxa de turnover?',
      'Como está a diversidade da equipe?'
    ];
  }
  // Financial
  else if (columns.some(c => c.includes('receita') || c.includes('revenue') || c.includes('despesa') || c.includes('expense'))) {
    estimatedDomain = 'financial';
    suggestedQuestions = [
      'Qual o balanço financeiro do período?',
      'Quais são as maiores despesas?',
      'Como foi a evolução da receita?',
      'Qual a margem de lucro?'
    ];
  }

  return {
    hasDateColumn,
    hasQuantityColumn,
    hasPriceColumn,
    hasStatusColumn,
    hasCustomerColumn,
    hasProductColumn,
    estimatedDomain,
    suggestedQuestions
  };
}

/**
 * Determine if user question is vague and needs more context
 */
export function isQuestionVague(question: string): boolean {
  const vaguePhrases = [
    'analise',
    'analyze',
    'mostre',
    'show me',
    'veja',
    'look at',
    'o que tem',
    'what is',
    'como está',
    'how is',
    'pense por mim',
    'think for me'
  ];

  const lowerQuestion = question.toLowerCase().trim();

  // Check if question is too short
  if (lowerQuestion.split(' ').length <= 3) {
    return true;
  }

  // Check if question is just a vague command
  return vaguePhrases.some(phrase => lowerQuestion === phrase || lowerQuestion.startsWith(phrase + ' '));
}

/**
 * Extract intent from user question
 */
export function extractIntent(question: string): {
  type: 'question' | 'command' | 'clarification';
  needsTimeframe: boolean;
  needsMetrics: boolean;
  needsComparison: boolean;
  hasClearGoal: boolean;
} {
  const lower = question.toLowerCase();

  // Check for question patterns
  const isQuestion = /\?$/.test(question) ||
                    /^(qual|quais|quanto|quantos|como|onde|quando|por que|quem)/.test(lower) ||
                    /^(what|which|how|where|when|why|who)/.test(lower);

  // Check for timeframe indicators
  const needsTimeframe = !(/\b(mes|mês|ano|dia|semana|trimestre|month|year|day|week|quarter)\b/.test(lower) ||
                          /\b(2023|2024|2025|janeiro|fevereiro|jan|feb|mar|apr)\b/.test(lower) ||
                          /\b(último|last|próximo|next|este|this)\b/.test(lower));

  // Check for metric indicators
  const needsMetrics = !(/\b(total|média|average|máximo|mínimo|max|min|count|sum|percentual)\b/.test(lower));

  // Check for comparison indicators
  const needsComparison = /\b(compar|vs|versus|diferença|variação|crescimento|queda)\b/.test(lower);

  // Check for clear goal
  const hasClearGoal = /\b(meta|objetivo|target|goal|benchmark|ideal|esperado)\b/.test(lower);

  return {
    type: isQuestion ? 'question' : 'command',
    needsTimeframe,
    needsMetrics,
    needsComparison,
    hasClearGoal
  };
}

/**
 * Generate contextual questions based on missing information
 */
export function generateQuestions(
  userQuestion: string,
  schema: any[],
  existingContext?: Partial<DialogueContext>
): string[] {
  const questions: string[] = [];
  const characteristics = analyzeDatasetCharacteristics(schema);
  const intent = extractIntent(userQuestion);

  // Priority 1: Timeframe (if dataset has dates and none specified)
  if (characteristics.hasDateColumn && !existingContext?.timeframe && intent.needsTimeframe) {
    questions.push('📅 **Qual período você gostaria de analisar?** (por exemplo: "último trimestre", "ano de 2024", "últimos 6 meses")');
  }

  // Priority 2: Specific metrics (if question is vague)
  if (intent.needsMetrics && isQuestionVague(userQuestion)) {
    if (characteristics.estimatedDomain === 'sales') {
      questions.push('📊 **Quais métricas são mais relevantes para você?** (por exemplo: faturamento total, ticket médio, produtos mais vendidos)');
    } else if (characteristics.estimatedDomain === 'logistics') {
      questions.push('📊 **Você prefere focar em pontualidade, completude, ou ambos (OTIF)?**');
    } else {
      questions.push('📊 **Quais indicadores você gostaria de acompanhar?** (por exemplo: totais, médias, ranking top 10, distribuição)');
    }
  }

  // Priority 3: Goals or benchmarks
  if (!existingContext?.goals) {
    if (characteristics.estimatedDomain === 'logistics') {
      questions.push('🎯 **Você tem alguma meta de performance em mente?** (por exemplo: "OTIF deve ser maior que 95%")');
    } else if (characteristics.estimatedDomain === 'sales') {
      questions.push('🎯 **Existe alguma meta de vendas ou crescimento que você está acompanhando?**');
    }
  }

  // Priority 4: Exclusions or filters
  if (!existingContext?.excludeConditions) {
    questions.push('🔍 **Há algum dado específico que você gostaria de excluir?** (por exemplo: "ignorar pedidos cancelados", "apenas clientes ativos")');
  }

  // Priority 5: Comparison (if user wants comparison but didn't specify)
  if (intent.needsComparison && characteristics.hasDateColumn) {
    questions.push('📈 **Com qual período você gostaria de comparar?** (por exemplo: "vs. mês anterior", "vs. mesmo período do ano passado")');
  }

  // Limit to 3 questions maximum (don't overwhelm user)
  return questions.slice(0, 3);
}

/**
 * Calculate context completeness score
 */
export function calculateCompleteness(context: Partial<DialogueContext>, question: string, schema: any[]): number {
  let score = 0;
  const characteristics = analyzeDatasetCharacteristics(schema);
  const intent = extractIntent(question);

  // Base score for having a question
  score += 20;

  // Timeframe (if applicable)
  if (!characteristics.hasDateColumn || context.timeframe || !intent.needsTimeframe) {
    score += 25;
  }

  // Metrics clarity
  if (!intent.needsMetrics || context.metrics) {
    score += 20;
  }

  // Goals/benchmarks (nice to have)
  if (context.goals && context.goals.length > 0) {
    score += 15;
  }

  // Exclusions/filters (nice to have)
  if (context.excludeConditions && context.excludeConditions.length > 0) {
    score += 10;
  }

  // Question specificity
  if (!isQuestionVague(question)) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Main function: Decide if should analyze or ask more questions
 */
export function evaluateReadiness(
  userQuestion: string,
  schema: any[],
  existingContext?: Partial<DialogueContext>
): DialogueResponse {
  const characteristics = analyzeDatasetCharacteristics(schema);
  const intent = extractIntent(userQuestion);
  const completeness = calculateCompleteness(existingContext || {}, userQuestion, schema);

  // Context is well-formed - ready to analyze
  if (completeness >= 70) {
    return {
      shouldAnalyze: true,
      needsMoreInfo: false,
      questions: [],
      context: {
        userId: existingContext?.userId || '',
        conversationId: existingContext?.conversationId || '',
        analysisType: characteristics.estimatedDomain,
        completeness,
        missingInfo: [],
        isReadyForAnalysis: true,
        ...existingContext
      },
      message: 'Perfeito! Tenho as informações que preciso. Vou iniciar a análise dos seus dados agora.'
    };
  }

  // Question is too vague - need more info
  const questions = generateQuestions(userQuestion, schema, existingContext);

  let message = 'Entendi sua solicitação! Para criar uma análise personalizada e relevante, preciso entender melhor alguns detalhes:\n\n';

  // Add context about what was detected
  if (characteristics.estimatedDomain !== 'generic') {
    message += `Identifiquei que seus dados são do tipo **${getDomainLabel(characteristics.estimatedDomain)}**. `;
  }

  message += 'Por favor, responda as perguntas abaixo para eu criar a análise ideal:\n\n';

  return {
    shouldAnalyze: false,
    needsMoreInfo: true,
    questions,
    context: {
      userId: existingContext?.userId || '',
      conversationId: existingContext?.conversationId || '',
      analysisType: characteristics.estimatedDomain,
      completeness,
      missingInfo: questions.map(q => q.split(':')[0].trim()),
      isReadyForAnalysis: false,
      ...existingContext
    },
    message
  };
}

/**
 * Parse user response and update context
 */
export function parseUserResponse(
  response: string,
  currentContext: Partial<DialogueContext>,
  schema: any[]
): Partial<DialogueContext> {
  const updated = { ...currentContext };
  const lower = response.toLowerCase();

  // Extract timeframe
  if (/\b(mes|mês|meses|month|ano|year|dia|day|semana|week|trimestre|quarter)\b/.test(lower)) {
    updated.timeframe = updated.timeframe || {};
    // Simple heuristic - can be improved
    if (/último|last|passado/.test(lower)) {
      updated.timeframe = { start: 'last_period' };
    } else if (/próximo|next/.test(lower)) {
      updated.timeframe = { start: 'next_period' };
    } else {
      updated.timeframe = { start: 'specified', end: response };
    }
  }

  // Extract metrics
  const metricKeywords = ['total', 'média', 'average', 'top', 'ranking', 'distribuição', 'evolução', 'crescimento'];
  const foundMetrics = metricKeywords.filter(keyword => lower.includes(keyword));
  if (foundMetrics.length > 0) {
    updated.metrics = [...(updated.metrics || []), ...foundMetrics];
  }

  // Extract goals
  if (/\b(meta|objetivo|target|goal|benchmark|>\s*\d+|<\s*\d+|=\s*\d+)\b/.test(lower)) {
    updated.goals = updated.goals || [];
    updated.goals.push(response);
  }

  // Extract exclusions
  if (/\b(excluir|ignorar|remover|sem|exclude|ignore|without)\b/.test(lower)) {
    updated.excludeConditions = updated.excludeConditions || [];
    updated.excludeConditions.push(response);
  }

  // If response doesn't match any pattern, treat as special instruction
  if (!updated.timeframe && !foundMetrics.length && !updated.goals && !updated.excludeConditions) {
    updated.specialInstructions = response;
  }

  return updated;
}

/**
 * Get human-friendly domain label
 */
function getDomainLabel(domain: string): string {
  const labels: Record<string, string> = {
    'logistics': 'Logística / OTIF',
    'sales': 'Vendas / Comercial',
    'hr': 'Recursos Humanos',
    'financial': 'Financeiro',
    'generic': 'Análise Geral'
  };
  return labels[domain] || domain;
}

/**
 * Create enriched analysis prompt with collected context
 */
export function enrichPromptWithContext(
  originalQuestion: string,
  context: DialogueContext,
  schema: any[]
): string {
  const parts: string[] = [originalQuestion];

  if (context.timeframe) {
    parts.push(`\n**Período**: ${JSON.stringify(context.timeframe)}`);
  }

  if (context.metrics && context.metrics.length > 0) {
    parts.push(`\n**Métricas prioritárias**: ${context.metrics.join(', ')}`);
  }

  if (context.goals && context.goals.length > 0) {
    parts.push(`\n**Metas/Benchmarks**: ${context.goals.join('; ')}`);
  }

  if (context.excludeConditions && context.excludeConditions.length > 0) {
    parts.push(`\n**Exclusões**: ${context.excludeConditions.join('; ')}`);
  }

  if (context.specialInstructions) {
    parts.push(`\n**Instruções especiais**: ${context.specialInstructions}`);
  }

  return parts.join('\n');
}
