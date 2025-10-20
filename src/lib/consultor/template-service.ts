import { supabase } from '../supabase';

export class TemplateService {
  static async gerarEntregavel(
    tipoTemplate: string,
    categoria: string,
    dadosContexto: Record<string, any>
  ) {
    try {
      const { data: template } = await supabase
        .from('templates_entregaveis')
        .select('*')
        .eq('tipo', tipoTemplate)
        .eq('categoria', categoria)
        .maybeSingle();

      if (!template) {
        console.warn(`Template não encontrado: ${tipoTemplate}/${categoria}`);
        return null;
      }

      const promptPreenchimento = this.construirPromptPreenchimento(
        template,
        dadosContexto
      );

      const dadosPreenchidos = await this.preencherComLLM(
        promptPreenchimento,
        template.placeholders
      );

      let htmlFinal = template.html_template;

      Object.entries(dadosPreenchidos).forEach(([placeholder, valor]) => {
        const regex = new RegExp(`{{${placeholder}}}`, 'g');
        htmlFinal = htmlFinal.replace(regex, String(valor));
      });

      return {
        nome: template.nome,
        html_conteudo: htmlFinal,
        dados_utilizados: dadosPreenchidos
      };
    } catch (error) {
      console.error('Erro ao gerar entregável:', error);
      return null;
    }
  }

  static construirPromptPreenchimento(template: any, contexto: Record<string, any>): string {
    return `
Você deve preencher os placeholders de um template de entregável.

TEMPLATE: ${template.nome}
CATEGORIA: ${template.categoria}

PLACEHOLDERS NECESSÁRIOS:
${template.placeholders.map((p: string) => `- {{${p}}}`).join('\n')}

CONTEXTO DISPONÍVEL:
${JSON.stringify(contexto, null, 2)}

INSTRUÇÕES:
1. Analise o contexto fornecido
2. Preencha cada placeholder com informação relevante e bem formatada
3. Use HTML simples quando necessário (listas, quebras de linha)
4. Seja específico e personalizado para esta empresa
5. Mantenha tom profissional e consultivo

RETORNE APENAS um JSON com os placeholders preenchidos:
{
  "placeholder1": "valor preenchido",
  "placeholder2": "valor preenchido"
}
`;
  }

  static async preencherComLLM(
    prompt: string,
    placeholders: string[]
  ): Promise<Record<string, any>> {
    try {
      const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!openaiKey) {
        console.error('OPENAI_API_KEY não configurada');
        return this.createFallbackData(placeholders);
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em preenchimento de templates de consultoria empresarial.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error('Erro na API OpenAI');
      }

      const data = await response.json();
      const conteudo = data.choices[0].message.content;

      return JSON.parse(conteudo);
    } catch (error) {
      console.error('Erro ao preencher com LLM:', error);
      return this.createFallbackData(placeholders);
    }
  }

  static createFallbackData(placeholders: string[]): Record<string, any> {
    const fallback: Record<string, any> = {};
    placeholders.forEach(placeholder => {
      fallback[placeholder] = `[${placeholder.toUpperCase().replace(/_/g, ' ')}]`;
    });
    return fallback;
  }
}
