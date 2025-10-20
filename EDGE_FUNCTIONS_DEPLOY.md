# 📋 Guia de Deploy das Edge Functions

## Problema Identificado

Duas Edge Functions estavam vazias/incompletas:
- ✅ `analyze-data/index.ts` - CORRIGIDO (estava com apenas 1 linha)
- ✅ `rename-conversation/index.ts` - CORRIGIDO (estava vazio)

## Functions Corrigidas

### 1. analyze-data (370 linhas)
**Função:** Orquestra análise completa de dados com IA
- Busca metadados do dataset
- Planeja query SQL usando IA (via plan-query)
- Executa query (via query-dataset)
- Gera insights, métricas e sugestões de gráficos (OpenAI)
- Armazena análise no banco

**Dependências:**
- OpenAI API (gpt-4o-mini)
- Edge Functions: plan-query, query-dataset
- Tabelas: datasets, analyses

### 2. rename-conversation (94 linhas)
**Função:** Renomeia título de uma conversa
- Valida autenticação
- Atualiza título garantindo ownership do usuário
- Retorna conversa atualizada

**Dependências:**
- Tabela: conversations

---

## 🚀 DEPLOY MANUAL NO SUPABASE

### Passo 1: Acesse o Supabase Dashboard
1. Vá para https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu lateral: **Edge Functions**

### Passo 2: Deploy da função `analyze-data`

1. Clique em **"Create a new function"** ou edite se já existir
2. Nome da função: `analyze-data`
3. Cole o conteúdo do arquivo: `supabase/functions/analyze-data/index.ts`
4. Clique em **Deploy**

**Configuração:**
- Verify JWT: ✅ Yes (função requer autenticação)
- Import Map: Não necessário

### Passo 3: Deploy da função `rename-conversation`

1. Clique em **"Create a new function"** ou edite se já existir
2. Nome da função: `rename-conversation`
3. Cole o conteúdo do arquivo: `supabase/functions/rename-conversation/index.ts`
4. Clique em **Deploy**

**Configuração:**
- Verify JWT: ✅ Yes (função requer autenticação)
- Import Map: Não necessário

---

## 🔐 Variáveis de Ambiente Necessárias

As seguintes variáveis já devem estar configuradas automaticamente:
- ✅ `SUPABASE_URL` - URL do projeto
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço
- ⚠️ `OPENAI_API_KEY` - **IMPORTANTE: Verifique se está configurada!**

### Como verificar/adicionar OPENAI_API_KEY:

1. No dashboard do Supabase
2. Menu **Project Settings** → **Edge Functions** → **Secrets**
3. Adicione: `OPENAI_API_KEY` = `sk-...`

---

## ✅ Verificação do Deploy

Após fazer o deploy, teste as funções:

### Teste 1: analyze-data

```bash
curl -X POST \
  'https://SEU_PROJETO.supabase.co/functions/v1/analyze-data' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "dataset_id": "uuid-do-dataset",
    "analysis_request": "Analise as vendas por categoria"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "analysis_id": "uuid",
  "validation_status": "validated",
  "message": "Análise concluída com sucesso",
  "result": {
    "insights": [...],
    "metrics": {...},
    "charts": [...],
    "raw_data": [...]
  }
}
```

### Teste 2: rename-conversation

```bash
curl -X POST \
  'https://SEU_PROJETO.supabase.co/functions/v1/rename-conversation' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "uuid-da-conversa",
    "new_title": "Novo Título"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "conversation": {
    "id": "uuid",
    "title": "Novo Título"
  }
}
```

---

## 📊 Fluxo da Análise de Dados

Quando o usuário faz upload de um arquivo Excel/CSV sem selecionar template:

```
Frontend (ChatPage.tsx)
  ↓ Upload arquivo
chat-analyze
  ↓ 1. Cria/busca dataset
  ↓ 2. Chama process-excel (processa e ingere dados)
  ↓ 3. Verifica se tem dados consultáveis
  ↓ 4. Chama analyze-data
analyze-data
  ↓ 1. Busca metadados do dataset
  ↓ 2. Chama plan-query (gera SQL)
  ↓ 3. Chama query-dataset (executa SQL)
  ↓ 4. Gera insights com OpenAI
  ↓ 5. Armazena análise
  ↓ Retorna resultado
Frontend
  ↓ Exibe insights, métricas e gráficos
```

---

## 🐛 Troubleshooting

### Erro 500 em analyze-data

**Possíveis causas:**
1. ❌ OPENAI_API_KEY não configurada
   - Solução: Adicione em Project Settings → Secrets

2. ❌ Tabela `analyses` não existe
   - Solução: Execute migration que cria a tabela

3. ❌ Functions plan-query ou query-dataset não estão deployadas
   - Solução: Verifique se todas as functions estão ativas

### Erro "Network connection lost"

**Causa:** Function está demorando mais de 150s (timeout)

**Solução:**
- Verifique logs da function no dashboard
- Reduza tamanho do dataset de teste
- Verifique se OpenAI API está respondendo

---

## 📝 Checklist Final

Antes de testar no frontend:

- [ ] analyze-data deployada ✅
- [ ] rename-conversation deployada ✅
- [ ] OPENAI_API_KEY configurada ⚠️
- [ ] Todas as outras functions estão ativas:
  - [ ] chat-analyze
  - [ ] process-excel
  - [ ] plan-query
  - [ ] query-dataset
- [ ] Políticas RLS consolidadas aplicadas
- [ ] Migrações duplicadas removidas

---

## 🎯 Próximos Passos

1. **Deploy as 2 functions corrigidas no Supabase**
2. **Verifique OPENAI_API_KEY nas secrets**
3. **Teste upload de arquivo no frontend**
4. **Verifique logs no Supabase → Edge Functions → Logs**

Se ainda houver erro 500, compartilhe os logs da function para debug!
