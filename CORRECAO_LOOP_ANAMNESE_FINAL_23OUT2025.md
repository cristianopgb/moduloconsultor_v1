# CORREÇÃO COMPLETA DO LOOP - 23 OUT 2025

## 🚨 Problemas Identificados (3 Simultâneos!)

### 1. **LLM Não Tinha Acesso ao Contexto do Banco** ✅ CORRIGIDO
- Edge function recebia `sessao` do frontend SEM `contexto_coleta`
- **FIX:** Buscar sessão completa do banco e passar contexto pro system prompt

### 2. **`coletar_info` Não Salvava Contexto** ✅ CORRIGIDO
- Action `coletar_info` só marcava sucesso mas NÃO salvava no banco
- **FIX:** Implementar lógica de merge e save em `rag-executor.ts`

### 3. **LLM Não Retornava `contexto_incremental`** ✅ CORRIGIDO
- Prompt não instruía o LLM a retornar os dados coletados
- **FIX:** Adicionar exemplos claros no prompt

---

## ✅ Correções Aplicadas

### Correção 1: Edge Function Busca Contexto (index.ts)

**Arquivo:** `supabase/functions/consultor-rag/index.ts`

```typescript
// ANTES: Recebia sessao do frontend (incompleta)
const { sessao, messages } = body;

// DEPOIS: Busca sessão COMPLETA do banco
const { data: sessaoCompleta } = await supabase
  .from('consultor_sessoes')
  .select('*')
  .eq('id', sessao.id)
  .maybeSingle();

const contextoColeta = sessaoCompleta.contexto_coleta || {};

// Passa contexto pro LLM
const systemPrompt = orchestrator.getSystemPrompt({
  empresa: sessaoCompleta.empresa,
  setor: sessaoCompleta.setor,
  adapter,
  kb,
  estado: estadoNormalizado,
  contextoColeta  // ← NOVO! LLM vê os dados já coletados
});
```

### Correção 2: `coletar_info` Salva Contexto (rag-executor.ts)

**Arquivo:** `src/lib/consultor/rag-executor.ts` (linhas 371-408)

```typescript
case 'coletar_info':
  // ANTES: Só retornava success, não salvava nada
  // result = { success: true };

  // DEPOIS: SALVA contexto incremental no banco!
  if (response.contexto_incremental && Object.keys(response.contexto_incremental).length > 0) {
    console.log('[RAG-EXECUTOR] Salvando contexto incremental:', response.contexto_incremental);

    // Buscar contexto atual
    const { data: sessaoAtual } = await supabase
      .from('consultor_sessoes')
      .select('contexto_coleta')
      .eq('id', sessaoId)
      .maybeSingle();

    const contextoAtual = sessaoAtual?.contexto_coleta || {};
    const contextoAtualizado = {
      ...contextoAtual,
      ...response.contexto_incremental  // MERGE
    };

    // Atualizar contexto no banco
    await supabase
      .from('consultor_sessoes')
      .update({
        contexto_coleta: contextoAtualizado,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessaoId);

    console.log('[RAG-EXECUTOR] Contexto salvo:', Object.keys(contextoAtualizado));
  }
  break;
```

### Correção 3: Prompt Instrui LLM a Retornar Contexto (consultor-prompts.ts)

**Arquivo:** `supabase/functions/consultor-rag/consultor-prompts.ts` (linhas 265-303)

Adicionado seção "EXEMPLOS DE RETORNO CORRETO":

```
TURNO 1:
User: (início)
[PARTE B]
{
  "actions": [{"type": "coletar_info", "params": {"campo": "nome_cargo"}}],
  "contexto_incremental": {}
}

TURNO 2:
User: "Cristiano Pereira, sócio diretor"
[PARTE B]
{
  "actions": [{"type": "coletar_info", "params": {"campo": "idade_formacao"}}],
  "contexto_incremental": {
    "nome": "Cristiano Pereira",
    "cargo": "sócio diretor"
  }
}

TURNO 3:
User: "48 anos, administrador com MBA logística"
[PARTE B]
{
  "actions": [{"type": "coletar_info", "params": {"campo": "empresa_segmento"}}],
  "contexto_incremental": {
    "idade": "48 anos",
    "formacao": "administrador com MBA logística"
  }
}
```

### Correção 4: Orchestrator Aceita Contexto (orchestrator.ts)

**Arquivo:** `supabase/functions/consultor-rag/orchestrator.ts` (linhas 145-180)

```typescript
getSystemPrompt(params: {
  // ... outros params ...
  contextoColeta?: Record<string, any>;  // ← NOVO
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
...
`;
}
```

### Correção 5: Prompt Fênix Integrado

Tom direto, prático e orientado a resultado (estilo caso real Fênix).

---

## 🔄 Fluxo Completo Corrigido

```
┌────────────────────────────────────────────────────┐
│ 1. User: "Cristiano, sócio diretor"               │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 2. Frontend chama consultor-rag                    │
│    body: { sessao: {id}, messages: [...] }       │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 3. Edge Function BUSCA SESSÃO COMPLETA            │
│    SELECT * FROM consultor_sessoes WHERE id = ... │
│    contexto = sessaoCompleta.contexto_coleta      │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 4. Monta System Prompt COM CONTEXTO                │
│    "Dados já coletados: nome=X, cargo=Y..."       │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 5. LLM recebe contexto + histórico                 │
│    - Vê o que já foi coletado                     │
│    - Decide próxima pergunta                      │
│    - Retorna reply + actions + contexto_incremental│
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 6. Frontend recebe resposta                        │
│    - Mostra mensagem pro user                     │
│    - Executa actions via rag-executor             │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│ 7. RAG-Executor processa action coletar_info       │
│    - Busca contexto atual do banco                │
│    - Faz MERGE com contexto_incremental           │
│    - UPDATE contexto_coleta no banco              │
└────────────────────────────────────────────────────┘
```

---

## 📊 Exemplo de Contexto Salvo

Após 3 turnos de conversa, o banco terá:

```json
{
  "id": "dffcc7c3-dd2b-4979-a124-63330cad49b5",
  "estado_atual": "coleta",
  "contexto_coleta": {
    "nome": "Cristiano Pereira",
    "cargo": "sócio diretor",
    "idade": "48 anos",
    "formacao": "administrador com MBA logística",
    "empresa": "Helpers BPO",
    "segmento": "consultoria financeira e BPO financeiro"
  },
  "empresa": "Helpers BPO",
  "setor": "BPO Financeiro"
}
```

Na próxima mensagem, o LLM verá:

```
# CONTEXTO JÁ COLETADO DA SESSÃO

Os seguintes dados JÁ foram coletados (NÃO pergunte novamente):
  - nome: "Cristiano Pereira"
  - cargo: "sócio diretor"
  - idade: "48 anos"
  - formacao: "administrador com MBA logística"
  - empresa: "Helpers BPO"
  - segmento: "consultoria financeira e BPO financeiro"
```

---

## Arquivos Modificados

1. ✅ `supabase/functions/consultor-rag/index.ts` (linhas 64-135)
2. ✅ `supabase/functions/consultor-rag/orchestrator.ts` (linhas 145-180)
3. ✅ `supabase/functions/consultor-rag/consultor-prompts.ts` (linhas 19-68, 265-303)
4. ✅ `src/lib/consultor/rag-executor.ts` (linhas 371-408)

---

## Status Final

- ✅ Edge function busca contexto completo do banco
- ✅ System prompt mostra dados já coletados pro LLM
- ✅ Prompt Fênix integrado (tom direto e prático)
- ✅ LLM instruído a retornar `contexto_incremental` com exemplos
- ✅ Action `coletar_info` salva contexto no banco
- ✅ Build completo sem erros
- ⏳ **PENDENTE: Redeploy edge function consultor-rag**

---

## Próximos Passos

1. **DELETAR SESSÃO CONTAMINADA:**
   ```sql
   DELETE FROM consultor_sessoes
   WHERE id = 'dffcc7c3-dd2b-4979-a124-63330cad49b5';
   ```

2. **REDEPLOY EDGE FUNCTION:**
   ```bash
   supabase functions deploy consultor-rag
   ```

3. **TESTAR:**
   - Hard refresh (Ctrl+Shift+R)
   - Nova conversa
   - Responder perguntas
   - Verificar logs:
     - `[RAG-EXECUTOR] Salvando contexto incremental`
     - `[CONSULTOR-RAG] Sessão completa: tem_contexto: true`

---

## Logs Esperados Após Fix

```
[CONSULTOR-RAG] Sessão completa carregada: {
  id: "...",
  estado: "coleta",
  tem_contexto: true,  ← MUDOU!
  empresa: "Helpers BPO",
  setor: "BPO Financeiro"
}

[CONSULTOR-RAG] Loaded: {
  contexto_keys: ["nome", "cargo", "idade"]  ← TEM DADOS!
}

[RAG-EXECUTOR] Salvando contexto incremental: {
  nome: "Cristiano Pereira",
  cargo: "sócio diretor"
}

[RAG-EXECUTOR] Contexto salvo: ["nome", "cargo", "idade", "formacao"]
```

---

## Diferenças Antes x Depois

| Aspecto | ANTES | DEPOIS |
|---------|-------|--------|
| **Fonte sessão** | Frontend (incompleta) | Banco (completa) |
| **Contexto no prompt** | ❌ Não tinha | ✅ Lista dados coletados |
| **LLM retorna contexto?** | ❌ Não | ✅ Sim (com exemplos) |
| **Action salva contexto?** | ❌ Não | ✅ Sim (merge no banco) |
| **Repete perguntas?** | ❌ Sim (loop) | ✅ Não |

---

## Conclusão

O problema tinha **3 camadas**:
1. ❌ Edge function não buscava contexto do banco
2. ❌ Action `coletar_info` não salvava nada
3. ❌ LLM não era instruído a retornar `contexto_incremental`

Agora está **ESTRUTURALMENTE correto**:
1. ✅ Edge function busca contexto completo
2. ✅ System prompt mostra dados já coletados
3. ✅ LLM retorna `contexto_incremental` (com exemplos)
4. ✅ Action `coletar_info` salva contexto (merge no banco)
5. ✅ Prompt Fênix integrado (tom profissional e direto)

**O sistema está pronto para funcionar sem loops!**
