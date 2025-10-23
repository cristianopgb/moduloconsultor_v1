# Correção do Loop de Anamnese - 23 Outubro 2025

## Problema Identificado

Após preencher o formulário de anamnese, o sistema entrava em loop:
- LLM continuava pedindo para enviar formulário de anamnese
- Nunca avançava para o canvas
- `aguardando_validacao: "anamnese"` ficava travado
- Checklist marcava `anamnese_preenchida` mas não `anamnese_analisada`

### Logs do Problema
```
ChatPage.tsx:996 consultorData completo: {
  actions: [],
  aguardando_validacao: "anamnese",
  etapa_atual: "anamnese",
  response: "Claro! Vou te enviar o formulário de anamnese para que possamos começar..."
}
```

## Causa Raiz

O problema tinha **duas causas**:

### 1. Flag `anamnese_analisada` Não Era Marcada
```typescript
// ANTES: Apenas marcava preenchida
if (form_data.nome_empresa || form_data.nome_usuario) {
  await frameworkGuide.markEvent(conversation_id, 'anamnese_preenchida');
}

// Framework-guide esperava anamnese_analisada para avançar (linha 193):
if (checklist.anamnese_preenchida && !checklist.anamnese_analisada) {
  return "Fazer análise dos dados da anamnese e introduzir Business Model Canvas.";
}
```

### 2. Etapa da Jornada Não Avançava
```typescript
// ANTES: Ficava em 'anamnese' com aguardando_validacao
if (form_type === 'anamnese') {
  await supabase.from('jornadas_consultor')
    .update({ etapa_atual: 'anamnese', aguardando_validacao: 'anamnese' })
    .eq('id', jornada.id);
}
```

## Solução Aplicada

### Fix 1: Marcar `anamnese_analisada` Automaticamente

**Arquivo**: `supabase/functions/consultor-chat/index.ts` (linhas 412-416)

```typescript
// DEPOIS: Marca preenchida E analisada
if (form_data.nome_empresa || form_data.nome_usuario || form_data.empresa_nome) {
  await frameworkGuide.markEvent(conversation_id, 'anamnese_preenchida');
  // IMPORTANTE: Marcar como analisada também para evitar loop
  await frameworkGuide.markEvent(conversation_id, 'anamnese_analisada');
  console.log('[CONSULTOR-CHAT] Marked anamnese_preenchida + analisada');
}
```

**Justificativa**:
- Após formulário preenchido, não faz sentido pedir análise manual
- A "análise" pode ser feita pela LLM na próxima mensagem
- Evita estado intermediário que causa loop

### Fix 2: Avançar Etapa para `modelagem`

**Arquivo**: `supabase/functions/consultor-chat/index.ts` (linhas 237-242)

```typescript
// ANTES: Ficava em anamnese com aguardando_validacao
if (form_type === 'anamnese') {
  await supabase.from('jornadas_consultor')
    .update({ etapa_atual: 'anamnese', aguardando_validacao: 'anamnese' })
    .eq('id', jornada.id);
}

// DEPOIS: Avança para modelagem sem aguardar validação
if (form_type === 'anamnese') {
  // CRÍTICO: Após anamnese preenchida, avançar para modelagem (canvas)
  // aguardando_validacao: null para não travar o fluxo
  await supabase.from('jornadas_consultor')
    .update({ etapa_atual: 'modelagem', aguardando_validacao: null })
    .eq('id', jornada.id);
}
```

**Justificativa**:
- Anamnese preenchida → próxima fase é modelagem (canvas)
- `aguardando_validacao: null` destrava o fluxo
- LLM pode avançar naturalmente para canvas

## Fluxo Corrigido

### Antes da Correção
```
1. Usuário preenche anamnese
2. Sistema marca: anamnese_preenchida = true
3. Sistema define: aguardando_validacao = "anamnese"
4. Framework-guide diz: "Fazer análise dos dados da anamnese"
5. LLM fica confusa, continua pedindo anamnese
6. LOOP INFINITO ❌
```

### Depois da Correção
```
1. Usuário preenche anamnese
2. Sistema marca: anamnese_preenchida = true + anamnese_analisada = true
3. Sistema avança: etapa_atual = "modelagem", aguardando_validacao = null
4. Framework-guide diz: "Propor Canvas de forma conversacional"
5. LLM pergunta se pode enviar canvas
6. FLUXO CONTINUA ✅
```

## Framework-Guide Context Esperado

Após a correção, o `getGuideContext` retorna:

```
📍 ONDE ESTAMOS:
✅ Apresentação feita
✅ Anamnese completa

💭 PRÓXIMO OBJETIVO NATURAL:
Propor de forma conversacional: 'Que tal mapearmos seu modelo de negócio no Canvas?' (não envie o form ainda!)

⚠️ EVITE:
- NÃO se apresente novamente
- NÃO peça dados que já estão na anamnese
- NÃO envie formulário de anamnese novamente
```

## Testes Realizados

✅ Build: `npm run build` passou sem erros
✅ Lógica: Flags corretas marcadas após form submission
✅ Avanço: Etapa muda de `anamnese` para `modelagem`
✅ Framework: Context indica próximo passo (canvas)

## Arquivos Modificados

1. **`supabase/functions/consultor-chat/index.ts`**
   - Linha 237-242: Avançar etapa para modelagem após anamnese
   - Linha 412-416: Marcar anamnese_analisada automaticamente

## Prevenção de Regressão

Para evitar que este problema volte:

1. **Sempre marcar flag "analisada" após "preenchida"**
   - `anamnese_preenchida` → `anamnese_analisada`
   - `canvas_preenchido` → considerar análise automática também

2. **Avançar etapa após formulários fundamentais**
   - Anamnese → Modelagem
   - Canvas → continua em Modelagem
   - Cadeia de Valor → Priorização

3. **Nunca usar `aguardando_validacao` para forms básicos**
   - Apenas para validações reais (escopo, priorização)
   - Forms básicos não precisam validação do usuário

## Comportamento Esperado Agora

**Sequência Normal:**
1. Apresentação → LLM pergunta sobre anamnese
2. Usuário confirma → LLM envia `[EXIBIR_FORMULARIO:anamnese]`
3. Usuário preenche → Sistema marca flags + avança para modelagem
4. LLM pergunta sobre canvas → Usuário confirma
5. LLM envia `[EXIBIR_FORMULARIO:canvas]`
6. Usuário preenche → Sistema avança
7. LLM pergunta sobre cadeia de valor → ...

**Sem Loops, Sem Travamentos!**

---

**Data**: 23 de Outubro de 2025
**Problema**: Loop infinito após anamnese preenchida
**Status**: ✅ RESOLVIDO
**Build**: ✅ Passou
