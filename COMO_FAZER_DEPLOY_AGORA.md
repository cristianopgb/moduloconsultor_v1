# 🚀 COMO FAZER DEPLOY DA EDGE FUNCTION (AGORA)

## ✅ PATCHES JÁ APLICADOS NOS ARQUIVOS LOCAIS

Os 3 patches críticos JÁ FORAM APLICADOS nos arquivos da sua IDE:

1. ✅ **Patch #1**: Prompts 5W2H (linhas 566-649 do `index.ts`)
2. ✅ **Patch #4**: Salvar Kanban cards (linhas 53-100 do `deliverable-generators.ts`)
3. ✅ **Patch #5**: Buscar area_id (linhas 1131-1150 do `index.ts`)

---

## 📂 ARQUIVOS PRONTOS PARA DEPLOY

Você tem **2 arquivos** atualizados na sua IDE:

```
supabase/functions/consultor-chat/
├── index.ts (1439 linhas) ✅ ATUALIZADO
└── deliverable-generators.ts (532 linhas) ✅ ATUALIZADO
```

---

## 🎯 OPÇÃO 1: DEPLOY VIA SUPABASE CLI (RECOMENDADO)

### Passo a Passo:

```bash
# 1. Navegar até o diretório do projeto
cd /caminho/para/seu/projeto

# 2. Fazer login no Supabase (se ainda não fez)
supabase login

# 3. Linkar ao projeto (se ainda não fez)
supabase link --project-ref seu-project-id

# 4. Deploy da função
supabase functions deploy consultor-chat

# 5. Confirmar deploy
# Deve retornar: "Deployed Function consultor-chat"
```

### Tempo estimado: **30 segundos**

---

## 🎯 OPÇÃO 2: DEPLOY VIA SUPABASE DASHBOARD

### Passo a Passo:

1. **Acessar Dashboard**
   - Ir para: https://supabase.com/dashboard
   - Selecionar seu projeto

2. **Ir em Edge Functions**
   - Menu lateral → **Edge Functions**
   - Encontrar `consultor-chat` na lista

3. **Editar Função**
   - Clicar nos 3 pontinhos da função
   - Selecionar **"Edit"** ou **"Update"**

4. **Substituir Código**
   - **Arquivo 1**: `index.ts`
     - Copiar TUDO do arquivo local
     - Colar no editor do Supabase

   - **Arquivo 2**: `deliverable-generators.ts`
     - Clicar em **"Add file"** ou editar existente
     - Copiar TUDO do arquivo local
     - Colar no editor do Supabase

5. **Deploy**
   - Clicar em **"Deploy"** ou **"Save & Deploy"**
   - Aguardar confirmação (15-30 segundos)

### Tempo estimado: **3-5 minutos**

---

## ⚠️ IMPORTANTE ANTES DE FAZER DEPLOY

### Verificar se arquivos estão completos:

```bash
# Verificar tamanho dos arquivos
wc -l supabase/functions/consultor-chat/index.ts
# Deve retornar: 1439 linhas

wc -l supabase/functions/consultor-chat/deliverable-generators.ts
# Deve retornar: 532 linhas
```

### Verificar se patches foram aplicados:

```bash
# Verificar se tem prompts 5W2H
grep "REGRA CRÍTICA - DETALHAMENTO DE AÇÕES 5W2H" supabase/functions/consultor-chat/index.ts
# Deve retornar uma linha

# Verificar se salva cards
grep "kanban_cards" supabase/functions/consultor-chat/deliverable-generators.ts
# Deve retornar várias linhas
```

---

## ✅ VALIDAR DEPLOY

Após fazer deploy, validar se funcionou:

### 1. Verificar no Dashboard
- Edge Functions → consultor-chat
- Status deve estar **"Active"** com data/hora recente

### 2. Testar no Chat
```
1. Ir em Chat → Modo Consultor
2. Criar nova conversa
3. Passar pela etapa de execução
4. Pedir para gerar plano de ação
5. Verificar se ações têm detalhes 5W2H
```

### 3. Verificar no Banco
```sql
-- Após gerar um Kanban, verificar:
SELECT * FROM kanban_cards
WHERE jornada_id = 'seu-id-de-jornada'
ORDER BY created_at DESC
LIMIT 5;

-- Deve retornar cards com dados_5w2h preenchidos
```

---

## 🔍 TROUBLESHOOTING

### Erro: "Module not found deliverable-generators.ts"
**Solução**: Certifique-se de fazer upload dos **2 arquivos** (index.ts + deliverable-generators.ts)

### Erro: "Syntax error"
**Solução**: Verifique se copiou o arquivo **completo** (1439 linhas do index.ts)

### Deploy não aparece como "Active"
**Solução**:
- Aguardar 30 segundos
- Recarregar página do dashboard
- Verificar logs de erro

### Função retorna erro 500
**Solução**:
- Ir em Edge Functions → consultor-chat → Logs
- Ver erro específico
- Geralmente é problema de sintaxe ou import

---

## 📊 CHECKLIST FINAL

Antes de testar:

- [ ] Arquivo `index.ts` tem 1439 linhas
- [ ] Arquivo `deliverable-generators.ts` tem 532 linhas
- [ ] Deploy foi feito com sucesso (status "Active")
- [ ] Função aparece no dashboard com data recente
- [ ] Não há erros nos logs

Depois de testar:

- [ ] LLM gera ações detalhadas com 5W2H
- [ ] Cards são salvos na tabela `kanban_cards`
- [ ] Cards têm `dados_5w2h` preenchidos
- [ ] Não há duplicação de entregáveis

---

## 🎯 RESUMO

**O QUE FAZER AGORA**:
1. Abrir terminal
2. Executar: `supabase functions deploy consultor-chat`
3. Aguardar 30 segundos
4. Testar no chat

**TEMPO TOTAL**: 1-2 minutos (CLI) ou 3-5 minutos (Dashboard)

**RESULTADO ESPERADO**:
- ✅ Ações detalhadas com 5W2H
- ✅ Cards salvos no banco
- ✅ Sistema 100% funcional

---

**BOA SORTE!** 🚀
