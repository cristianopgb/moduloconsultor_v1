# AÇÕES URGENTES - SISTEMA QUEBRADO

## 🔥 3 PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. Sessão Antiga no Banco (CRÍTICO)
**ID:** `24a2175b-5805-4a18-8939-a23204dd775b`
- Estado errado: `execucao`
- Sem `jornada_id` (null)
- Causa loops infinitos

**SOLUÇÃO:** Execute no Supabase SQL Editor:
```sql
DELETE FROM consultor_sessoes WHERE id = '24a2175b-5805-4a18-8939-a23204dd775b';
DELETE FROM consultor_sessoes WHERE jornada_id IS NULL;
```

### 2. Edge Function com Deno std antiga (CRÍTICO)
**Erro:** `Deno.core.runMicrotasks() is not supported`
- Supabase usa Deno v2.1.4
- Functions usavam `esm.sh` que puxa std@0.177.1

**SOLUÇÃO APLICADA:**
✅ Todos imports mudados de:
```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno';
```

Para:
```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
```

**Arquivos corrigidos:**
- `consultor-rag/index.ts`
- `consultor-rag/orchestrator.ts`
- `consultor-rag/rag-engine.ts`
- `_shared/session-utils.ts`
- `_shared/progress-calculator.ts`
- + 6 outras functions

### 3. Prompt Superficial e Não Profissional (CRÍTICO)
**Problema:** Prompt genérico sem metodologia real de consultoria

**SOLUÇÃO APLICADA:**
✅ Prompt de ANAMNESE completamente reescrito com:
- Quebra-gelo profissional (consultor se apresenta)
- 8 turnos estruturados (profissional → empresa → dores)
- Contexto explicado (por quê de cada pergunta)
- Máximo 2 perguntas por turno
- Síntese e validação ao final
- Tom CEO → CEO (profissional mas acessível)

**Ver detalhes:** `PROMPT_ANAMNESE_PROFISSIONAL_REAL.md`

## ✅ O QUE FAZER AGORA (EM ORDEM)

### PASSO 1: Deletar sessão antiga ✅ FEITO
```sql
-- EXECUTE NO SUPABASE DASHBOARD → SQL EDITOR
DELETE FROM consultor_sessoes WHERE id = '24a2175b-5805-4a18-8939-a23204dd775b';
DELETE FROM consultor_sessoes WHERE jornada_id IS NULL;
SELECT COUNT(*) FROM consultor_sessoes; -- deve ser 0
```

### PASSO 2: Redeploy Edge Function
A function precisa ser redeployada manualmente no Supabase Dashboard:

1. Acesse: **Dashboard → Edge Functions → consultor-rag**
2. Clique em **Deploy**
3. Ou use CLI (se disponível):
   ```bash
   supabase functions deploy consultor-rag
   ```

### PASSO 3: Teste
1. Hard refresh no browser (Ctrl+Shift+R)
2. Iniciar nova conversa no modo Consultor
3. Verificar se:
   - Não há mais erros `Deno.core.runMicrotasks`
   - Consultor pergunta nome e cargo
   - Segue roteiro de anamnese

## 📋 Resumo das Correções no Código

### Prompts Melhorados
- ✅ `ANAMNESE_PROMPT` com roteiro passo-a-passo
- ✅ Formato `[PARTE A]...[PARTE B]` explicado
- ✅ `orchestrator.getPhasePrompt()` mapeia estado → prompt
- ✅ Sistema passa `estado` para selecionar prompt correto

### Imports Atualizados
- ✅ `npm:` specifier (Deno 2 compatible)
- ✅ Remove dependência de `esm.sh`
- ✅ Remove referências a std@0.177.1

### Arquitetura
- ✅ Jornada criada automaticamente com sessão
- ✅ Estado normalizado corretamente
- ✅ Fallback actions quando LLM falha

## 🚨 Se AINDA Não Funcionar Após Deploy

### Verificar Logs da Edge Function
Dashboard → Functions → consultor-rag → Logs

**Procurar por:**
- `[CONSULTOR-RAG] Loaded:`
- `[ORCH] Parsing actions`
- Erros de import ou runtime

### Verificar OPENAI_API_KEY
Se aparecer: `[TEMPLATE-SERVICE] OPENAI_API_KEY not configured`

1. Dashboard → Settings → Edge Functions → Secrets
2. Adicionar: `OPENAI_API_KEY` com valor válido

## 📝 Arquivos Criados/Modificados

### Novos:
- `DELETE_SESSAO_24a2175b.sql` - SQL para deletar sessão
- `ACOES_URGENTES_AGORA.md` - Este arquivo

### Modificados:
- `supabase/functions/consultor-rag/consultor-prompts.ts`
- `supabase/functions/consultor-rag/orchestrator.ts`
- `supabase/functions/consultor-rag/index.ts`
- `supabase/functions/consultor-rag/rag-engine.ts`
- `supabase/functions/_shared/*.ts`
- +6 outras edge functions

## ⚠️ NOTA IMPORTANTE

A edge function **DEVE ser redeployada** para que as mudanças tenham efeito!

Apenas fazer build do frontend NÃO atualiza a edge function no Supabase.
