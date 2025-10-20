# Deploy do Consultor Chat - INSTRUÇÕES IMPORTANTES

## ❌ NÃO USE esses arquivos para deploy:
- `index.ts` - Tem imports separados, vai falhar no Supabase
- `index-consolidated.ts` - Falta o FrameworkGuide e usa tabela errada de gamificação

## ✅ ARQUIVO CORRETO para deploy:
Copie e faça deploy manual do arquivo que está criando agora...

## Alterações necessárias no index-consolidated.ts:

### 1. Adicionar FrameworkGuide antes do IntelligentPromptBuilder

Adicione estas interfaces e classe ANTES da linha `// INTELLIGENT PROMPT BUILDER`:

```typescript
// ============================================================================
// FRAMEWORK GUIDE
// ============================================================================

interface ProcessoChecklist {
  id: string;
  framework_checklist_id: string;
  conversation_id: string;
  processo_nome: string;
  processo_ordem: number;
  atributos_preenchidos: boolean;
  bpmn_as_is_mapeado: boolean;
  diagnostico_preenchido: boolean;
  processo_completo: boolean;
  xp_atributos_concedido: boolean;
  xp_bpmn_concedido: boolean;
  xp_diagnostico_concedido: boolean;
}

interface FrameworkChecklistData {
  id: string;
  apresentacao_feita: boolean;
  anamnese_preenchida: boolean;
  anamnese_analisada: boolean;
  anamnese_formulario_exibido: boolean;
  canvas_preenchido: boolean;
  canvas_formulario_exibido: boolean;
  cadeia_valor_preenchida: boolean;
  cadeia_valor_formulario_exibida: boolean;
  processos_identificados: boolean;
  escopo_priorizacao_definido: boolean;
  escopo_quantidade_processos: number;
  escopo_processos_nomes: string[];
  matriz_priorizacao_preenchida: boolean;
  matriz_priorizacao_formulario_exibido: boolean;
  todos_processos_concluidos: boolean;
  plano_acao_gerado: boolean;
  xp_anamnese_concedido: boolean;
  xp_canvas_concedido: boolean;
  xp_cadeia_valor_concedido: boolean;
  xp_matriz_priorizacao_concedido: boolean;
  xp_plano_acao_concedido: boolean;
  xp_conclusao_concedido: boolean;
}

class FrameworkGuide {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async getGuideContext(conversationId: string): Promise<string> {
    const { data: checklist, error: checklistError } = await this.supabase
      .from('framework_checklist')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (checklistError || !checklist) {
      console.error('[FRAMEWORK_GUIDE] Erro ao buscar checklist:', checklistError);
      return "";
    }

    const { data: processos } = await this.supabase
      .from('processo_checklist')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('processo_ordem');

    return `
=== SEU CONTEXTO INTERNO (Framework Proceda) ===
Use isso como ORIENTAÇÃO, não como script rígido. Você é um consultor experiente.

📍 ONDE ESTAMOS:
${this.buildCurrentState(checklist, processos || [])}

🎯 ESCOPO DEFINIDO:
${this.buildScopeInfo(checklist, processos || [])}

💭 PRÓXIMO OBJETIVO NATURAL:
${this.suggestNextStep(checklist, processos || [])}

⚠️ EVITE:
${this.buildAvoidanceList(checklist, processos || [])}

🎮 GAMIFICAÇÃO PENDENTE:
${this.buildPendingXP(checklist, processos || [])}

📋 PRINCÍPIOS DO DIÁLOGO:
- SEMPRE responda dúvidas do cliente, mesmo fora da sequência
- Seja natural e conversacional
- Use o checklist para NÃO repetir o que já foi feito
- Retome gentilmente quando cliente se desviar muito
- Se cliente perguntar algo de etapa futura, explique com contexto
`;
  }

  private buildCurrentState(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    const steps = [];
    if (checklist.apresentacao_feita) steps.push("✅ Apresentação feita");
    if (checklist.anamnese_preenchida) steps.push("✅ Anamnese completa");
    if (checklist.canvas_preenchido) steps.push("✅ Canvas mapeado");
    if (checklist.cadeia_valor_preenchida) steps.push("✅ Cadeia de Valor definida");
    if (checklist.processos_identificados) steps.push("✅ Processos identificados");
    if (checklist.escopo_priorizacao_definido) steps.push("✅ Escopo definido");
    if (checklist.matriz_priorizacao_preenchida) steps.push("✅ Matriz de Priorização feita");
    processos.forEach((p, idx) => {
      if (p.processo_completo) steps.push(`✅ Processo ${idx + 1}: ${p.processo_nome} - Concluído`);
      else if (p.diagnostico_preenchido) steps.push(`🔄 Processo ${idx + 1}: ${p.processo_nome} - Diagnóstico ok`);
      else if (p.bpmn_as_is_mapeado) steps.push(`🔄 Processo ${idx + 1}: ${p.processo_nome} - BPMN mapeado`);
      else if (p.atributos_preenchidos) steps.push(`🔄 Processo ${idx + 1}: ${p.processo_nome} - Atributos ok`);
    });
    if (checklist.plano_acao_gerado) steps.push("✅ Plano de Ação entregue");
    return steps.length > 0 ? steps.join("\n") : "🆕 Início da jornada";
  }

  private buildScopeInfo(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    if (!checklist.escopo_priorizacao_definido) return "❌ Escopo ainda não definido.";
    const total = processos.length;
    const completos = processos.filter(p => p.processo_completo).length;
    let info = `✅ Escopo: ${total} processo(s) | 📊 Progresso: ${completos}/${total}\n\n`;
    processos.forEach((p, idx) => {
      const status = p.processo_completo ? '✅' : p.diagnostico_preenchido ? '🔄 Diagnóstico ok' : p.bpmn_as_is_mapeado ? '🔄 BPMN ok' : p.atributos_preenchidos ? '🔄 Atributos ok' : '⏳';
      info += `${idx + 1}. ${p.processo_nome}: ${status}\n`;
    });
    return info;
  }

  private suggestNextStep(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    if (!checklist.apresentacao_feita) return "Apresentar-se brevemente.";
    if (!checklist.anamnese_formulario_exibido) return "[EXIBIR_FORMULARIO:anamnese]";
    if (!checklist.anamnese_preenchida) return "Aguardando anamnese.";
    if (!checklist.anamnese_analisada) return "Analisar anamnese.";
    if (!checklist.canvas_formulario_exibido) return "[EXIBIR_FORMULARIO:canvas]";
    if (!checklist.canvas_preenchido) return "Aguardando Canvas.";
    if (!checklist.cadeia_valor_formulario_exibida) return "[EXIBIR_FORMULARIO:cadeia_valor]";
    if (!checklist.cadeia_valor_preenchida) return "Aguardando Cadeia de Valor.";
    if (!checklist.processos_identificados) return "Identificar processos-chave.";
    if (!checklist.escopo_priorizacao_definido) return "DEFINIR ESCOPO com o cliente.";
    if (!checklist.matriz_priorizacao_formulario_exibido) return "[EXIBIR_FORMULARIO:matriz_priorizacao]";
    if (!checklist.matriz_priorizacao_preenchida) return "Aguardando matriz.";

    if (processos.length > 0) {
      const atual = processos.find(p => !p.processo_completo);
      if (!atual) return checklist.plano_acao_gerado ? "✅ Completo!" : "🎉 [GERAR_ENTREGAVEL:plano_acao]";
      if (!atual.atributos_preenchidos) return `[EXIBIR_FORMULARIO:atributos] - ${atual.processo_nome}`;
      if (!atual.bpmn_as_is_mapeado) return `[GERAR_ENTREGAVEL:bpmn_as_is] - ${atual.processo_nome}`;
      if (!atual.diagnostico_preenchido) return `[EXIBIR_FORMULARIO:diagnostico] - ${atual.processo_nome}`;
    }

    return "Prosseguir naturalmente.";
  }

  private buildAvoidanceList(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    const avoid = [];
    if (checklist.apresentacao_feita) avoid.push("- NÃO se apresente novamente");
    if (checklist.anamnese_preenchida) avoid.push("- NÃO peça dados já coletados");
    if (checklist.canvas_preenchido) avoid.push("- NÃO peça Canvas novamente");
    if (checklist.cadeia_valor_preenchida) avoid.push("- NÃO peça Cadeia de Valor novamente");
    if (!checklist.escopo_priorizacao_definido && checklist.processos_identificados) avoid.push("- NÃO pule a definição de escopo");
    return avoid.length > 0 ? avoid.join("\n") : "- Nenhuma restrição";
  }

  private buildPendingXP(checklist: FrameworkChecklistData, processos: ProcessoChecklist[]): string {
    const pending = [];
    if (checklist.anamnese_preenchida && !checklist.xp_anamnese_concedido) pending.push("🎁 [GAMIFICACAO:anamnese_completa:50]");
    if (checklist.canvas_preenchido && !checklist.xp_canvas_concedido) pending.push("🎁 [GAMIFICACAO:canvas_completo:75]");
    if (checklist.cadeia_valor_preenchida && !checklist.xp_cadeia_valor_concedido) pending.push("🎁 [GAMIFICACAO:cadeia_valor_completa:60]");
    if (checklist.matriz_priorizacao_preenchida && !checklist.xp_matriz_priorizacao_concedido) pending.push("🎁 [GAMIFICACAO:matriz_completa:80]");
    processos.forEach(p => {
      const slug = p.processo_nome.toLowerCase().replace(/\s+/g, '_');
      if (p.atributos_preenchidos && !p.xp_atributos_concedido) pending.push(`🎁 [GAMIFICACAO:atributos_${slug}:50]`);
      if (p.bpmn_as_is_mapeado && !p.xp_bpmn_concedido) pending.push(`🎁 [GAMIFICACAO:bpmn_${slug}:100]`);
      if (p.diagnostico_preenchido && !p.xp_diagnostico_concedido) pending.push(`🎁 [GAMIFICACAO:diagnostico_${slug}:90]`);
    });
    if (checklist.plano_acao_gerado && !checklist.xp_plano_acao_concedido) pending.push("🎁 [GAMIFICACAO:plano_acao_gerado:150]");
    if (checklist.todos_processos_concluidos && checklist.plano_acao_gerado && !checklist.xp_conclusao_concedido) pending.push("🎁 [GAMIFICACAO:framework_completo:200]");
    return pending.length > 0 ? "USE estes marcadores:\n" + pending.join("\n") : "✅ Nenhum XP pendente.";
  }

  async markEvent(conversationId: string, event: string): Promise<void> {
    const updates: any = { ultima_interacao: new Date().toISOString(), updated_at: new Date().toISOString() };
    const eventMap: Record<string, any> = {
      'apresentacao': { apresentacao_feita: true, apresentacao_ts: new Date().toISOString() },
      'anamnese_exibida': { anamnese_formulario_exibido: true },
      'anamnese_preenchida': { anamnese_preenchida: true, anamnese_ts: new Date().toISOString() },
      'anamnese_analisada': { anamnese_analisada: true },
      'canvas_exibido': { canvas_formulario_exibido: true },
      'canvas_preenchido': { canvas_preenchido: true, canvas_ts: new Date().toISOString() },
      'cadeia_valor_exibida': { cadeia_valor_formulario_exibida: true },
      'cadeia_valor_preenchida': { cadeia_valor_preenchida: true, cadeia_valor_ts: new Date().toISOString() },
      'processos_identificados': { processos_identificados: true, processos_identificados_ts: new Date().toISOString() },
      'matriz_exibida': { matriz_priorizacao_formulario_exibido: true },
      'matriz_preenchida': { matriz_priorizacao_preenchida: true, matriz_priorizacao_ts: new Date().toISOString() },
      'plano_gerado': { plano_acao_gerado: true, plano_acao_ts: new Date().toISOString() },
      'xp_anamnese': { xp_anamnese_concedido: true },
      'xp_canvas': { xp_canvas_concedido: true },
      'xp_cadeia': { xp_cadeia_valor_concedido: true },
      'xp_matriz': { xp_matriz_priorizacao_concedido: true },
      'xp_plano': { xp_plano_acao_concedido: true },
      'xp_conclusao': { xp_conclusao_concedido: true },
    };
    const eventUpdates = eventMap[event];
    if (eventUpdates) Object.assign(updates, eventUpdates);
    await this.supabase.from('framework_checklist').update(updates).eq('conversation_id', conversationId);
  }
}
```

### 2. Alterar buildSystemPrompt para aceitar 4 parâmetros

Linha 20, altere de:
```typescript
async buildSystemPrompt(jornada: any, gamification: any, conversationHistory: any[]): Promise<string> {
```

Para:
```typescript
async buildSystemPrompt(jornada: any, gamification: any, checklistContext: string, conversationHistory: any[]): Promise<string> {
```

### 3. Adicionar checklistContext no return do buildSystemPrompt

Adicione `${checklistContext}` ANTES de `${ctaGuidelines}`:

```typescript
return `${baseIdentity}

${framework}

${phaseInstructions}

${contextSection}

${gamificationContext}

${checklistContext}

${ctaGuidelines}

${markerInstructions}
...
```

### 4. Trocar gamificacao_consultor por gamificacao_conversa

Procure a linha (aproximadamente 968):
```typescript
.from('gamificacao_consultor')
```

Altere para:
```typescript
.from('gamificacao_conversa')
```

E altere o `.eq` de `user_id` para `conversation_id`:
```typescript
.eq('conversation_id', conversation_id)
```

### 5. Adicionar fetching do checklistContext no handler

Antes de chamar `buildSystemPrompt`, adicione:

```typescript
const frameworkGuide = new FrameworkGuide(supabase);
const checklistContext = await frameworkGuide.getGuideContext(conversation_id);
```

E atualize a chamada para:
```typescript
const systemPrompt = await promptBuilder.buildSystemPrompt(jornada, gamification, checklistContext, conversationHistory || []);
```

### 6. Adicionar event tracking após form submission

Após `if (jornadaAtualizada) jornada = jornadaAtualizada;`, adicione:

```typescript
const frameworkGuide = new FrameworkGuide(supabase);
if (form_data.nome_empresa || form_data.nome_usuario || form_data.empresa_nome) {
  await frameworkGuide.markEvent(conversation_id, 'anamnese_preenchida');
} else if (form_data.parcerias_chave || form_data.segmentos_clientes) {
  await frameworkGuide.markEvent(conversation_id, 'canvas_preenchido');
} else if (form_data.atividades_primarias || form_data.atividades_suporte) {
  await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_preenchida');
} else if (form_data.processos && Array.isArray(form_data.processos)) {
  await frameworkGuide.markEvent(conversation_id, 'matriz_preenchida');
}
```

### 7. Adicionar tracking de form actions e gamification

Após `executeActions`, adicione:

```typescript
const formActions = actions.filter(a => a.type === 'exibir_formulario');
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
```

---

## Resumo das alterações:
1. ✅ Adicionar FrameworkGuide completo
2. ✅ Adicionar parâmetro checklistContext em buildSystemPrompt
3. ✅ Incluir checklistContext no prompt
4. ✅ Corrigir tabela de gamificação
5. ✅ Adicionar fetching do checklist
6. ✅ Adicionar event tracking completo

Depois dessas alterações, o arquivo estará completo para deploy!
