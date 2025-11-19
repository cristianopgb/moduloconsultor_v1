# 🚀 Deploy da Função analyze-file (CORRIGIDA)

## ❌ Problema Atual
O sistema está rodando código ANTIGO que gera SQL sem GROUP BY, causando falhas.

```
[SimpleAnalyzer] Query failed: Aggregation SUM requires GROUP BY
[SimpleAnalyzer] Error: All SQL queries failed to execute
```

## ✅ Solução
Fazer deploy do código corrigido que:
1. Valida queries SQL ANTES de executar
2. Ensina o LLM a usar GROUP BY corretamente
3. Corrige schema do banco (charts_config → visualizations)

---

## 📋 PASSO A PASSO DO DEPLOY

### Opção 1: Via Painel Supabase (RECOMENDADO)

#### 1️⃣ Acesse o Painel
```
https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg/functions
```

#### 2️⃣ Clique em "analyze-file"

#### 3️⃣ Clique em "Deploy new version"

#### 4️⃣ Cole TODO o conteúdo do arquivo:
```bash
# Ver arquivo completo:
cat supabase/functions/analyze-file/index.ts
```

**IMPORTANTE:** O arquivo `index.ts` já importa automaticamente o `simple-analyzer.ts` corrigido.

#### 5️⃣ Clique em "Deploy"

⏱️ O deploy leva ~30 segundos.

---

### Opção 2: Via CLI (se tiver access token)

```bash
# No terminal, na raiz do projeto:
npx supabase functions deploy analyze-file --no-verify-jwt
```

---

## 🧪 Como Testar Depois do Deploy

1. Faça upload do arquivo Excel novamente
2. Pergunte: "faça uma analise das ruas com mais movimentação de produtos"
3. Verifique os logs: https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg/logs/edge-functions

**✅ Logs de Sucesso (o que você DEVE ver):**
```
[SimpleAnalyzer] Step 2.5: Validating SQL queries...
[SimpleAnalyzer] 4 queries validated successfully
[SimpleAnalyzer] Step 3: Executing SQL queries...
[SimpleAnalyzer] Executing: Calcular a soma total de entradas de produtos por rua
✅ Query executada com sucesso
```

**❌ Logs de Falha (o que você NÃO deve ver mais):**
```
[SimpleAnalyzer] Query failed: Aggregation SUM requires GROUP BY
```

---

## 📊 Resultados Esperados

Depois do deploy, a análise deve retornar:

- ✅ **Números corretos** (iguais ao Excel)
- ✅ **Zero queries falhadas**
- ✅ **Gráficos precisos**
- ✅ **Insights baseados em SQL real**

Exemplo:
```
Rua A: 2661 entradas (igual ao Excel)
Rua B: 1540 saídas
Rua C: 420 movimentações totais
```

---

## 🆘 Troubleshooting

### Problema: "Access token not provided"
**Solução:** Use a Opção 1 (painel web)

### Problema: Deploy funciona mas ainda vejo erros
**Solução:**
1. Limpe o cache do navegador (Ctrl+Shift+R)
2. Aguarde 1 minuto (pode haver cache do Supabase)
3. Teste novamente

### Problema: Não consigo acessar o painel
**Solução:** Você tem as credenciais em `.env`:
```
VITE_SUPABASE_URL=https://gljoasdvlaitplbmbtzg.supabase.co
```
Acesse https://supabase.com e faça login

---

## 📁 Arquivos Modificados

Apenas 2 arquivos foram alterados:

1. **supabase/functions/analyze-file/index.ts** (293 linhas)
   - Corrigido schema: charts_config → visualizations

2. **supabase/functions/analyze-file/simple-analyzer.ts** (454 linhas)
   - Adicionada validação SQL (linhas 217-243)
   - Melhorado prompt LLM (linhas 274-297)

**Total:** 747 linhas de código testado e funcionando localmente.

---

## ✅ Checklist

- [ ] Acessei o painel do Supabase
- [ ] Abri a função analyze-file
- [ ] Cliquei em "Deploy new version"
- [ ] Colei o código do index.ts
- [ ] Deploy concluído (verde)
- [ ] Testei com arquivo Excel
- [ ] Verifiquei logs (sem erros de GROUP BY)
- [ ] Resultados batem com Excel ✅

---

**Tempo total estimado:** 5 minutos

**Dificuldade:** ⭐⭐☆☆☆ (Fácil - apenas copy/paste)
