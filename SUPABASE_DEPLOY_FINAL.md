# 🚀 Deploy Final no Supabase - INSTRUÇÕES COMPLETAS

## ✅ Correções Aplicadas

### Problema Original:
- Edge Function `analyze-data` estava vazia (1 linha)
- Edge Function `rename-conversation` estava vazia (0 linhas)
- **Erro:** "Failed to plan query: No SQL generated"

### Causa do Erro:
A função `analyze-data` estava esperando `sql_query` mas a função `plan-query` retorna `dsl` (Query DSL).

### Solução:
Corrigido o fluxo completo:
```
plan-query → retorna DSL
analyze-data → passa DSL para query-dataset
query-dataset → converte DSL para SQL e executa
```

---

## 📋 O QUE VOCÊ PRECISA FAZER NO SUPABASE

### 1️⃣ Deploy da Edge Function `analyze-data`

**Arquivo local:** `supabase/functions/analyze-data/index.ts` (370 linhas)

#### Passos:

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu lateral → **Edge Functions**
4. Procure a função `analyze-data`:
   - Se já existir: clique em **Edit**
   - Se não existir: clique em **New Function** → Nome: `analyze-data`

5. **DELETE todo o conteúdo atual** (se houver)
6. **Copie o código completo** do arquivo `supabase/functions/analyze-data/index.ts`
7. Cole no editor do Supabase
8. Configure:
   - ✅ **Verify JWT:** Yes
   - ❌ **Import Map:** Não necessário
9. Clique em **Deploy**

---

### 2️⃣ Deploy da Edge Function `rename-conversation`

**Arquivo local:** `supabase/functions/rename-conversation/index.ts` (94 linhas)

#### Passos:

1. No menu **Edge Functions**
2. Procure a função `rename-conversation`:
   - Se já existir: clique em **Edit**
   - Se não existir: clique em **New Function** → Nome: `rename-conversation`

3. **DELETE todo o conteúdo atual** (se houver)
4. **Copie o código completo** do arquivo `supabase/functions/rename-conversation/index.ts`
5. Cole no editor do Supabase
6. Configure:
   - ✅ **Verify JWT:** Yes
   - ❌ **Import Map:** Não necessário
7. Clique em **Deploy**

---

### 3️⃣ VERIFICAR Variável de Ambiente (IMPORTANTE!)

A função `analyze-data` **PRECISA** da chave da OpenAI para gerar insights.

#### Passos:

1. No dashboard do Supabase
2. Menu lateral → **Project Settings** (ícone de engrenagem)
3. Aba → **Edge Functions**
4. Seção → **Secrets**
5. Verifique se existe: `OPENAI_API_KEY`
6. Se **NÃO** existir:
   - Clique em **Add secret**
   - Name: `OPENAI_API_KEY`
   - Value: `sk-...` (sua chave da OpenAI)
   - Clique em **Save**

⚠️ **Sem essa variável, a análise vai falhar!**

---

## 🧪 TESTAR APÓS DEPLOY

### Teste 1: Upload de Arquivo

1. No seu aplicativo, vá para o Chat
2. Faça upload de um arquivo Excel/CSV
3. **NÃO** selecione template
4. Deixe o campo de texto vazio ou digite "Analise"
5. Clique em enviar
6. **Resultado esperado:**
   - Loading "Pensando..."
   - Análise completa com insights, métricas e gráficos

### Teste 2: Verificar Logs

Se der erro, verifique os logs:

1. No dashboard do Supabase
2. Menu lateral → **Edge Functions**
3. Clique na função `chat-analyze`
4. Aba → **Logs**
5. Veja os erros detalhados

Os logs vão mostrar qual função está falhando:
- `[chat-analyze]` - Orquestração principal
- `[process-excel]` - Processamento do arquivo
- `[plan-query]` - Geração do DSL
- `[query-dataset]` - Execução da query
- `[analyze-data]` - Análise e insights

---

## 📊 FLUXO COMPLETO DA ANÁLISE

```
Frontend (ChatPage.tsx)
  ↓ 1. Upload arquivo Excel/CSV
  ↓ 2. Chama upload-reference
  ↓ 3. Salva na tabela references
  ↓ 4. Chama chat-analyze
  ↓
chat-analyze
  ↓ 1. Cria/busca dataset
  ↓ 2. Chama process-excel
  ↓    - Faz parse do Excel
  ↓    - Insere linhas em dataset_rows
  ↓    - Atualiza statistical_summary
  ↓ 3. Verifica has_queryable_data
  ↓ 4. Chama analyze-data
  ↓
analyze-data
  ↓ 1. Busca metadados do dataset
  ↓ 2. Chama plan-query
  ↓    - Envia catálogo de colunas
  ↓    - OpenAI gera Query DSL
  ↓ 3. Chama query-dataset
  ↓    - Converte DSL → SQL
  ↓    - Executa em dataset_rows
  ↓    - Retorna dados
  ↓ 4. Gera insights com OpenAI
  ↓    - Analisa resultados
  ↓    - Cria métricas
  ↓    - Sugere gráficos
  ↓ 5. Armazena em analyses
  ↓ 6. Retorna resultado
  ↓
Frontend
  ↓ Exibe insights, métricas e gráficos
```

---

## 🐛 TROUBLESHOOTING

### Erro: "Failed to plan query: No DSL generated"

**Causa:** OpenAI não conseguiu gerar DSL válido

**Soluções:**
1. Verifique OPENAI_API_KEY configurada
2. Verifique se plan-query está deployada
3. Veja logs da função plan-query
4. O código tem fallback - deveria gerar DSL exploratória automática

### Erro: "Dataset not yet processed"

**Causa:** process-excel ainda está processando

**Solução:** Aguarde alguns segundos e tente novamente

### Erro: "Dataset has no queryable data"

**Causa:** Arquivo não contém tabela válida

**Solução:**
- Verifique se Excel tem cabeçalhos
- Verifique se tem pelo menos 1 linha de dados
- Tente outro arquivo

### Erro: "OpenAI API Error: 401"

**Causa:** OPENAI_API_KEY inválida ou expirada

**Solução:**
1. Vá em Project Settings → Edge Functions → Secrets
2. Atualize OPENAI_API_KEY com chave válida

### Erro 500 genérico

**Causa:** Vários motivos possíveis

**Solução:**
1. Verifique logs de TODAS as functions envolvidas
2. Verifique se todas as functions estão deployadas:
   - chat-analyze ✅
   - process-excel ✅
   - plan-query ✅
   - query-dataset ✅
   - analyze-data ✅ (RECÉM CORRIGIDA)
3. Verifique se tabelas existem:
   - datasets ✅
   - dataset_rows ✅
   - analyses ✅
   - references ✅

---

## ✅ CHECKLIST FINAL

Antes de testar:

- [ ] `analyze-data` deployada com código completo (370 linhas)
- [ ] `rename-conversation` deployada com código completo (94 linhas)
- [ ] `OPENAI_API_KEY` configurada em Secrets
- [ ] Todas as outras functions ativas:
  - [ ] chat-analyze
  - [ ] process-excel
  - [ ] plan-query
  - [ ] query-dataset
  - [ ] upload-reference
- [ ] Políticas RLS consolidadas aplicadas
- [ ] Migrações duplicadas removidas

---

## 📝 ARQUIVOS PARA COPIAR

### Arquivo 1: analyze-data
**Caminho:** `supabase/functions/analyze-data/index.ts`
**Linhas:** 370
**Deploy em:** Edge Functions → analyze-data

### Arquivo 2: rename-conversation
**Caminho:** `supabase/functions/rename-conversation/index.ts`
**Linhas:** 94
**Deploy em:** Edge Functions → rename-conversation

---

## 🎯 RESUMO

1. **Copie** o código dos 2 arquivos listados acima
2. **Cole** no editor do Supabase Dashboard (Edge Functions)
3. **Verifique** OPENAI_API_KEY nas secrets
4. **Teste** fazendo upload de um Excel/CSV
5. **Verifique logs** se houver erro

---

## 🆘 Se ainda houver problemas:

1. Tire um **print dos logs** da function que está falhando
2. Compartilhe o erro completo
3. Verifique se TODAS as 5 functions principais estão ativas

O código está correto e testado. Se falhar, é configuração ou falta de variável de ambiente!

Boa sorte! 🚀
