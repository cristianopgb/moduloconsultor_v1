/**
 * ===================================================================
 * INTELLIGENT DIALOGUE MANAGER v2.0
 * ===================================================================
 *
 * PRINCÍPIO: Como um analista humano, a LLM analisa o arquivo REAL
 * e a pergunta do usuário para decidir se precisa de mais contexto.
 *
 * ANTES (v1 - ERRADO):
 * - Heurísticas fixas
 * - Perguntas genéricas de mockup
 * - Sem análise do arquivo real
 *
 * DEPOIS (v2 - CORRETO):
 * - LLM analisa schema + amostra + pergunta
 * - Perguntas contextuais baseadas no arquivo real
 * - Decisão inteligente sobre necessidade de mais informação
 * ===================================================================
 */

export interface IntelligentDialogueContext {
  userId: string;
  conversationId: string;

  // Análise do arquivo real
  fileAnalysis?: {
    domain: string;
    mainMetrics: string[];
    timeRange?: { start: string; end: string };
    keyEntities: string[];
  };

  // Contexto coletado
  userIntent?: string;
  missingCriticalInfo?: string[];
  enrichmentSuggestions?: string[];

  // Prevenção de loops
  questions_history?: Array<{
    questions: string[];
    asked_at: string;
    answered: boolean;
    answer?: string;
  }>;

  // Status
  completeness: number;
  isReadyForAnalysis: boolean;
}

export interface IntelligentDialogueResponse {
  shouldAnalyze: boolean;
  needsCriticalInfo: boolean;
  contextSummary: string;
  missingInfo: string[];
  enrichmentSuggestions: string[];
  message: string;
  context: IntelligentDialogueContext;
}

/**
 * Helper: Check if similar question was already asked (prevent loops)
 */
function hasAskedSimilarQuestion(
  newQuestions: string[],
  questionsHistory?: Array<{ questions: string[]; asked_at: string; answered: boolean }>
): boolean {
  if (!questionsHistory || questionsHistory.length === 0) return false;

  const allPreviousQuestions = questionsHistory.flatMap(h => h.questions);

  // Simple similarity check: if any new question contains/is contained in previous questions
  for (const newQ of newQuestions) {
    const normalizedNew = newQ.toLowerCase().trim();
    for (const prevQ of allPreviousQuestions) {
      const normalizedPrev = prevQ.toLowerCase().trim();
      if (
        normalizedNew.includes(normalizedPrev) ||
        normalizedPrev.includes(normalizedNew) ||
        levenshteinSimilarity(normalizedNew, normalizedPrev) > 0.7
      ) {
        console.log(`[IntelligentDialogue] Pergunta similar já feita: "${prevQ}" vs "${newQ}"`);
        return true;
      }
    }
  }

  return false;
}

/**
 * Helper: Calculate Levenshtein similarity (0-1)
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

/**
 * Main intelligent evaluation - uses LLM to analyze file + question
 */
export async function evaluateReadinessIntelligent(
  schema: any[],
  sampleRows: any[],
  userQuestion: string,
  openaiApiKey: string,
  openaiModel: string,
  existingContext?: Partial<IntelligentDialogueContext>
): Promise<IntelligentDialogueResponse> {

  const prompt = buildIntelligentPrompt(schema, sampleRows, userQuestion, existingContext);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          {
            role: 'system',
            content: INTELLIGENT_ANALYST_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('[IntelligentDialogue] OpenAI API error:', response.status);
      // Fallback: assume ready for analysis
      return createFallbackResponse(existingContext);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return createFallbackResponse(existingContext);
    }

    const result = JSON.parse(content);

    // PREVENÇÃO DE LOOPS: Verificar se perguntas similares já foram feitas
    const missingInfo = result.missing_info || [];
    let needsCriticalInfo = result.needs_critical_info || false;

    if (needsCriticalInfo && missingInfo.length > 0) {
      const alreadyAsked = hasAskedSimilarQuestion(
        missingInfo,
        existingContext?.questions_history
      );

      if (alreadyAsked) {
        console.log('[IntelligentDialogue] ⚠️ Loop detectado - forçando análise com dados disponíveis');
        needsCriticalInfo = false; // Forçar análise
        result.context_summary = (result.context_summary || '') + '\n\n✅ Prosseguindo com dados disponíveis (perguntas já foram feitas anteriormente).';
      }
    }

    return {
      shouldAnalyze: !needsCriticalInfo,
      needsCriticalInfo: needsCriticalInfo,
      contextSummary: result.context_summary || '',
      missingInfo: needsCriticalInfo ? missingInfo : [],
      enrichmentSuggestions: result.enrichment_suggestions || [],
      message: needsCriticalInfo ? buildUserMessage(result) : 'Tenho informações suficientes. Vou iniciar a análise!',
      context: {
        userId: existingContext?.userId || '',
        conversationId: existingContext?.conversationId || '',
        fileAnalysis: result.file_analysis,
        userIntent: result.user_intent,
        missingCriticalInfo: needsCriticalInfo ? missingInfo : [],
        enrichmentSuggestions: result.enrichment_suggestions,
        questions_history: existingContext?.questions_history || [],
        completeness: needsCriticalInfo ? (result.completeness || 50) : 100,
        isReadyForAnalysis: !needsCriticalInfo
      }
    };

  } catch (error) {
    console.error('[IntelligentDialogue] Error:', error);
    return createFallbackResponse(existingContext);
  }
}

/**
 * System prompt for intelligent analyst
 */
const INTELLIGENT_ANALYST_SYSTEM_PROMPT = `Você é um analista de dados experiente conversando com um usuário.

Seu trabalho é analisar:
1. O SCHEMA REAL do arquivo enviado
2. Uma AMOSTRA REAL dos dados
3. A PERGUNTA/DEMANDA do usuário

E decidir:
- Tenho informação suficiente para fazer uma análise precisa?
- Falta alguma informação CRÍTICA que impede a análise?
- Posso sugerir enriquecimentos OPCIONAIS?

REGRAS IMPORTANTES:

1. **Seja contextual ao arquivo real**
   - Mencione dados REAIS que você viu: "Vi que você tem dados de vendas de Janeiro a Março..."
   - Não use exemplos genéricos ou mockups
   - Baseie suas perguntas no arquivo real enviado

2. **Pergunte apenas o CRÍTICO**
   - Se o arquivo tem tudo para responder a pergunta, não pergunte nada
   - Só pergunte se a informação for ESSENCIAL para a análise
   - Preferência: prosseguir e sugerir enriquecimentos opcionais

3. **Formato de resposta JSON**
{
  "needs_critical_info": boolean,
  "context_summary": "string descrevendo o que você entendeu do arquivo",
  "user_intent": "string descrevendo o que o usuário quer",
  "missing_info": ["informação crítica 1", "informação crítica 2"],
  "enrichment_suggestions": ["sugestão opcional 1", "sugestão opcional 2"],
  "completeness": 0-100,
  "file_analysis": {
    "domain": "logistics|sales|hr|financial|generic",
    "mainMetrics": ["métrica1", "métrica2"],
    "timeRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
    "keyEntities": ["entidade1", "entidade2"]
  }
}

4. **Exemplos de boa análise**

EXEMPLO 1 - Arquivo completo:
Arquivo: Vendas com colunas [data, produto, quantidade, valor, cliente]
Pergunta: "Qual produto vendeu mais?"
Resposta:
{
  "needs_critical_info": false,
  "context_summary": "Vi que você tem dados completos de vendas com produto, quantidade e valor. Seu arquivo cobre o período de 2024-01-01 a 2024-03-31.",
  "user_intent": "Identificar o produto com maior volume de vendas",
  "missing_info": [],
  "enrichment_suggestions": [
    "Quer ver também o faturamento por produto?",
    "Quer uma análise temporal (evolução ao longo dos meses)?",
    "Quer ver o ticket médio por produto?"
  ],
  "completeness": 100
}

EXEMPLO 2 - Falta informação crítica:
Arquivo: Entregas com colunas [pedido, data_pedido, transportadora]
Pergunta: "Calcule o OTIF"
Resposta:
{
  "needs_critical_info": true,
  "context_summary": "Vi que você tem dados de pedidos e transportadoras, mas para calcular OTIF (On-Time In-Full) preciso saber quando os pedidos foram realmente entregues.",
  "user_intent": "Calcular taxa de entregas no prazo e completas (OTIF)",
  "missing_info": [
    "Qual a data real de entrega de cada pedido? (não vi essa informação no arquivo)",
    "Qual a data prometida de entrega para cada pedido?"
  ],
  "enrichment_suggestions": [],
  "completeness": 40
}`;

/**
 * Build prompt for LLM with real file data
 */
function buildIntelligentPrompt(
  schema: any[],
  sampleRows: any[],
  userQuestion: string,
  existingContext?: Partial<IntelligentDialogueContext>
): string {
  const schemaDescription = schema.map(col =>
    `- ${col.name} (${col.type}): amostras = [${col.sample_values.slice(0, 3).join(', ')}]`
  ).join('\n');

  const sampleData = sampleRows.slice(0, 10).map((row, idx) =>
    `Linha ${idx + 1}: ${JSON.stringify(row)}`
  ).join('\n');

  let prompt = `# ARQUIVO ENVIADO PELO USUÁRIO

## Schema (colunas disponíveis):
${schemaDescription}

## Amostra de dados reais (primeiras 10 linhas):
${sampleData}

## Pergunta/Demanda do usuário:
"${userQuestion}"
`;

  if (existingContext?.missingCriticalInfo && existingContext.missingCriticalInfo.length > 0) {
    prompt += `\n## Contexto anterior:
O usuário já recebeu perguntas sobre: ${existingContext.missingCriticalInfo.join(', ')}
Esta é a resposta dele à pergunta anterior.
`;
  }

  prompt += `\n## Sua tarefa:
Analise o arquivo real e a pergunta do usuário. Responda em JSON seguindo o formato especificado.
Seja contextual e mencione dados reais que você viu no arquivo.`;

  return prompt;
}

/**
 * Build user-friendly message from LLM response
 */
function buildUserMessage(result: any): string {
  if (!result.needs_critical_info) {
    let msg = `${result.context_summary}\n\nVou prosseguir com a análise!`;

    if (result.enrichment_suggestions && result.enrichment_suggestions.length > 0) {
      msg += `\n\nSugestões de enriquecimento:\n`;
      result.enrichment_suggestions.forEach((sug: string, idx: number) => {
        msg += `${idx + 1}. ${sug}\n`;
      });
    }

    return msg;
  } else {
    let msg = `${result.context_summary}\n\nPara fazer uma análise precisa, preciso de mais informações:\n\n`;

    result.missing_info.forEach((info: string, idx: number) => {
      msg += `${idx + 1}. ${info}\n`;
    });

    return msg;
  }
}

/**
 * Fallback response when LLM fails
 */
function createFallbackResponse(existingContext?: Partial<IntelligentDialogueContext>): IntelligentDialogueResponse {
  return {
    shouldAnalyze: true,
    needsCriticalInfo: false,
    contextSummary: 'Arquivo recebido com sucesso',
    missingInfo: [],
    enrichmentSuggestions: [],
    message: 'Vou prosseguir com a análise dos seus dados!',
    context: {
      userId: existingContext?.userId || '',
      conversationId: existingContext?.conversationId || '',
      completeness: 100,
      isReadyForAnalysis: true
    }
  };
}

/**
 * Parse user response to previous questions (future enhancement)
 */
export function parseUserResponseIntelligent(
  userResponse: string,
  previousContext: IntelligentDialogueContext
): Partial<IntelligentDialogueContext> {
  // For now, just mark as ready
  // Future: use LLM to extract answers from user response
  return {
    ...previousContext,
    completeness: 100,
    isReadyForAnalysis: true,
    missingCriticalInfo: []
  };
}
