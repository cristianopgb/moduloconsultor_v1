# Sistema de Knowledge Base SQL - Implementação Completa

## Visão Geral

Sistema completo de aprendizado contínuo onde SQLs customizados gerados dinamicamente podem ser revisados, aprovados e transformados em templates reutilizáveis.

## Status: ✅ 100% Implementado

### Backend (Banco de Dados)

✅ **Tabela `custom_sql_attempts`** (20251008190000)
- Armazena SQLs customizados para revisão
- Status workflow: pending → approved/rejected/duplicate
- Campos completos: user_question, generated_sql, dataset_columns, query_results_sample
- RLS policies: Masters veem tudo, usuários veem apenas seus próprios

✅ **Função `check_similar_templates`** (20251008190000)
- Detecta templates analytics similares
- Evita duplicação automática
- Usa semantic_tags e similarity do SQL

✅ **Função `approve_custom_sql_as_template`** (20251008190000)
- Aprova SQL e cria template analytics permanente
- Parâmetros: JSONB nativos (não JSON.stringify)
- Atualiza status e gera approved_template_id
- Transação atômica

✅ **Integração com `data_analyses`**
- Coluna `template_used_id` rastreia qual template foi usado
- Foreign key para `models(id)`
- Índice para performance

### Edge Function (Salvamento Automático)

✅ **analyze-file/index.ts** (linhas 888-918)
- Sistema de detecção de templates (confidence >= 70%)
- Se nenhum template serve → gera SQL dinâmico
- Salvamento automático em `custom_sql_attempts` (status='pending')
- Campos salvos:
  - user_id, conversation_id, message_id
  - data_analysis_id (link para análise completa)
  - user_question (pergunta original)
  - generated_sql (SQL gerado pela LLM)
  - dataset_columns (schema completo)
  - query_results_sample (primeiras 10 linhas)
  - execution_success: true
  - status: 'pending'

### Frontend (Interface de Aprovação)

✅ **LearningPage.tsx** (/admin/learning)

**Funcionalidades Implementadas:**
- ✅ Lista SQLs por status: pending | approved | rejected | templates
- ✅ Busca por pergunta ou SQL
- ✅ Cards expansíveis com SQL completo e preview de resultados
- ✅ Dashboard com métricas (pendentes, aprovados, taxa de aprovação)

**Modal de Aprovação (3 abas):**

1. **Aba Basic (Informações Básicas)**
   - ✅ Nome do template (auto-sugerido da pergunta)
   - ✅ Categoria (padrão: Analytics)
   - ✅ Descrição (pré-preenchida com pergunta)
   - ✅ Tags semânticas com auto-sugestão via IA
   - ✅ Validação: mínimo 1, máximo 10 tags

2. **Aba Columns (Mapeamento de Placeholders)**
   - ✅ Detecção automática de placeholders {{nome}}
   - ✅ Sugestão de tipos baseada em nomes (numeric, text, date, boolean)
   - ✅ Configuração de: tipo, descrição, valor padrão
   - ✅ Validação: todos placeholders devem ter tipo e descrição
   - ✅ Re-detecção manual disponível

3. **Aba Preview**
   - ✅ SQL destacado com placeholders coloridos
   - ✅ Resumo da aprovação
   - ✅ Status de configuração de cada placeholder
   - ✅ Botão de copiar SQL

**Correções Críticas Aplicadas:**
- ✅ Removido JSON.stringify de p_semantic_tags (linha 354)
- ✅ Removido JSON.stringify de p_required_columns (linha 355)
- ✅ Parâmetros enviados como objetos/arrays nativos JavaScript
- ✅ Validações robustas antes de aprovar
- ✅ Feedback visual de sucesso/erro
- ✅ Logging detalhado para debugging
- ✅ Auto-sugestão de tags ao abrir modal

**Sistema de Rejeição:**
- ✅ Modal de rejeição com campo obrigatório de motivo
- ✅ Atualização de status para 'rejected'
- ✅ Registro de reviewed_by e reviewed_at
- ✅ Feedback visual após rejeição

## Arquitetura de Fluxo

### Fluxo Normal (Template Match - confidence >= 70%)
```
1. Usuário faz upload → analyze-file
2. Sistema busca templates analytics
3. LLM escolhe melhor template
4. SQL mapeado para colunas do dataset
5. Execução em 100% dos dados
6. Interpretação e insights
7. Salvo em data_analyses COM template_used_id
8. NÃO salva em custom_sql_attempts (template já existe)
```

### Fluxo Knowledge Base (Sem Template - confidence < 70%)
```
1. Usuário faz upload → analyze-file
2. Nenhum template tem confidence >= 70%
3. LLM gera SQL dinâmico customizado
4. Execução em 100% dos dados
5. Interpretação e insights
6. Salvo em data_analyses SEM template_used_id
7. ✅ AUTOMATICAMENTE salvo em custom_sql_attempts (status='pending')
8. Master acessa /admin/learning
9. Revisa: pergunta, SQL, schema, resultados
10. Aprova → RPC approve_custom_sql_as_template
11. Cria novo template analytics em models
12. Atualiza custom_sql_attempts (status='approved', approved_template_id)
13. Próximas perguntas similares usam o novo template
```

## Seed de Templates (14+ Templates Prontos)

Execute: `supabase/seed-analytics-templates.sql`

### Templates Básicos (4)
- Ticket Médio por Grupo
- Top N Itens
- Soma por Grupo
- Contagem por Categoria

### Templates de Vendas (3)
- Giro de Estoque
- Curva ABC de Produtos
- Análise de Sazonalidade

### Templates Financeiros (2)
- Contas a Receber por Vencimento
- Fluxo de Caixa Projetado

### Templates de RH (2)
- Análise de Turnover
- Distribuição Salarial por Cargo

### Templates de Marketing (2)
- ROI de Campanhas
- Funil de Conversão

### Templates de Logística (1)
- Tempo Médio de Entrega por Região

## Como Usar

### Para Masters (Aprovar Templates)

1. Acesse `/admin/learning`
2. Veja lista de SQLs pendentes
3. Clique em "Aprovar como template"
4. **Aba Basic:**
   - Revise nome sugerido
   - Adicione tags semânticas (use sugestão IA)
5. **Aba Columns:**
   - Revise tipos de placeholders detectados
   - Adicione descrições claras
6. **Aba Preview:**
   - Confirme configurações
7. Clique "Aprovar Template"
8. ✅ Template criado e disponível imediatamente

### Para Desenvolvedores (Adicionar Templates Manualmente)

```sql
SELECT insert_template_if_not_exists(
  'Nome do Template',
  'Categoria',
  'Descrição do que faz',
  'SELECT {{placeholder}} FROM temp_data WHERE {{condition}}',
  '{"placeholder": {"type": "text", "description": "Descrição"}}'::jsonb,
  '["tag1", "tag2", "tag3"]'::jsonb
);
```

## Testes End-to-End

### Teste 1: Template Existente
```
1. Upload CSV de vendas (10k linhas)
2. Pergunta: "Qual o ticket médio por região?"
3. ✅ Sistema encontra template "Ticket Médio por Grupo"
4. ✅ Mapeia automaticamente colunas
5. ✅ Executa em 100% dos dados
6. ✅ Salva em data_analyses com template_used_id
7. ✅ NÃO salva em custom_sql_attempts
```

### Teste 2: Novo Padrão (Knowledge Base)
```
1. Upload CSV de logística (5k linhas)
2. Pergunta: "Quantas entregas atrasadas por transportadora?"
3. ⚠️ Nenhum template serve (confidence < 70%)
4. ✅ LLM gera SQL dinâmico
5. ✅ Executa em 100% dos dados
6. ✅ Salva em data_analyses SEM template_used_id
7. ✅ AUTOMATICAMENTE salva em custom_sql_attempts (pending)
8. Master acessa /admin/learning
9. ✅ Vê SQL pendente com pergunta, schema, resultados
10. ✅ Aprova como "Entregas Atrasadas por Transportadora"
11. ✅ Template criado em models
12. ✅ custom_sql_attempts atualizado (approved)
13. Próximo usuário com pergunta similar:
14. ✅ Sistema encontra novo template
15. ✅ Usa automaticamente
```

## Banco de Dados

### Tabelas Envolvidas
- `custom_sql_attempts` - Knowledge base de SQLs
- `models` - Templates (template_type='analytics')
- `data_analyses` - Histórico de análises
- `conversations` - Contexto das perguntas
- `messages` - Mensagens do chat

### Funções RPC
- `approve_custom_sql_as_template(...)`
- `check_similar_templates(text, text, float)`
- `exec_sql_secure(text)`
- `exec_sql_secure_transaction(text)`

## Migrações

Total: 17 migrações válidas

### Principais
- `20251008000002` - Analytics V2 base (data_analyses, exec_sql_secure)
- `20251008152235` - Unified Template System (models com analytics)
- `20251008180000` - template_used_id em data_analyses
- `20251008190000` - Custom SQL Knowledge Base (custom_sql_attempts)

### Arquivadas
- `migrations_archive/duplicates_and_obsolete_20251008/` (migração duplicada removida)

## Segurança

### RLS Policies

**custom_sql_attempts:**
- Masters: veem todos registros
- Usuários: veem apenas próprios registros
- Insert: apenas próprios registros
- Update/Delete: apenas masters

**models (template_type='analytics'):**
- Todos usuários autenticados podem ler
- Masters podem criar/editar/deletar

**data_analyses:**
- Usuários veem apenas próprias análises
- CRUD completo nos próprios registros

### SQL Injection Protection
- `exec_sql_secure` permite apenas SELECT
- Bloqueia: DROP, DELETE, UPDATE, INSERT, ALTER, etc
- Valida padrões de temp tables
- Transaction-safe

## Vantagens do Sistema

1. **Evolução Contínua**
   - Sistema aprende com casos reais de usuários
   - Templates criados de perguntas reais
   - Cobertura aumenta automaticamente

2. **Controle de Qualidade**
   - Masters revisam antes de aprovar
   - Validação de placeholders obrigatória
   - Detecção de duplicatas

3. **Eficiência**
   - Template match reduz custo de LLM
   - Queries pré-otimizadas
   - Reutilização automática

4. **Transparência**
   - Histórico completo em custom_sql_attempts
   - Rastreabilidade (reviewed_by, reviewed_at)
   - Motivos de rejeição documentados

## Próximos Passos Sugeridos

### Melhorias de UX
- [ ] Notificação em tempo real para masters (novos SQLs pendentes)
- [ ] Paginação na lista de SQLs pendentes
- [ ] Filtro avançado (data, usuário, sucesso/erro)
- [ ] Gráfico de evolução de templates ao longo do tempo
- [ ] Ranking de templates mais usados

### Funcionalidades Avançadas
- [ ] Sistema de versionamento de templates
- [ ] Preview de como template será usado em dataset real
- [ ] Sugestão automática de categorias baseada em SQL
- [ ] Exportação de templates para arquivo SQL
- [ ] Importação de templates de outros sistemas

### Analytics
- [ ] Dashboard de uso de templates por período
- [ ] Taxa de sucesso de detecção automática
- [ ] Tempo médio de aprovação de SQLs
- [ ] Templates mais/menos usados
- [ ] Usuários que mais contribuem com SQLs únicos

## Conclusão

✅ Sistema 100% funcional e pronto para produção
✅ Integração completa: Backend ↔ Edge Function ↔ Frontend
✅ Correções críticas aplicadas (JSONB vs JSON.stringify)
✅ Validações robustas implementadas
✅ Seed de 14+ templates prontos
✅ Documentação completa
✅ Migrações sanitizadas (duplicatas removidas)

O sistema permite que a aplicação evolua organicamente, transformando perguntas únicas de usuários em templates reutilizáveis através de um processo supervisionado por masters.
