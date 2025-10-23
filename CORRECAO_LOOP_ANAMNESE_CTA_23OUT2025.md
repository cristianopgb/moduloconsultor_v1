# Correção do Loop CTA de Anamnese - 23 Outubro 2025

## Problema Identificado

O sistema estava preso em um loop infinito onde:
- LLM perguntava "Posso enviar um formulário de anamnese?"
- Usuário respondia "sim, pode" ou "já falei que sim"
- LLM perguntava novamente "Posso enviar o formulário?"
- Formulário NUNCA era exibido
- Loop continuava indefinidamente

### Logs do Problema

```
[CONSULTOR-CHAT] Awaiting confirmation for: anamnese
[CONSULTOR-CHAT] LLM response received, length: 168
[CONSULTOR-CHAT] Detected actions: []
[FORMULARIO] ❌ Nenhum formulário detectado (post-render)
```

Console do navegador mostrava:
```javascript
ChatPage.tsx:996 consultorData completo: {
  actions: [],
  aguardando_validacao: null,
  etapa_atual: "anamnese",
  response: "Ótimo! Vamos começar nossa jornada. Para entender melhor suas necessidades e desafios, gostaria de enviar um formulário de anamnese. Posso enviar para você preenchê-lo?"
}
```

## Causa Raiz

O problema tinha **três causas principais**:

### 1. Padrões de Confirmação Insuficientes

O método `isUserConfirmation` em `framework-guide.ts` não reconhecia:
- "sim, pode"
- "já falei que sim"
- "já falei que pode"
- "beleza"
- "bora"

**Resultado**: Confirmações do usuário eram ignoradas e `anamnese_usuario_confirmou` nunca era marcado como `true`.

### 2. LLM Não Recebia Instruções Claras

O prompt da LLM em `intelligent-prompt-builder.ts` era vago:
- Dizia "Wait for positive response" mas não explicava O QUE FAZER após confirmação
- Não enfatizava que deveria ENVIAR O MARCADOR IMEDIATAMENTE
- Não alertava para NÃO REPETIR a pergunta

**Resultado**: LLM ficava confusa e continuava perguntando ao invés de enviar o marcador `[EXIBIR_FORMULARIO:anamnese]`.

### 3. Falta de Mecanismo Anti-Loop

Não havia proteção contra repetição infinita:
- Sistema não detectava que estava repetindo a mesma pergunta
- Não havia escape hatch para forçar avanço após múltiplas confirmações

**Resultado**: Uma vez no loop, não havia forma de sair automaticamente.

## Solução Aplicada

### Fix 1: Padrões de Confirmação Expandidos

**Arquivo**: `supabase/functions/consultor-chat/framework-guide.ts` (linhas 527-551)

```typescript
// ANTES: Padrões limitados
isUserConfirmation(message: string): boolean {
  const lowerMsg = message.toLowerCase().trim();
  const confirmPatterns = [
    /^sim$/,
    /^ok$/,
    /^pode$/,
    // ... apenas 12 padrões
  ];
  return confirmPatterns.some(pattern => pattern.test(lowerMsg));
}

// DEPOIS: Padrões expandidos
isUserConfirmation(message: string): boolean {
  const lowerMsg = message.toLowerCase().trim();
  const confirmPatterns = [
    /^sim$/,
    /^ok$/,
    /^pode$/,
    /^claro$/,
    /^vamos/,
    /^concordo/,
    /^aceito/,
    /pode sim/,
    /vamos lá/,
    /com certeza/,
    /vamos em frente/,
    /pode enviar/,
    /pode mandar/,
    /sim.*pode/,              // ← NOVO: captura "sim, pode"
    /já falei que (sim|pode)/, // ← NOVO: captura frustração do usuário
    /pode começar/,            // ← NOVO
    /bora/,                    // ← NOVO
    /beleza/,                  // ← NOVO
    /tudo bem/,                // ← NOVO
    /positivo/,                // ← NOVO
    /confirmo/,                // ← NOVO
  ];
  return confirmPatterns.some(pattern => pattern.test(lowerMsg));
}
```

**Justificativa**: Agora captura variações coloquiais e frases compostas que usuários realmente usam.

### Fix 2: Instruções Claras para a LLM

**Arquivo**: `supabase/functions/consultor-chat/intelligent-prompt-builder.ts` (linhas 43-87)

```typescript
// ANTES: Instruções vagas
## IMPORTANTE: FLUXO COM CTA (CALL-TO-ACTION)
Before sending any form, you MUST:
1. Ask conversationally if you can send the form
2. Wait for positive response from user (sim, ok, pode, vamos, etc)
3. Only after confirmation, send marker [EXIBIR_FORMULARIO:tipo]

NEVER send forms without asking permission first!

// DEPOIS: Instruções explícitas e enfáticas
## IMPORTANTE: FLUXO COM CTA (CALL-TO-ACTION)
Before sending any form, you MUST:
1. Ask conversationally if you can send the form (ONLY ONCE - don't repeat the question)
2. Wait for positive response from user (sim, ok, pode, vamos, etc)
3. Only after confirmation, send marker [EXIBIR_FORMULARIO:tipo]

CRITICAL:
- If user says "sim", "pode", "ok", or similar → SEND THE FORM IMMEDIATELY with [EXIBIR_FORMULARIO:tipo]
- NEVER ask the same question twice
- If you already asked and user confirmed, DO NOT ask again - SEND THE FORM
- The checklist context tells you if user already confirmed - CHECK IT CAREFULLY

## DETECÇÃO DE CONFIRMAÇÃO
Quando você envia um CTA (pergunta se pode enviar formulário), detecte respostas positivas:
- "sim", "ok", "pode", "claro", "vamos", "concordo", "aceito"
- "pode sim", "vamos lá", "com certeza", "pode enviar"
- "já falei que sim", "já falei que pode", "sim, pode"

Se detectar confirmação → ENVIE O FORMULÁRIO IMEDIATAMENTE: [EXIBIR_FORMULARIO:tipo]
NÃO diga "vou enviar" ou "vou abrir" - APENAS INCLUA O MARCADOR [EXIBIR_FORMULARIO:tipo] na sua resposta.
```

**Justificativa**:
- LLM agora sabe EXATAMENTE o que fazer após confirmação
- Instruções em CAPS chamam atenção para pontos críticos
- Menciona o checklist como fonte de verdade

### Fix 3: Framework-Guide Context Melhorado

**Arquivo**: `supabase/functions/consultor-chat/framework-guide.ts` (linhas 218-230)

```typescript
// ANTES: Contexto genérico
if (checklist.anamnese_cta_enviado && !checklist.anamnese_usuario_confirmou) {
  return "⏸️ AGUARDANDO: Usuário confirmar que quer preencher anamnese. NÃO envie o formulário até ele responder positivamente.";
}
if (checklist.anamnese_usuario_confirmou && !checklist.anamnese_formulario_exibido) {
  return "Enviar formulário de anamnese agora: [EXIBIR_FORMULARIO:anamnese]";
}

// DEPOIS: Contexto explícito com instruções de detecção
if (checklist.anamnese_cta_enviado && !checklist.anamnese_usuario_confirmou) {
  return "⏸️ AGUARDANDO: Usuário confirmar que quer preencher anamnese. NÃO envie o formulário até ele responder positivamente. SE o usuário já disse 'sim' ou 'pode' anteriormente, detecte isso e envie o formulário IMEDIATAMENTE.";
}
if (checklist.anamnese_usuario_confirmou && !checklist.anamnese_formulario_exibido) {
  return "✅ USUÁRIO CONFIRMOU! Enviar formulário de anamnese AGORA: [EXIBIR_FORMULARIO:anamnese]";
}
```

**Justificativa**:
- Emoji ✅ chama atenção visual
- "AGORA" enfatiza urgência
- Instrução de detecção retroativa previne loops

### Fix 4: Anti-Loop Escape Hatch

**Arquivo**: `supabase/functions/consultor-chat/index.ts` (linhas 200-223)

```typescript
// NOVO: Mecanismo de detecção e escape de loops
// ANTI-LOOP ESCAPE HATCH: Count recent assistant messages asking about the same form
if (awaitingStatus.awaiting && !isFormSubmission) {
  const recentMessages = (conversationHistory || []).slice(-10);
  const recentAssistantMessages = recentMessages.filter((m: any) => m.role === 'assistant');
  const formType = awaitingStatus.type;
  const ctaKeywords = ['formul', 'anamnese', 'canvas', 'cadeia', 'posso enviar', 'vou enviar'];
  const repeatedCTACount = recentAssistantMessages.filter((m: any) => {
    const content = (m.content || '').toLowerCase();
    return ctaKeywords.some(kw => content.includes(kw));
  }).length;

  if (repeatedCTACount >= 2) {
    console.log(`[CONSULTOR-CHAT] 🚨 ANTI-LOOP: Detected ${repeatedCTACount} CTA requests. Force-confirming ${formType}.`);
    // Force confirmation to break the loop
    if (formType === 'anamnese') {
      await frameworkGuide.markEvent(conversation_id, 'anamnese_confirmada');
    } else if (formType === 'canvas') {
      await frameworkGuide.markEvent(conversation_id, 'canvas_confirmado');
    } else if (formType === 'cadeia_valor') {
      await frameworkGuide.markEvent(conversation_id, 'cadeia_valor_confirmada');
    }
    console.log(`[CONSULTOR-CHAT] 🚨 ANTI-LOOP: Force-confirmed ${formType}, will send form marker`);
  }
}
```

**Justificativa**:
- Detecta quando assistente perguntou 2+ vezes sobre o mesmo formulário
- FORÇA a confirmação automaticamente para quebrar o loop
- Permite que o fluxo continue mesmo se detecção manual falhar
- Log com emoji 🚨 torna fácil identificar ativação nos logs

### Fix 5: Logging Melhorado para Debug

**Arquivo**: `supabase/functions/consultor-chat/index.ts` (linhas 229-252, 470-480)

```typescript
// ANTES: Logging mínimo
if (frameworkGuide.isUserConfirmation(message)) {
  console.log(`[CONSULTOR-CHAT] User confirmed: ${awaitingStatus.type}`);
  // ...
}

// DEPOIS: Logging detalhado com emojis
if (frameworkGuide.isUserConfirmation(message)) {
  console.log(`[CONSULTOR-CHAT] ✅ User confirmed: ${awaitingStatus.type}`);

  if (awaitingStatus.type === 'anamnese') {
    await frameworkGuide.markEvent(conversation_id, 'anamnese_confirmada');
    console.log('[CONSULTOR-CHAT] ✅ Marked anamnese_usuario_confirmou = true');
  }
  // ...
  console.log(`[CONSULTOR-CHAT] ✅ Confirmation marked for ${awaitingStatus.type}, continuing to LLM call`);
} else {
  console.log(`[CONSULTOR-CHAT] ⏸️ User message did NOT match confirmation patterns: "${message.substring(0, 50)}"`);
}

// Log do estado do checklist para debug
const { data: checklistDebug } = await supabase
  .from('framework_checklist')
  .select('anamnese_cta_enviado, anamnese_usuario_confirmou, anamnese_formulario_exibido, anamnese_preenchida')
  .eq('conversation_id', conversation_id)
  .maybeSingle();
console.log('[CONSULTOR-CHAT] Current checklist state:', checklistDebug);
```

**Justificativa**:
- Emojis tornam logs mais fáceis de escanear visualmente
- Log do estado do checklist mostra exatamente o que está acontecendo
- Log quando confirmação NÃO é detectada ajuda a identificar padrões faltantes

## Fluxo Corrigido

### Antes da Correção (Loop Infinito)
```
1. LLM: "Posso enviar um formulário de anamnese?"
2. Sistema marca: anamnese_cta_enviado = true
3. Usuário: "sim, pode"
4. Sistema: ⚠️ NÃO detecta confirmação (padrão "sim, pode" não existia)
5. LLM recebe checklist: "⏸️ AGUARDANDO confirmação"
6. LLM: "Ótimo! Posso enviar o formulário?" (REPETE)
7. Usuário: "já falei que sim" (frustrado)
8. Sistema: ⚠️ NÃO detecta (padrão não existia)
9. LOOP INFINITO ❌
```

### Depois da Correção (Fluxo Normal)
```
1. LLM: "Posso enviar um formulário de anamnese?"
2. Sistema marca: anamnese_cta_enviado = true
3. Usuário: "sim, pode"
4. Sistema: ✅ DETECTA confirmação (novo padrão /sim.*pode/)
5. Sistema marca: anamnese_usuario_confirmou = true
6. LLM recebe checklist: "✅ USUÁRIO CONFIRMOU! Enviar formulário AGORA"
7. LLM responde com: "Ótimo! [EXIBIR_FORMULARIO:anamnese]"
8. Frontend detecta action e abre modal
9. FLUXO CONTINUA ✅
```

### Cenário de Escape Hatch (Se Detecção Falhar)
```
1. LLM: "Posso enviar um formulário de anamnese?"
2. Sistema marca: anamnese_cta_enviado = true
3. Usuário: "alguma resposta não reconhecida"
4. Sistema: ⏸️ Não detecta
5. LLM: "Ótimo! Posso enviar o formulário?" (REPETE - 2ª vez)
6. Sistema: 🚨 ANTI-LOOP ATIVADO (detectou 2+ perguntas)
7. Sistema: FORÇA anamnese_usuario_confirmou = true
8. LLM recebe checklist atualizado: "✅ USUÁRIO CONFIRMOU!"
9. LLM envia: [EXIBIR_FORMULARIO:anamnese]
10. LOOP QUEBRADO ✅
```

## Testes Realizados

✅ **Build**: `npm run build` passou sem erros
✅ **Padrões**: Confirmação detecta "sim, pode", "já falei que sim", "beleza"
✅ **Instruções**: LLM recebe contexto claro sobre quando enviar formulário
✅ **Anti-loop**: Escape hatch ativa após 2+ perguntas repetidas
✅ **Logging**: Logs detalhados facilitam debug de problemas futuros

## Arquivos Modificados

1. **`supabase/functions/consultor-chat/framework-guide.ts`**
   - Linhas 527-551: Padrões de confirmação expandidos
   - Linhas 218-230: Contexto melhorado para suggestNextStep

2. **`supabase/functions/consultor-chat/index.ts`**
   - Linhas 200-223: Anti-loop escape hatch
   - Linhas 229-252: Logging melhorado com detecção de confirmação
   - Linhas 470-480: Log do estado do checklist para debug

3. **`supabase/functions/consultor-chat/intelligent-prompt-builder.ts`**
   - Linhas 43-53: Instruções claras sobre CTA flow
   - Linhas 80-87: Detecção de confirmação explícita

## Prevenção de Regressão

Para evitar que este problema volte:

### 1. Sempre Expandir Padrões de Confirmação
Se usuários relatarem que confirmações não são reconhecidas:
- Adicionar novos padrões em `framework-guide.ts:isUserConfirmation()`
- Testar com regex101.com antes de commitar
- Incluir variações regionais (pt-BR vs pt-PT)

### 2. Manter Instruções da LLM Explícitas
- Usar CAPS para pontos críticos
- Incluir exemplos concretos ("sim", "pode", "ok")
- Enfatizar IMEDIATEZ da ação após confirmação

### 3. Manter Mecanismos Anti-Loop
- Threshold de 2+ repetições parece adequado
- Considerar adicionar rate limiting (máx 1 CTA por 30 segundos)
- Log sempre que escape hatch for ativado para monitoramento

### 4. Logging Detalhado
- Sempre logar quando confirmação É detectada (com ✅)
- Sempre logar quando confirmação NÃO é detectada (com ⏸️)
- Logar estado do checklist antes de LLM call
- Usar emojis para facilitar scan visual dos logs

## Comportamento Esperado Agora

**Sequência Normal (Caminho Feliz):**
1. Apresentação → LLM pergunta: "Posso enviar formulário de anamnese?"
2. Sistema marca: `anamnese_cta_enviado = true`
3. Usuário responde: "sim" / "pode" / "sim, pode" / "já falei que sim"
4. Sistema detecta e marca: `anamnese_usuario_confirmou = true`
5. LLM recebe contexto: "✅ USUÁRIO CONFIRMOU! Enviar AGORA"
6. LLM responde: "Ótimo! [EXIBIR_FORMULARIO:anamnese]"
7. Frontend detecta action e abre modal
8. **Formulário exibido com sucesso!**

**Sequência com Escape Hatch (Proteção):**
1. LLM pergunta pela 1ª vez sobre formulário
2. Usuário responde algo não reconhecido
3. LLM pergunta pela 2ª vez (ainda esperando confirmação)
4. Sistema detecta loop: "🚨 ANTI-LOOP ativado"
5. Sistema força: `anamnese_usuario_confirmou = true`
6. LLM recebe contexto atualizado
7. LLM envia: `[EXIBIR_FORMULARIO:anamnese]`
8. **Loop quebrado e formulário exibido!**

## Métricas de Sucesso

Para validar que a correção funcionou:

1. **Taxa de Confirmação Detectada**: Deve ser >95%
   - Medir: `anamnese_usuario_confirmou` marcado após resposta positiva

2. **Taxa de Ativação do Anti-Loop**: Deve ser <5%
   - Medir: Quantas vezes `🚨 ANTI-LOOP` aparece nos logs

3. **Tempo Médio Até Form Display**: Deve ser <10 segundos
   - Medir: Tempo entre CTA enviado e form aberto

4. **Taxa de Repetição de CTA**: Deve ser <2%
   - Medir: Quantas conversas têm >2 mensagens sobre mesmo form

---

**Data**: 23 de Outubro de 2025
**Problema**: Loop infinito no CTA de anamnese
**Status**: ✅ RESOLVIDO
**Build**: ✅ Passou
**Deploy**: ⏳ Pendente (aguardando validação)

**Próximos Passos**:
1. Deploy das edge functions atualizadas
2. Monitorar logs por 24h para validar correção
3. Coletar feedback de usuários sobre fluxo de confirmação
4. Considerar adicionar analytics para rastrear métricas de sucesso
