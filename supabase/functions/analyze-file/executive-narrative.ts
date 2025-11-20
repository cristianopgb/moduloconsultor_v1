/**
 * EXECUTIVE NARRATIVE GENERATOR
 *
 * Transforms technical results into business-friendly narratives.
 * Think: Senior analyst presenting to CEO.
 *
 * Core principles:
 * - Simple, direct language (as if speaking, not writing)
 * - Concrete numbers (not generalizations)
 * - Business insights (not technical details)
 * - Actionable recommendations
 * - ZERO technical jargon
 */

export interface ExecutiveNarrative {
  headline: string;
  executive_summary: string;
  key_insights: Array<{
    title: string;
    description: string;
    numbers: string[];
    importance: 'high' | 'medium' | 'low';
    emoji: string;
  }>;
  visualizations: Array<{
    type: string;
    title: string;
    data: any;
    interpretation: string;
  }>;
  business_recommendations: Array<{
    action: string;
    rationale: string;
    expected_impact: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  next_questions: string[];
}

async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateExecutiveNarrative(
  userQuestion: string,
  businessUnderstanding: any,
  executedQueries: any[],
  openaiApiKey: string,
  openaiModel: string
): Promise<ExecutiveNarrative> {

  const prompt = `
Você é um analista de dados apresentando resultados ao CEO de uma empresa.

SOLICITAÇÃO ORIGINAL:
"${userQuestion}"

CONTEXTO DE NEGÓCIO:
${JSON.stringify(businessUnderstanding, null, 2)}

RESULTADOS DA ANÁLISE:
${JSON.stringify(executedQueries, null, 2)}

SUA TAREFA:
Crie uma apresentação executiva clara, concisa e acionável.

REGRAS:
- Linguagem simples e direta (como se estivesse falando, não escrevendo)
- Números concretos e específicos (não generalizações)
- Insights de negócio (não técnicos)
- Recomendações práticas e acionáveis
- ZERO jargão técnico
- Use emojis com moderação para dar vida ao texto
- Seja específico com números (não diga "muitos", diga "45%")
- Conecte insights com ações práticas
- Conte uma história com os dados

Retorne JSON VÁLIDO no seguinte formato:

{
  "headline": "Título chamativo do principal achado (máximo 10 palavras)",
  "executive_summary": "Resumo executivo de 2-3 frases diretas",
  "key_insights": [
    {
      "title": "Nome do insight",
      "description": "Explicação clara e direta (2-3 frases)",
      "numbers": ["Dado específico 1", "Dado específico 2"],
      "importance": "high",
      "emoji": "📈"
    }
  ],
  "visualizations": [
    {
      "type": "bar",
      "title": "Título do gráfico",
      "data": {
        "labels": ["Label 1", "Label 2"],
        "values": [100, 200]
      },
      "interpretation": "O que este gráfico mostra (1-2 frases)"
    }
  ],
  "business_recommendations": [
    {
      "action": "Ação específica recomendada",
      "rationale": "Por que fazer isso (1-2 frases)",
      "expected_impact": "Resultado esperado",
      "priority": "high"
    }
  ],
  "next_questions": [
    "Sugestão de pergunta 1 baseada nos resultados",
    "Sugestão de pergunta 2 baseada nos resultados",
    "Sugestão de pergunta 3 baseada nos resultados"
  ]
}

IMPORTANTE:
- Seja honesto se os dados não responderam completamente a pergunta
- Sempre inclua pelo menos 2-3 insights
- Sempre inclua pelo menos 1 visualização
- Sempre inclua pelo menos 1 recomendação
- As sugestões de próximas perguntas devem ser relevantes e específicas

Retorne APENAS o JSON (sem markdown, sem explicação adicional).
`;

  console.log('[ExecutiveNarrative] Generating narrative...');

  const response = await callOpenAI(prompt, openaiApiKey, openaiModel);

  const cleanResponse = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');

  try {
    const narrative = JSON.parse(cleanResponse);
    console.log('[ExecutiveNarrative] Narrative generated successfully');
    return narrative;
  } catch (error: any) {
    console.error('[ExecutiveNarrative] Failed to parse response:', cleanResponse);
    throw new Error(`Failed to parse narrative: ${error.message}`);
  }
}
