# 🚀 Deploy das Correções do Sistema de Consultoria

## ✅ O Que Foi Corrigido

### 1. **Nomenclatura Consistente**
- ✅ Prompts renomeados corretamente
- ✅ Backend aceita aliases para retrocompatibilidade
- ✅ Fluxo alinhado com database

### 2. **Fluxo Correto Implementado**
```
ANAMNESE → MAPEAMENTO (Canvas+Cadeia) → INVESTIGAÇÃO (Ishikawa+5Porquês)
→ PRIORIZAÇÃO (GUT) → MAPEAMENTO_PROCESSOS (SIPOC+BPMN) → DIAGNÓSTICO → EXECUÇÃO
```

### 3. **Formatação Visual**
- ✅ Emojis contextuais em todas as fases
- ✅ Marcadores, negrito, listas organizadas
- ✅ PARTE B reforçada com exemplos completos

### 4. **Templates de Entregáveis**
- ✅ Cadeia de Valor HTML
- ✅ Ishikawa (6M) HTML
- ✅ 5 Porquês HTML
- ✅ SIPOC HTML

---

## 📦 Arquivos Alterados

### Edge Functions:
1. **`supabase/functions/consultor-rag/consultor-prompts.ts`**
   - Renomeado `MODELAGEM_PROMPT` → `MAPEAMENTO_PROMPT`
   - Renomeado `MAPEAMENTO_PROMPT` → `MAPEAMENTO_PROCESSOS_PROMPT`
   - Adicionada formatação visual com emojis
   - Reforçada geração de PARTE B
   - Adicionados aliases para retrocompatibilidade

2. **`supabase/functions/consultor-rag/index.ts`**
   - Atualizado `PHASE_FLOW` com aliases
   - Atualizado `PHASE_NORMALIZE` com aliases
   - Atualizado `PHASE_PROGRESS` com todas as fases

3. **`supabase/functions/_shared/deliverable-templates.ts`**
   - Adicionado `generateCadeiaValorHTML()`
   - Adicionado `generateIshikawaHTML()`
   - Adicionado `generate5WhysHTML()`
   - Adicionado `generateSIPOCHTML()`
   - Atualizado `getTemplateForType()` com novos templates

---

## 🚀 OPÇÃO 1: Deploy Manual via Supabase Dashboard

### Passo 1: Acesse o Dashboard
1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto: `gljoasdvlaitplbmbtzg`
3. Menu lateral: **Edge Functions**

### Passo 2: Deploy `consultor-rag`

**Opção A - Via Dashboard:**
1. Encontre a função `consultor-rag` na lista
2. Clique em **"Edit"** ou **"Deploy"**
3. Cole os conteúdos dos arquivos alterados:
   - `consultor-prompts.ts`
   - `index.ts`
4. Clique em **Deploy**

**Opção B - Via Supabase CLI (Recomendado):**
```bash
# 1. Fazer login no Supabase
npx supabase login

# 2. Deploy da função
npx supabase functions deploy consultor-rag --no-verify-jwt

# 3. Verificar se foi implantada
npx supabase functions list
```

### Passo 3: Deploy `_shared` (se necessário)

Se a pasta `_shared` não atualizar automaticamente:

```bash
# As funções compartilhadas são incluídas automaticamente
# ao fazer deploy de qualquer função que as importa
# Apenas certifique-se de que o arquivo existe em:
# supabase/functions/_shared/deliverable-templates.ts
```

---

## 🚀 OPÇÃO 2: Deploy via CLI (Mais Rápido)

Se você tem o Supabase CLI configurado:

```bash
# Login (uma vez)
npx supabase login

# Deploy todas as funções de uma vez
npx supabase functions deploy

# Ou apenas a função específica
npx supabase functions deploy consultor-rag --no-verify-jwt
```

---

## ✅ Verificação Pós-Deploy

### 1. Teste a função via Dashboard

No Supabase Dashboard:
1. Vá em **Edge Functions** → `consultor-rag`
2. Clique em **"Invoke"** ou **"Test"**
3. Use este payload de teste:

```json
{
  "sessao_id": "COLOQUE_UM_ID_REAL_AQUI",
  "message": "Olá, quero começar"
}
```

### 2. Teste via Frontend

1. Abra o aplicativo em desenvolvimento: `npm run dev`
2. Inicie uma nova sessão de consultoria
3. Verifique:
   - ✅ Primeira mensagem tem formatação visual (emojis, marcadores)
   - ✅ Após anamnese completa, transita para "mapeamento"
   - ✅ Mapeamento pergunta sobre Canvas e Cadeia de Valor (não SIPOC)
   - ✅ Entregáveis são gerados automaticamente

### 3. Verifique os Logs

No Dashboard do Supabase:
1. **Edge Functions** → `consultor-rag` → **Logs**
2. Procure por:
   - `[CONSULTOR] Current phase: mapeamento`
   - `[CONSULTOR] Deliverable saved:`
   - `[CONSULTOR] Phase transition: anamnese -> mapeamento`

---

## 🐛 Troubleshooting

### Erro: "Access token not provided"
**Solução:** Faça login no Supabase CLI
```bash
npx supabase login
```

### Erro: "Function already exists"
**Solução:** Use `--force` para sobrescrever
```bash
npx supabase functions deploy consultor-rag --no-verify-jwt --force
```

### Erro: "Import not found: _shared"
**Solução:** As funções compartilhadas devem estar em:
```
supabase/functions/_shared/deliverable-templates.ts
```

### Função não atualiza no frontend
**Solução:** Limpe o cache do navegador ou use modo anônimo

---

## 📊 Checklist de Verificação

Após o deploy, verifique:

- [ ] Edge function `consultor-rag` foi implantada com sucesso
- [ ] Logs mostram fase "mapeamento" (não "modelagem")
- [ ] Primeira mensagem tem emojis e formatação
- [ ] Após anamnese, transição para mapeamento acontece
- [ ] Mapeamento pergunta sobre Canvas (não SIPOC)
- [ ] Entregáveis são gerados em cada fase
- [ ] Templates HTML novos funcionam (Cadeia, Ishikawa, SIPOC)

---

## 🎯 Próximos Passos Após Deploy

1. **Teste completo do fluxo:**
   - Crie uma nova sessão
   - Complete a anamnese (6-7 perguntas)
   - Verifique se vai para Canvas (não SIPOC)
   - Complete todo o fluxo até execução

2. **Monitore os logs:**
   - Verifique se PARTE B está sendo gerada
   - Verifique transições de fase
   - Verifique geração de entregáveis

3. **Ajustes finos (se necessário):**
   - Prompts podem ser ajustados sem alterar código
   - Templates HTML podem ser customizados
   - Formatação visual pode ser refinada

---

## 📝 Notas Importantes

1. **Retrocompatibilidade:** O sistema aceita os nomes antigos (`coleta`, `modelagem`) e converte automaticamente para os novos

2. **Sessões antigas:** Sessões existentes continuarão funcionando, mas podem ter nomenclatura antiga no contexto

3. **Database:** Não precisa alterar nada no database - as migrações já suportam todas as fases

4. **Frontend:** O frontend não precisa ser alterado - já está preparado para receber os novos nomes de fase

---

## ✅ Resumo das Melhorias

### Antes:
- ❌ Pulava etapas (anamnese → SIPOC direto)
- ❌ PARTE B não era gerada consistentemente
- ❌ Sem formatação visual (texto plano)
- ❌ Nomenclatura inconsistente (modelagem vs mapeamento)
- ❌ Templates faltando (Cadeia, Ishikawa, SIPOC)

### Agora:
- ✅ Fluxo completo e correto (7 fases sequenciais)
- ✅ PARTE B reforçada com exemplos completos
- ✅ Formatação visual com emojis e marcadores
- ✅ Nomenclatura 100% consistente
- ✅ Todos os templates implementados

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas:
1. Verifique os logs da Edge Function no Supabase Dashboard
2. Teste com `curl` ou Postman para isolar problemas
3. Confirme que o arquivo `_shared/deliverable-templates.ts` existe
4. Verifique se as variáveis de ambiente estão corretas

**Deploy bem-sucedido = Sistema de consultoria corrigido e funcionando! 🎉**
