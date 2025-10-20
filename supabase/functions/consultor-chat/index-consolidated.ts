// supabase/functions/consultor-chat/index.ts
// Orquestrador principal do módulo Consultor (LLM + markers + entregáveis + gamificação)
// Mantém sua arquitetura original com IntelligentPromptBuilder e MarkerProcessor,
// adicionando fallbacks e cálculo de matriz baseado nos processos mapeados.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

// ============================================================================
// INTELLIGENT PROMPT BUILDER (seu original, com pequenos reforços textuais)
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
- Explique por que os **PROCESSOS** (não problemas) foram priorizados
- Confirme processo #1 para iniciar Execução
- **CTA**: ao concordar, avance: [AVANCAR_FASE:execucao]`;
      }
      return `# CURRENT PHASE: PRIORIZAÇÃO
- Liste processos (derivados da Cadeia de Valor) e pontue Impacto x Esforço
- Gere **dois** entregáveis:
  [GERAR_ENTREGAVEL:matriz_priorizacao] e [GERAR_ENTREGAVEL:escopo_projeto]
- Sinalize validação: [SET_VALIDACAO:priorizacao]`;
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
- Nunca sugira “contratar consultoria”; você é o consultor e deve detalhar as ações`;
    return prompt;
  }
}

// ============================================================================
// MARKER PROCESSOR (ações + gamificação por JORNADA) — com anti-loop
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

  async executeActions(actions: any[], jornada: any, userId: string, conversationId: string) {
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
          await this.addTimelineEvent(jornada.id, `Fase avançada para: ${action.params.fase}`, action.params.fase);
          gamificationResult = await this.awardXPByJornada(jornada.id, 100, `Fase ${action.params.fase} iniciada`, userId, conversationId);
          if (action.params.fase === 'execucao') {
            await this.ensureAreasFromScope(jornada.id);
          }
          break;
        }
        case 'gerar_entregavel': {
          // tratado no fluxo principal (HTML + save)
          break;
        }
        case 'gamificacao': {
          gamificationResult = await this.awardXPByJornada(jornada.id, action.params.xp, action.params.evento, userId, conversationId);
          break;
        }
        case 'exibir_formulario': {
          // anti-loop tratado no handler
          break;
        }
      }
    }
    return { updates, gamificationResult };
  }

  async ensureAreasFromScope(jornadaId: string) {
    try {
      const { data: j } = await this.supabase
        .from('jornadas_consultor').select('contexto_coleta').eq('id', jornadaId).single();
      const ctx = j?.contexto_coleta || {};
      const processos = ctx?.escopo?.processos || ctx?.escopo_projeto?.processos || ctx?.matriz_priorizacao?.processos || ctx?.priorizacao?.processos || [];
      if (!Array.isArray(processos) || processos.length === 0) return;

      const { data: existentes } = await this.supabase
        .from('areas_trabalho').select('id, nome_area').eq('jornada_id', jornadaId);
      const nomesExistentes = new Set((existentes || []).map((a:any)=>(a.nome_area || '').toLowerCase().trim()));
      let pos = (existentes || []).length + 1;

      for (const p of processos){
        const nome = (typeof p === 'string' ? p : p.nome || p.processo || '').trim();
        if (!nome) continue;
        if (nomesExistentes.has(nome.toLowerCase())) continue;

        await this.supabase.from('areas_trabalho').insert({
          jornada_id: jornadaId,
          nome_area: nome,
          etapa_area: 'as_is',
          posicao_prioridade: pos++,
          progresso_area: 0
        });
      }
    } catch (e) {
      console.error('[AREAS] Erro ao garantir áreas do escopo:', e);
    }
  }

  // tenta usar RPC por jornada; fallback por conversa (compat)
  async awardXPByJornada(jornadaId: string, xp: number, conquista: string, userId?: string, conversationId?: string) {
    try {
      let { data, error } = await this.supabase.rpc('add_xp_to_jornada', {
        p_jornada_id: jornadaId,
        p_xp_amount: xp,
        p_conquista_nome: conquista,
        p_user_id: userId
      });
      if (error) {
        console.warn('[MARKER] add_xp_to_jornada not available, trying add_xp_to_conversation...', error);
        if (!conversationId) return null;
        const { data: d2, error: e2 } = await this.supabase.rpc('add_xp_to_conversation', {
          p_conversation_id: conversationId,
          p_xp_amount: xp,
          p_conquista_nome: conquista
        });
        if (e2) { console.error('[MARKER] XP RPC failed:', e2); return null; }
        return d2;
      }
      return data;
    } catch (err) {
      console.error('[MARKER] Exception awarding XP:', err);
      return null;
    }
  }

  async addTimelineEvent(jornadaId: string, evento: string, fase: string) {
    try {
      await this.supabase.rpc('add_timeline_event', {
        p_jornada_id: jornadaId,
        p_evento: evento,
        p_fase: fase
      });
    } catch (err) {
      console.error('[MARKER] Error adding timeline event:', err);
    }
  }

  async autoAwardXPByEvent(jornadaId: string, userId: string, event: 'formulario_preenchido'|'entregavel_gerado'|'fase_concluida'|'acao_iniciada', conversationId?: string) {
    const xpMap: Record<string, number> = {
      formulario_preenchido: 50,
      entregavel_gerado: 75,
      fase_concluida: 100,
      acao_iniciada: 25
    };
    const xp = xpMap[event];
    if (!xp) return null;
    return await this.awardXPByJornada(jornadaId, xp, event, userId, conversationId);
  }
}

// ============================================================================
// DELIVERABLE GENERATOR (usa processos mapeados na Cadeia de Valor p/ priorização)
// ============================================================================
class DeliverableGenerator {
  supabase: any;
  openaiKey: string;
  constructor(supabase: any, openaiKey: string){
    this.supabase = supabase;
    this.openaiKey = openaiKey;
  }

  async generateDeliverable(tipo: string, jornada: any) {
    // Base de contexto
    let contexto = jornada.contexto_coleta || {};

    // Para "matriz_priorizacao" e "escopo_projeto", enriquecemos com os processos da cadeia de valor
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
      matriz_priorizacao: 'Matriz de Priorização',
      escopo_projeto: 'Escopo do Projeto',
      processo_as_is: 'Mapeamento AS-IS',
      bpmn: 'BPMN AS-IS',
      diagnostico: 'Diagnóstico Detalhado',
      plano_acao: 'Plano de Ação 5W2H'
    };
    return { html: this.cleanHTML(html), nome: nomeMap[tipo] || 'Documento' };
  }

  buildPromptForType(tipo: string, contexto: any, jornada: any) {
    const contextoJson = JSON.stringify(contexto, null, 2);
    const empresa = jornada?.empresa_nome || 'Empresa';
    const responsavel = jornada?.responsavel_nome || 'Usuário';
    const hoje = new Date().toLocaleDateString('pt-BR');

    const prompts: Record<string,string> = {
      anamnese: `Gere um documento HTML (pt-BR) de **Anamnese Empresarial**.

Dados:
${contextoJson}

Seções: Perfil da Empresa, Situação Atual, Principais Desafios, Metas Estratégicas, Insights.
HTML limpo com CSS embutido minimalista e padronizado. Retorne APENAS HTML.`,
      canvas: `Gere um **Business Model Canvas** (pt-BR) em HTML com 9 blocos.

Dados:
${contextoJson}

Use CSS Grid limpo e padrão visual consistente. Inclua análise breve depois. Retorne APENAS HTML.`,
      cadeia_valor: `Gere a **Cadeia de Valor de Porter** em HTML (pt-BR) com atividades primárias e de suporte.

Dados:
${contextoJson}

Indique onde valor é criado/perdido. Visual padronizado. Retorne APENAS HTML.`,
      matriz_priorizacao: `Gere uma **Matriz de Priorização (Impacto x Esforço)** em HTML (pt-BR) para **PROCESSOS mapeados** (não problemas).
Use os processos em "__processos_mapeados" do JSON abaixo. Se algum campo (impacto/criticidade/esforço) estiver ausente, assuma 1.
Produza tabela ordenada por prioridade (maior impacto*criticidade / esforço) e destaque "Prioridade 1".

Dados:
${contextoJson}

Visual padronizado. Retorne APENAS HTML.`,
      escopo_projeto: `Gere o documento HTML (pt-BR) **Escopo do Projeto**.

Cabeçalho:
- **Título:** Escopo do Projeto
- **Empresa:** ${empresa}
- **Responsável:** ${responsavel}
- **Data:** ${hoje}

Use os **processos mapeados** em "__processos_mapeados" do JSON abaixo. Liste processos com breve descrição e **ordem** sugerida por prioridade.

Dados:
${contextoJson}

Visual profissional. Retorne APENAS HTML.`,
      processo_as_is: `Gere um HTML de apoio descrevendo o **AS-IS do processo** (pt-BR), com passos e atores.

Dados:
${contextoJson}

Este HTML é apoio textual; o fluxo principal será em BPMN Viewer. Visual padronizado. Retorne APENAS HTML.`,
      bpmn: `Forneça **BPMN 2.0 XML** dentro de **<pre><code>...</code></pre>** (com &lt; &gt; escapados) para o **processo AS-IS** (pt-BR).
Inclua pools/lanes, gateways, e comente gargalos.

Dados:
${contextoJson}
Retorne apenas o bloco <pre><code>...</code></pre> com o XML escapado.`,
      diagnostico: `Gere um **Diagnóstico Detalhado** (pt-BR): Sumário Executivo, Achados, Causas-raiz, Impactos, Riscos.

Dados:
${contextoJson}

Nada superficial: traga causas específicas, evidências e medidas. Visual padronizado. Retorne APENAS HTML.`,
      plano_acao: `Gere um **Plano de Ação 5W2H** (pt-BR) com colunas O quê/Por quê/Onde/Quando/Quem/Como/Quanto.
- Sem ações vagas. Detalhe exatamente competências, responsáveis, ferramentas/sistemas (módulo, integração, fornecedor), indicadores (fórmula, meta), cronograma e dependências.
- Liste Quick Wins primeiro.

Dados:
${contextoJson}

Visual padronizado. Retorne APENAS HTML.`
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
          { role: 'system', content: 'Você é um gerador de documentos de consultoria. Produza HTML clean, com CSS embutido padronizado. Não use cores aleatórias.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 2000
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
    const isPreCodeOnly = /^<pre>\s*<code>[\s\S]*<\/code>\s*<\/pre>$/i.test(html);
    if (!isPreCodeOnly && !/^<!DOCTYPE|^<html/i.test(html)) {
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Documento</title></head><body>${html}</body></html>`;
    }
    return html;
  }

  async saveDeliverable(jornadaId: string, tipo: string, nome: string, html: string, etapaOrigem: string, areaId?: string) {
    const { data: existing } = await this.supabase
      .from('entregaveis_consultor')
      .select('id, created_at, etapa_origem')
      .eq('jornada_id', jornadaId)
      .eq('tipo', tipo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0 && existing[0].etapa_origem === etapaOrigem) {
      const { error: upErr } = await this.supabase
        .from('entregaveis_consultor')
        .update({ nome, html_conteudo: html })
        .eq('id', existing[0].id);
      if (upErr) throw upErr;
      return existing[0].id;
    }

    const { data, error } = await this.supabase.from('entregaveis_consultor').insert({
      jornada_id: jornadaId,
      area_id: areaId || null,
      nome,
      tipo,
      html_conteudo: html,
      etapa_origem: etapaOrigem
    }).select().single();
    if (error) throw error;
    return data.id;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
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

async function callLLM(systemPrompt: string, userPrompt: string, openaiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.5,
      max_tokens: 1500
    })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(()=> ({}));
    throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

// Helper anti-loop para formularios já preenchidos
function isFormAlreadyFilled(tipo: string, ctx: any) {
  const c = ctx || {};
  return (tipo === 'anamnese' && c.anamnese) ||
         (tipo === 'canvas' && c.canvas) ||
         (tipo === 'cadeia_valor' && c.cadeia_valor) ||
         (tipo === 'matriz_priorizacao' && c.matriz_priorizacao) ||
         (tipo === 'atributos_processo' && c.atributos_processo);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { fetch } });

    const { message, conversation_id, user_id, form_data, form_type } = await req.json();

    if (!message || !conversation_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isFormSubmission = Boolean(form_data && Object.keys(form_data).length > 0);

    // histórico
    const { data: conversationHistory } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    // Jornada por (user_id, conversation_id) — UPSERT iniciando em ANAMNESE (como seu original)
    let { data: jornada, error: selectErr } = await supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('user_id', user_id)
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    if (!jornada) {
      const { data: upserted, error: upErr } = await supabase
        .from('jornadas_consultor')
        .upsert({
          user_id,
          conversation_id,
          etapa_atual: 'anamnese',
          contexto_coleta: {},
          aguardando_validacao: null,
          progresso_geral: 0
        }, { onConflict: 'user_id,conversation_id' })
        .select()
        .single();
      if (upErr) throw upErr;
      jornada = upserted;

      // evento inicial da timeline em anamnese
      try {
        await supabase.rpc('add_timeline_event', {
          p_jornada_id: jornada.id,
          p_evento: 'Fase iniciada: anamnese',
          p_fase: 'anamnese'
        });
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] timeline init warn:', e);
      }
    } else if (selectErr) {
      console.error('[CONSULTOR-CHAT] Erro ao buscar jornada:', selectErr);
    }

    // Persistência de formulário
    if (isFormSubmission && form_data) {
      const currentContext = jornada.contexto_coleta || {};
      const updatedContext = { ...currentContext, [String(form_type || 'generico')]: form_data };

      await supabase.from('jornadas_consultor')
        .update({ contexto_coleta: updatedContext })
        .eq('id', jornada.id);

      // Atualiza etapa/validação conforme formulário
      if (form_type === 'anamnese') {
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'anamnese', aguardando_validacao: 'anamnese' })
          .eq('id', jornada.id);
      }
      if (form_type === 'canvas' || form_type === 'cadeia_valor') {
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'modelagem', aguardando_validacao: null })
          .eq('id', jornada.id);
      }
      if (form_type === 'matriz_priorizacao') {
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'priorizacao', aguardando_validacao: 'priorizacao' })
          .eq('id', jornada.id);
      }
      if (form_type === 'atributos_processo') {
        await supabase.from('jornadas_consultor')
          .update({ etapa_atual: 'execucao', aguardando_validacao: null })
          .eq('id', jornada.id);
      }

      // refresh jornada
      const { data: jornadaAtualizada } = await supabase.from('jornadas_consultor').select('*').eq('id', jornada.id).single();
      if (jornadaAtualizada) jornada = jornadaAtualizada;

      // Gamificação (evento formulário)
      const markerProcessorForForm = new MarkerProcessor(supabase);
      await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'formulario_preenchido', conversation_id);

      // Se escopo existir, criar áreas
      const ctx = updatedContext;
      if (ctx?.escopo?.processos || ctx?.escopo_projeto?.processos || ctx?.priorizacao?.processos) {
        await markerProcessorForForm.ensureAreasFromScope(jornada.id);
      }
    }

    // GAMIFICAÇÃO (compat com sua tabela/view atual)
    const { data: gamification } = await supabase
      .from('gamificacao_conversa')
      .select('*')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    // PROMPTS
    const promptBuilder = new IntelligentPromptBuilder(supabase);
    const systemPrompt = await promptBuilder.buildSystemPrompt(jornada, gamification, '', conversationHistory || []);
    const userPrompt = await promptBuilder.buildUserPrompt(message, conversationHistory || []);

    // LLM
    const llmResponse = await callLLM(systemPrompt, userPrompt, openaiKey);

    // MARKERS (com filtragem anti-loop ANTES de enviar ao front)
    const markerProcessor = new MarkerProcessor(supabase);
    const { displayContent, actions } = markerProcessor.processResponse(llmResponse);

    // -------- Fallbacks para não travar fluxo ----------
    const ctxNow = (jornada && jornada.contexto_coleta) ? jornada.contexto_coleta : {};
    const filteredActions = actions.filter((a: any) => {
      if (a.type !== 'exibir_formulario') return true;
      const tipo = String(a.params?.tipo || '');
      return !isFormAlreadyFilled(tipo, ctxNow);
    });

    // 1) Matriz de Priorização nunca como formulário
    //    Se vier como exibir_formulario, troca por gerar_entregavel
    for (const a of actions) {
      if (a.type === 'exibir_formulario' && (a.params?.tipo === 'matriz_priorizacao' || a.params?.tipo === 'matriz-priorizacao')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
    }

    // 2) Em MODELAGEM/MAPEAMENTO: garantir Cadeia de Valor (se ainda não foi preenchida)
    if ((jornada.etapa_atual === 'modelagem' || jornada.etapa_atual === 'mapeamento')
        && !isFormAlreadyFilled('cadeia_valor', ctxNow)
        && !filteredActions.some((a:any)=> a.type==='exibir_formulario' && a.params?.tipo==='cadeia_valor')) {
      filteredActions.push({ type: 'exibir_formulario', params: { tipo: 'cadeia_valor' } });
    }

    // 3) Após existir Cadeia de Valor: sugerir Atributos do Processo quando for iniciar Execução
    if ((jornada.etapa_atual === 'execucao' || jornada.etapa_atual === 'priorizacao')
        && ctxNow?.cadeia_valor
        && !isFormAlreadyFilled('atributos_processo', ctxNow)
        && !filteredActions.some((a:any)=> a.type==='exibir_formulario' && a.params?.tipo==='atributos_processo')) {
      filteredActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
    }
    // ----------------------------------------------------

    const { updates, gamificationResult } =
      await markerProcessor.executeActions(filteredActions, jornada, user_id, conversation_id);

    // GERAR ENTREGÁVEIS
    const deliverableActions = filteredActions.filter((a: any)=>a.type === 'gerar_entregavel');
    if (deliverableActions.length > 0) {
      const deliverableGenerator = new DeliverableGenerator(supabase, openaiKey);
      for (const action of deliverableActions){
        try {
          const rawTipo = action.params.tipo;
          // normalização de slug
          const tipo = (rawTipo === 'matriz' ? 'matriz_priorizacao' : rawTipo).replace(/-/g, '_');
          const { html, nome } = await deliverableGenerator.generateDeliverable(tipo, jornada);
          await deliverableGenerator.saveDeliverable(jornada.id, tipo, nome, html, jornada.etapa_atual);
          await markerProcessor.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);
          if (tipo === 'escopo_projeto') await markerProcessor.ensureAreasFromScope(jornada.id);
        } catch (err) {
          console.error(`[CONSULTOR-CHAT] Error generating deliverable ${action.params?.tipo}:`, err);
        }
      }
    }

    if (Object.keys(updates).length > 0) jornada = { ...jornada, ...updates };

    // Persistência das falas
    await saveMessages(supabase, conversation_id, user_id, message, displayContent);

    // RESPOSTA
    return new Response(JSON.stringify({
      response: displayContent,
      jornada_id: jornada.id,
      etapa_atual: jornada.etapa_atual,
      aguardando_validacao: jornada.aguardando_validacao,
      actions: filteredActions.map((a:any)=>({ type: a.type, params: a.params })),
      gamification: gamificationResult
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[CONSULTOR-CHAT ERROR]', error);
    return new Response(JSON.stringify({ error: error.message, details: error.stack }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
