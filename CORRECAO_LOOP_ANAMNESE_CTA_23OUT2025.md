# CORREÇÃO REAL DO LOOP - CONTEXTO PERDIDO

## 🎯 Causa Raiz Identificada

Você estava **COMPLETAMENTE CERTO**: o problema era **ESTRUTURAL**, não de prompt.

### O Problema REAL

**O LLM não tinha acesso ao contexto já coletado no banco!**

```typescript
// ANTES (ERRO):
const { sessao, messages } = body;  // sessao vem do frontend, SEM contexto!

const systemPrompt = orchestrator.getSystemPrompt({
  empresa: sessao.empresa,
  setor: sessao.setor,
  // ... SEM passar contexto_coleta!
});
```

**Resultado:**
- LLM só via histórico de MENSAGENS
- NÃO via o que já foi ARMAZENADO no `contexto_coleta` do banco
- Repetia perguntas porque não sabia que já tinha os dados

---

## ✅ Correção Estrutural Aplicada

### 1. **Buscar Sessão Completa do Banco**

```typescript
// AGORA: Busca sessão COMPLETA do banco
const { data: sessaoCompleta } = await supabase
  .from('consultor_sessoes')
  .select('*')
  .eq('id', sessao.id)
  .maybeSingle();

console.log('[CONSULTOR-RAG] Sessão completa carregada:', {
  id: sessaoCompleta.id,
  estado: sessaoCompleta.estado_atual,
  tem_contexto: !!sessaoCompleta.contexto_coleta,  // ← CRÍTICO!
  empresa: sessaoCompleta.empresa,
  setor: sessaoCompleta.setor
});
```

### 2. **Extrair Contexto Coletado**

```typescript
// Extrair dados já coletados
const contextoColeta = sessaoCompleta.contexto_coleta || {};

console.log('[CONSULTOR-RAG] Contexto coletado:', {
  keys: Object.keys(contextoColeta),
  dados: contextoColeta
});
```

### 3. **Passar Contexto para o System Prompt**

```typescript
// Passar contexto pro LLM
const systemPrompt = orchestrator.getSystemPrompt({
  empresa: sessaoCompleta.empresa,
  setor: sessaoCompleta.setor,
  adapter,
  kb,
  estado: estadoNormalizado,
  contextoColeta  // ← NOVO! Dados já coletados
});
```

### 4. **Modificar `getSystemPrompt` para Incluir Contexto**

**Arquivo:** `orchestrator.ts`

```typescript
getSystemPrompt(params: {
  // ... params existentes ...
  contextoColeta?: Record<string, any>;  // ← NOVO PARÂMETRO
}): string {
  
  // Formatar contexto já coletado
  const contexto = params.contextoColeta || {};
  const contextoStr = Object.keys(contexto).length > 0
    ? Object.entries(contexto)
        .map(([k, v]) => `  - ${k}: ${JSON.stringify(v)}`)
        .join('\n')
    : '  (nenhum dado coletado ainda)';

  return `${phase.systemPrompt}

# CONTEXTO JÁ COLETADO DA SESSÃO

Os seguintes dados JÁ foram coletados (NÃO pergunte novamente):
${contextoStr}

# CONTEXTO ADICIONAL DO SETOR
...
`;
}
```

---

## 🔍 Exemplo de Contexto Passado ao LLM

### Sessão com Dados Coletados:

```json
{
  "nome": "Cristiano Pereira",
  "cargo": "sócio diretor",
  "idade": "48 anos",
  "formacao": "adm com MBA logística",
  "localizacao": "Brasília-DF",
  "experiencia": "15 anos de gestão",
  "empresa": "Helpers BPO",
  "segmento": "consultoria financeira e BPO financeiro"
}
```

### System Prompt Agora Inclui:

```
# CONTEXTO JÁ COLETADO DA SESSÃO

Os seguintes dados JÁ foram coletados (NÃO pergunte novamente):
  - nome: "Cristiano Pereira"
  - cargo: "sócio diretor"
  - idade: "48 anos"
  - formacao: "adm com MBA logística"
  - localizacao: "Brasília-DF"
  - experiencia: "15 anos de gestão"
  - empresa: "Helpers BPO"
  - segmento: "consultoria financeira e BPO financeiro"
```

**Agora o LLM sabe EXATAMENTE o que já foi coletado!**

---

## Arquivos Modificados

### 1. `supabase/functions/consultor-rag/index.ts`

**Linhas 64-85:** Busca sessão completa do banco
```typescript
const { data: sessaoCompleta } = await supabase
  .from('consultor_sessoes')
  .select('*')
  .eq('id', sessao.id)
  .maybeSingle();
```

**Linhas 116-117:** Extrai contexto coletado
```typescript
const contextoColeta = sessaoCompleta.contexto_coleta || {};
```

**Linhas 127-135:** Passa contexto pro system prompt
```typescript
const systemPrompt = orchestrator.getSystemPrompt({
  // ...
  contextoColeta  // NOVO!
});
```

### 2. `supabase/functions/consultor-rag/orchestrator.ts`

**Linhas 145-152:** Adiciona parâmetro `contextoColeta`
**Linhas 166-180:** Formata e inclui contexto no prompt

---

## Diferenças Antes x Depois

| Aspecto | ANTES | DEPOIS |
|---------|-------|--------|
| **Fonte de dados** | `sessao` do body (frontend) | `sessaoCompleta` do banco |
| **Contexto coletado** | ❌ Não tinha | ✅ Lê do `contexto_coleta` |
| **LLM vê dados?** | ❌ Só via mensagens | ✅ Vê tudo que foi armazenado |
| **Repete perguntas?** | ❌ Sim | ✅ Não |
| **System prompt** | Genérico | Personalizado com contexto |

---

## Logs Esperados Após Fix

```
[CONSULTOR-RAG] Sessão completa carregada: {
  id: "e5821219-5181-4195-8b76-e583a8d04d14",
  estado: "coleta",
  tem_contexto: true,  ← TRUE significa tem dados!
  empresa: "Helpers BPO",
  setor: "BPO Financeiro"
}

[CONSULTOR-RAG] Loaded: {
  adapter: "none",
  kb_docs: 0,
  estado_normalizado: "coleta",
  contexto_keys: ["nome", "cargo", "idade", "formacao", "localizacao", "empresa", "segmento"]
}
```

---

## Por Que Estava Loopando?

### ANTES:
1. User: "Cristiano, sócio diretor"
2. Frontend armazena no banco: `contexto_coleta.nome = "Cristiano"`
3. Próxima mensagem: Edge function recebe `sessao` do frontend
4. **MAS `sessao` NÃO INCLUI `contexto_coleta`!**
5. LLM não sabe que já tem o nome
6. Pergunta de novo: "Qual seu nome?"
7. User: "já respondi"
8. Loop infinito...

### DEPOIS:
1. User: "Cristiano, sócio diretor"
2. Frontend armazena no banco
3. Próxima mensagem: Edge function **BUSCA SESSÃO COMPLETA DO BANCO**
4. Extrai `contexto_coleta` com todos os dados
5. Passa pro LLM via system prompt
6. LLM VÊ: "nome já coletado = Cristiano"
7. Pula para PRÓXIMA pergunta: "Qual sua idade?"
8. **SEM LOOP!**

---

## Estrutura de Dados

### Tabela `consultor_sessoes`:

```sql
CREATE TABLE consultor_sessoes (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  jornada_id uuid,
  estado_atual text,
  empresa text,
  setor text,
  contexto_coleta jsonb,  ← AQUI ficam os dados coletados!
  ...
);
```

### Exemplo de `contexto_coleta`:

```json
{
  "nome": "Cristiano Pereira",
  "cargo": "sócio diretor",
  "idade": "48 anos",
  "formacao": "adm com MBA logística",
  "localizacao": "Brasília-DF",
  "tempo_empresa": "15 anos de gestão",
  "empresa": "Helpers BPO",
  "segmento": "consultoria financeira e BPO financeiro",
  "faturamento": "200-500k mensal",
  "funcionarios": "15 colaboradores",
  "tempo_mercado": "8 anos",
  "processos_documentados": "não",
  "dor_principal": "desorganização processos",
  "expectativa": "escalar sem perder qualidade"
}
```

---

## Como Funciona o Fluxo Correto

```
┌─────────────────────────────────────────────────────────┐
│ 1. User envia mensagem                                  │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Frontend chama consultor-rag                         │
│    body: { sessao: {id, estado}, messages: [...] }     │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Edge Function BUSCA SESSÃO COMPLETA do banco        │
│    SELECT * FROM consultor_sessoes WHERE id = ...       │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Extrai contexto_coleta (dados já coletados)         │
│    contexto = sessaoCompleta.contexto_coleta            │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Monta System Prompt COM CONTEXTO                     │
│    "Dados já coletados: nome=X, cargo=Y..."            │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 6. LLM recebe:                                          │
│    - System prompt com contexto                         │
│    - Histórico de mensagens                             │
│    - Sabe o que já foi perguntado E armazenado!        │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 7. LLM decide próxima pergunta correta                  │
│    (não repete o que já tem)                            │
└─────────────────────────────────────────────────────────┘
```

---

## Status

- ✅ Correção estrutural aplicada
- ✅ Busca sessão completa do banco
- ✅ Extrai e passa contexto_coleta
- ✅ System prompt mostra dados já coletados
- ✅ Build completo sem erros
- ⏳ **PENDENTE: Redeploy da edge function consultor-rag**

---

## Próximos Passos

1. **DELETAR SESSÃO CONTAMINADA:**
   ```sql
   DELETE FROM consultor_sessoes WHERE id = 'e5821219-5181-4195-8b76-e583a8d04d14';
   ```

2. **REDEPLOY EDGE FUNCTION:**
   ```bash
   supabase functions deploy consultor-rag
   ```

3. **TESTAR COM NOVA SESSÃO:**
   - Hard refresh (Ctrl+Shift+R)
   - Iniciar nova conversa
   - Responder perguntas
   - Verificar que NÃO repete

---

## Conclusão

O problema NÃO era:
- ❌ Prompt mal escrito
- ❌ Histórico concatenado
- ❌ LLM não seguindo instruções

O problema ERA:
- ✅ **LLM não tinha acesso ao contexto armazenado no banco**
- ✅ **Edge function só recebia dados do frontend, não buscava do banco**
- ✅ **Faltava passar `contexto_coleta` pro system prompt**

Agora está ESTRUTURALMENTE correto!
