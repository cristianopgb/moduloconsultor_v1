/**
 * ===================================================================
 * TEMPLATE ORCHESTRATOR - Intelligent Template Selection
 * ===================================================================
 *
 * Analyzes the user's file + question and automatically suggests
 * the most appropriate template for analysis.
 *
 * Process:
 * 1. Analyze file characteristics (domain, metrics, entities)
 * 2. Analyze user intent from question
 * 3. Match against available templates
 * 4. Return best template with confidence score
 * ===================================================================
 */

export interface TemplateRecommendation {
  recommendedTemplateId: string | null;
  recommendedTemplateName: string | null;
  confidence: number;
  reasoning: string;
  alternativeTemplates: Array<{
    id: string;
    name: string;
    score: number;
  }>;
  shouldUseTemplate: boolean;
}

/**
 * Orchestrate template selection using LLM
 */
export async function orchestrateTemplateSelection(
  schema: any[],
  sampleRows: any[],
  userQuestion: string,
  availableTemplates: any[],
  openaiApiKey: string,
  openaiModel: string
): Promise<TemplateRecommendation> {

  if (!availableTemplates || availableTemplates.length === 0) {
    return createNoTemplateResponse();
  }

  const prompt = buildOrchestrationPrompt(schema, sampleRows, userQuestion, availableTemplates);

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
            content: TEMPLATE_ORCHESTRATOR_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('[TemplateOrchestrator] OpenAI API error:', response.status);
      return createNoTemplateResponse();
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return createNoTemplateResponse();
    }

    const result = JSON.parse(content);

    return {
      recommendedTemplateId: result.recommended_template_id || null,
      recommendedTemplateName: result.recommended_template_name || null,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || '',
      alternativeTemplates: result.alternative_templates || [],
      shouldUseTemplate: result.should_use_template && result.confidence >= 60
    };

  } catch (error) {
    console.error('[TemplateOrchestrator] Error:', error);
    return createNoTemplateResponse();
  }
}

/**
 * System prompt for template orchestration
 */
const TEMPLATE_ORCHESTRATOR_SYSTEM_PROMPT = `Você é um especialista em análise de dados e seleção de templates SQL.

Seu trabalho é analisar:
1. O arquivo enviado pelo usuário (schema + amostra de dados)
2. A pergunta/demanda do usuário
3. Os templates disponíveis no sistema

E recomendar o template mais adequado.

REGRAS:

1. **Análise de compatibilidade**
   - Verifique se as colunas do arquivo batem com as required_columns do template
   - Analise se a semântica (semantic_tags) do template corresponde à demanda
   - Considere o domínio (vendas, logística, RH, financeiro)

2. **Confiança (confidence)**
   - 90-100: Match perfeito (todas as colunas e semântica batem)
   - 70-89: Match bom (maioria das colunas e semântica similar)
   - 50-69: Match razoável (algumas colunas e semântica relacionada)
   - 0-49: Match fraco (pouca ou nenhuma correspondência)

3. **Quando NÃO usar template**
   - Confidence < 60
   - Pergunta é muito específica e não se encaixa em nenhum template
   - Dados não têm as colunas necessárias para o template

4. **Formato de resposta JSON**
{
  "should_use_template": boolean,
  "recommended_template_id": "uuid ou null",
  "recommended_template_name": "nome ou null",
  "confidence": 0-100,
  "reasoning": "explicação clara do motivo da escolha",
  "alternative_templates": [
    { "id": "uuid", "name": "nome", "score": 0-100 }
  ]
}

EXEMPLOS:

EXEMPLO 1 - Match perfeito:
Arquivo: [data_pedido, data_entrega, transportadora, status]
Pergunta: "Calcule o OTIF"
Templates: [Template OTIF com required_columns: [data_pedido, data_entrega]]
Resposta:
{
  "should_use_template": true,
  "recommended_template_id": "template-otif-uuid",
  "recommended_template_name": "Análise OTIF",
  "confidence": 95,
  "reasoning": "O arquivo possui todas as colunas necessárias (data_pedido, data_entrega) para cálculo de OTIF. A pergunta solicita exatamente o que o template oferece.",
  "alternative_templates": []
}

EXEMPLO 2 - Nenhum template adequado:
Arquivo: [nome, idade, cidade, hobby]
Pergunta: "Quantas pessoas de cada cidade?"
Templates: [Template OTIF, Template Vendas, Template RH]
Resposta:
{
  "should_use_template": false,
  "recommended_template_id": null,
  "recommended_template_name": null,
  "confidence": 0,
  "reasoning": "Os templates disponíveis são para OTIF, Vendas e RH, mas o arquivo é sobre dados demográficos pessoais. Nenhum template se aplica. Melhor usar análise livre.",
  "alternative_templates": []
}

EXEMPLO 3 - Match parcial com alternativas:
Arquivo: [data, produto, quantidade, valor, cliente]
Pergunta: "Qual o produto mais vendido?"
Templates: [Template Vendas (required: data, produto, valor), Template Top N (required: categoria, metrica)]
Resposta:
{
  "should_use_template": true,
  "recommended_template_id": "template-vendas-uuid",
  "recommended_template_name": "Análise de Vendas",
  "confidence": 75,
  "reasoning": "O arquivo possui colunas de vendas (data, produto, valor, quantidade) que batem com o Template Vendas. A pergunta sobre 'produto mais vendido' pode ser respondida agregando por produto.",
  "alternative_templates": [
    { "id": "template-topn-uuid", "name": "Análise Top N", "score": 65 }
  ]
}`;

/**
 * Build prompt for template orchestration
 */
function buildOrchestrationPrompt(
  schema: any[],
  sampleRows: any[],
  userQuestion: string,
  templates: any[]
): string {
  const schemaDescription = schema.map(col =>
    `- ${col.name} (${col.type})`
  ).join('\n');

  const sampleData = sampleRows.slice(0, 5).map((row, idx) =>
    `Linha ${idx + 1}: ${JSON.stringify(row)}`
  ).join('\n');

  const templatesDescription = templates.map(t =>
    `
Template: ${t.name} (ID: ${t.id})
Descrição: ${t.description || 'Sem descrição'}
Tags semânticas: ${(t.semantic_tags || []).join(', ')}
Colunas necessárias: ${(t.required_columns || []).join(', ')}
`
  ).join('\n---\n');

  return `# ARQUIVO ENVIADO

## Colunas disponíveis:
${schemaDescription}

## Amostra de dados (primeiras 5 linhas):
${sampleData}

# PERGUNTA DO USUÁRIO
"${userQuestion}"

# TEMPLATES DISPONÍVEIS
${templatesDescription}

# SUA TAREFA
Analise o arquivo, a pergunta e os templates disponíveis.
Recomende o template mais adequado (se houver) em formato JSON.`;
}

/**
 * Create response when no templates are suitable
 */
function createNoTemplateResponse(): TemplateRecommendation {
  return {
    recommendedTemplateId: null,
    recommendedTemplateName: null,
    confidence: 0,
    reasoning: 'Nenhum template específico identificado. Usando análise livre.',
    alternativeTemplates: [],
    shouldUseTemplate: false
  };
}
