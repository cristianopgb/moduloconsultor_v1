# Como Testar o Sistema de Análise Inteligente

O sistema de análise de dados funciona **exclusivamente no chat**, não na página de Datasets.

## ✅ Fluxo Correto (Como Deve Ser Usado)

### 1. Inicie uma Conversa no Chat

```
Acesse: /chat ou crie uma nova conversa
```

### 2. Anexe uma Planilha

Clique no botão de anexar (📎) e faça upload de:
- Excel (.xlsx, .xls)
- CSV (.csv)
- Qualquer arquivo de dados tabular

### 3. Faça uma Pergunta Analítica

Exemplos de perguntas que funcionam:

#### Análise Geral (Automática):
```
"Pense por mim"
"Analise automaticamente"
"Me mostre os principais pontos"
"Visão geral dos dados"
```

#### Análise Específica:
```
"Qual foi o total de vendas por mês?"
"Mostre o top 5 produtos mais vendidos"
"Compare as vendas dos últimos 3 meses"
"Qual a média de faturamento por categoria?"
"Analise a tendência de crescimento"
"Mostre um gráfico de evolução mensal"
```

### 4. O Sistema Vai:

1. **Detectar** que você anexou uma planilha
2. **Processar** o arquivo (extrair dados, detectar tipos)
3. **Entender** sua pergunta
4. **Gerar SQL** customizado para responder
5. **Executar** as queries no PostgreSQL
6. **Interpretar** os resultados reais
7. **Apresentar**:
   - 💡 Insights baseados em dados reais
   - 📊 Gráficos apropriados (linha, barra, pizza)
   - 📐 Métricas formatadas
   - ✅ Recomendações acionáveis
   - 🔍 Transparência (quantas queries foram executadas)

## 🎯 Exemplos Práticos

### Exemplo 1: Análise de Vendas

**Arquivo:** vendas_2024.xlsx
```csv
Data,Produto,Categoria,Quantidade,Valor
2024-01-15,Notebook,Eletrônicos,5,5000
2024-01-20,Mouse,Periféricos,20,400
2024-02-10,Teclado,Periféricos,15,750
```

**Pergunta:** "Analise as vendas por categoria e mostre a evolução mensal"

**Resultado Esperado:**
- Gráfico de barras: Vendas por categoria
- Gráfico de linha: Evolução mensal
- Métricas: Total vendido, média por mês
- Insights: Qual categoria vendeu mais, tendência de crescimento
- Recomendações: Onde focar esforços

### Exemplo 2: Análise Automática

**Arquivo:** clientes.csv
**Pergunta:** "Pense por mim"

**Resultado Esperado:**
- Sistema analisa automaticamente
- Identifica padrões sem você pedir
- Mostra métricas principais
- Sugere próximos passos

## ❌ O Que NÃO Fazer

### NÃO use a página /datasets para análise

A página de Datasets é apenas para:
- Ver uploads anteriores
- Baixar CSV processado
- Excluir datasets antigos

O botão "Gerar Análise" foi **removido** porque análise só deve acontecer no chat.

## 🔧 Detalhes Técnicos do Fluxo

### Roteamento Automático

O `chat-assistant` detecta quando você:
1. Anexou uma planilha (.xlsx, .xls, .csv)
2. Fez uma pergunta analítica

E automaticamente roteia para `chat-analyze`, que:
1. Cria um dataset temporário
2. Chama `process-excel` para processar
3. Chama `analyze-data` (nova função inteligente!)
4. Retorna resultados formatados para o chat

### A Nova Função `analyze-data`

Esta função implementa análise **dinâmica e inteligente**:

```typescript
// Fluxo interno:
1. getDataSample() → Pega primeiras 100 linhas
2. detectColumnTypes() → Identifica numérico/data/texto
3. generateAnalysisSQL() → LLM gera SQL customizado
4. execSQL() → Executa no PostgreSQL
5. interpretResults() → LLM interpreta números reais
6. Retorna: insights + gráficos + métricas
```

**Diferença do sistema antigo:**
- ❌ Antigo: Funções fixas (runTrend, runByCategory)
- ✅ Novo: LLM gera SQL sob demanda para qualquer pergunta

## 🧪 Como Testar Agora

### Teste Rápido:

```bash
# 1. Inicie o servidor
npm run dev

# 2. Acesse http://localhost:5173/chat

# 3. Crie um arquivo teste.csv:
Data,Produto,Valor
2024-01-01,A,100
2024-02-01,A,150
2024-03-01,B,200

# 4. Anexe no chat e pergunte:
"Mostre a evolução de vendas por mês"

# 5. Observe:
- Sistema processa automaticamente
- Gera SQL customizado
- Executa queries reais
- Retorna insights com dados verdadeiros
```

### Teste com Script Automatizado:

```bash
# Use o script de teste (se tiver datasets já processados)
node test-analysis.js seu-email@example.com sua-senha
```

## 📊 O Que Você Deve Ver no Chat

Quando a análise é concluída, você verá:

```
🔍 Transparência da Análise
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 1.234 Linhas Analisadas
🔍 3 Consultas SQL Executadas
📋 8 Colunas Disponíveis

A IA analisou dados reais, gerou SQL customizado,
executou consultas no PostgreSQL e interpretou os resultados.

💡 Insights Identificados:
1. Crescimento de 23% em fevereiro
   Descrição detalhada com números reais...
   Tipo: trend | Confiança: 90%

📊 Gráficos:
[Gráfico de linha: Evolução Mensal]
[Gráfico de barras: Top Produtos]

📐 Métricas:
• Total de Vendas: R$ 12.345,67
  → Representa crescimento de 15% vs período anterior
• Ticket Médio: R$ 234,56
  → Acima da média histórica

✅ Recomendações:
1. Investir mais em campanha de fevereiro
2. Analisar causa do pico em produto A
3. Replicar estratégia em outras regiões
```

## 🚀 Próximos Passos

Após ver a análise no chat, você pode:

1. **Fazer perguntas de follow-up:**
   ```
   "Agora mostre apenas os últimos 30 dias"
   "Compare com o ano passado"
   "Detalhe mais o produto A"
   ```

2. **Gerar apresentação:**
   ```
   "Gere uma apresentação com esses resultados"
   ```
   (O sistema criará slides profissionais em HTML)

3. **Exportar documento:**
   ```
   "Crie um relatório executivo"
   ```

## ⚠️ Troubleshooting

### "Análise não iniciou"
- Verifique se anexou um arquivo válido (.xlsx, .xls, .csv)
- Confirme que a pergunta é analítica (use palavras como "analise", "mostre", "compare")

### "Erro ao processar"
- Dataset pode estar corrompido
- Tente converter para CSV antes de anexar
- Verifique se as colunas têm nomes válidos

### "Insights vazios"
- Arquivo pode estar vazio ou com poucos dados
- Tente com dataset maior (mínimo 10 linhas)

## 📚 Documentação Técnica

- Edge Function: `/supabase/functions/analyze-data/index.ts`
- Roteamento: `/supabase/functions/chat-assistant/index.ts` (linhas 306-400)
- Orquestrador: `/supabase/functions/chat-analyze/index.ts`

---

**Resumo:** Análise acontece **no chat, não na página de datasets**. Anexe planilha → Faça pergunta → Sistema analisa automaticamente! 🎉
