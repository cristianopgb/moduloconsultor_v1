# Guia de Deploy - Analytics V2

## ✅ Pré-requisitos

- Conta Supabase ativa
- Projeto Supabase configurado
- Acesso ao Supabase CLI (já instalado no projeto)
- OpenAI API Key configurada nas Edge Functions

---

## 📋 Checklist de Deploy

### Passo 1: Aplicar Migrations no Banco de Dados

As migrations criam a nova tabela `data_analyses` e a função RPC `exec_sql_secure`.

#### Via Supabase Dashboard (Recomendado):

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Crie uma nova query
5. Copie e cole o conteúdo de:
   - `supabase/migrations/20251008000000_create_data_analyses_table.sql`
6. Execute a query
7. Repita para:
   - `supabase/migrations/20251008000001_create_exec_sql_secure.sql`

#### Via Supabase CLI (Alternativa):

```bash
# No diretório do projeto
npx supabase db push

# Ou se tiver Supabase CLI instalado globalmente
supabase db push
```

#### Verificação:

Execute no SQL Editor:
```sql
-- Verifica se a tabela foi criada
SELECT * FROM data_analyses LIMIT 1;

-- Verifica se a função existe
SELECT exec_sql_secure('SELECT 1 as test');
```

Resultado esperado: Query executa sem erros.

---

### Passo 2: Deploy da Edge Function `analyze-file`

#### Via Supabase Dashboard:

1. Acesse **Edge Functions** no dashboard
2. Clique em **Create a new function**
3. Nome: `analyze-file`
4. Copie todo o conteúdo de:
   - `supabase/functions/analyze-file/index.ts`
5. Cole no editor
6. Clique em **Deploy function**

#### Via Supabase CLI (Alternativa):

```bash
# Deploy da função
npx supabase functions deploy analyze-file

# Ou se CLI global
supabase functions deploy analyze-file
```

#### Verificação:

Teste via curl:
```bash
curl -X POST \
  'https://SEU_PROJECT_ID.supabase.co/functions/v1/analyze-file' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "file_data": "data,product,value\n2024-01-01,A,100\n2024-01-02,B,200",
    "filename": "test.csv",
    "user_question": "Qual o total de vendas?"
  }'
```

Resultado esperado: JSON com `"success": true`

---

### Passo 3: Verificar Variáveis de Ambiente

As Edge Functions precisam das seguintes variáveis:

```bash
SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu_service_role_key
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
```

#### Configurar no Dashboard:

1. Vá em **Edge Functions** → **Settings**
2. Clique em **Add secret**
3. Adicione cada variável acima
4. **Importante:** Service role key está em Settings → API

---

### Passo 4: Deploy do Frontend

O frontend já foi modificado e está pronto. Apenas faça o deploy normal:

```bash
# Build
npm run build

# Deploy (depende da sua plataforma)
# Vercel, Netlify, etc
```

---

## 🧪 Testar o Sistema Completo

### Teste 1: Upload e Análise

1. Acesse sua aplicação
2. Faça login
3. Crie uma nova conversa
4. Clique no botão Analytics (ícone de gráfico)
5. Anexe uma planilha de teste (use arquivo de exemplo abaixo)
6. Digite: "Analise estes dados"
7. Aguarde ~10-15 segundos

**Resultado Esperado:**
- Resumo executivo aparece
- Insights com confiança (high/medium/low)
- Métricas formatadas (R$, %, etc)
- Gráficos renderizados (se aplicável)
- Mensagem: "Análise executada em X linhas"

### Arquivo de Teste (vendas.csv)

```csv
data,produto,categoria,quantidade,valor
2024-01-15,Notebook,Eletrônicos,5,5000
2024-01-20,Mouse,Periféricos,20,400
2024-02-10,Teclado,Periféricos,15,750
2024-02-15,Monitor,Eletrônicos,8,3200
2024-03-05,Webcam,Periféricos,12,600
2024-03-20,Headset,Periféricos,10,500
```

Perguntas de teste:
- "Qual o total de vendas por mês?"
- "Top 3 produtos mais vendidos"
- "Compare vendas de Eletrônicos vs Periféricos"

---

## 🔍 Troubleshooting

### Erro: "Function not found: analyze-file"

**Causa:** Edge Function não foi deployada corretamente

**Solução:**
1. Verifique no Dashboard → Edge Functions
2. Se não aparecer, faça deploy novamente
3. Aguarde 1-2 minutos (propagação)

---

### Erro: "relation 'data_analyses' does not exist"

**Causa:** Migration não foi aplicada

**Solução:**
1. Vá em SQL Editor
2. Execute manualmente a migration
3. Verifique com: `SELECT * FROM data_analyses LIMIT 1;`

---

### Erro: "exec_sql_secure does not exist"

**Causa:** RPC function não foi criada

**Solução:**
1. Execute a segunda migration manualmente
2. Verifique com: `SELECT exec_sql_secure('SELECT 1');`

---

### Erro: "OPENAI_API_KEY not found"

**Causa:** Variável de ambiente não configurada

**Solução:**
1. Edge Functions → Settings
2. Add secret: `OPENAI_API_KEY`
3. Re-deploy a função

---

### Erro: "Authorization token required"

**Causa:** Usuário não está autenticado

**Solução:**
1. Fazer logout e login novamente
2. Verificar se sessão está ativa
3. Limpar cookies/localStorage se necessário

---

## 📊 Monitoramento

### Logs da Edge Function

Acesse no Dashboard:
1. **Edge Functions** → `analyze-file`
2. Clique em **Logs**
3. Filtre por erro se necessário

Procure por:
- `[analyze-file] ETAPA X: ...` (progresso)
- `[analyze-file] ✅ ...` (sucesso)
- `[analyze-file] ERROR:` (falhas)

### Logs do Frontend

Abra DevTools (F12) e procure por:
- `[ANALYTICS MODE - NEW]` (novo fluxo)
- `[ANALYTICS MODE - NEW] ✅ Análise concluída` (sucesso)

---

## 🎯 Validação Final

Execute este checklist para confirmar que tudo está funcionando:

- [ ] Migration aplicada (tabela `data_analyses` existe)
- [ ] RPC function criada (`exec_sql_secure` funciona)
- [ ] Edge Function deployada (`analyze-file` aparece no dashboard)
- [ ] Variáveis de ambiente configuradas (OPENAI_API_KEY, etc)
- [ ] Frontend buildado sem erros (`npm run build`)
- [ ] Teste end-to-end passou (upload → análise → resultado)
- [ ] Logs mostram "Análise executada em X linhas"
- [ ] Gráficos renderizam corretamente
- [ ] Presentation mode continua funcionando (não foi afetado)

---

## 🚨 Rollback (Se Necessário)

Se algo der errado, você pode voltar ao sistema anterior:

### Reverter Frontend:

```bash
git checkout HEAD~1 src/components/Chat/ChatPage.tsx
npm run build
```

### Desativar Nova Função:

No código, comente a chamada para `analyze-file` e volte para `chat-analyze`.

**Importante:** As migrations são aditivas (não deletam nada), então não afetam o sistema antigo.

---

## 📞 Suporte

Se encontrar problemas:

1. **Verifique os logs** (Edge Functions + DevTools)
2. **Leia o ANALYTICS_V2_ARCHITECTURE.md** (documentação completa)
3. **Teste com arquivo pequeno** (10-20 linhas) primeiro
4. **Verifique permissões** (RLS policies)

---

## ✅ Sucesso!

Se todos os testes passaram, sua nova arquitetura de analytics está funcionando!

**Benefícios que você agora tem:**
- ✅ Análises 100% precisas (dados completos)
- ✅ Custo de API controlado (LLM vê apenas amostra)
- ✅ Flexibilidade total (qualquer pergunta, qualquer dado)
- ✅ Fácil de manter (1 função, 1 tabela)
- ✅ Sem erros de permissão
- ✅ Presentation mode intocado (documentos funcionam normalmente)

---

**Data:** 2025-10-08
**Versão:** 2.0.0-simplified
**Status:** ✅ Pronto para produção
