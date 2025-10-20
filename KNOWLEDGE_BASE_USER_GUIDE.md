# 📚 Guia do Sistema de Knowledge Base - Aprendizado de SQL

## Visão Geral

O Sistema de Knowledge Base permite que o sistema **aprenda automaticamente** com casos reais de uso. Quando um usuário faz uma pergunta que não tem template correspondente, o SQL gerado dinamicamente é salvo para revisão. Masters podem aprovar esses SQLs e transformá-los em templates permanentes.

---

## 🎯 Como Funciona

### Fluxo Automático

```
Usuário faz pergunta → Sistema busca template →
  ├─ SE encontra (confidence ≥ 70%) → Usa template existente ✅
  └─ SE NÃO encontra → Gera SQL dinâmico → Salva em custom_sql_attempts ⚠️
```

### Para Usuários Normais

Nada muda! Você continua fazendo perguntas normalmente. O sistema:
1. Tenta encontrar um template que corresponda à sua pergunta
2. Se não encontrar, gera SQL customizado especificamente para você
3. Executa a análise normalmente
4. Salva o SQL customizado para possível aprovação futura

**Você nem percebe que está ajudando o sistema a evoluir!**

---

## 👨‍💼 Para Masters: Como Aprovar Templates

### 1. Acessar Interface de Aprendizado

Navegue até: **`/admin/learning`**

Você verá:
- **Pendentes**: SQLs customizados aguardando revisão
- **Aprovados**: SQLs que viraram templates
- **Rejeitados**: SQLs descartados
- **Templates Ativos**: Todos os templates analytics disponíveis

### 2. Revisar SQL Customizado Pendente

Para cada SQL pendente, você pode ver:

**Contexto da Solicitação:**
- Pergunta original do usuário
- Dataset usado (colunas e tipos)
- Data da criação
- Status de execução (sucesso ou erro)

**SQL Gerado:**
- Query completa gerada pela LLM
- Placeholders destacados em amarelo (ex: `{{group_col}}`)
- Preview dos resultados (primeiras 10 linhas)

### 3. Decidir: Aprovar ou Rejeitar

#### ✅ Aprovar (Criar Template)

Clique no botão verde **"Aprovar como template"**

**Modal de Aprovação - 3 Abas:**

**Aba 1: Informações Básicas**
- **Nome do Template** (obrigatório): Nome descritivo
  - Exemplo: "Análise de Margem de Lucro por Produto"
- **Categoria**: Analytics, Vendas, Financeiro, RH, Marketing, Logística
- **Descrição**: Explique o que o template faz
- **Tags Semânticas** (obrigatório, min 1, max 10):
  - Palavras-chave que usuários podem usar ao perguntar
  - Sistema detecta automaticamente o template baseado nessas tags
  - Botão **"Sugerir com IA"**: LLM sugere tags automaticamente
  - Exemplo: ["margem", "lucro", "produto", "rentabilidade"]

**Aba 2: Mapeamento de Colunas**
- Sistema **detecta automaticamente** placeholders no SQL (padrão `{{nome}}`)
- Para cada placeholder, configure:
  - **Tipo**: texto, numérico, data, booleano
  - **Descrição**: Explique o que deve ir neste campo
  - **Valor Padrão** (opcional): Se aplicável
- Sistema **sugere tipos automaticamente** baseado no nome do placeholder
  - `{{value_col}}` → numérico
  - `{{group_col}}` → texto
  - `{{date_col}}` → data
  - `{{limit}}` → numérico

**Aba 3: Preview**
- Visualize o SQL completo com placeholders destacados
- Resumo da configuração:
  - Nome, categoria, quantidade de tags
  - Placeholders detectados vs configurados
  - Status de cada placeholder (configurado ou pendente)
- **Validação automática** antes de aprovar:
  - Nome preenchido?
  - Pelo menos 1 tag semântica?
  - Todos os placeholders configurados?
  - Descrições preenchidas?

#### ❌ Rejeitar

Se o SQL não é adequado para virar template:
1. Clique no botão vermelho **"Rejeitar"**
2. **Motivo obrigatório**: Explique por que está rejeitando
   - Exemplo: "SQL muito específico para um caso único"
   - Exemplo: "Já existe template similar"
   - Exemplo: "Query ineficiente ou incorreta"
3. Registro fica marcado como "rejeitado" (não aparece mais em pendentes)

### 4. Resultado da Aprovação

Quando você aprova:
1. **Novo template** é criado na tabela `models` (template_type='analytics')
2. Registro em `custom_sql_attempts` é marcado como **"aprovado"**
3. Link entre o SQL original e o template criado é mantido
4. **Template fica disponível IMEDIATAMENTE** para todos os usuários
5. Próxima pergunta similar → Sistema detecta automaticamente e usa o novo template

---

## 📊 Estatísticas e Métricas

Na interface `/admin/learning`, você vê:

**Resumo:**
- **Pendentes**: Quantos SQLs aguardam revisão
- **Aprovados**: Quantos viraram templates
- **Templates Ativos**: Total de templates analytics disponíveis
- **Taxa de Aprovação**: Percentual de aprovação vs total

**Filtros:**
- Buscar por texto na pergunta ou SQL
- Filtrar por status (pendente/aprovado/rejeitado)
- Ver apenas templates ativos

---

## 🎓 Boas Práticas para Masters

### Quando Aprovar

✅ Aprove quando:
- SQL está **correto e eficiente**
- Pergunta é **comum e recorrente**
- Template pode ser **reutilizado** em múltiplos contextos
- Placeholders são **claros e bem definidos**
- Já houve **múltiplas perguntas similares**

### Quando Rejeitar

❌ Rejeite quando:
- SQL é **muito específico** para um caso único
- Query é **ineficiente** ou incorreta
- Já existe **template similar** (evitar duplicação)
- Pergunta é **ambígua** ou mal formulada
- SQL usa **colunas hardcoded** que não existirão em outros datasets

### Dicas de Nomenclatura

**Nome do Template:**
- Use verbos: "Calcular", "Analisar", "Identificar"
- Seja específico: "Ticket Médio por Região" > "Análise de Vendas"
- Evite: "Query 1", "Template Teste"

**Tags Semânticas:**
- Pense como o usuário perguntaria
- Use sinônimos: ["ticket", "média", "medio", "average"]
- Inclua variações: ["vendas", "venda", "faturamento", "receita"]
- Evite tags muito genéricas: ["dados", "análise"]

**Descrição de Placeholders:**
- Seja claro: "Coluna com valor de venda" > "Valor"
- Dê exemplos se possível: "Coluna de agrupamento (ex: região, categoria)"
- Especifique restrições: "Coluna numérica com valores positivos"

---

## 🔍 Detecção Automática de Duplicatas

O sistema tem função **`check_similar_templates`** que detecta:
- Templates com **tags semânticas similares**
- Templates com **SQL estruturalmente similar**
- **Threshold de 70%** de similaridade

**Antes de aprovar**, o sistema automaticamente checa se já existe template similar e te avisa.

---

## 📈 Evolução do Sistema

### Ciclo de Aprendizado

```
Semana 1: 4 templates básicos (inseridos na migration)
         ↓
Usuários fazem perguntas diversas
         ↓
10 SQLs customizados gerados e salvos (status='pending')
         ↓
Master revisa e aprova 7, rejeita 3
         ↓
Semana 2: 11 templates disponíveis (4 + 7 aprovados)
         ↓
Taxa de match aumenta (mais perguntas usam templates)
         ↓
Custo de API diminui (menos SQL dinâmico)
         ↓
Accuracy melhora (SQL validado e testado)
```

### Métricas de Sucesso

**Monitorar:**
- **Taxa de Template Match**: % de análises que usaram template vs SQL dinâmico
- **Templates Aprovados por Semana**: Velocidade de evolução
- **Taxa de Reuso**: Quantas vezes cada template foi usado
- **Qualidade**: Taxa de sucesso das análises (erros vs sucesso)

---

## 🛠️ Manutenção e Gestão

### Editar Template Existente

Na aba **"Templates Ativos"**:
1. Clique no ícone de **edição** (lápis azul)
2. Modifique:
   - Nome
   - Categoria
   - Descrição
   - Tags semânticas
3. **NÃO é possível editar**: SQL template, required_columns
   - Se precisar mudar o SQL, crie novo template e delete o antigo

### Deletar Template

1. Clique no ícone de **lixeira** (vermelho)
2. Confirmação obrigatória
3. Template é removido permanentemente
4. Análises antigas que usaram o template **não são afetadas**
   - Link `template_used_id` fica NULL (ON DELETE SET NULL)

### Copiar SQL de Template

Botão **"Copiar"** copia o SQL para clipboard, útil para:
- Testar manualmente no SQL Editor
- Criar variações
- Documentação

---

## 🚀 Seed Inicial de Templates

Execute o arquivo **`supabase/seed-analytics-templates.sql`** para popular templates iniciais:

**Templates Básicos (4):**
- Ticket Médio por Grupo
- Top N Itens
- Soma por Grupo
- Contagem por Categoria

**Templates de Vendas (3):**
- Giro de Estoque
- Curva ABC de Produtos
- Análise de Sazonalidade

**Templates Financeiros (2):**
- Contas a Receber por Vencimento
- Fluxo de Caixa Projetado

**Templates de RH (2):**
- Análise de Turnover
- Distribuição Salarial por Cargo

**Templates de Marketing (2):**
- ROI de Campanhas
- Funil de Conversão

**Templates de Logística (1):**
- Tempo Médio de Entrega por Região

**Total:** 14 templates prontos para uso

### Como Executar o Seed

**Opção 1: Supabase Dashboard**
1. Acesse: **Supabase Dashboard → SQL Editor**
2. Cole o conteúdo de `seed-analytics-templates.sql`
3. Clique em **"Run"**

**Opção 2: CLI (se disponível)**
```bash
supabase db execute -f supabase/seed-analytics-templates.sql
```

**Verificação de Duplicatas:**
O seed tem proteção automática:
- Usa função `insert_template_if_not_exists`
- Se template já existe, pula (não gera erro)
- Logs indicam quais foram inseridos vs pulados

---

## 📝 Perguntas Frequentes

### P: O que acontece se eu aprovar um SQL incorreto?
**R:** Você pode:
1. Editar as tags semânticas para reduzir matches
2. Deletar o template
3. O sistema continuará funcionando (usuários não perdem dados)

### P: Como sei se um template está sendo usado?
**R:** Você pode verificar na tabela `data_analyses`:
```sql
SELECT
  m.name as template_name,
  COUNT(*) as vezes_usado
FROM data_analyses da
JOIN models m ON da.template_used_id = m.id
WHERE m.template_type = 'analytics'
GROUP BY m.name
ORDER BY vezes_usado DESC
```

### P: Posso criar templates manualmente?
**R:** Sim! Use a função helper no seed:
```sql
SELECT insert_template_if_not_exists(
  'Nome do Template',
  'Categoria',
  'Descrição',
  'SELECT {{placeholder}} FROM temp_data',
  '{"placeholder": {"type": "text", "description": "Desc"}}'::jsonb,
  '["tag1", "tag2"]'::jsonb
);
```

### P: Qual a diferença entre templates analytics e presentation?
**R:**
- **Analytics**: SQL-based, auto-selected, usado para análise de dados
- **Presentation**: HTML-based, user-selected, usado para documentos

### P: O sistema aprova templates automaticamente?
**R:** **NÃO!** Todo template precisa de aprovação manual de um Master. Isso garante qualidade e evita SQL incorreto ou malicioso.

---

## 🎉 Benefícios do Sistema

**Para Usuários:**
- ✅ Respostas mais rápidas (templates já validados)
- ✅ Maior precisão (SQL testado e aprovado)
- ✅ Experiência consistente

**Para Masters:**
- ✅ Controle total sobre qualidade
- ✅ Sistema evolui com casos reais
- ✅ Visibilidade de padrões de uso

**Para o Sistema:**
- ✅ Redução de custos (menos chamadas LLM para SQL dinâmico)
- ✅ Melhoria contínua de accuracy
- ✅ Detecção automática de casos de uso comuns
- ✅ Base de conhecimento cresce organicamente

---

## 📞 Suporte

Se encontrar problemas ou tiver dúvidas:
1. Verifique os logs da edge function `analyze-file`
2. Confira a tabela `custom_sql_attempts` diretamente no SQL Editor
3. Revise a documentação completa em `KNOWLEDGE_BASE_SYSTEM_COMPLETE.md`

**Logs importantes:**
- Edge function: Console do Supabase Functions
- Frontend: Console do navegador (F12)
- Banco: Tabela `custom_sql_attempts` e `models`
