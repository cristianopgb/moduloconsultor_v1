# COMO FAZER REDEPLOY DA EDGE FUNCTION

## ⚠️ IMPORTANTE

O deploy via Supabase Dashboard (copiar/colar código) **NÃO FUNCIONA** quando a função tem imports de outros arquivos.

## ✅ Solução: Deploy via CLI

### Passo 1: Verificar Supabase CLI

```bash
supabase --version
```

Se não tiver instalado:
```bash
npm install -g supabase
```

### Passo 2: Login no Supabase

```bash
supabase login
```

### Passo 3: Link do Projeto

```bash
supabase link --project-ref gljoasdvlaitplbmbtzg
```

### Passo 4: Deploy da Função

```bash
cd /tmp/cc-agent/59063573/project
supabase functions deploy consultor-rag
```

## 🎯 Resultado Esperado

```
Deploying consultor-rag...
✓ Deployed function consultor-rag
Function URL: https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/consultor-rag
```

## 📋 Checklist Pós-Deploy

1. ✅ Ver logs: `supabase functions logs consultor-rag`
2. ✅ Deletar sessão contaminada:
   ```sql
   DELETE FROM consultor_sessoes
   WHERE id = 'dffcc7c3-dd2b-4979-a124-63330cad49b5';
   ```
3. ✅ Testar no navegador:
   - Hard refresh (Ctrl+Shift+R)
   - Nova conversa
   - Responder perguntas
   - Verificar que não loopa

## 🔍 Logs Esperados

Após o deploy, os logs devem mostrar:

```
[CONSULTOR-RAG] Sessão completa carregada: {
  tem_contexto: true,
  contexto_keys: ["nome", "cargo", "idade"]
}

[RAG-EXECUTOR] Salvando contexto incremental: {...}
[RAG-EXECUTOR] Contexto salvo: ["nome", "cargo", "idade", "formacao"]
```

## ❌ Erro Comum

Se você tentar copiar/colar no Dashboard:
```
Failed to bundle the function (reason: Module not found "file:///tmp/.../prompt.ts")
```

**Solução:** Sempre usar `supabase functions deploy` via CLI!

## 📦 Arquivos da Função

```
supabase/functions/consultor-rag/
├── index.ts              (entrada principal)
├── orchestrator.ts       (lógica de orquestração)
├── consultor-prompts.ts  (prompts por fase)
├── rag-engine.ts         (RAG search)
└── (prompt.ts DELETADO)  (arquivo obsoleto removido)
```

## 🚀 Comando Completo (Copy-Paste)

```bash
\
supabase login && \
supabase link --project-ref gljoasdvlaitplbmbtzg && \
supabase functions deploy consultor-rag && \
echo "✅ Deploy concluído!"
```

---

**CRÍTICO:** Sempre use CLI para deploy de funções com múltiplos arquivos!
