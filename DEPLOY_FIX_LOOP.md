# 🚀 DEPLOY DAS CORREÇÕES - FIX LOOP CONSULTOR

## ✅ Problemas Corrigidos

### 1. **Loop Infinito na Validação de Escopo** ❌➡️✅
**Problema:** Sistema ficava preso em "aguardando validação de escopo"
**Causa:** Linha 660 do `index.ts` reabria a validação ao transicionar
**Correção:** Removida lógica que reabria validação após transição

### 2. **Consultor Pedindo User Preencher GUT** ❌➡️✅
**Problema:** LLM pedia valores GUT ao invés de inferir automaticamente
**Causa:** Prompt ambíguo ("pergunte ou infira")
**Correção:** Prompt reforçado para **SEMPRE INFERIR** valores automaticamente

### 3. **Entregáveis Não Preenchidos** ⚠️
**Status:** Aguardando validação
**Causa Possível:** Templates podem estar falhando ao preencher HTML
**Ação:** Testar após deploy

---

## 📋 Arquivos Modificados

1. ✅ `supabase/functions/consultor-rag/index.ts` (linha 659-661)
2. ✅ `supabase/functions/consultor-rag/consultor-prompts.ts` (linha 829-838)

---

## 🎯 COMO FAZER O DEPLOY

### Opção 1: Via Supabase CLI (Recomendado)

```bash
# 1. Login no Supabase
supabase login

# 2. Link ao projeto (se necessário)
supabase link --project-ref SEU_PROJECT_REF

# 3. Deploy da função
supabase functions deploy consultor-rag
```

### Opção 2: Via Dashboard Supabase

1. Acesse: https://supabase.com/dashboard/project/SEU_PROJECT/functions
2. Clique em "consultor-rag"
3. Clique em "Edit function"
4. Cole o conteúdo corrigido dos arquivos:
   - `index.ts`
   - `consultor-prompts.ts`
5. Clique em "Deploy"

---

## 🧪 COMO TESTAR APÓS DEPLOY

### 1. Resetar Sessão Atual (Opcional)

```sql
-- Execute no SQL Editor do Supabase
UPDATE consultor_sessoes
SET
  aguardando_validacao = NULL,
  estado_atual = 'anamnese'
WHERE id = '80b0801f-fd27-437a-9cad-b405c6c24586';
```

### 2. Testar Fluxo Completo

1. **Inicie nova conversa** no modo Consultor
2. **Complete anamnese** (responda 7-10 perguntas)
3. **Sistema gera Canvas + Cadeia de Valor** automaticamente ✅
4. **Sistema faz investigação** (Ishikawa + 5 Porquês) ✅
5. **Sistema apresenta Matriz GUT PRONTA** (não pede valores!) ✅
6. **Você diz "sim" ou "perfeito"** para aprovar
7. **Sistema avança para mapeamento** (SEM LOOP!) ✅

### 3. Validar Logs

Acesse: https://supabase.com/dashboard/project/SEU_PROJECT/logs/edge-functions

**Logs esperados após correção:**

```
✅ [CONSULTOR] Phase transition: priorizacao -> mapeamento_processos
✅ [CONSULTOR] Limpar flag de validação
❌ NÃO DEVE APARECER: "Waiting for scope validation" após transição
```

---

## 🔍 Verificar Correções Aplicadas

### Verificação 1: Loop Corrigido

```bash
# Buscar no código (deve retornar VAZIO)
grep -n "aguardandoValidacaoNova = 'escopo'" supabase/functions/consultor-rag/index.ts
```

**Resultado esperado:** Nenhuma linha (linha 660 foi removida)

### Verificação 2: Prompt Corrigido

```bash
# Buscar no prompt
grep -A 5 "INFIRA AUTOMATICAMENTE" supabase/functions/consultor-rag/consultor-prompts.ts
```

**Resultado esperado:**
```
INFIRA AUTOMATICAMENTE** os valores GUT baseado no contexto coletado:
   - Gravidade (1-5): Analise o impacto do problema no negócio
   - Urgência (1-5): Avalie o tempo disponível baseado nas dores relatadas
   - Tendência (1-5): Estime se o problema tende a piorar
   **⚠️ CRÍTICO: NÃO PEÇA esses valores ao usuário!
```

---

## ⚠️ ROLLBACK (Se Necessário)

Se algo der errado após deploy:

```bash
# Reverter para versão anterior
supabase functions deploy consultor-rag --version VERSAO_ANTERIOR
```

Ou via Dashboard:
1. Edge Functions > consultor-rag
2. Versions tab
3. Clique em "Rollback" na versão anterior

---

## 📊 Métricas de Sucesso

Após deploy e teste:

- [ ] Conversa completa sem loops
- [ ] Matriz GUT apresentada automaticamente (não pede valores)
- [ ] Transição priorizacao → mapeamento_processos funciona
- [ ] Entregáveis gerados com HTML preenchido
- [ ] Timeline registra todas as fases

---

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique logs da Edge Function**
2. **Verifique estado da sessão no banco**:
   ```sql
   SELECT
     estado_atual,
     aguardando_validacao,
     progresso,
     contexto_coleta
   FROM consultor_sessoes
   WHERE id = 'SUA_SESSAO_ID';
   ```
3. **Compartilhe screenshots dos erros**

---

**Data:** 2025-11-04
**Versão:** Fix Loop v1.0
**Status:** ✅ Pronto para deploy
