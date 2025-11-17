# Quick Start: Sistema Multi-Formato

## 🚀 Como Usar

### 1. Upload de Arquivos Excel

**Antes (❌ Erro 400):**
```
Usuário: [Upload estoque.xlsx]
Sistema: Error 400 - File format not supported
```

**Agora (✅ Funciona):**
```
Usuário: [Upload estoque.xlsx]
Sistema: ✅ Análise iniciada
         📊 Detectado: Excel (8.5 MB)
         📋 Planilha: "Dados2025"
         📈 500 linhas processadas
         🔍 15 colunas detectadas
```

### 2. Upload de CSV

```
Usuário: [Upload vendas.csv]
Sistema: ✅ Análise iniciada
         📊 Detectado: CSV
         🔧 Delimitador: ponto-e-vírgula
         🌍 Decimais: vírgula → ponto
         📈 1.250 linhas processadas
```

### 3. Upload de JSON

```json
// arquivo: clientes.json
[
  {"nome": "João Silva", "idade": 35},
  {"nome": "Maria Santos", "idade": 28}
]
```

```
Sistema: ✅ Análise iniciada
         📊 Detectado: JSON (array direto)
         📈 2 linhas processadas
         🔍 2 colunas detectadas
```

### 4. Upload de TXT Delimitado

```
// arquivo: relatorio.txt
Nome;Cidade;Valor
João;São Paulo;1500,00
Maria;Rio;2300,50
```

```
Sistema: ✅ Análise iniciada
         📊 Detectado: TXT delimitado
         🔧 Delimitador: ponto-e-vírgula
         📈 2 linhas processadas
```

---

## 📋 Audit Card

Após cada análise, você verá um cartão de auditoria:

```markdown
## 📋 Cartão de Auditoria da Análise

### 📁 Informações do Arquivo
- **Tipo:** XLSX
- **Tamanho:** 8.50 MB
- **Confiança na Detecção:** 100%

### 📥 Ingestão
- **Método:** Excel - planilha "Dados2025"
- **Linhas Processadas:** 500
- **Colunas Detectadas:** 15

### 🔄 Normalizações Aplicadas
- "Nome do Cliente" → "nome_do_cliente"
- "Valor (R$)" → "valor_r"
- Decimais: vírgula → ponto (ex: 1,5 → 1.5)

### 🔍 Schema Detectado
| Coluna Original | Coluna Normalizada | Tipo |
|----------------|-------------------|------|
| Nome do Cliente | nome_do_cliente | text |
| Valor (R$) | valor_r | numeric |
| Data Compra | data_compra | date |

### 🛡️ Guardrails (Anti-Alucinação)
- **Pontuação de Qualidade:** 85/100
- **Seções Ativas:** 5
- **Seções Desabilitadas:** 1
  - **Previsão de Tendências:** Requer coluna temporal

### 💡 Recomendações
- 15 linhas vazias foram descartadas (3%)
- Para análise temporal completa, adicione coluna de data
```

---

## 🔍 Detecção Automática

O sistema detecta automaticamente:

### Por Extensão
```
arquivo.xlsx  → Excel
arquivo.csv   → CSV
arquivo.json  → JSON
arquivo.txt   → TXT
arquivo.pdf   → PDF (limitação)
```

### Por Conteúdo (quando extensão ausente)
```
Bytes: PK\x03\x04...     → Excel/ZIP
Texto: [{"key":"val"}]   → JSON
Texto: val1,val2,val3    → CSV
```

### Delimitadores CSV/TXT
```
Frequência de "," alta   → Vírgula
Frequência de ";" alta   → Ponto-e-vírgula
Frequência de "\t" alta  → Tab
Frequência de "|" alta   → Pipe
```

---

## ⚠️ Limitações Conhecidas

### PDF/Word/PowerPoint (v1.1)
```
Usuário: [Upload relatorio.pdf]
Sistema: ⚠️ Detectamos arquivo PDF sem tabelas legíveis.
         A extração de tabelas de PDF será implementada
         em versão futura.

         💡 Para seguir com análises agora, exporte a
         tabela para CSV ou Excel (.xlsx).
```

**Por que?**
- Extração de tabelas de PDF é complexa
- Requer bibliotecas adicionais e heurísticas
- Planejado para v1.2

**Workaround:**
1. Abrir PDF
2. Selecionar tabela
3. Copiar e colar no Excel
4. Salvar como .xlsx
5. Fazer upload

---

## 🎯 Boas Práticas

### 1. Nomes de Colunas
**❌ Evite:**
```
"Valor (em R$) - Final"  → difícil normalizar
"Data/Hora/Minuto"       → múltiplos separadores
"#ID Cliente!"           → caracteres especiais
```

**✅ Prefira:**
```
"Valor Final"      → valor_final
"Data Hora"        → data_hora
"ID Cliente"       → id_cliente
```

### 2. Valores Nulos
**✅ Sistema reconhece automaticamente:**
```
""           → null
"NA"         → null
"N/A"        → null
"null"       → null
(célula vazia) → null
```

### 3. Decimais
**✅ Ambos funcionam:**
```
CSV com ";" → pode usar "1,50"  → convertido para 1.5
CSV com "," → deve usar "1.50"  → mantém 1.5
```

### 4. Datas
**✅ Formatos reconhecidos:**
```
Excel: 44927           → 2023-01-15
CSV: "15/01/2023"      → 2023-01-15
CSV: "2023-01-15"      → 2023-01-15
JSON: "2023-01-15T..."  → 2023-01-15
```

---

## 🐛 Troubleshooting

### Erro: "Arquivo muito grande"
```
Limite excedido: 10.5MB
Limite para CSV: 10MB

Solução:
1. Filtrar dados desnecessários
2. Remover colunas não usadas
3. Dividir em múltiplos arquivos
```

### Erro: "Nenhuma linha de dados"
```
CSV tem apenas cabeçalho (sem linhas de dados)

Solução:
1. Verificar se arquivo tem dados
2. Conferir se delimitador está correto
```

### Erro: "Não foi possível identificar estrutura tabular"
```
Arquivo TXT sem delimitador claro nem colunas fixas

Solução:
1. Adicionar delimitadores (vírgula, ponto-e-vírgula)
2. Ou converter para CSV
3. Ou formatar como colunas de largura fixa consistente
```

---

## 📞 Suporte

### Logs Úteis

Verifique o console do navegador:
```javascript
[ANALYTICS MODE - NEW] Arquivo de dados: vendas.xlsx
[IngestOrchestrator] File type detected: { type: 'xlsx', confidence: 100 }
[IngestOrchestrator] Ingestion complete: { rows: 500, columns: 15 }
[AnalyzeFile] ✅ Analysis complete in 2500ms
```

### Informações para Suporte

Se encontrar problemas, forneça:
1. ✅ Tipo de arquivo (extensão)
2. ✅ Tamanho do arquivo
3. ✅ Primeiras 3 linhas do arquivo (sem dados sensíveis)
4. ✅ Screenshot do erro
5. ✅ Logs do console

---

## 🎉 Exemplo Completo

### Cenário: Análise de Vendas

**Arquivo:** `vendas_janeiro.xlsx`

**Estrutura:**
```
| Data       | Cliente      | Produto  | Valor  |
|------------|--------------|----------|--------|
| 15/01/2025 | João Silva   | Mouse    | 45,90  |
| 16/01/2025 | Maria Santos | Teclado  | 120,00 |
```

**Resultado:**
```json
{
  "success": true,
  "analysis_id": "uuid...",
  "playbook_id": "sales_basic_v1",
  "compatibility_score": 92,
  "quality_score": 87,
  "result": {
    "summary": "Análise de vendas identificou 2 transações..."
  },
  "metadata": {
    "ingestion": {
      "source": "xlsx",
      "sheet_name": "Plan1",
      "discarded_rows": 0,
      "ingest_warnings": []
    },
    "guardrails": {
      "active_sections": ["sales_overview", "product_ranking"],
      "disabled_sections": []
    }
  }
}
```

---

*Sistema pronto para uso!*
*Versão: 1.1*
*Data: 17/11/2025*
