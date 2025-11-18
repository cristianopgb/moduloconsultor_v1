# 🧪 Teste Rápido - Sistema de Analytics Real

## Teste em 3 Minutos

### Preparação (30 segundos)

1. Certifique-se de que o sistema está rodando:
   ```bash
   npm run dev
   ```

2. Abra o navegador em: http://localhost:5173

### Teste 1: Upload e Análise (2 minutos)

#### Passo 1: Fazer Upload
1. Clique no modo **Analytics** (ícone de gráfico)
2. Clique em **Attach File** ou arraste o arquivo
3. Selecione: `estoque_inventario_ficticio_500_linhas.xlsx`
4. Aguarde upload (barra verde = sucesso)

#### Passo 2: Enviar Pergunta
Digite qualquer uma dessas perguntas:
- "Analise as divergências"
- "Quais categorias têm mais problemas?"
- "Mostre as divergências por localização"
- Ou apenas: "Analise"

#### Passo 3: Aguardar Análise
- Tempo esperado: **5-10 segundos**
- Verá animação de "Analisando..."

### ✅ Resultado Esperado

Você DEVE ver algo assim:

```markdown
## 📊 Sumário Executivo

- Dataset contém 500 registros analisados.
- Div Media: -0.12
- Div Abs Media: 2.34
- Taxa Itens Divergentes: 0.67

## 🔍 Principais Descobertas

Por categoria:
- categoria "Eletrônicos": div abs: 3.45
- categoria "Alimentos": div abs: 1.23
- categoria "Roupas": div abs: 2.67

Por localização:
- rua "A1": div abs: 4.12
- rua "B2": div abs: 1.89
- rua "C3": div abs: 2.34

## 📋 Detalhes da Análise

Colunas utilizadas:
| Coluna | Menções |
|--------|---------|
| saldo_anterior | 3 |
| entrada | 3 |
| saida | 3 |
| contagem_fisica | 3 |
| categoria | 2 |
| rua | 2 |
```

### ❌ Resultado ERRADO (Mock Antigo)

Se você ver isso, o sistema ainda está no mock:

```markdown
## 📊 Sumário Executivo

- Dataset contém 20 registros analisados.  ❌ (mock era 20, real é 500)
- Nome: média de X, variando de Y a Z     ❌ (valores genéricos)
```

**Se isso acontecer**: A Edge Function não foi atualizada. Veja `COMO_FAZER_DEPLOY_SISTEMA_REAL.md`.

## Verificação Visual Rápida

### ✅ Sinais de que está funcionando:

1. **Número de registros**: Deve ser **500** (não 20)
2. **Métricas específicas**: Deve mostrar "Div Media", "Div Abs Media", "Taxa Itens Divergentes"
3. **Agregações**: Deve mostrar categorias e ruas específicas
4. **Valores numéricos**: Deve ter valores calculados (ex: 2.34, não 0)

### ❌ Sinais de que está no mock:

1. **Número de registros**: Mostra **20**
2. **Métricas genéricas**: Mostra "média de X, variando de Y a Z"
3. **Sem agregações**: Não agrupa por categoria/rua
4. **Valores vazios**: Muitos zeros ou valores nulos

## Teste 2: Verificar Console do Navegador (30 segundos)

1. Abra DevTools (F12)
2. Vá na aba **Console**
3. Faça upload e envie análise
4. Procure por:

```
[ANALYTICS MODE - NEW] Iniciando fluxo simplificado de análise...
[ANALYTICS MODE - NEW] Arquivo baixado e convertido para base64
[ANALYTICS MODE - NEW] Creating data_analyses record with hash: ...
[ANALYTICS MODE - NEW] ✅ data_analyses record created: ...
[ANALYTICS MODE - NEW] ✅ Análise concluída em 500 linhas completas
```

### ✅ Se aparecer:
Frontend está funcionando corretamente!

### ❌ Se aparecer erro:
Veja mensagem de erro e corrija.

## Teste 3: Verificar Logs do Supabase (1 minuto)

### Via Dashboard:
1. Vá em https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Edge Functions** > **analyze-file**
4. Clique em **Logs**
5. Procure pelo log mais recente

### ✅ Logs Esperados:

```
[AnalyzeFile] Starting analysis: { has_file_data: true, ... }
[AnalyzeFile] Processing file_data (base64) using ingest orchestrator
[IngestOrchestrator] File type detected: { type: "xlsx", confidence: 100 }
[AnalyzeFile] LAYER 1: Schema Validator
[AnalyzeFile] Enriched schema with inferred types:
  - saldo_anterior: numeric (confidence: 100%)
  - entrada: numeric (confidence: 100%)
  - saida: numeric (confidence: 100%)
  - contagem_fisica: numeric (confidence: 100%)
[AnalyzeFile] LAYER 2: Playbook Registry
[SchemaValidator] Playbook "pb_estoque_divergencias_v1" score: 100%
[AnalyzeFile] LAYER 3: Guardrails Engine
[AnalyzeFile] Executing playbook analysis with real data...  🎯 AQUI!
[PlaybookExecutor] Executing playbook: pb_estoque_divergencias_v1
[PlaybookExecutor] Row count: 500
[PlaybookExecutor] Metric computation order: qtd_esperada → divergencia → div_abs → taxa_div
[PlaybookExecutor] Computing metric: qtd_esperada
[PlaybookExecutor] Computing metric: divergencia
[PlaybookExecutor] Computing metric: div_abs
[PlaybookExecutor] Computing metric: taxa_div
[PlaybookExecutor] Executing section: overview (3 queries)
[PlaybookExecutor] Executing section: by_category (2 queries)
[PlaybookExecutor] Executing section: by_location (2 queries)
[PlaybookExecutor] Execution complete in 45ms
[AnalyzeFile] Playbook execution complete:
  - Sections executed: 3
  - Metrics computed: 4
  - Execution time: 45ms
[AnalyzeFile] LAYER 4: Narrative Adapter
[AnalyzeFile] ✅ Analysis complete in 618ms
```

### ❌ Logs Antigos (Mock):

```
[AnalyzeFile] Executing analysis...
// For now, we'll create a simple analysis result
// In production, this would call the actual analytics engine
```

Se ver comentários como "For now" ou "In production", está na versão antiga!

## Teste 4: Validação Matemática (2 minutos)

Pegue uma linha do Excel manualmente:

| Linha | saldo_anterior | entrada | saida | contagem_fisica |
|-------|---------------|---------|-------|-----------------|
| 1     | 100           | 20      | 15    | 103             |

**Calcule manualmente**:
```
qtd_esperada = 100 + 20 - 15 = 105
divergencia = 103 - 105 = -2
div_abs = ABS(-2) = 2
taxa_div = (-2 != 0) ? 1 : 0 = 1
```

**Confira se os valores na análise batem**:
- Deve haver itens com divergência de -2
- Deve haver itens com div_abs de 2
- Taxa de divergentes deve incluir esse item

### ✅ Se bater:
Sistema está calculando corretamente! 🎉

### ❌ Se não bater:
Há um bug no cálculo. Revise `playbook-executor.ts`.

## Teste 5: Testar Outro Playbook (5 minutos)

Para garantir que o sistema funciona com múltiplos playbooks:

### Criar planilha de vendas:

| produto    | quantidade | valor_unit |
|------------|-----------|-----------|
| Notebook   | 2         | 3000      |
| Mouse      | 10        | 50        |
| Teclado    | 5         | 150       |

Salvar como: `vendas_teste.xlsx`

### Fazer Upload e Analisar:
1. Upload do `vendas_teste.xlsx`
2. Enviar: "Analise as vendas"
3. Sistema deve matchear: **pb_vendas_basico_v1**

### ✅ Resultado Esperado:
```markdown
## 📊 Sumário Executivo
- Faturamento: 7500.00
- Itens: 17
- Ticket Medio: 441.18

## 🔍 Principais Descobertas
Por produto:
- produto "Notebook": valor total: 6000.00
- produto "Mouse": valor total: 500.00
- produto "Teclado": valor total: 750.00
```

## Resumo dos Testes

| Teste | Tempo | Prioridade | Status |
|-------|-------|-----------|--------|
| 1. Upload e Análise | 2 min | ALTA | ☐ |
| 2. Console do Navegador | 30 seg | ALTA | ☐ |
| 3. Logs Supabase | 1 min | ALTA | ☐ |
| 4. Validação Matemática | 2 min | MÉDIA | ☐ |
| 5. Outro Playbook | 5 min | BAIXA | ☐ |

**Mínimo para validar**: Testes 1, 2 e 3 devem passar.

## Troubleshooting Rápido

### Problema: Análise demora mais de 30 segundos
**Causa**: Timeout ou arquivo muito grande
**Solução**: Use arquivo menor (<1000 linhas) ou aumente timeout

### Problema: Erro 400 "Dataset is empty"
**Causa**: Arquivo não foi lido corretamente
**Solução**: Verifique formato do Excel (deve ter headers na primeira linha)

### Problema: Análise retorna "No compatible playbook"
**Causa**: Colunas do arquivo não matcheiam nenhum playbook
**Solução**:
- Verifique nome das colunas
- Use arquivo de exemplo fornecido
- Ou crie playbook customizado

### Problema: Valores todos zerados
**Causa**: Erro no cálculo de métricas
**Solução**:
- Verifique logs do Supabase
- Veja se há erros no `evaluateMetricFormula()`
- Confirme que colunas têm valores numéricos

## Checklist Final

Antes de considerar o teste bem-sucedido:

- [ ] Upload funciona sem erros
- [ ] Análise completa em menos de 15 segundos
- [ ] Resultado mostra 500 registros (não 20)
- [ ] Métricas têm valores não-zero
- [ ] Agregações mostram categorias/ruas específicas
- [ ] Console não mostra erros
- [ ] Logs mostram `[PlaybookExecutor]` executando
- [ ] Valores calculados fazem sentido matematicamente

**Se TODOS os itens estão marcados**: Sistema funcionando 100%! 🎉

---

**Tempo total de teste**: 3-10 minutos
**Complexidade**: Baixa
**Confiança nos resultados**: Alta (validação matemática)
