// supabase/functions/consultor-chat/index.ts
// Orquestrador principal do módulo Consultor (LLM + markers + entregáveis + gamificação)
// Mantém sua arquitetura original com IntelligentPromptBuilder e MarkerProcessor,
// adicionando fallbacks e cálculo de matriz baseado nos processos mapeados.

// Use an ESM build compatible with Deno to avoid runtime resolution issues (tslib) in the Edge environment
// esm.sh bundles a Deno-friendly version of the package
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno'

interface ChatRequest {
  message: string;
  conversation_id: string;
  user_id: string;
  form_data?: any;
  form_type?: string;
}

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
    const postActions: any[] = [];
    let gamificationResult: any = null;

    // refresh jornada from DB to avoid stale state when processing actions
    try {
      if (jornada && jornada.id) {
        const { data: refreshedJornada } = await this.supabase
          .from('jornadas_consultor').select('*').eq('id', jornada.id).single();
        if (refreshedJornada) {
          jornada = refreshedJornada;
          console.log('[MARKER] Refreshed jornada before executing actions, etapa_atual:', jornada.etapa_atual, 'aguardando_validacao:', jornada.aguardando_validacao);
        }
      }
    } catch (e) {
      console.warn('[MARKER] failed to refresh jornada before executeActions:', e);
    }

    console.log('[MARKER] executeActions received actions:', actions.map((a:any)=>a.type));

    for (const action of actions){
      switch(action.type){
        case 'set_validacao': {
          const tipo = action.params.tipo;
          console.log(`[MARKER] processing set_validacao for tipo='${tipo}' (jornada.aguardando_validacao='${jornada.aguardando_validacao}')`);
          // If user validated priorizacao, advance to execucao
          if (tipo === 'priorizacao' && jornada.aguardando_validacao === 'priorizacao') {
            updates.etapa_atual = 'execucao';
            updates.aguardando_validacao = null;
            await this.supabase.from('jornadas_consultor')
              .update({ etapa_atual: 'execucao', aguardando_validacao: null })
              .eq('id', jornada.id);
            await this.addTimelineEvent(jornada.id, `Fase avançada para: execucao`, 'execucao');
            try {
              gamificationResult = await this.awardXPByJornada(jornada.id, 100, `Fase execucao iniciada`, userId, conversationId);
            } catch (e) {
              console.warn('[MARKER] awardXPByJornada failed on set_validacao:priorizacao', e);
            }
            await this.ensureAreasFromScope(jornada.id);
            // enqueue atributos_processo after advancing
            // Try to include the prioritized process info (from matriz_priorizacao) so frontend can pre-fill the form
            try {
              const ctx = jornada.contexto_coleta || {};
              const processos = ctx?.matriz_priorizacao?.processos || ctx?.priorizacao?.processos || ctx?.escopo?.processos || [];
              if (Array.isArray(processos) && processos.length > 0) {
                const primeiro = processos[0];
                const pa = { type: 'exibir_formulario', params: { tipo: 'atributos_processo', processo: { id: primeiro.id || null, nome: primeiro.nome || primeiro.processo || primeiro } } };
                postActions.push(pa);
                console.log('[MARKER] enqueued atributos_processo prefilled with process:', pa.params.processo);
              } else {
                postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
                console.log('[MARKER] enqueued atributos_processo without prefilling (no prioritized processes found)');
              }
            } catch (e) {
              postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
              console.warn('[MARKER] error while trying to enqueue atributos_processo, enqueued empty form instead:', e);
            }
          } else {
            updates.aguardando_validacao = tipo;
            await this.supabase.from('jornadas_consultor')
              .update({ aguardando_validacao: tipo })
              .eq('id', jornada.id);
          }
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
            // ensure we ask for atributos_processo once execution starts
            try {
              const ctx = jornada.contexto_coleta || {};
              const processos = ctx?.matriz_priorizacao?.processos || ctx?.priorizacao?.processos || ctx?.escopo?.processos || [];
              if (Array.isArray(processos) && processos.length > 0) {
                const primeiro = processos[0];
                postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo', processo: { id: primeiro.id || null, nome: primeiro.nome || primeiro.processo || primeiro } } });
              } else {
                postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
              }
            } catch (e) {
              postActions.push({ type: 'exibir_formulario', params: { tipo: 'atributos_processo' } });
            }
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
    return { updates, gamificationResult, postActions };
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
    // Lightweight validation for userId to avoid passing invalid/null values to RPCs
    const isValidUserId = (id?: string) => {
      if (!id || typeof id !== 'string') return false;
      const v = id.trim();
      if (!v) return false;
      if (v.toLowerCase() === 'null') return false;
      // basic check: should contain hex or dash characters (UUID-like) or be reasonably long
      return /[0-9a-fA-F\-]{8,}/.test(v);
    };

    try {
      if (!isValidUserId(userId)) {
        console.warn('[MARKER] invalid or missing userId; using conversation-level XP RPC');
        if (!conversationId) return null;
        try {
          const { data: d2, error: e2 } = await this.supabase.rpc('add_xp_to_conversation', {
            p_conversation_id: conversationId,
            p_xp_amount: xp,
            p_conquista_nome: conquista
          });
          if (e2) { console.error('[MARKER] XP RPC failed (conversation fallback):', e2); return null; }
          return d2;
        } catch (errRpc) {
          console.error('[MARKER] Exception calling add_xp_to_conversation (fallback):', errRpc);
          return null;
        }
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
        try {
          const { data: d2, error: e2 } = await this.supabase.rpc('add_xp_to_conversation', {
            p_conversation_id: conversationId,
            p_xp_amount: xp,
            p_conquista_nome: conquista
          });
          if (e2) { console.error('[MARKER] XP RPC failed (fallback):', e2); return null; }
          return d2;
        } catch (errRpc) {
          console.error('[MARKER] Exception calling add_xp_to_conversation (fallback):', errRpc);
          return null;
        }
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

      const mapped = (processos || []).map((p:any)=>({ id: p.id, nome: p.nome, impacto: p.impacto, criticidade: p.criticidade, esforco: p.esforco, descricao: p.descricao }));
      (contexto as any).__processos_mapeados = mapped;

      // Ensure prompts receive a canonical field with processes so the LLM doesn't fallback to mock text
      if (!((contexto as any).processos) || ((contexto as any).processos || []).length === 0) {
        (contexto as any).processos = mapped.map((x:any)=>({ id: x.id, nome: x.nome, impacto: x.impacto, esforco: x.esforco, descricao: x.descricao }));
      }
      if (!((contexto as any).cadeia_valor) || !((contexto as any).cadeia_valor.processos)) {
        (contexto as any).cadeia_valor = (contexto as any).cadeia_valor || {};
        (contexto as any).cadeia_valor.processos = mapped.map((x:any)=>({ id: x.id, nome: x.nome, impacto: x.impacto, esforco: x.esforco, descricao: x.descricao }));
        console.log('[DELIVERABLE] injecting processes into contexto for', tipo, 'count:', mapped.length);
      }
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
    // Prefer the explicit 'contexto' passed by the caller (may include injected processos)
    const { empresa_nome, responsavel_nome } = jornada || {};
    const ctxSource = contexto || (jornada && jornada.contexto_coleta) || {};
    const {
      objetivos,
      dores,
      processos,
      areas_impactadas,
      desafios,
      metas_estrategicas,
      produtos_servicos
    } = ctxSource || {};

    const empresa = empresa_nome || 'Empresa';
    const responsavel = responsavel_nome || 'Usuário';
    const hoje = new Date().toLocaleDateString('pt-BR');
    const contextoJson = JSON.stringify(ctxSource || contexto || {}, null, 2);

    const prompts: Record<string,string> = {
      anamnese: `Gere um documento HTML (pt-BR) de **Anamnese Empresarial** para ${empresa}.

Use os dados coletados:
Objetivos: ${objetivos || 'N/A'}
Dores: ${dores || 'N/A'}
Desafios: ${desafios || 'N/A'}
Metas Estratégicas: ${metas_estrategicas || 'N/A'}

Seções: Perfil da Empresa, Situação Atual, Principais Desafios, Metas Estratégicas, Insights.
HTML limpo com CSS embutido minimalista e padronizado. Retorne APENAS HTML.`,

    /* matriz_priorizacao (version consolidated later in file) removed to avoid duplicate keys */

      escopo_projeto: `Gere um **Documento de Escopo** (pt-BR) para ${empresa}.
Use os dados reais coletados (incluindo entregáveis já gerados e a Matriz de Priorização):

Objetivos: ${objetivos || 'N/A'}
Dores: ${dores || 'N/A'}
Processos mapeados/identificados: ${processos || 'N/A'}
Matriz de Priorização (se disponível no contexto): inclua os 3 primeiros processos priorizados com justificativa clara
Áreas Impactadas: ${areas_impactadas || 'N/A'}

Requisitos:
- Não gere um texto genérico. Use os entregáveis já gerados (Anamnese, Canvas, Cadeia de Valor, Matriz de Priorização) como fonte primária.
- Liste explicitamente quais processos serão trabalhados durante a fase de execução (use a ordem da Matriz de Priorização).
- Para cada processo priorizado inclua: identificação do processo, razão da priorização (impacto/esforço), escopo do trabalho (o que será coberto na execução), áreas envolvidas, entregáveis esperados e critérios de aceite.

Inclua seções:
1. Objetivo (alinhado aos objetivos informados)
2. Justificativa (baseada nas dores reais e na Matriz de Priorização)
3. Processos Priorizados (liste e detalhe pelo menos os 3 primeiros)
  - Descrição detalhada
  - Áreas envolvidas (use as áreas informadas)
  - Resultados esperados e entregáveis por processo
4. Premissas e Restrições
5. Entregas Principais e Critérios de Aceite

HTML limpo com CSS embutido minimalista e padronizado. Retorne APENAS HTML.`,

      canvas: `Gere um **Business Model Canvas** (pt-BR) em HTML para ${empresa}.

Use os dados reais:
Produtos/Serviços: ${produtos_servicos || 'N/A'}
Desafios: ${desafios || 'N/A'}
Metas: ${metas_estrategicas || 'N/A'}

Dados:
${contextoJson}

Use CSS Grid limpo e padrão visual consistente. Inclua análise breve depois. Retorne APENAS HTML.`,
      cadeia_valor: `Gere a **Cadeia de Valor de Porter** em HTML (pt-BR) com atividades primárias e de suporte.

Dados:
${contextoJson}

Indique onde valor é criado/perdido. Visual padronizado. Retorne APENAS HTML.`,
      matriz_priorizacao: `Gere uma **Matriz de Priorização (Impacto x Esforço)** em HTML (pt-BR) para os **PROCESSOS mapeados** na cadeia de valor.

Use dados reais do contexto:
${contextoJson}

1. Analise cada processo considerando:
   - Impacto (1-5): alinhamento objetivos, redução dores, benefícios
   - Esforço (1-5): complexidade, recursos, dependências
2. Gere tabela com:
   - Nome do Processo
   - Impacto (1-5)
   - Esforço (1-5) 
   - Score Final (Impacto/Esforço)
   - Justificativa baseada no contexto
3. Ordene por Score
4. Adicione <pre><code>scores_json</code></pre> com a lista ordenada

Visual limpo. Retorne apenas o HTML.`,
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
    try {
      // Replace explicit scores_json blocks (quando a LLM inclui um bloco de código JSON) por um details colapsável
      html = html.replace(/<pre>\s*<code>\s*scores_json\s*([\s\S]*?)<\/code>\s*<\/pre>/i, (_m, jsonBlock) => {
        const cleaned = String(jsonBlock || '').trim();
        // attempt to pretty-print if it's valid JSON
        let pretty = cleaned;
        try { pretty = JSON.stringify(JSON.parse(cleaned), null, 2); } catch (e) { /* keep as-is */ }
        return `<details style="background:#0b1220;padding:10px;border-radius:6px;color:#e6eef8"><summary style="cursor:pointer;font-weight:600;padding:4px 0">Detalhes dos scores (JSON) — ver apenas se quiser o relatório técnico</summary><pre style="white-space:pre-wrap;overflow:auto;margin-top:8px;color:#d1e7ff">${this.escapeHtml(pretty)}</pre></details>`;
      });
    } catch (e) {
      // ignore post-processing errors
    }
    return html;
  }

  // small helper to escape HTML for inclusion in pre blocks
  escapeHtml(s: string) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { fetch } });

    const { message, conversation_id, user_id, form_data, form_type } = await req.json() as ChatRequest;
    

    if (!message || !conversation_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isFormSubmission = Boolean(form_data && Object.keys(form_data).length > 0);

    // histórico
    const { data: _conversationHistory } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });
    // allow reassigning conversationHistory later (we may reload it after form submission)
    let conversationHistory = _conversationHistory;

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
  let preAwardResult = null;
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
      try {
        // tentar premiar XP e capturar resultado para retorno
        // usar o método que já existe e pode retornar dados
        // @ts-ignore
        preAwardResult = await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'formulario_preenchido', conversation_id);
        console.log('[CONSULTOR-CHAT] preAwardResult:', preAwardResult);
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
        // Persist an assistant acknowledgement in the messages table so subsequent reads include it
        try {
          const ack = `Recebi o formulário ${String(form_type || 'generico')} e atualizei o contexto.`;
          await supabase.from('messages').insert([{ conversation_id: conversation_id, role: 'assistant', content: ack, user_id: user_id }]);
          console.log('[CONSULTOR-CHAT] persisted assistant ack message to messages table');
        } catch (e) {
          // log but do not fail the flow if DB insert fails (RLS/permissions may block this in some setups)
          console.warn('[CONSULTOR-CHAT] failed to persist assistant ack message (non-fatal):', e);
        }
      } catch (e) {
        // ignore if summarization fails
      }

      // After processing the form and saving context, re-fetch conversation messages
      // to ensure the LLM prompt builder sees the persisted user message and any DB-driven changes.
      try {
        let { data: refreshedHistory } = await supabase
          .from('messages').select('*')
          .eq('conversation_id', conversation_id)
          .order('created_at', { ascending: true });
        // retry once if empty (some setups may have eventual consistency/RLS delay)
        if (!Array.isArray(refreshedHistory) || refreshedHistory.length === 0) {
          try {
            await new Promise(res => setTimeout(res, 200));
            const r = await supabase
              .from('messages').select('*')
              .eq('conversation_id', conversation_id)
              .order('created_at', { ascending: true });
            refreshedHistory = r.data;
            console.log('[CONSULTOR-CHAT] retried message reload, messages count:', (refreshedHistory || []).length);
          } catch (e) {
            // ignore retry failures
          }
        }
        if (Array.isArray(refreshedHistory)) {
          // replace conversationHistory used later for prompt building
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (conversationHistory as any) = refreshedHistory;
          console.log('[CONSULTOR-CHAT] conversationHistory reloaded after form submission, messages:', ((refreshedHistory || []).length));
          try {
            // also append a synthetic assistant acknowledgement so the LLM clearly understands the form was received
            // this is not persisted to DB (only in-memory for prompt building)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (conversationHistory as any).push({ role: 'assistant', content: `Recebi o formulário ${String(form_type || 'generico')} e atualizei o contexto. Vou analisar os dados e gerar os próximos passos.` });
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] falha ao recarregar conversationHistory após form submission:', e);
      }

      // Se escopo existir, criar áreas
      const ctx = updatedContext;
      // Persistir processos enviados via formulário de cadeia_valor na tabela específica
      if (form_type === 'cadeia_valor') {
        try {
          // Normalize different possible shapes submitted by the frontend into a flat array
          const normalizeProcesses = (data: any) => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (data.processos && Array.isArray(data.processos)) return data.processos;
            // If sections were provided as keys, flatten them
            const out: any[] = [];
            for (const k of Object.keys(data)) {
              const v = data[k];
              if (Array.isArray(v)) out.push(...v);
              else if (v && typeof v === 'object' && Array.isArray(v.processos)) out.push(...v.processos);
            }
            return out;
          };

          const processosArray = normalizeProcesses(form_data);
          if (Array.isArray(processosArray) && processosArray.length > 0) {
            try {
              await supabase.from('cadeia_valor_processos').delete().eq('jornada_id', jornada.id);
            } catch (e) { /* ignore delete errors */ }
            const toInsert = processosArray.map((p: any) => ({
              jornada_id: jornada.id,
              nome: p.nome || p.process_name || String(p).slice(0, 200),
              descricao: p.descricao || p.descricao_curta || null,
              impacto: p.impacto ?? (p.impact || null),
              criticidade: p.criticidade ?? p.criticality ?? null,
              esforco: p.esforco ?? p.esforco_estimado ?? null
            }));
            try {
              const { data: ins, error: insErr } = await supabase.from('cadeia_valor_processos').insert(toInsert).select('id');
              if (insErr) console.warn('[CONSULTOR-CHAT] falha ao inserir processos cadeia_valor:', insErr);
              else console.log('[CONSULTOR-CHAT] inserted cadeia_valor_processos count:', (ins || []).length);
            } catch (e) { console.warn('[CONSULTOR-CHAT] falha ao inserir processos cadeia_valor (exception):', e); }
          }
        } catch (e) {
          console.warn('[CONSULTOR-CHAT] erro ao persistir cadeia_valor_processos:', e);
        }
      }
      if (ctx?.escopo?.processos || ctx?.escopo_projeto?.processos || ctx?.priorizacao?.processos) {
        await markerProcessorForForm.ensureAreasFromScope(jornada.id);
      }

      // If we have collected canvas/anamnese/cadeia_valor in contexto_coleta but the corresponding
      // entregaveis aren't present, auto-generate them so the flow can continue to priorizacao.
      try {
        const hasAnamneseData = !!(ctx && (ctx.anamnese || ctx.empresa));
        const hasCanvasData = !!(ctx && ctx.canvas);
        const hasCadeiaData = !!(ctx && (ctx.cadeia_valor || ctx.cadeia));

        if ((hasAnamneseData || hasCanvasData || hasCadeiaData)) {
          const deliverableGenerator = new DeliverableGenerator(supabase, openaiKey);
          // check existing entregaveis
          const { data: existing } = await supabase.from('entregaveis_consultor').select('tipo').eq('jornada_id', jornada.id);
          const tiposExistentes = new Set((existing || []).map((e:any)=> e.tipo));

          if (hasAnamneseData && !tiposExistentes.has('anamnese')) {
            try {
              const { html, nome } = await deliverableGenerator.generateDeliverable('anamnese', jornada);
              await deliverableGenerator.saveDeliverable(jornada.id, 'anamnese', nome, html, jornada.etapa_atual);
              await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);
            } catch (e) { console.warn('[CONSULTOR-CHAT] falha ao gerar anamnese automaticamente:', e); }
          }
          if (hasCanvasData && !tiposExistentes.has('canvas')) {
            try {
              const { html, nome } = await deliverableGenerator.generateDeliverable('canvas', jornada);
              await deliverableGenerator.saveDeliverable(jornada.id, 'canvas', nome, html, jornada.etapa_atual);
              await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);
            } catch (e) { console.warn('[CONSULTOR-CHAT] falha ao gerar canvas automaticamente:', e); }
          }
          if (hasCadeiaData && !tiposExistentes.has('cadeia_valor')) {
            try {
              const { html, nome } = await deliverableGenerator.generateDeliverable('cadeia_valor', jornada);
              await deliverableGenerator.saveDeliverable(jornada.id, 'cadeia_valor', nome, html, jornada.etapa_atual);
              await markerProcessorForForm.autoAwardXPByEvent(jornada.id, user_id, 'entregavel_gerado', conversation_id);
            } catch (e) { console.warn('[CONSULTOR-CHAT] falha ao gerar cadeia_valor automaticamente:', e); }
          }
        }
      } catch (e) {
        console.warn('[CONSULTOR-CHAT] Erro ao auto-gerar entregaveis após form submission:', e);
      }
    }

    // GAMIFICAÇÃO (compat com sua tabela/view atual)
    const { data: gamification } = await supabase
      .from('gamificacao_conversa')
      .select('*')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    // If user message contains direct markers (user clicked a button), handle them immediately
    const userMarkerActions: any[] = [];
    const formRegex = /\[EXIBIR_FORMULARIO:(\w+)\]/g;
    const deliverableRegex = /\[GERAR_ENTREGAVEL:([\w-]+)\]/g;
    const validationRegex = /\[SET_VALIDACAO:(\w+)\]/g;
    const phaseRegex = /\[AVANCAR_FASE:(\w+)\]/g;
    const gamificationRegex = /\[GAMIFICACAO:([^:]+):(\d+)\]/g;
    let m: RegExpExecArray | null;
    while((m = formRegex.exec(message)) !== null) userMarkerActions.push({ type: 'exibir_formulario', params: { tipo: m[1] } });
    while((m = deliverableRegex.exec(message)) !== null) userMarkerActions.push({ type: 'gerar_entregavel', params: { tipo: m[1] } });
    while((m = validationRegex.exec(message)) !== null) userMarkerActions.push({ type: 'set_validacao', params: { tipo: m[1] } });
    while((m = phaseRegex.exec(message)) !== null) userMarkerActions.push({ type: 'avancar_fase', params: { fase: m[1] } });
    while((m = gamificationRegex.exec(message)) !== null) userMarkerActions.push({ type: 'gamificacao', params: { evento: m[1], xp: Number(m[2]) } });

    if (userMarkerActions.length > 0) {
      // execute immediately and return current state (no LLM call)
      const { updates: ua, gamificationResult: ugr, postActions: up } = await new MarkerProcessor(supabase).executeActions(userMarkerActions, jornada, user_id, conversation_id) as any;
      // refresh jornada
      const { data: refreshed } = await supabase.from('jornadas_consultor').select('*').eq('id', jornada.id).single();
      jornada = refreshed || jornada;
      const mergedActions = [...userMarkerActions];
      if (Array.isArray(up) && up.length>0) mergedActions.push(...up);
      return new Response(JSON.stringify({
        response: 'Ação processada',
        jornada_id: jornada.id,
        etapa_atual: jornada.etapa_atual,
        aguardando_validacao: jornada.aguardando_validacao,
        actions: mergedActions,
        gamification: ugr ?? null
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PROMPTS
    const promptBuilder = new IntelligentPromptBuilder(supabase);
    const systemPrompt = await promptBuilder.buildSystemPrompt(jornada, gamification, '', conversationHistory || []);
    const userPrompt = await promptBuilder.buildUserPrompt(message, conversationHistory || []);

    // LLM
    const llmResponse = await callLLM(systemPrompt, userPrompt, openaiKey);

    // MARKERS (com filtragem anti-loop ANTES de enviar ao front)
    const markerProcessor = new MarkerProcessor(supabase);
    const { displayContent, actions } = markerProcessor.processResponse(llmResponse);

    // Fallback: se o LLM escreveu que vai abrir um formulário mas não gerou a marker explicitamente,
    // tentamos inferir a ação por heurística simples (palavras-chave) para não travar o fluxo.
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

    // -------- Fallbacks para não travar fluxo ----------
    const ctxNow = (jornada && jornada.contexto_coleta) ? jornada.contexto_coleta : {};
    const filteredActions = actions.filter((a: any) => {
      if (a.type !== 'exibir_formulario') return true;
      const tipo = String(a.params?.tipo || '');
      return !isFormAlreadyFilled(tipo, ctxNow);
    });

    // 1) Matriz de Priorização nunca como formulário
    //    Se LLM tentar exibir como formulário, convertemos em gerar_entregavel (priorização automática)
    for (const a of actions) {
      if (a.type === 'exibir_formulario' && (a.params?.tipo === 'matriz_priorizacao' || a.params?.tipo === 'matriz-priorizacao')) {
        console.log('[CONSULTOR-CHAT] Interceptando pedido de formulário de matriz_priorizacao — convertendo para gerar_entregavel');
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
    }

    // If we're in modelagem and we already have cadeia_valor and anamnese/canvas in contexto_coleta,
    // we should generate 'matriz_priorizacao' and 'escopo_projeto' automatically (LLM should compute them)
    const hasCadeia = !!(ctxNow && (ctxNow.cadeia_valor || ctxNow.cadeia));
    const hasCanvasOrAnamnese = !!(ctxNow && (ctxNow.canvas || ctxNow.anamnese || ctxNow.empresa));
    if ((jornada.etapa_atual === 'modelagem' || jornada.etapa_atual === 'mapeamento') && hasCadeia && hasCanvasOrAnamnese) {
      // ensure we don't duplicate if already present
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='matriz_priorizacao')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'matriz_priorizacao' } });
      }
      if (!filteredActions.some((a:any)=> a.type==='gerar_entregavel' && a.params?.tipo==='escopo_projeto')) {
        filteredActions.push({ type: 'gerar_entregavel', params: { tipo: 'escopo_projeto' } });
      }
      // also set validation for modelagem once generated
      if (!filteredActions.some((a:any)=> a.type==='set_validacao' && a.params?.tipo==='modelagem')) {
        filteredActions.push({ type: 'set_validacao', params: { tipo: 'modelagem' } });
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

    const { updates, gamificationResult, postActions } =
      await markerProcessor.executeActions(filteredActions, jornada, user_id, conversation_id) as any;

    // Merge postActions (avoiding duplicates)
    if (Array.isArray(postActions) && postActions.length > 0) {
      for (const pa of postActions) {
        if (!filteredActions.some((a:any)=> a.type === pa.type && JSON.stringify(a.params) === JSON.stringify(pa.params))) {
          filteredActions.push(pa);
        }
      }
    }

  // GERAR ENTREGÁVEIS
  let generatedMatriz = false;
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

          // If we just generated the prioritization matrix, compute concrete priorities from cadeia_valor_processos
          if (tipo === 'matriz_priorizacao') {
            try {
              console.log('[CONSULTOR-CHAT] Gerando matriz_priorizacao automaticamente (computando scores)');
              const { data: processos } = await supabase
                .from('cadeia_valor_processos')
                .select('id, nome, impacto, criticidade, esforco, descricao')
                .eq('jornada_id', jornada.id);

              const computed = (processos || []).map((p:any) => {
                const impacto = Number(p.impacto || 1);
                const criticidade = Number(p.criticidade || 1);
                const esforco = Number(p.esforco || 1) || 1;
                // Nova fórmula que inclui complexidade/urgência se disponíveis
                const complexidade = Number((p as any).complexidade || 1);
                const urgencia = Number((p as any).urgencia || 1);
                const score = ((impacto * criticidade) + (urgencia * complexidade)) / Math.max(1, esforco);
                return { id: p.id, nome: p.nome, impacto, criticidade, esforco, complexidade, urgencia, score, descricao: p.descricao || '' };
              }).sort((a:any,b:any)=> b.score - a.score);

              // persist computed matrix into contexto_coleta.matriz_priorizacao
              const newCtx = { ...(jornada.contexto_coleta || {}), matriz_priorizacao: { processos: computed, generated_at: new Date().toISOString() } };
              await supabase.from('jornadas_consultor').update({ contexto_coleta: newCtx, aguardando_validacao: 'priorizacao' }).eq('id', jornada.id);
              jornada.contexto_coleta = newCtx;
              jornada.aguardando_validacao = 'priorizacao';

              // Do NOT move to 'execucao' yet and do NOT enqueue atributos_processo.
              // The user must VALIDATE the priorização first. Once they validate, the frontend
              // will call the backend with a SET_VALIDACAO:priorizacao action to advance.
              console.log('[CONSULTOR-CHAT] matriz_priorizacao persistida e jornada marcada aguardando_validacao: priorizacao');
              // Ensure the assistant asks the user to review and validate the matrix
              // by adding a set_validacao action to the response flow (frontend will render CTA)
              if (!filteredActions.some((a:any)=> a.type === 'set_validacao' && a.params?.tipo === 'priorizacao')) {
                filteredActions.push({ type: 'set_validacao', params: { tipo: 'priorizacao' } });
              }
              generatedMatriz = true;
            } catch (e) {
              console.error('[CONSULTOR-CHAT] Error computing matriz_priorizacao details:', e);
            }
          }
        } catch (err) {
          console.error(`[CONSULTOR-CHAT] Error generating deliverable ${action.params?.tipo}:`, err);
        }
      }
    }

    // If we generated a matrix automatically, prepare a clear review/validation CTA
    let responseContent = displayContent;
    try {
      if (generatedMatriz) {
        const reviewNote = `\n\nAtenção: gerei automaticamente a *Matriz de Priorização* e o *Escopo do Projeto* com base nos dados fornecidos. Por favor, revise os entregáveis na aba "Entregáveis" e, se concordar com as prioridades sugeridas, use o botão "Validar Priorização" disponível na conversa para avançarmos. Ao validar, iniciaremos a execução: primeiro faremos a coleta de atributos do primeiro processo priorizado e depois modelagem AS-IS e BPMN.`;
        responseContent = (responseContent || '') + reviewNote;
        // Ensure frontend receives set_validacao to render CTA buttons
        if (!filteredActions.some((a:any)=> a.type === 'set_validacao' && a.params?.tipo === 'priorizacao')) {
          filteredActions.push({ type: 'set_validacao', params: { tipo: 'priorizacao' } });
        }
      }
    } catch (e) {
      // ignore
    }

    // RESPOSTA
    return new Response(JSON.stringify({
      response: responseContent,
      jornada_id: jornada.id,
      etapa_atual: jornada.etapa_atual,
      aguardando_validacao: jornada.aguardando_validacao,
      actions: filteredActions.map(a => ({ type: a.type, params: a.params })),
      gamification: preAwardResult ?? gamificationResult ?? null
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[CONSULTOR-CHAT ERROR]', error);
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message, details: err.stack }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// @ts-ignore
Deno.serve(handleRequest);

