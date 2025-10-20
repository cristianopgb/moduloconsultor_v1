# Guia de Criação de Templates com Suporte a Gráficos e Dados

Este guia explica como criar templates HTML que suportam análise de dados, gráficos e tabelas.

---

## 1. Placeholders Básicos

Templates utilizam placeholders no formato `{{nome_do_campo}}` que são preenchidos automaticamente pela IA.

### Exemplos de Placeholders Comuns:

```html
{{titulo}}
{{subtitulo}}
{{empresa}}
{{autor}}
{{data}}
{{resumo}}
{{introducao}}
{{objetivos}}
{{conclusao}}
```

---

## 2. Placeholders para Gráficos

Para incluir gráficos gerados automaticamente, use placeholders específicos:

### Sintaxe:

```html
{{grafico_1}}
{{grafico_2}}
{{grafico_3}}
```

ou

```html
{{chart_1}}
{{chart_2}}
```

### Exemplo de Uso no Template:

```html
<section class="analise-dados">
  <h2>Análise de Vendas</h2>
  <p>{{resumo_vendas}}</p>

  <div class="grafico-container">
    {{grafico_1}}
  </div>

  <p>{{interpretacao_vendas}}</p>
</section>
```

### Como Funciona:

1. A IA analisa os dados anexados pelo usuário
2. Gera gráficos apropriados (barras, linhas, pizza, etc.)
3. Converte os gráficos para imagens base64
4. Injeta as imagens no lugar dos placeholders

---

## 3. Placeholders para Tabelas

Para incluir tabelas de dados:

```html
{{tabela_resumo}}
{{tabela_estatisticas}}
{{tabela_comparativo}}
```

### Exemplo:

```html
<section class="dados-estatisticos">
  <h3>Estatísticas Descritivas</h3>
  {{tabela_estatisticas}}
</section>
```

---

## 4. Estrutura Recomendada para Templates de Dados

### Template Completo de Exemplo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{titulo}}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #ffffff;
    }

    header {
      text-align: center;
      margin-bottom: 48px;
      padding-bottom: 24px;
      border-bottom: 3px solid #3b82f6;
    }

    h1 {
      font-size: 2.5rem;
      color: #1e40af;
      margin-bottom: 12px;
      font-weight: 700;
    }

    h2 {
      font-size: 1.75rem;
      color: #1e40af;
      margin: 32px 0 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }

    h3 {
      font-size: 1.25rem;
      color: #374151;
      margin: 24px 0 12px;
    }

    .subtitle {
      font-size: 1.125rem;
      color: #6b7280;
      font-weight: 400;
    }

    .metadata {
      display: flex;
      justify-content: center;
      gap: 24px;
      color: #6b7280;
      font-size: 0.875rem;
      margin-top: 12px;
    }

    section {
      margin: 32px 0;
      padding: 24px;
      background: #f9fafb;
      border-left: 4px solid #3b82f6;
      border-radius: 4px;
    }

    .grafico-container {
      margin: 24px 0;
      padding: 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .grafico-container img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }

    .insight-card {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }

    .insight-card h4 {
      color: #1e40af;
      margin-bottom: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      background: white;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border: 1px solid #e5e7eb;
    }

    th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }

    tr:nth-child(even) {
      background: #f9fafb;
    }

    .destaque {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }

    footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
    }

    @media print {
      body {
        padding: 20px;
      }

      section {
        page-break-inside: avoid;
      }

      .grafico-container {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>{{titulo}}</h1>
    <p class="subtitle">{{subtitulo}}</p>
    <div class="metadata">
      <span>📊 {{empresa}}</span>
      <span>👤 {{autor}}</span>
      <span>📅 {{data}}</span>
    </div>
  </header>

  <section>
    <h2>📝 Resumo Executivo</h2>
    <p>{{resumo}}</p>
  </section>

  <section>
    <h2>🎯 Principais Insights</h2>
    <div class="insight-card">
      <h4>Insight 1</h4>
      <p>{{insight_1}}</p>
    </div>
    <div class="insight-card">
      <h4>Insight 2</h4>
      <p>{{insight_2}}</p>
    </div>
  </section>

  <section>
    <h2>📊 Análise de Dados</h2>
    <p>{{introducao_analise}}</p>

    <h3>Tendências Identificadas</h3>
    <div class="grafico-container">
      {{grafico_1}}
    </div>
    <p>{{interpretacao_grafico_1}}</p>

    <h3>Distribuição por Categoria</h3>
    <div class="grafico-container">
      {{grafico_2}}
    </div>
    <p>{{interpretacao_grafico_2}}</p>
  </section>

  <section>
    <h2>📈 Estatísticas Descritivas</h2>
    {{tabela_estatisticas}}
  </section>

  <section class="destaque">
    <h2>💡 Recomendações</h2>
    <p>{{recomendacoes}}</p>
  </section>

  <section>
    <h2>✅ Conclusão</h2>
    <p>{{conclusao}}</p>
  </section>

  <footer>
    <p>Gerado em {{data_geracao}} por {{sistema}}</p>
    <p>{{rodape}}</p>
  </footer>
</body>
</html>
```

---

## 5. Boas Práticas

### Design Responsivo:
```css
@media screen and (max-width: 768px) {
  body {
    padding: 20px 10px;
  }

  h1 {
    font-size: 1.75rem;
  }

  .grafico-container {
    padding: 8px;
  }
}
```

### Impressão Otimizada:
```css
@media print {
  section {
    page-break-inside: avoid;
  }

  .grafico-container {
    page-break-inside: avoid;
  }
}
```

### Acessibilidade:
- Use cores com bom contraste
- Adicione atributos `alt` nas imagens
- Estruture conteúdo com headings hierárquicos

---

## 6. Placeholders Especiais

### Metadados:
```html
{{data_geracao}}
{{versao_documento}}
{{numero_paginas}}
{{confidencialidade}}
```

### Formatação Condicional:
Se um placeholder não tiver conteúdo, o bloco HTML que o contém será automaticamente removido.

Exemplo:
```html
<section>
  <h2>Observações</h2>
  <p>{{observacoes}}</p>
</section>
```

Se `{{observacoes}}` estiver vazio, toda a `<section>` será removida.

---

## 7. Exemplos de Tipos de Gráficos Suportados

### Gráfico de Barras:
Ideal para comparar valores entre categorias
```html
<div class="grafico-container">
  <h3>Vendas por Produto</h3>
  {{grafico_barras_vendas}}
</div>
```

### Gráfico de Linhas:
Ideal para mostrar tendências ao longo do tempo
```html
<div class="grafico-container">
  <h3>Evolução Mensal</h3>
  {{grafico_linha_evolucao}}
</div>
```

### Gráfico de Pizza:
Ideal para mostrar proporções
```html
<div class="grafico-container">
  <h3>Participação de Mercado</h3>
  {{grafico_pizza_mercado}}
</div>
```

---

## 8. Testando Seu Template

Para testar se seu template está funcionando:

1. Cadastre o template no sistema
2. Inicie uma conversa
3. Selecione o template
4. Anexe um arquivo de dados (Excel/CSV)
5. Peça para analisar os dados
6. Clique em "Gerar Documento"

---

## 9. Dicas Avançadas

### Múltiplos Gráficos na Mesma Seção:
```html
<section>
  <h2>Análise Comparativa</h2>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
    <div class="grafico-container">
      {{grafico_1}}
    </div>
    <div class="grafico-container">
      {{grafico_2}}
    </div>
  </div>
</section>
```

### Tabelas Customizadas:
```html
<table>
  <thead>
    <tr>
      <th>Métrica</th>
      <th>Valor</th>
      <th>Variação</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Total de Vendas</td>
      <td>{{total_vendas}}</td>
      <td>{{variacao_vendas}}</td>
    </tr>
    <tr>
      <td>Ticket Médio</td>
      <td>{{ticket_medio}}</td>
      <td>{{variacao_ticket}}</td>
    </tr>
  </tbody>
</table>
```

---

## 10. Troubleshooting

### Problema: Gráfico não aparece
**Solução:** Verifique se o placeholder está escrito corretamente (`{{grafico_1}}` e não `{{gráfico_1}}`)

### Problema: Seção vazia não é removida
**Solução:** Certifique-se de que o placeholder está dentro de um elemento de bloco (`<p>`, `<div>`, `<section>`, etc.)

### Problema: Gráfico muito pequeno
**Solução:** Ajuste o CSS do `.grafico-container`:
```css
.grafico-container {
  min-height: 400px;
}
```

---

## 11. Checklist de Template Completo

- [ ] Título e metadados básicos
- [ ] Seção de resumo executivo
- [ ] Seções para gráficos com interpretações
- [ ] Tabelas de dados quando aplicável
- [ ] Seção de recomendações
- [ ] Conclusão
- [ ] Footer com informações do documento
- [ ] CSS responsivo
- [ ] CSS otimizado para impressão
- [ ] Placeholders bem nomeados e documentados

---

## Suporte

Para dúvidas ou sugestões sobre templates, entre em contato com a equipe de desenvolvimento.
