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

REGRAS DE STORYTELLING:
1. Comece com o PRINCIPAL ACHADO (headline impactante)
2. Adicione CONTEXTO (o que isso significa?)
3. Compare com REFERÊNCIAS (outros vendedores, média, meta, período anterior)
4. Identifique PADRÕES interessantes (concentração, tendência, anomalia)
5. Sugira AÇÕES práticas (o que fazer com essa informação?)
6. Use emojis com PARCIMÔNIA (1-2 por insight, não mais)
7. Números SEMPRE concretos (nunca "muitos", sempre "45%")
8. Use TODOS os resultados das queries (não ignore nenhum resultado!)

EXEMPLO DE BOM STORYTELLING:

Pergunta: "Como foi a performance de Fernando?"

❌ RUIM (vago, sem contexto):
"Fernando vendeu 408 unidades totalizando R$ 39.404,32."

✅ BOM (rico, com contexto, insights):
"Fernando é especialista em argamassa! 🎯

Ele concentrou 100% das vendas (408 unidades) em um único produto: Argamassa AC-II 20kg,
gerando R$ 39.404,32 em receita.

**Contexto:** O dataset tem 15 vendedores ativos. Fernando representa 7,8% das vendas totais.

**Padrão interessante:** Essa especialização extrema pode ser:
- 💪 **Força:** Expertise profunda = fechamentos mais rápidos
- ⚠️ **Oportunidade:** Diversificar portfólio poderia multiplicar resultados

**Comparação:** A média dos vendedores é R$ 33.600. Fernando está 17% acima da média,
mas concentrado em uma única categoria.

**Insight de negócio:** Se Fernando aplicar o mesmo nível de especialização em 2-3
categorias complementares (ex: cimento, rejunte), pode potencialmente dobrar o volume."

REGRAS TÉCNICAS:
- Linguagem simples e direta (como se estivesse falando)
- Números concretos (não generalizações)
- Insights de negócio (não técnicos)
- ZERO jargão técnico
- Conecte insights com ações práticas
- Conte uma HISTÓRIA com os dados
- Use TODOS os resultados (não deixe queries sem mencionar)

Retorne JSON VÁLIDO no seguinte formato:

{
  "headline": "Título chamativo do principal achado (máximo 10 palavras)",
  "executive_summary": "Resumo executivo de 2-3 frases diretas",
  "key_insights": [
    {
      "title": "Especialização em produto único",
      "description": "Fernando vendeu exclusivamente Argamassa AC-II 20kg (408 unidades), demonstrando expertise profunda nesta categoria. Essa especialização resultou em R$ 39.404,32 em receita, mas limita o potencial de crescimento.",
      "numbers": ["100% de concentração em 1 produto", "408 unidades vendidas", "R$ 39.404,32 em receita"],
      "importance": "high",
      "emoji": "🎯"
    },
    {
      "title": "Performance acima da média",
      "description": "Entre 15 vendedores ativos, Fernando fica 17% acima da média de receita (R$ 33.600). Representa 7,8% do total de vendas da empresa.",
      "numbers": ["17% acima da média", "7,8% do total", "15 vendedores no time"],
      "importance": "medium",
      "emoji": "📊"
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
      "action": "Diversificar portfólio de Fernando para 2-3 categorias complementares",
      "rationale": "Dado o sucesso em argamassa, aplicar a mesma expertise em cimento e rejunte pode capturar vendas cruzadas. Clientes de argamassa frequentemente compram esses produtos.",
      "expected_impact": "Potencial de aumentar receita em 60-80% mantendo a mesma base de clientes",
      "priority": "high"
    },
    {
      "action": "Criar programa de mentoria com Fernando para outros vendedores",
      "rationale": "Fernando tem técnicas de especialização que funcionam. Replicar isso pode elevar a performance média do time.",
      "expected_impact": "Elevar a média do time de R$ 33.600 para R$ 40.000+",
      "priority": "medium"
    }
  ],
  "next_questions": [
    "Quais clientes de Fernando têm maior potencial para vendas cruzadas?",
    "Como Fernando se compara aos outros vendedores em taxa de conversão?",
    "Qual a margem de lucro média de argamassa vs outras categorias?"
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
