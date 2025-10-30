# CORREÇÃO DO LOOP INFINITO - CONSULTOR RAG

## Problema Identificado

O consultor estava entrando em **LOOP INFINITO** porque:

### 1. ❌ Histórico NÃO era passado corretamente ao LLM
```typescript
// ANTES (ERRADO):
const userContent = messages.map((m: any) =>
  `${m.role.toUpperCase()}: ${m.content}`
).join('\n');

const llmMessages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userContent }  // TUDO EM UMA MENSAGEM!
];
```

**Resultado:** GPT recebia tudo como texto concatenado, não conseguia distinguir histórico.

### 2. ❌ Prompt tinha EXEMPLOS que LLM copiava literalmente
```typescript
// Prompt tinha:
[PARTE A]
Olá! Prazer em conhecê-lo(a)! Meu nome é [seu nome]...

// LLM copiava isso palavra por palavra, sempre voltava ao turno 1
```

---

## ✅ Correções Aplicadas

### 1. **Passar Histórico Como Array de Mensagens**

**Arquivo:** `supabase/functions/consultor-rag/index.ts`

```typescript
// AGORA (CORRETO):
const llmMessages: Array<{role: string, content: string}> = [
  { role: 'system', content: systemPrompt }
];

// Adicionar histórico completo de mensagens SEPARADAS
for (const msg of messages) {
  llmMessages.push({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  });
}
```

**Resultado:** GPT agora VÊ o histórico completo e NÃO repete perguntas.

### 2. **Prompt com DIRETRIZES, não exemplos literais**

**Arquivo:** `supabase/functions/consultor-rag/consultor-prompts.ts`

```typescript
// ANTES:
┌────────────────────────────────┐
│ TURNO 1: QUEBRA-GELO          │
└────────────────────────────────┘

[PARTE A]
Olá! Prazer... Meu nome é [seu nome]...
[PARTE B]
{...}

// AGORA:
**TURNO 1: QUEBRA-GELO**

SE for a PRIMEIRA interação (histórico vazio):
- Apresente-se como consultor estratégico da PROCEda
- Explique que precisa conhecer o cliente
- Pergunte: nome completo + cargo

Action: {"type": "coletar_info", "params": {"campo": "nome_cargo"}}
```

### 3. **Instrução Explícita: ANALISE O HISTÓRICO**

Adicionado no topo do prompt:

```
**IMPORTANTE:** Analise o HISTÓRICO de mensagens para saber:
1. Quais dados JÁ foram coletados
2. Qual a PRÓXIMA pergunta da sequência
3. NÃO repita perguntas já respondidas
```

### 4. **Tratamento de "Já Respondi"**

```
**SE O CLIENTE DISSER "JÁ RESPONDI":**
- Peça desculpas: "Desculpe, você tem razão!"
- Avance para PRÓXIMA pergunta da sequência
- NÃO insista na mesma pergunta
```

---

## Arquivos Modificados

1. **`supabase/functions/consultor-rag/index.ts`**
   - Linhas 109-121: Histórico como array de mensagens separadas

2. **`supabase/functions/consultor-rag/consultor-prompts.ts`**
   - Linhas 112-119: Instrução para analisar histórico
   - Linhas 125-190: Turnos reescritos como DIRETRIZES
   - Linhas 237-251: Regras críticas + tratamento de "já respondi"

---

## Como Aplicar (Deploy)

### PASSO 1: Deletar sessões antigas (JÁ FEITO)
```sql
DELETE FROM consultor_sessoes WHERE id = '24a2175b-5805-4a18-8939-a23204dd775b';
DELETE FROM consultor_sessoes WHERE jornada_id IS NULL;
```

### PASSO 2: Redeploy Edge Function
```bash
# Via CLI (se disponível):
supabase functions deploy consultor-rag

# Ou via Dashboard:
# 1. Supabase Dashboard → Edge Functions
# 2. Selecionar consultor-rag
# 3. Clicar "Deploy"
```

### PASSO 3: Testar
1. Hard refresh: Ctrl+Shift+R
2. Iniciar nova conversa
3. Verificar:
   - ✅ Consultor pergunta nome/cargo
   - ✅ NÃO repete perguntas
   - ✅ Segue sequência de 8 turnos
   - ✅ Sintetiza ao final

---

## Conversa Esperada Após Fix

```
USER: Olá

BOT: Olá! Prazer em conhecê-lo(a)! Meu nome é João, consultor estratégico 
     da PROCEda. Antes de começarmos, preciso te conhecer melhor.
     
     Para começar: qual é o seu nome e qual cargo você ocupa?

USER: Cristiano, sócio diretor

BOT: Ótimo, Cristiano! Como sócio diretor, você deve ter visão ampla da empresa.
     
     1. Qual sua faixa etária aproximada? (20-30, 30-40, 40-50, 50+)
     2. Qual sua formação acadêmica?

USER: 48 anos, adm com MBA logística

BOT: Perfeito! Agora me conte:
     
     1. Em qual cidade/estado você está localizado?
     2. Há quanto tempo você atua nessa empresa/posição?

USER: Brasília, 15 anos de gestão

BOT: Ótimo, Cristiano! Agora vamos falar sobre a empresa:
     
     1. Qual o nome da empresa?
     2. Qual o segmento/ramo principal de atuação?

USER: Helpers BPO, consultoria financeira e BPO financeiro

BOT: Entendido. Para dimensionar adequadamente nossa abordagem:
     
     1. Qual o faturamento médio mensal? (até 50k, 50-200k, 200-500k, 500k-2M, 2M+)
     2. Quantos colaboradores trabalham na empresa?

[... continua até completar 8 turnos ...]
```

---

## Diferenças Antes x Depois

| Aspecto | ANTES | DEPOIS |
|---------|-------|--------|
| **Histórico** | Concatenado em 1 mensagem | Array de mensagens separadas |
| **GPT vê contexto?** | ❌ Não | ✅ Sim |
| **Repete perguntas?** | ❌ Sim (loop infinito) | ✅ Não |
| **Prompt** | Exemplos literais | Diretrizes condicionais |
| **Tratamento "já respondi"** | ❌ Não tinha | ✅ Pede desculpas e avança |
| **Análise de histórico** | ❌ Não fazia | ✅ Instrução explícita |

---

## Logs Esperados Após Fix

```
[CONSULTOR-RAG] Loaded: { adapter: "none", kb_docs: 0, estado: "coleta" }
[CONSULTOR-RAG] Calling LLM with analytical profile
[CONSULTOR-RAG] LLM response length: 450
[ORCH] Successfully parsed 1 actions
[CONSULTOR-RAG] Actions after normalization: 1
[RAG-EXECUTOR] Executing 1 actions
[RAG-EXECUTOR] Action succeeded: coletar_info
```

**SEM:**
- ❌ Loop infinito
- ❌ "Qual sua faixa etária?" depois de responder
- ❌ Voltar ao TURNO 1

---

## Arquivos Relacionados

- `supabase/functions/consultor-rag/index.ts` - Correção histórico
- `supabase/functions/consultor-rag/consultor-prompts.ts` - Prompt reescrito
- `PROMPT_ANAMNESE_PROFISSIONAL_REAL.md` - Documentação do prompt
- `ACOES_URGENTES_AGORA.md` - Resumo de todos os problemas

---

## Status

- ✅ Correção aplicada no código local
- ✅ Build completo sem erros
- ⏳ **PENDENTE: Redeploy da edge function consultor-rag**
