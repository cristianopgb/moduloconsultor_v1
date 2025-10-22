// Use CDN-built ESM to avoid tslib require errors when running in the Edge runtime
// Use an ESM build compatible with Deno to avoid runtime resolution issues (tslib)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno'

// Importing from local files that exist
import { FrameworkGuide } from './framework-guide.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper anti-loop para formularios já preenchidos
function isFormAlreadyFilled(tipo: string, ctx: any) {
  const c = ctx || {};
  return (tipo === 'anamnese' && c.anamnese) ||
         (tipo === 'canvas' && c.canvas) ||
         (tipo === 'cadeia_valor' && c.cadeia_valor) ||
         (tipo === 'matriz_priorizacao' && c.matriz_priorizacao) ||
         (tipo === 'atributos_processo' && c.atributos_processo);
}

// ============================================================================
// INTELLIGENT PROMPT BUILDER
// ============================================================================
class IntelligentPromptBuilder {
  supabase: any;
  constructor(supabase: any){ this.supabase = supabase; }

  async buildSystemPrompt(jornada: any, gamification: any, checklistContext: string, conversationHistory: any[]) {
    const hasIntroduced = Array.isArray(conversationHistory) && conversationHistory.some((m)=>m.role === 'assistant');
    const baseIdentity = this.getConsultantIdentity(hasIntroduced);
    const framework = this.getCompleteFramework();
    const phaseInstructions = this.getPhaseInstructions(jornada.etapa_atual, jornada.aguardando_validacao);
    const contextSection = await this.buildContextSection(jornada);
    const gamificationContext = this.buildGamificationContext(gamification);
    const ctaGuidelines = this.getCTAGuidelines();
    const markerInstructions = this.getMarkerInstructions();

    return `${baseIdentity}

${framework}

${phaseInstructions}

${contextSection}

${gamificationContext}

${checklistContext || ''}

${ctaGuidelines}

${markerInstructions}

CRITICAL RULES:
- You NEVER ask for information already collected in contexto_coleta
- You NEVER advance phases without explaining deliverables and getting validation
- You ALWAYS end with a natural, contextualized CTA (before any marker)
- You ONLY include a form marker [EXIBIR_FORMULARIO:*] AFTER the client agrees in this conversation
- You ALWAYS conduct the process - the client doesn't choose randomly
- You ANALYZE data after receiving forms, provide insights, then move forward
- Never start a message repeating your introduction (e.g., "Hello" or "I am Proceda")
- You mention XP and achievements naturally in conversation
- You use markers to trigger actions but remove them from displayed text
- NEVER suggest hiring an external consultant; YOU are the consultant and must provide concrete, executable guidance
- NEVER output vague actions (e.g., "treinar equipe", "criar indicadores", "implementar software") without specifics (quem/como/quando/ferramenta/indicador)
- NEVER request the user to fill a form for 'matriz_priorizacao' or 'escopo_projeto'. These MUST be generated automatically by you when the modelagem data exists. If you would normally ask for a priorizacao form, instead generate the deliverables and ask the user to REVIEW and VALIDATE them.
${hasIntroduced ? '- You NEVER repeat your introduction - the client already knows who you are' : ''}

STYLE RULES:
- Be concise and specific (no fluff, no lecturing tone)
- Be empathetic, motivating, and keep engagement
- Avoid repeating what was already said in recent messages
- Use short paragraphs and lists when useful
- Keep momentum with a single clear CTA at the end (marker only after consent)`;
  }

  getConsultantIdentity(hasIntroduced: boolean) {
    return `# YOUR IDENTITY
You are **Proceda AI consultant**, a senior business consultant with 20+ years in BPM, strategy, logistics, planning, ISO QMS, PM, quality tools, finance & controlling.

Communication:
- Profissional, direto, motivador
- Adeque o tom ao perfil do usuário
- Sem tom professoral, sem rodeios
- Estruturado e consultivo

${hasIntroduced ? `
# CRITICAL: CONVERSATION CONTINUITY
Você JÁ se apresentou nesta conversa.
- NUNCA se reapresente
- Continue de onde parou
- Referencie o contexto anterior naturalmente
- Nunca repita o passo anterior sem o cliente pedir revisão, seja fluido e propositivo
` : `
# INTRODUCTION PHASE
Primeira interação. Apresente-se brevemente, mostre o método (5 fases) e convide a iniciar.
Depois da PRIMEIRA mensagem, NUNCA mais se reapresente (nem "hello").
`}`;
  }

  getCompleteFramework() {
    return `# THE 5-PHASE TRANSFORMATION FRAMEWORK
FASE 1: APRESENTAÇÃO E ANAMNESE → Entregável: "Anamnese Empresarial"
FASE 2: MODELAGEM GERAL (BMC + Cadeia de Valor) → 3 entregáveis
FASE 3: PRIORIZAÇÃO → 2 entregáveis: "Matriz de Priorização" **e** "Escopo do Projeto" (processos mapeados, não problemas)
FASE 4: EXECUÇÃO por processo → Coleta de atributos do processo → BPMN AS-IS → Diagnóstico → Plano 5W2H
FASE 5: ACOMPANHAMENTO → Kanban das ações`;
  }

  getPhaseInstructions(currentPhase: string, aguardandoValidacao: string | null) {
    if (currentPhase === 'apresentacao') {
      return `# CURRENT PHASE: APRESENTAÇÃO
Objetivo: abrir o método e rapidamente iniciar a coleta.
- Apresente o método em 2-3 linhas (sem palestrar)
- **CTA primeiro** (pergunte se pode enviar a anamnese). **Só inclua [EXIBIR_FORMULARIO:anamnese] se o cliente disser que sim nesta conversa.**
CTA: "Quer entender rapidinho o método ou já começamos com a anamnese?"`;
    }
    if (currentPhase === 'anamnese') {
      if (aguardandoValidacao === 'anamnese') {
        return `# CURRENT PHASE: ANAMNESE - AGUARDANDO VALIDAÇÃO
- ANALISE contexto_coleta (sem repetir perguntas)
- Traga insights: perfil, problemas ocultos, oportunidades
- **CTA** para iniciar o Canvas; **só inclua [EXIBIR_FORMULARIO:canvas] após o cliente aceitar.**
CTA: "Quer ver os principais achados ou já partimos para o Canvas?"`;
      }
      return `# CURRENT PHASE: ANAMNESE (coleta)
- **CTA** pedindo permissão para enviar o formulário.
- Só depois do "sim", inclua: [EXIBIR_FORMULARIO:anamnese]`;
    }
    if (currentPhase === 'modelagem' || currentPhase === 'mapeamento') {
      if (aguardandoValidacao === 'modelagem') {
        return `# CURRENT PHASE: MODELAGEM - AGUARDANDO VALIDAÇÃO
- Informe sobre os 3 entregáveis (Anamnese, Canvas, Cadeia de Valor) já gerados
- Explique insights principais de forma direta
- **CTA** para seguir à Priorização; ao concordar, avance: [AVANCAR_FASE:priorizacao]`;
      }
      return `# CURRENT PHASE: MODELAGEM (coleta em 2 passos)
1) **Canvas**:
   - **CTA** e, após o "sim": [EXIBIR_FORMULARIO:canvas]
2) **Após Canvas concluído**, **CTA** para a **Cadeia de Valor**; após o "sim": [EXIBIR_FORMULARIO:cadeia_valor]

Concluídos os dois, gere:
[GERAR_ENTREGAVEL:anamnese] [GERAR_ENTREGAVEL:canvas] [GERAR_ENTREGAVEL:cadeia_valor]
Depois, sinalize validação: [SET_VALIDACAO:modelagem]`;
    }
    if (currentPhase === 'priorizacao') {
      if (aguardandoValidacao === 'priorizacao') {
        return `# CURRENT PHASE: PRIORIZAÇÃO - AGUARDANDO VALIDAÇÃO
- Analise a matriz gerada com os processos priorizados
- Confirme se concorda com a ordem de prioridade sugerida
- Se ajustes forem necessários, podemos revisar
- **CTA**: Para validar e avançar, use: [AVANCAR_FASE:execucao]`;
      }
      return `# CURRENT PHASE: PRIORIZAÇÃO
- Analisando a cadeia de valor para priorizar processos
- Gerando os entregáveis de priorização:
  [GERAR_ENTREGAVEL:matriz_priorizacao] e [GERAR_ENTREGAVEL:escopo_projeto]
- Em seguida aguardarei sua validação: [SET_VALIDACAO:priorizacao]`;
    }
    if (currentPhase === 'execucao') {
      if (aguardandoValidacao === 'bpmn') {
        return `# CURRENT PHASE: EXECUÇÃO - VALIDANDO BPMN
- Explique gargalos e confirme se o AS-IS está correto
CTA: "Representa fielmente o fluxo atual? Ajusto algo?"`;
      }
      if (aguardandoValidacao === 'diagnostico') {
        return `# CURRENT PHASE: EXECUÇÃO - VALIDANDO DIAGNÓSTICO
- Mostre achados, causas-raiz e impactos
CTA: "Quer ajustar algo ou seguimos para o plano de ação?"`;
      }
      if (aguardandoValidacao === 'plano_acao') {
        return `# CURRENT PHASE: EXECUÇÃO - VALIDANDO PLANO
- Explique 5W2H com detalhes (sem generalidades)
- Destaque quick wins vs estruturais
CTA: "Posso enviar para o Kanban e iniciar a execução?"`;
      }
      return `# CURRENT PHASE: EXECUÇÃO (pipeline por processo)
1) **Coleta de Atributos do Processo**:
   - **CTA** e, após aceitar: [EXIBIR_FORMULARIO:atributos_processo]
2) **Gerar BPMN AS-IS**: [GERAR_ENTREGAVEL:bpmn] → [SET_VALIDACAO:bpmn]
3) **Diagnóstico**: [GERAR_ENTREGAVEL:diagnostico] → [SET_VALIDACAO:diagnostico]
4) **Plano 5W2H**: [GERAR_ENTREGAVEL:plano_acao] → [SET_VALIDACAO:plano_acao]`;
    }
    return `# CURRENT PHASE: UNKNOWN
Siga o framework com base no contexto.`;
  }

  async buildContextSection(jornada: any) {
    const contextoColeta = jornada.contexto_coleta || {};
    const etapaAtual = jornada.etapa_atual;

    const { data: entregaveis } = await this.supabase
      .from('entregaveis_consultor')
      .select('id, nome, tipo, etapa_origem, created_at')
      .eq('jornada_id', jornada.id)
      .order('created_at', { ascending: true });

    let contextSection = `# CURRENT CONTEXT

**Current Phase:** ${etapaAtual}
**Waiting Validation:** ${jornada.aguardando_validacao || 'None'}

`;
    if (Object.keys(contextoColeta).length > 0) {
      contextSection += `## DATA ALREADY COLLECTED
(Do NOT ask this again)
\`\`\`json
${JSON.stringify(contextoColeta, null, 2)}
\`\`\`

`;
    }
    if (entregaveis && entregaveis.length > 0) {
      contextSection += `## DELIVERABLES GENERATED\n`;
      entregaveis.forEach((e: any)=>{
        contextSection += `- **${e.nome}** (${e.tipo}) - ${e.etapa_origem}\n`;
      });
      contextSection += `\n`;
    }
    return contextSection;
  }

  buildGamificationContext(gamification: any) {
    if (!gamification) {
      return `# GAMIFICATION
**XP:** 0 | **Level:** 1 | **Next Level:** 200 XP
Incentive naturalmente o cliente ao concluir etapas.`;
    }
    const xpNeeded = (gamification.nivel || 1) * 200;
    const xpToNext = Math.max(0, xpNeeded - (gamification.xp_total || 0));
    return `# GAMIFICATION
**XP:** ${gamification.xp_total || 0} | **Level:** ${gamification.nivel || 1} | **Next Level:** ${xpToNext} XP

Exemplos (não force, use quando fizer sentido):
- "Excelente! +50 XP pela anamnese concluída."
- "Ótimo avanço, faltam ${xpToNext} XP para o próximo nível."
`;
  }

  getCTAGuidelines() {
    return `# CTA GUIDELINES
- Finalize SEMPRE com uma única CTA clara
- Nunca dispare formulário antes da CTA e do consentimento explícito
- Evite múltiplas perguntas ao mesmo tempo`;
  }

  getMarkerInstructions() {
    return `# ACTION MARKERS (só usar após consentimento na conversa)
[EXIBIR_FORMULARIO:tipo] → anamnese | canvas | cadeia_valor | matriz_priorizacao | processo_as_is | atributos_processo
[GERAR_ENTREGAVEL:tipo] → anamnese | canvas | cadeia_valor | matriz_priorizacao | escopo_projeto | bpmn | diagnostico | plano_acao
[SET_VALIDACAO:tipo] → anamnese | modelagem | priorizacao | bpmn | diagnostico | plano_acao
[AVANCAR_FASE:fase] → anamnese | modelagem | priorizacao | execucao | acompanhamento
[GAMIFICACAO:evento:xp] → opcional, sistema detecta ganhos também`;
  }

  async buildUserPrompt(userMessage: string, conversationHistory: any[]) {
    let prompt = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-6);
      prompt += '# RECENT CONVERSATION\n\n';
      recentHistory.forEach((msg: any)=>{
        const role = msg.role === 'user' ? 'CLIENT' : 'YOU';
        prompt += `**${role}:** ${msg.content}\n\n`;
      });
    }
    let expandedMessage = (userMessage || '').trim();
    if (/^[\(\[]?[ab][\)\]]?$/i.test(expandedMessage)) {
      const letter = expandedMessage.toLowerCase().replace(/[\(\)\[\]]/g, '');
      expandedMessage = letter === 'a' ? 'Quero escolher a opção (a)' : 'Quero escolher a opção (b)';
    }
    prompt += `# CLIENT'S CURRENT MESSAGE\n\n${expandedMessage}\n\n`;
    prompt += `# YOUR RESPONSE
- Faça a **CTA primeiro**; só inclua [EXIBIR_FORMULARIO:*] se o cliente **concordou nesta conversa agora**
- Seja direto, sem redundância e siga as regras/markers
- Nunca sugira "contratar consultoria"; você é o consultor e deve detalhar as ações`;
    return prompt;
  }
}

// ============================================================================
// MARKER PROCESSOR
// ============================================================================
class MarkerProcessor {
  supabase: any;
  constructor(supabase: any){ this.supabase = supabase; }

  processResponse(response: string) {
    const actions: any[] = [];
    let displayContent = response || '';

    const formRegex = /\[EXIBIR_FORMULARIO:(\w+)\]/g;
    const deliverableRegex = /\[GERAR_ENTREGAVEL:([\w-]+)\]/g;
    const validationRegex = /\[SET_VALIDACAO:(\w+)\]/g;
    const phaseRegex = /\[AVANCAR_FASE:(\w+)\]/g;
    const gamificationRegex = /\[GAMIFICACAO:([^:]+):(\d+)\]/g;

    let match: RegExpExecArray | null;
    while((match = formRegex.exec(displayContent)) !== null){
      actions.push({ type: 'exibir_formulario', params: { tipo: match[1] }});
    }
    displayContent = displayContent.replace(formRegex, '');

    while((match = deliverableRegex.exec(displayContent)) !== null){
      actions.push({ type: 'gerar_entregavel', params: { tipo: match[1] }});
    }
    displayContent = displayContent.replace(deliverableRegex, '');

    while((match = validationRegex.exec(displayContent)) !== null){
      actions.push({ type: 'set_validacao', params: { tipo: match[1] }});
    }
    displayContent = displayContent.replace(validationRegex, '');

    while((match = phaseRegex.exec(displayContent)) !== null){
      actions.push({ type: 'avancar_fase', params: { fase: match[1] }});
    }
    displayContent = displayContent.replace(phaseRegex, '');

    while((match = gamificationRegex.exec(displayContent)) !== null){
      actions.push({ type: 'gamificacao', params: { evento: match[1], xp: parseInt(match[2]) }});
    }
    displayContent = displayContent.replace(gamificationRegex, '');

    displayContent = displayContent.replace(/\n{3,}/g, '\n\n').trim();

    return { displayContent, actions };
  }

  async executeActions(actions: any[], jornada: any, conversationId: string, userId: string) {
    const updates: any = {};
    let gamificationResult: any = null;

    for (const action of actions){
      switch(action.type){
        case 'set_validacao': {
          updates.aguardando_validacao = action.params.tipo;
          await this.supabase.from('jornadas_consultor')
            .update({ aguardando_validacao: action.params.tipo })
            .eq('id', jornada.id);
          break;
        }
        case 'avancar_fase': {
          updates.etapa_atual = action.params.fase;
          updates.aguardando_validacao = null;
          await this.supabase.from('jornadas_consultor')
            .update({ etapa_atual: action.params.fase, aguardando_validacao: null })
            .eq('id', jornada.id);
          gamificationResult = await this.awardXPByJornada(jornada.id, userId, 100, `Fase ${action.params.fase} iniciada`, conversationId);
          break;
        }
        case 'gamificacao': {
          gamificationResult = await this.awardXPByJornada(jornada.id, userId, action.params.xp, action.params.evento, conversationId);
          break;
        }
      }
    }
    return { updates, gamificationResult };
  }

  async awardXPByJornada(jornadaId: string, userId: string, xp: number, conquista: string, conversationId?: string) {
    try {
      if (!userId) {
        console.warn('[MARKER] userId missing; using conversation-level XP RPC');
        if (!conversationId) return null;
        const { data: d2, error: e2 } = await this.supabase.rpc('add_xp_to_conversation', {
          p_conversation_id: conversationId,
          p_xp_amount: xp,
          p_conquista_nome: conquista
        });
        if (e2) { console.error('[MARKER] XP RPC failed (conversation fallback):', e2); return null; }
        return d2;
      }

      let { data, error } = await this.supabase.rpc('add_xp_to_jornada', {
        p_jornada_id: jornadaId,
        p_xp_amount: xp,
        p_conquista_nome: conquista,
        p_user_id: userId
      });
      if (error) {
        console.warn('[MARKER] add_xp_to_jornada failed, trying add_xp_to_conversation...', error);
        if (!conversationId) return null;
        const { data: d2, error: e2 } = await this.supabase.rpc('add_xp_to_conversation', {
          p_conversation_id: conversationId,
          p_xp_amount: xp,
          p_conquista_nome: conquista
        });
        if (e2) { console.error('[MARKER] XP RPC failed (fallback):', e2); return null; }
        return d2;
      }
      return data;
    } catch (err) {
      console.error('[MARKER] Exception awarding XP:', err);
      return null;
    }
  }

  async autoAwardXP(conversationId: string, event: string) {
    try {
      const xpMap: Record<string, number> = {
        formulario_preenchido: 50,
        entregavel_gerado: 75,
        fase_concluida: 100
      };
      const xp = xpMap[event] || 25;
      
      const { data, error } = await this.supabase.rpc('add_xp_to_conversation', {
        p_conversation_id: conversationId,
        p_xp_amount: xp,
        p_conquista_nome: event
      });
      
      if (error) {
        console.error('[MARKER] autoAwardXP failed:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[MARKER] Exception in autoAwardXP:', err);
      return null;
    }
  }
}

// ============================================================================
// DELIVERABLE GENERATOR
// ============================================================================
class DeliverableGenerator {
  supabase: any;
  openaiKey: string;
  constructor(supabase: any, openaiKey: string){
    this.supabase = supabase;
    this.openaiKey = openaiKey;
  }

  async generateDeliverable(tipo: string, jornada: any, llmResponse: string) {
    let contexto = jornada.contexto_coleta || {};
    
    // For matriz and escopo, enrich with actual processes from cadeia_valor_processos
    if (tipo === 'matriz_priorizacao' || tipo === 'escopo_projeto') {
      const { data: processos } = await this.supabase
        .from('cadeia_valor_processos')
        .select('id,nome,criticidade,impacto,esforco,descricao')
        .eq('jornada_id', jornada.id);

      (contexto as any).__processos_mapeados = (processos || []).map((p:any)=>({
        id: p.id, nome: p.nome, impacto: p.impacto, criticidade: p.criticidade, esforco: p.esforco, descricao: p.descricao
      }));
    }

    const prompt = this.buildPromptForType(tipo, contexto, jornada);
    const html = await this.callLLMForHTML(prompt);
    const nomeMap: Record<string,string> = {
      anamnese: 'Anamnese Empresarial',
      canvas: 'Canvas do Modelo de Negócio',
      cadeia_valor: 'Cadeia de Valor',
      'cadeia-valor': 'Cadeia de Valor',
      matriz_priorizacao: 'Matriz de Priorização',
      escopo_projeto: 'Escopo do Projeto',
      bpmn: 'BPMN AS-IS',
      diagnostico: 'Diagnóstico Detalhado',
      plano_acao: 'Plano de Ação 5W2H'
    };
    return { html: this.cleanHTML(html), nome: nomeMap[tipo] || 'Documento' };
  }

  buildPromptForType(tipo: string, contexto: any, jornada: any) {
    const contextoJson = JSON.stringify(contexto, null, 2);
    const empresa = contexto.anamnese?.nome_empresa || contexto.empresa_nome || 'Empresa';
    
    const prompts: Record<string,string> = {
      anamnese: `Gere um documento HTML (pt-BR) de **Anamnese Empresarial** para ${empresa}.

Use os dados REAIS coletados no formulário:
${contextoJson}

Seções obrigatórias:
1. Perfil da Empresa (nome, setor, tamanho, produtos/serviços)
2. Situação Atual (dores, desafios, contexto)
3. Objetivos e Metas Estratégicas
4. Principais Insights e Oportunidades Identificadas

NÃO use dados genéricos ou mockup. Use APENAS os dados fornecidos.
HTML limpo com CSS embutido minimalista e padronizado. Retorne APENAS HTML.`,

      canvas: `Gere um **Business Model Canvas** (pt-BR) em HTML para ${empresa}.

Use os dados REAIS do formulário:
${contextoJson}

IMPORTANTE: Use APENAS os dados fornecidos. NÃO invente ou use exemplos genéricos.
Crie um grid visual com os 9 blocos do Canvas preenchidos com os dados reais.
Adicione uma breve análise após o canvas.

HTML limpo com CSS embutido. Retorne APENAS HTML.`,

      cadeia_valor: `Gere a **Cadeia de Valor de Porter** em HTML (pt-BR) para ${empresa}.

Use os dados REAIS do formulário, incluindo os processos mapeados:
${contextoJson}

CRÍTICO:
1. Liste TODOS os processos de gestão/suporte informados no formulário
2. Liste TODOS os processos primários informados no formulário
3. Para cada processo, mostre: nome, descrição (se disponível), impacto, criticidade
4. NÃO use dados genéricos ou mockup
5. Indique onde valor é criado/perdido com base nos dados reais

HTML limpo com CSS padronizado. Retorne APENAS HTML.`,

      matriz_priorizacao: `Gere uma **Matriz de Priorização** em HTML (pt-BR) para os processos mapeados.

Dados REAIS (incluindo processos da cadeia de valor):
${contextoJson}

REQUISITOS:
1. Use os processos REAIS de __processos_mapeados se disponível
2. Para cada processo, calcule o Score = (Impacto × Criticidade) / Esforço
3. Ordene por Score (maior = mais prioritário)
4. Crie tabela com: Nome, Impacto, Criticidade, Esforço, Score, Justificativa
5. NÃO invente processos - use APENAS os dados fornecidos

HTML limpo. Retorne APENAS HTML.`,

      escopo_projeto: `Gere um **Documento de Escopo** (pt-BR) para ${empresa}.

Use dados REAIS (anamnese + canvas + cadeia valor + matriz):
${contextoJson}

REQUISITOS CRÍTICOS:
1. Use a Matriz de Priorização para listar os processos que serão trabalhados
2. Liste explicitamente os 3-5 processos priorizados com:
   - Nome e descrição do processo
   - Razão da priorização (baseada em impacto/criticidade/esforço)
   - Escopo do trabalho na fase de execução
   - Áreas envolvidas
   - Entregáveis esperados
   - Critérios de aceite
3. NÃO use texto genérico - referencie os entregáveis já gerados
4. Baseie tudo nos dados reais coletados

Seções:
1. Objetivo (alinhado aos objetivos da anamnese)
2. Justificativa (baseada nas dores + matriz)
3. Processos Priorizados (detalhe cada um)
4. Premissas e Restrições
5. Entregas Principais e Critérios de Aceite

HTML limpo. Retorne APENAS HTML.`
    };
    
    return prompts[tipo] || prompts['anamnese'];
  }

  async callLLMForHTML(prompt: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um gerador de documentos de consultoria. Produza HTML clean, com CSS embutido padronizado. Use APENAS dados fornecidos, NUNCA invente ou use mockups genéricos.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 3000
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(()=> ({}));
      throw new Error(`OpenAI API error: ${JSON.stringify(err)}`);
    }
    const data = await response.json();
    if (!data?.choices?.[0]?.message?.content) throw new Error('LLM sem conteúdo');
    return data.choices[0].message.content;
  }

  cleanHTML(html: string) {
    html = String(html || '').replace(/```html\s*/gi, '').replace(/```\s*$/gi, '').trim();
    if (!html.toLowerCase().includes('<html')) {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Documento</title></head><body>${html}</body></html>`;
    }
    return html;
  }

  async saveDeliverable(jornadaId: string, tipo: string, nome: string, html: string, etapa: string) {
    await this.supabase.from('entregaveis_consultor').insert({
      jornada_id: jornadaId,
      slug: tipo,
      nome,
      html,
      etapa: etapa || 'unknown'
    });
  }
}

async function saveMessages(supabase: any, conversationId: string, userId: string, userMsg: string, assistantMsg: string) {
  try {
    await supabase.from('messages').insert([
      { conversation_id: conversationId, role: 'user', content: userMsg, user_id: userId },
      { conversation_id: conversationId, role: 'assistant', content: assistantMsg, user_id: userId }
    ]);
  } catch (err) {
    console.error('[CONSULTOR-CHAT] Erro ao salvar mensagens:', err);
  }
}

async function callLLM(systemPrompt: string, userPrompt: string, openaiKey: string): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('[CONSULTOR-CHAT] LLM call failed:', err);
    throw err;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

  const { message, conversation_id, user_id, form_data, form_type } = await req.json();

    if (!message || !conversation_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[CONSULTOR-CHAT] Request received:', { user_id, conversation_id, has_form_data: !!form_data });

    const isFormSubmission = Boolean(form_data && Object.keys(form_data).length > 0);

    const { data: conversationHistory } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    let { data: jornada, error: jornadaError } = await supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('user_id', user_id)
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    if (jornadaError) {
      console.error('[CONSULTOR-CHAT] Erro ao buscar jornada:', jornadaError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar jornada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!jornada) {
      console.log('[CONSULTOR-CHAT] Creating new jornada...');
      const { data: newJornada, error: createError } = await supabase
        .from('jornadas_consultor')
        .insert({
          user_id: user_id,
          conversation_id: conversation_id,
          etapa_atual: 'apresentacao',
          contexto_coleta: {}
        })
        .select()
        .single();

      if (createError) {
        console.error('[CONSULTOR-CHAT] Error creating jornada:', createError);
        return new Response(JSON.stringify({ error: 'Erro ao criar jornada' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      jornada = newJornada;
    }

  let preAwardResult = null;
  if (isFormSubmission && form_data) {
      console.log('[CONSULTOR-CHAT] Form submission detected, updating context...');
      const currentContext = jornada.contexto_coleta || {};
      
      // Store form data under the specific form type key (like consolidated version)
      const formKey = String(form_type || 'generico');
      const updatedContext = { ...currentContext, [formKey]: form_data };

      await supabase
        .from('jornadas_consultor')
        .update({ contexto_coleta: updatedContext })
        .eq('id', jornada.id);

      const { data: jornadaAtualizada } = await supabase
        .from('jornadas_consultor')
        .select('*')
        .eq('id', jornada.id)
        .single();

      if (jornadaAtualizada) jornada = jornadaAtualizada;

      const frameworkGuide = new FrameworkGuide(supabase);
      
      // Detect form type and mark appropriate events, also update phase
      if (form_type === 'anamnese' || form_data.nome_empresa || form_data.nome_usuario || form_data.empresa_nome) {
        await frameworkGuide.markEvent(conversation_id, 'anamnese_preenchida');
        // Update phase to anamnese with validation pending
        await supabase
          .from('jornadas_consultor')
          .update({ etapa_atual: 'anamnese', aguardando_validacao: 'anamnese' })
          .eq('id', jornada.id);
      } else if (form_type === 'canvas' || form_data.parcerias_chave || form_data.segmentos_clientes) {
        await frameworkGuide.markEvent(conversation_id, 'canvas_preenchido');
        // Keep in modelagem, clear validation
        await supabase
          .from('jornadas_consultor')
          .update({ etapa_atual: 'modelagem', aguardando_validacao: null })
          .eq('id', jornada.id);
      } else if (form_type === 'cadeia_valor' || form_data.atividades_primarias || form_data.atividades_suporte || (form_data.processos && Array.isArray(form_data.processos))) {
        await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_preenchida');
        
        // Update to modelagem phase
        await supabase
          .from('jornadas_consultor')
          .update({ etapa_atual: 'modelagem', aguardando_validacao: null })
          .eq('id', jornada.id);
        
        // Save processes from cadeia_valor to the database
        if (form_data.processos && Array.isArray(form_data.processos) && form_data.processos.length > 0) {
          try {
            // Remove old processes for this jornada
            await supabase.from('cadeia_valor_processos').delete().eq('jornada_id', jornada.id);
            
            // Insert new processes
            const toInsert = form_data.processos.map((p: any) => ({
              jornada_id: jornada.id,
              nome: p.nome || p.process_name || String(p).slice(0, 200),
              descricao: p.descricao || p.descricao_curta || null,
              impacto: p.impacto ?? (p.impact || null),
              criticidade: p.criticidade ?? p.criticality ?? null,
              esforco: p.esforco ?? p.esforco_estimado ?? null
            }));
            
            await supabase.from('cadeia_valor_processos').insert(toInsert);
            console.log(`[CONSULTOR-CHAT] Saved ${toInsert.length} processes from cadeia_valor`);
          } catch (e) {
            console.warn('[CONSULTOR-CHAT] Failed to save cadeia_valor processes:', e);
          }
        }
      } else if (form_type === 'matriz_priorizacao' || (form_data.processos && Array.isArray(form_data.processos) && !form_type)) {
        await frameworkGuide.markEvent(conversation_id, 'matriz_preenchida');
        // Update to priorizacao phase
        await supabase
          .from('jornadas_consultor')
          .update({ etapa_atual: 'priorizacao', aguardando_validacao: 'priorizacao' })
          .eq('id', jornada.id);
      } else if (form_type === 'atributos_processo') {
        // Update to execucao phase
        await supabase
          .from('jornadas_consultor')
          .update({ etapa_atual: 'execucao', aguardando_validacao: null })
          .eq('id', jornada.id);
      }
      
      // Refresh jornada after phase update
      const { data: jornadaRefreshed } = await supabase
        .from('jornadas_consultor')
        .select('*')
        .eq('id', jornada.id)
        .single();
      if (jornadaRefreshed) jornada = jornadaRefreshed;

      const markerProcessor = new MarkerProcessor(supabase);
      try {
        // tentar premiar XP e capturar resultado para retornar ao frontend
        // algumas implementações retornam objeto, outras apenas executam RPCs
        // guardamos o retorno se houver
        // @ts-ignore
        preAwardResult = await markerProcessor.autoAwardXP(conversation_id, 'formulario_preenchido');
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] preAward XP failed:', e);
      }

      // Ensure the LLM sees the submitted form data: append a synthetic user message
      try {
        const formSummary = `Formulário submetido (${String(form_type || 'generico')}): ${JSON.stringify(form_data)}`;
        if (!conversationHistory || !Array.isArray(conversationHistory)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (conversationHistory as any) = [];
        }
        // push summary so the prompt builder includes it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (conversationHistory as any).push({ role: 'user', content: formSummary });
      } catch (e) {
        // ignore if summarization fails
      }
    }

    const { data: gamification } = await supabase
      .from('gamificacao_consultor')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    const frameworkGuide = new FrameworkGuide(supabase);
    const checklistContext = await frameworkGuide.getGuideContext(conversation_id);

    const promptBuilder = new IntelligentPromptBuilder(supabase);
    const systemPrompt = await promptBuilder.buildSystemPrompt(jornada, gamification, checklistContext, conversationHistory || []);
    const userPrompt = await promptBuilder.buildUserPrompt(message, conversationHistory || []);

    console.log('[CONSULTOR-CHAT] Calling LLM with enhanced prompts...');
    const llmResponse = await callLLM(systemPrompt, userPrompt, openaiKey);
    console.log('[CONSULTOR-CHAT] LLM response received');

    const markerProcessor = new MarkerProcessor(supabase);
    const { displayContent, actions } = markerProcessor.processResponse(llmResponse);

    // Heuristic fallback: if LLM promises to open a form but markers are missing, infer actions
    if ((!actions || actions.length === 0) && /abrir o formulário|vou abrir o formulário|vou abrir o form/i.test(llmResponse)) {
      const inferred: any[] = [];
      if (/anamnese/i.test(llmResponse)) inferred.push({ type: 'exibir_formulario', params: { tipo: 'anamnese' } });
      if (/canvas/i.test(llmResponse)) inferred.push({ type: 'exibir_formulario', params: { tipo: 'canvas' } });
      if (/cadeia/i.test(llmResponse) || /cadeia de valor/i.test(llmResponse)) inferred.push({ type: 'exibir_formulario', params: { tipo: 'cadeia_valor' } });
      if (/matriz/i.test(llmResponse) || /prioriza/i.test(llmResponse)) inferred.push({ type: 'exibir_formulario', params: { tipo: 'matriz_priorizacao' } });
      if (inferred.length > 0) {
        console.log('[CONSULTOR-CHAT] Inferred actions from LLM text:', inferred.map(i=>i.params.tipo));
        actions.push(...inferred);
      }
    }

    console.log('[CONSULTOR-CHAT] Detected actions:', actions.map(a => a.type));

    // Filter out forms already filled and apply heuristics similar to consolidated handler
    const ctxNow = (jornada && jornada.contexto_coleta) ? jornada.contexto_coleta : {};
    const filteredActions = actions.filter((a: any) => {
      if (a.type !== 'exibir_formulario') return true;
      const tipo = String(a.params?.tipo || '');
      return !isFormAlreadyFilled(tipo, ctxNow);
    });

    // Convert matriz form into deliverable if needed
    for (const a of actions) {
      if (a.type === 'exibir_formulario' && (a.params?.tipo === 'matriz_priorizacao' || a.params?.tipo === 'matriz-priorizacao')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
    }

    // If we already have cadeia_valor + anamnese/canvas, auto-generate matriz and escopo
    const hasCadeia = !!(ctxNow && (ctxNow.cadeia_valor || ctxNow.cadeia));
    const hasCanvasOrAnamnese = !!(ctxNow && (ctxNow.canvas || ctxNow.anamnese || ctxNow.empresa));
    
    if ((jornada.etapa_atual === 'modelagem' || jornada.etapa_atual === 'mapeamento') && hasCadeia && hasCanvasOrAnamnese) {
      // Auto-generate deliverables and advance to priorizacao phase
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='anamnese')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'anamnese' } });
      }
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='canvas')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'canvas' } });
      }
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='cadeia_valor')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'cadeia_valor' } });
      }
      if (!filteredActions.some((a:any)=> a.type==='set_validacao' && a.params?.tipo==='modelagem')) {
        filteredActions.push({ type: 'set_validacao', params: { tipo: 'modelagem' } });
      }
      
      // Once modelagem is validated, move to priorizacao and auto-generate matriz + escopo
      if (jornada.aguardando_validacao === 'modelagem') {
        if (!filteredActions.some((a:any)=> a.type==='avancar_fase' && a.params?.fase==='priorizacao')) {
          filteredActions.push({ type: 'avancar_fase', params: { fase: 'priorizacao' } });
        }
        if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='matriz_priorizacao')) {
          filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
        }
        if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='escopo_projeto')) {
          filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'escopo_projeto' } });
        }
        if (!filteredActions.some((a:any)=> a.type==='set_validacao' && a.params?.tipo==='priorizacao')) {
          filteredActions.push({ type: 'set_validacao', params: { tipo: 'priorizacao' } });
        }
      }
    }

    const { updates, gamificationResult } = await markerProcessor.executeActions(
      filteredActions,
      jornada,
      conversation_id,
      user_id
    );

    const formActions = filteredActions.filter(a => a.type === 'exibir_formulario');
    for (const formAction of formActions) {
      const tipo = formAction.params.tipo;
      if (tipo === 'anamnese') {
        await frameworkGuide.markEvent(conversation_id, 'anamnese_exibida');
      } else if (tipo === 'canvas') {
        await frameworkGuide.markEvent(conversation_id, 'canvas_exibido');
      } else if (tipo === 'cadeia_valor') {
        await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_exibida');
      } else if (tipo === 'matriz_priorizacao') {
        await frameworkGuide.markEvent(conversation_id, 'matriz_exibida');
      }
    }

    const gamificationActions = actions.filter(a => a.type === 'gamificacao');
    for (const gamAction of gamificationActions) {
      const evento = gamAction.params.evento;
      if (evento.includes('anamnese')) {
        await frameworkGuide.markEvent(conversation_id, 'xp_anamnese');
      } else if (evento.includes('canvas')) {
        await frameworkGuide.markEvent(conversation_id, 'xp_canvas');
      } else if (evento.includes('cadeia')) {
        await frameworkGuide.markEvent(conversation_id, 'xp_cadeia');
      } else if (evento.includes('matriz')) {
        await frameworkGuide.markEvent(conversation_id, 'xp_matriz');
      }
    }

    const deliverableActions = actions.filter(a => a.type === 'gerar_entregavel');
    if (deliverableActions.length > 0) {
      console.log('[CONSULTOR-CHAT] Generating deliverables...');
      const deliverableGenerator = new DeliverableGenerator(supabase, openaiKey);

      for (const action of deliverableActions) {
        try {
          const { html, nome } = await deliverableGenerator.generateDeliverable(
            action.params.tipo,
            jornada,
            llmResponse
          );

          await deliverableGenerator.saveDeliverable(
            jornada.id,
            action.params.tipo,
            nome,
            html,
            jornada.etapa_atual
          );

          console.log(`[CONSULTOR-CHAT] Deliverable generated: ${nome}`);
        } catch (err) {
          console.error(`[CONSULTOR-CHAT] Error generating deliverable ${action.params.tipo}:`, err);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      jornada = { ...jornada, ...updates };
    }

    await saveMessages(supabase, conversation_id, user_id, message, displayContent);

    const response = {
      response: displayContent,
      jornada_id: jornada.id,
      etapa_atual: jornada.etapa_atual,
      actions: actions.map(a => ({ type: a.type, params: a.params })),
      // preferir retorno do prêmio feito no handling do formulário, se disponível
      gamification: preAwardResult ?? gamificationResult ?? null
    };

    console.log('[CONSULTOR-CHAT] Request completed successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[CONSULTOR-CHAT ERROR]', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
