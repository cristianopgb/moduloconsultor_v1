/**
 * Template Service - REAL Implementation
 *
 * Generates actual deliverables with structured content
 * Uses LLM to fill templates based on context
 */

import { supabase } from '../supabase';

export interface DeliverableResult {
  nome: string;
  html_conteudo?: string;
  conteudo_xml?: string;
  conteudo_md?: string;
  dados_utilizados: Record<string, any>;
}

export class TemplateService {
  /**
   * Main entry point - routes to specific generator
   */
  static async gerar(tipo: string, contexto: any): Promise<DeliverableResult | null> {
    console.log('[TEMPLATE-SERVICE] Generating:', tipo);

    try {
      switch (tipo.toLowerCase()) {
        case 'ishikawa':
        case 'diagrama_ishikawa':
          return await this.gerarIshikawa(contexto);

        case 'sipoc':
          return await this.gerarSIPOC(contexto);

        case 'bpmn':
        case 'bpmn_as_is':
        case 'bpmn_asis':
          return await this.gerarBPMN(contexto, 'AS-IS');

        case 'bpmn_to_be':
        case 'bpmn_tobe':
          return await this.gerarBPMN(contexto, 'TO-BE');

        case '5w2h':
        case 'plano_acao':
        case 'plano_5w2h':
          return await this.gerar5W2H(contexto);

        case 'okr':
        case 'okrs':
          return await this.gerarOKR(contexto);

        case 'bsc':
        case 'balanced_scorecard':
          return await this.gerarBSC(contexto);

        case 'matriz_priorizacao':
        case 'matriz_gut':
          return await this.gerarMatrizPriorizacao(contexto);

        case 'escopo':
        case 'escopo_projeto':
          return await this.gerarEscopo(contexto);

        case 'diagnostico':
          return await this.gerarDiagnostico(contexto);

        default:
          console.warn('[TEMPLATE-SERVICE] Unknown type:', tipo);
          return await this.gerarGenerico(tipo, contexto);
      }
    } catch (error) {
      console.error('[TEMPLATE-SERVICE] Error generating:', tipo, error);
      return null;
    }
  }

  /**
   * Generate Ishikawa (Fishbone) Diagram
   */
  private static async gerarIshikawa(contexto: any): Promise<DeliverableResult> {
    const problema = contexto.descricao_problema || contexto.titulo_problema || 'Problema identificado';
    const segmento = contexto.segmento || 'geral';

    const prompt = `Você é um consultor empresarial criando um Diagrama de Ishikawa (Espinha de Peixe).

PROBLEMA CENTRAL: ${problema}
SEGMENTO: ${segmento}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere um diagrama HTML estruturado com as 6 categorias clássicas:
- Máquina (Equipamentos, tecnologia)
- Método (Processos, procedimentos)
- Material (Matéria-prima, insumos)
- Mão de Obra (Pessoas, treinamento)
- Meio Ambiente (Ambiente físico, condições)
- Medição (Métricas, controles)

Para cada categoria, liste 3-4 causas específicas baseadas no contexto fornecido.

Retorne HTML completo, estilizado, profissional, pronto para visualização.
Use cores e layout moderno. Sem JavaScript.`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: `Diagrama Ishikawa - ${problema.substring(0, 50)}`,
      html_conteudo: html,
      dados_utilizados: { problema, segmento, contexto }
    };
  }

  /**
   * Generate SIPOC Diagram
   */
  private static async gerarSIPOC(contexto: any): Promise<DeliverableResult> {
    const processo = contexto.processo_nome || contexto.titulo_problema || 'Processo';

    const prompt = `Você é um consultor empresarial criando um diagrama SIPOC.

PROCESSO: ${processo}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere uma tabela HTML SIPOC completa com:
- Suppliers (Fornecedores): Quem fornece entradas
- Inputs (Entradas): O que entra no processo
- Process (Processo): Etapas principais (5-7 etapas)
- Outputs (Saídas): O que é produzido
- Customers (Clientes): Quem recebe as saídas

Para cada coluna, liste 3-5 itens específicos baseados no contexto.

Retorne HTML com tabela profissional, estilizada, cores modernas.`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: `SIPOC - ${processo.substring(0, 50)}`,
      html_conteudo: html,
      dados_utilizados: { processo, contexto }
    };
  }

  /**
   * Generate BPMN XML
   */
  private static async gerarBPMN(contexto: any, tipo: 'AS-IS' | 'TO-BE'): Promise<DeliverableResult> {
    const processo = contexto.processo_nome || contexto.titulo_problema || 'Processo';

    const prompt = `Você é um especialista em BPMN gerando XML válido.

PROCESSO: ${processo}
TIPO: ${tipo}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere XML BPMN 2.0 válido representando o fluxo ${tipo} do processo.

Inclua:
- StartEvent
- Tasks (5-8 atividades principais)
- Gateways (decisões se aplicável)
- EndEvent
- SequenceFlows conectando tudo

Use IDs únicos e labels descritivos.

Retorne APENAS o XML, sem markdown, sem explicações.`;

    const xml = await this.callLLMForText(prompt);

    // Clean XML
    const cleanXml = xml
      .replace(/```xml/g, '')
      .replace(/```/g, '')
      .trim();

    // Generate HTML wrapper for display
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>BPMN ${tipo} - ${processo}</title>
  <style>
    body { font-family: system-ui; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #1e40af; margin-bottom: 10px; }
    .subtitle { color: #64748b; margin-bottom: 30px; }
    pre { background: #f1f5f9; padding: 20px; border-radius: 6px; overflow-x: auto; border: 1px solid #e2e8f0; }
    code { font-family: 'Courier New', monospace; font-size: 12px; color: #334155; }
  </style>
</head>
<body>
  <div class="container">
    <h1>BPMN ${tipo}</h1>
    <p class="subtitle">${processo}</p>
    <pre><code class="language-xml">${cleanXml.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
  </div>
</body>
</html>`;

    return {
      nome: `BPMN ${tipo} - ${processo}`,
      html_conteudo: html,
      conteudo_xml: cleanXml,
      dados_utilizados: { processo, tipo, contexto }
    };
  }

  /**
   * Generate 5W2H Action Plan
   */
  private static async gerar5W2H(contexto: any): Promise<DeliverableResult> {
    const objetivo = contexto.objetivo_principal || contexto.titulo_problema || 'Plano de Ação';

    const prompt = `Você é um consultor empresarial criando um Plano de Ação 5W2H.

OBJETIVO: ${objetivo}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere uma tabela HTML 5W2H com 8-12 ações específicas.

Para cada ação, defina:
- What (O quê): Ação específica
- Why (Por quê): Justificativa
- Who (Quem): Responsável
- When (Quando): Prazo
- Where (Onde): Local/área
- How (Como): Método de execução
- How Much (Quanto): Custo/recurso estimado

Retorne HTML com tabela profissional, estilizada, prioridades visuais.`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: `Plano de Ação 5W2H - ${objetivo.substring(0, 50)}`,
      html_conteudo: html,
      dados_utilizados: { objetivo, contexto }
    };
  }

  /**
   * Generate OKRs
   */
  private static async gerarOKR(contexto: any): Promise<DeliverableResult> {
    const objetivo = contexto.objetivo_principal || contexto.titulo_problema || 'OKRs';

    const prompt = `Você é um consultor empresarial criando OKRs (Objectives and Key Results).

OBJETIVO: ${objetivo}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere 3-4 Objetivos, cada um com 3-4 Key Results mensuráveis.

Formato:
OBJETIVO 1: [Objetivo inspirador]
- KR1: [Resultado mensurável com meta numérica]
- KR2: [Resultado mensurável com meta numérica]
- KR3: [Resultado mensurável com meta numérica]

Retorne HTML estruturado, visualmente atraente, com progress bars.`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: `OKRs - ${objetivo.substring(0, 50)}`,
      html_conteudo: html,
      dados_utilizados: { objetivo, contexto }
    };
  }

  /**
   * Generate Balanced Scorecard
   */
  private static async gerarBSC(contexto: any): Promise<DeliverableResult> {
    const empresa = contexto.empresa_nome || 'Empresa';

    const prompt = `Você é um consultor empresarial criando um Balanced Scorecard.

EMPRESA: ${empresa}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere BSC com as 4 perspectivas:
1. Financeira (receita, custos, margens)
2. Clientes (satisfação, retenção, mercado)
3. Processos Internos (qualidade, eficiência, inovação)
4. Aprendizado e Crescimento (pessoas, sistemas, cultura)

Para cada perspectiva, defina:
- 3-4 objetivos
- 2-3 indicadores (KPIs)
- Metas específicas

Retorne HTML com layout em grid 2x2, visualmente organizado.`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: `Balanced Scorecard - ${empresa}`,
      html_conteudo: html,
      dados_utilizados: { empresa, contexto }
    };
  }

  /**
   * Generate Prioritization Matrix
   */
  private static async gerarMatrizPriorizacao(contexto: any): Promise<DeliverableResult> {
    const processos = contexto.processos || [];

    const prompt = `Você é um consultor empresarial criando uma Matriz de Priorização GUT.

PROCESSOS/PROBLEMAS: ${JSON.stringify(processos, null, 2)}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere matriz GUT (Gravidade, Urgência, Tendência) com:
- Lista de ${processos.length > 0 ? processos.length : '5-8'} processos/problemas
- Pontuação 1-5 para cada dimensão (G, U, T)
- Score total (G × U × T)
- Ordenação por prioridade

Retorne HTML com tabela interativa, cores indicando prioridade (vermelho=alto, amarelo=médio, verde=baixo).`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: 'Matriz de Priorização GUT',
      html_conteudo: html,
      dados_utilizados: { processos, contexto }
    };
  }

  /**
   * Generate Project Scope
   */
  private static async gerarEscopo(contexto: any): Promise<DeliverableResult> {
    const projeto = contexto.objetivo_principal || contexto.titulo_problema || 'Projeto';

    const prompt = `Você é um consultor empresarial criando um Documento de Escopo de Projeto.

PROJETO: ${projeto}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere documento completo com:
1. Objetivo do Projeto
2. Justificativa
3. Escopo (o que está incluído)
4. Fora do Escopo (o que NÃO está incluído)
5. Entregas Principais
6. Premissas
7. Restrições
8. Stakeholders
9. Cronograma Macro
10. Orçamento Estimado

Retorne HTML profissional, formatado como documento executivo.`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: `Escopo - ${projeto.substring(0, 50)}`,
      html_conteudo: html,
      dados_utilizados: { projeto, contexto }
    };
  }

  /**
   * Generate Diagnostic Report
   */
  private static async gerarDiagnostico(contexto: any): Promise<DeliverableResult> {
    const empresa = contexto.empresa_nome || 'Empresa';

    const prompt = `Você é um consultor empresarial criando um Relatório de Diagnóstico.

EMPRESA: ${empresa}
CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere relatório executivo com:
1. Sumário Executivo
2. Situação Atual
3. Principais Problemas Identificados (bullet points)
4. Análise de Causas Raiz
5. Oportunidades de Melhoria
6. Riscos Identificados
7. Recomendações Imediatas (top 5)
8. Próximos Passos

Retorne HTML profissional, visualmente organizado, com seções claras.`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: `Diagnóstico - ${empresa}`,
      html_conteudo: html,
      dados_utilizados: { empresa, contexto }
    };
  }

  /**
   * Generic fallback generator
   */
  private static async gerarGenerico(tipo: string, contexto: any): Promise<DeliverableResult> {
    const prompt = `Você é um consultor empresarial criando um documento: ${tipo}

CONTEXTO: ${JSON.stringify(contexto, null, 2)}

Gere um documento profissional HTML para este tipo de entregável.
Seja específico e baseie-se no contexto fornecido.`;

    const html = await this.callLLMForHTML(prompt);

    return {
      nome: tipo,
      html_conteudo: html,
      dados_utilizados: { tipo, contexto }
    };
  }

  /**
   * Call LLM for HTML generation
   */
  private static async callLLMForHTML(prompt: string): Promise<string> {
    const fullPrompt = `${prompt}

IMPORTANTE:
- Retorne HTML completo e válido
- Inclua DOCTYPE, head com meta charset, title, e style inline
- Use CSS moderno (flexbox, grid, cores profissionais)
- Seja visual e atraente
- NÃO use JavaScript
- NÃO retorne markdown, apenas HTML puro`;

    return await this.callLLMForText(fullPrompt);
  }

  /**
   * Call LLM for text generation
   */
  private static async callLLMForText(prompt: string): Promise<string> {
    const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!openaiKey) {
      console.error('[TEMPLATE-SERVICE] OPENAI_API_KEY not configured');
      return this.getFallbackHTML(prompt);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Você é um consultor empresarial expert em BPM, processos e documentação gerencial. Gere conteúdo profissional e acionável.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error) {
      console.error('[TEMPLATE-SERVICE] LLM call failed:', error);
      return this.getFallbackHTML(prompt);
    }
  }

  /**
   * Fallback HTML when LLM fails
   */
  private static getFallbackHTML(prompt: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Entregável</title>
  <style>
    body { font-family: system-ui; padding: 40px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #1e40af; }
    .notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px; }
    pre { background: #f1f5f9; padding: 16px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Entregável em Processamento</h1>
    <div class="notice">
      <strong>Atenção:</strong> Este entregável foi gerado em modo de fallback. Configure a chave OpenAI para obter conteúdo personalizado.
    </div>
    <h2>Contexto Solicitado:</h2>
    <pre>${prompt.substring(0, 500)}...</pre>
  </div>
</body>
</html>`;
  }
}
