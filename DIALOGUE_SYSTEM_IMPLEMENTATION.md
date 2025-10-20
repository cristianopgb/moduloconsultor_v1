# Sistema de Diálogo Conversacional - Implementação Parcial

## ✅ O que foi Implementado (50% concluído)

### 1. Persistência no Banco de Dados ✅
**Status:** Completo

Criadas duas tabelas novas para persistência do diálogo:

#### `dialogue_states`
- Armazena estado do diálogo por conversa (1:1 com `conversations`)
- Campos principais:
  - `state`: 'idle', 'conversing', 'ready_to_analyze', 'analyzing', 'completed'
  - `context_data`: JSONB com schema, sample, metadados
  - `questions_history`: Array de perguntas já feitas (previne loops)
  - `user_responses`: Respostas acumuladas do usuário
  - `completeness_score`: 0-100% de completude do contexto
  - `llm_understanding`: O que a LLM já entendeu
  - `ready_for_analysis`: Boolean se pode iniciar análise

#### `dialogue_messages`
- Histórico completo de mensagens do diálogo
- Tipos:
  - `llm_question`: LLM fazendo pergunta
  - `llm_statement`: LLM apenas informando algo
  - `user_answer`: Resposta do usuário
  - `user_message`: Mensagem livre do usuário
- `expects_response`: Define se mostra campo de input
- `metadata`: Sugestões, confidence, etc

**RLS Policies:** Completas e seguras (usuários veem só seus dados, masters veem tudo)

### 2. Correção do Backend ✅
**Status:** Completo

**Arquivo:** `supabase/functions/analyze-file/index.ts`

**Problema corrigido:**
- Linha 1846: `dialogueContext is not defined`
- **Solução:** Adicionada definição de `dialogueContext` a partir de `intelligentContext` na linha 1375

```typescript
// Linha 1375
const dialogueContext = intelligentContext || {};
```

### 3. Novo ContextQuestionsPanel Dinâmico ✅
**Status:** Completo

**Arquivo:** `src/components/Chat/ContextQuestionsPanel.tsx`

**Características:**
- ✅ Carrega estado e histórico do banco automaticamente
- ✅ Mostra histórico completo de mensagens (LLM + usuário)
- ✅ UI diferenciada por tipo de mensagem (pergunta, statement, resposta)
- ✅ Campo de input só aparece quando `expects_response === true`
- ✅ Sugestões dinâmicas da LLM
- ✅ Salva respostas automaticamente no banco
- ✅ Barra de progresso de completude
- ✅ Scroll automático para novas mensagens
- ✅ Atalho Cmd/Ctrl + Enter para enviar

## ⏳ O que Falta Implementar (50% restante)

### 4. Integração do ChatPage com Novo Painel ⏳
**Status:** Não iniciado

**Arquivo:** `src/components/Chat/ChatPage.tsx`

**O que precisa ser feito:**

```typescript
// 1. Adicionar estado para controlar painel
const [showDialoguePanel, setShowDialoguePanel] = useState(false);
const [dialogueStateId, setDialogueStateId] = useState<string | null>(null);

// 2. Ao receber needs_dialogue do backend, NÃO adicionar mensagem ao chat
// Apenas abrir o painel
if (analysisResponse?.needs_dialogue) {
  // NÃO FAZER: setMessages(prev => [...prev, dialogueMessage]);

  // FAZER: Abrir painel e deixar ele gerenciar o histórico
  setShowDialoguePanel(true);
  return; // Não adicionar nada ao chat principal
}

// 3. Renderizar painel condicionalmente
{showDialoguePanel && current && (
  <ContextQuestionsPanel
    conversationId={current.id}
    onAnswerSubmit={handleDialogueAnswer}
    onSkip={handleSkipDialogue}
  />
)}
```

**Handlers necessários:**
- `handleDialogueAnswer(answer: string)`: Envia resposta para backend
- `handleSkipDialogue()`: Define `force_analysis: true` e chama analyze-file novamente

### 5. Backend: Salvar Mensagens em dialogue_states/dialogue_messages ⏳
**Status:** Não iniciado

**Arquivo:** `supabase/functions/analyze-file/index.ts`

**O que precisa ser feito:**

```typescript
// Quando readiness.needsCriticalInfo === true (linha ~1346)
// 1. Criar ou atualizar dialogue_state
const { data: dialogueState, error: stateError } = await supabase
  .from('dialogue_states')
  .upsert({
    conversation_id,
    state: 'conversing',
    context_data: readiness.context,
    completeness_score: readiness.context.completeness || 0,
    questions_history: [
      ...(existing_context?.questions_history || []),
      {
        questions: readiness.missingInfo,
        asked_at: new Date().toISOString(),
        answered: false
      }
    ]
  }, { onConflict: 'conversation_id' })
  .select()
  .single();

// 2. Salvar mensagem da LLM em dialogue_messages
await supabase.from('dialogue_messages').insert({
  dialogue_state_id: dialogueState.id,
  message_type: 'llm_question',
  content: readiness.message,
  expects_response: true,
  metadata: {
    suggestions: readiness.enrichmentSuggestions,
    missing_info: readiness.missingInfo
  }
});

// 3. Retornar dialogue_state_id na resposta
return httpJson({
  success: true,
  needs_dialogue: true,
  dialogue_state_id: dialogueState.id,
  // ... resto
}, 200);
```

### 6. Backend: Processar Respostas do Usuário ⏳
**Status:** Não iniciado

**Lógica necessária:**

```typescript
// Quando usuário responde (existing_context existe)
// 1. Atualizar dialogue_state com nova resposta
await supabase
  .from('dialogue_states')
  .update({
    user_responses: {
      ...existing_context.user_responses,
      [new Date().toISOString()]: user_question
    },
    updated_at: new Date().toISOString()
  })
  .eq('conversation_id', conversation_id);

// 2. LLM decide próximo passo:
//    - Se ainda precisa de mais info → nova pergunta
//    - Se tem tudo → statement + confirmation
//    - Se usuário confirmou → iniciar análise

// 3. Salvar nova mensagem da LLM
await supabase.from('dialogue_messages').insert({
  dialogue_state_id,
  message_type: nextStep.type, // 'llm_question', 'llm_statement'
  content: nextStep.message,
  expects_response: nextStep.expects_response,
  metadata: nextStep.metadata
});
```

### 7. Prevenir Loops de Perguntas ⏳
**Status:** Não iniciado

**Lógica necessária no backend:**

```typescript
// Antes de fazer nova pergunta, verificar questions_history
const alreadyAsked = dialogueState.questions_history.some(
  h => h.questions.some(q => isSimilar(q, newQuestion))
);

if (alreadyAsked) {
  // Não perguntar de novo!
  // Usar dados disponíveis OU reformular pergunta OU pular
  console.log('[analyze-file] Pergunta similar já foi feita - pulando');
}
```

### 8. Recuperação de Estado ao Navegar ⏳
**Status:** Não iniciado

**No ChatPage, ao carregar conversa:**

```typescript
useEffect(() => {
  if (!current?.id) return;

  // ... carregar mensagens ...

  // Verificar se existe diálogo ativo
  const checkDialogue = async () => {
    const { data } = await supabase
      .from('dialogue_states')
      .select('*')
      .eq('conversation_id', current.id)
      .eq('state', 'conversing')
      .maybeSingle();

    if (data) {
      setShowDialoguePanel(true);
      setDialogueStateId(data.id);
    }
  };

  checkDialogue();
}, [current?.id]);
```

## 🎯 Fluxo Completo Esperado

### Cenário 1: Primeira Análise com Diálogo

1. **User:** Anexa Excel + "analise vendas"
2. **Backend:** Parseia, vê dados, LLM decide que precisa de contexto
3. **Backend:** Cria `dialogue_state` + `dialogue_message` (llm_question)
4. **Frontend:** Recebe `needs_dialogue: true`
5. **Frontend:** NÃO adiciona ao chat, abre `ContextQuestionsPanel`
6. **Panel:** Carrega histórico do banco, mostra pergunta da LLM
7. **User:** Responde "por região"
8. **Panel:** Salva resposta em `dialogue_messages`
9. **Panel:** Chama `onAnswerSubmit()`
10. **Frontend:** Envia para backend com `existing_context`
11. **Backend:** Atualiza contexto, LLM decide próximo passo
12. **Backend:** Se suficiente → cria `llm_statement` + `llm_question` (confirmation)
13. **Frontend:** Panel recarrega, mostra statement + pergunta "Posso iniciar?"
14. **User:** "Pode ir"
15. **Backend:** Atualiza `state: 'analyzing'`, inicia análise
16. **Backend:** Ao finalizar, atualiza `state: 'completed'`
17. **Frontend:** Esconde painel, mostra resultado da análise no chat

### Cenário 2: Retornar à Conversa Dias Depois

1. **User:** Abre a mesma conversa
2. **Frontend:** `useEffect` detecta conversa carregada
3. **Frontend:** Busca `dialogue_states` where `conversation_id` AND `state != 'completed'`
4. **Frontend:** Se existe → abre `ContextQuestionsPanel`
5. **Panel:** Carrega todo histórico de `dialogue_messages`
6. **Panel:** Mostra conversa de onde parou
7. **User:** Continua de onde parou

## 📊 Progresso Atual

- ✅ Estrutura de dados (25%)
- ✅ Backend: Correção de bugs (10%)
- ✅ Frontend: Novo componente (15%)
- ⏳ Integração ChatPage (0%)
- ⏳ Backend: Persistência (0%)
- ⏳ Backend: Lógica de diálogo (0%)
- ⏳ Prevenção de loops (0%)
- ⏳ Recuperação de estado (0%)
- ⏳ Testes (0%)

**Total: 50% concluído**

## 🚀 Próximos Passos Recomendados

1. **Integrar ChatPage com novo painel** (30 min)
   - Remover lógica antiga de `pendingQuestions`
   - Adicionar handlers `onAnswerSubmit` e `onSkip`
   - Condicionar renderização do painel

2. **Atualizar backend para salvar em dialogue_states/messages** (45 min)
   - Criar/atualizar estado ao retornar `needs_dialogue`
   - Salvar mensagens da LLM
   - Retornar `dialogue_state_id`

3. **Implementar processamento de respostas** (1h)
   - Atualizar estado com respostas
   - LLM decidir próximo passo dinamicamente
   - Salvar novas mensagens

4. **Prevenir loops** (30 min)
   - Verificar `questions_history`
   - Detectar perguntas similares
   - Pular ou reformular

5. **Recuperação de estado** (20 min)
   - `useEffect` no ChatPage
   - Buscar estado ativo
   - Abrir painel se necessário

6. **Testar fluxo completo** (1h)
   - Cenário 1: Primeira análise
   - Cenário 2: Navegar e voltar
   - Cenário 3: Pular diálogo
   - Cenário 4: Loops (não devem acontecer)

## ⚠️ Pontos de Atenção

1. **Não duplicar mensagens**: Quando `needs_dialogue`, NÃO adicionar ao chat principal
2. **Painel nunca desaparece**: Só esconde quando `state === 'completed'`
3. **Campo de input condicional**: Só mostra se última mensagem tem `expects_response: true`
4. **LLM nunca pula para análise**: Sempre pergunta "Posso iniciar?" antes
5. **Histórico persiste**: Mesmo após dias, conversa continua de onde parou

## 🔧 Arquivos Modificados

- ✅ `supabase/migrations/20251011000000_create_dialogue_persistence_tables.sql`
- ✅ `supabase/functions/analyze-file/index.ts` (correção de bug)
- ✅ `src/components/Chat/ContextQuestionsPanel.tsx` (reescrito)
- ⏳ `src/components/Chat/ChatPage.tsx` (precisa integração)

## 🐛 Bugs Corrigidos

1. **dialogueContext is not defined** (linha 1846 de analyze-file/index.ts)
   - **Causa:** Variável usada mas não definida
   - **Fix:** Adicionada definição na linha 1375
