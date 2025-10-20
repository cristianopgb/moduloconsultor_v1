# Supabase Migrations - Documentação Completa

Este diretório contém todas as migrações SQL ativas e necessárias para o sistema.

## 📊 Estado Atual (2025-10-10)

- **Migrações Ativas**: 17 arquivos
- **Migrações Arquivadas**: 21 arquivos (em `migrations_archive/`)
- **Última Sanitização**: 2025-10-10 (Consolidação RLS)

## 🎯 Filosofia de Migrações

### Princípios
1. **Uma Fonte de Verdade para RLS**: Todas as políticas RLS em um único arquivo mestre
2. **Idempotência**: Todas as migrações podem ser executadas múltiplas vezes sem erro
3. **Documentação Inline**: Cada migração explica o que faz e por quê
4. **Sem Dados Destrutivos**: NUNCA usar DROP sem backup ou condicionais

### Estrutura
```
migrations/
├── 2025-10-04: Storage e Índices
├── 2025-10-06: Templates e Otimizações
├── 2025-10-08: Analytics V2 + Knowledge Base
└── 2025-10-10: Consolidação Final RLS
```

## 📁 Migrações Ativas (por ordem cronológica)

### Fase 1: Storage e RLS Base (Out 04-06)

#### 20251004000000_consolidate_storage_policies.sql
**Políticas de Storage para Buckets**
- Consolida RLS para `references` (privado) e `previews` (público)
- 12 políticas: 8 para storage.objects + 4 para tabela references
- Remove políticas conflitantes antigas
- Padrão de path: `{user_id}/{filename}`

#### 20251006170841_add_tags_index_to_models.sql
**Índices GIN para Busca**
- Adiciona índices para busca eficiente em tags JSONB
- Índices parciais para evitar erros de tamanho

#### 20251006174009_fix_tags_index_size_limit.sql
**Correção de Limite de Índice**
- Corrige "index row requires 105496 bytes"
- Índice parcial: apenas arrays ≤20 items

#### 20251006175004_add_templates_storage_policies.sql
**Bucket Templates**
- 4 políticas para bucket `templates` (público)
- Permite upload de thumbnails por usuários autenticados

#### 20251006175034_remove_problematic_gin_indexes.sql
**Limpeza de Índices**
- Remove índices GIN problemáticos
- Mantém apenas índices parciais seguros

#### 20251006175818_fix_templates_storage_policies_conflict.sql
**Resolução de Conflitos**
- Remove políticas duplicadas do bucket templates
- Mantém apenas políticas genéricas funcionais

---

### Fase 2: Analytics V2 System (Out 08)

#### 20251008000002_analytics_v2_complete.sql ⭐ BASE
**Sistema Analytics V2 - Fundação**
- Cria tabela `data_analyses` (source of truth)
- Cria função `exec_sql_secure()` (SELECT-only)
- Arquitetura: LLM recebe 50 linhas, SQL executa em 100% dos dados
- **IMPORTANTE**: Não contém políticas RLS (movidas para master)

#### 20251008015808_fix_exec_sql_secure_temp_tables.sql
**Suporte a Temp Tables**
- Permite `CREATE TEMP TABLE`, `INSERT`, `DROP` em tabelas `analysis_temp_*`
- Mantém segurança com padrão de nome específico

#### 20251008023616_fix_exec_sql_secure_compound_statements.sql
**Statements Compostos**
- Cria `exec_sql_secure_transaction()` para múltiplos statements
- Resolve problema de temp tables desaparecendo entre chamadas RPC

#### 20251008033816_allow_complex_select_queries.sql
**Queries Analíticas Complexas**
- Suporta CTEs (WITH), subqueries, window functions
- Permite CASE, PARTITION BY, agregações avançadas

#### 20251008033853_fix_messages_analysis_foreign_key.sql
**Correção de Foreign Key**
- Corrige FK `messages.analysis_id`: `analyses` → `data_analyses`
- Resolve erro 409 ao salvar resultados

#### 20251008160000_fix_temp_table_validation.sql
**Validação de UUID**
- Corrige regex: `[a-f0-9]` → `[a-fA-F0-9]`
- Aceita UUIDs em maiúsculas

---

### Fase 3: Sistema de Templates Unificado (Out 08)

#### 20251008152235_add_unified_template_system_v2.sql
**Templates Unificados**
- Estende `models` com:
  - `template_type` ('analytics' | 'presentation')
  - `sql_template` (query parametrizada)
  - `required_columns` (mapeamento)
  - `semantic_tags` (detecção automática)
- Estende `conversations` com `chat_mode`
- Estende `messages` com `template_used_id`, `message_type`
- Insere 4 templates analytics padrão

#### 20251008170000_create_get_analysis_safe_correct.sql
**Recuperação Segura de Análises**
- Função `get_analysis_safe()` com tratamento de erros
- Validação de permissões RLS
- Usado para histórico de análises

#### 20251008180000_add_template_used_id_to_data_analyses.sql
**Rastreamento de Templates**
- Adiciona `template_used_id` em `data_analyses`
- FK para `models(id)` com ON DELETE SET NULL
- Índice para queries filtradas por template

---

### Fase 4: Knowledge Base System (Out 08)

#### 20251008190000_create_custom_sql_knowledge_base.sql ⭐ KNOWLEDGE BASE
**Sistema de Aprendizado de SQL Customizados**
- Cria tabela `custom_sql_attempts`:
  - Status: pending | approved | rejected | duplicate
  - Workflow de revisão por masters
  - Campos: user_question, generated_sql, dataset_columns
- Funções:
  - `check_similar_templates()` - Detecta duplicatas
  - `approve_custom_sql_as_template()` - Aprova e cria template
- **RLS**: Habilitado aqui, políticas na migração mestre

---

### Fase 5: Consolidação Final (Out 10)

#### 20251010000000_master_rls_policies_consolidated.sql ⭐ MASTER RLS
**Fonte Única de Verdade para RLS**
- Remove TODAS as políticas existentes dinamicamente
- Recria 51 políticas em 11 tabelas com naming consistente
- Usa função `is_master()` para evitar recursão
- Validação automática e reporting detalhado
- **Tabelas cobertas**:
  - users (4), custom_sql_attempts (5)
  - ai_agents (1), ai_providers (1)
  - analyses (5), datasets (5), documents (5)
  - projects (5), conversations (5), messages (5)
  - data_analyses (4)

**Naming Convention**: `{table}_{operation}_{scope}`
- Exemplos: `users_select_own`, `datasets_insert_master`

---

## 🔐 Modelo de Segurança RLS

### Permissões Padrão
- **Usuários**: SELECT, INSERT, UPDATE, DELETE em seus próprios dados
- **Masters**: SELECT em todos os dados + gestão de AI configs
- **Messages**: Herdam permissões de conversations

### Tabelas Master-Only
- `ai_agents` - Configuração de agentes IA
- `ai_providers` - Configuração de provedores LLM

### Storage Buckets (Separado)
- `references` (privado): Path `{user_id}/{filename}`
- `previews` (público): Acesso público para visualização
- `templates` (público): Thumbnails acessíveis publicamente

---

## 🗃️ Estrutura de Dados Principal

### Tabela: data_analyses
Ciclo completo de uma análise:
```sql
- file_hash           → Cache de arquivos
- parsed_schema       → Estrutura detectada (100% dos dados)
- sample_data         → 50 linhas para contexto LLM
- user_question       → Pergunta original
- generated_sql       → SQL gerado
- full_dataset_rows   → Total de linhas (SQL executa em 100%)
- query_results       → Resultados da execução
- ai_response         → Insights e visualizações
- template_used_id    → Template analytics usado (nullable)
```

### Tabela: custom_sql_attempts
Knowledge base para revisão:
```sql
- user_question         → Pergunta que gerou SQL
- generated_sql         → SQL dinâmico da LLM
- dataset_columns       → Schema [{name, type, sample_values}]
- query_results_sample  → Primeiras 10 linhas
- execution_success     → Sucesso na execução
- status                → pending | approved | rejected | duplicate
- reviewed_by           → UUID do master revisor
- approved_template_id  → Template criado (se aprovado)
- rejection_reason      → Motivo de rejeição
```

---

## ⚙️ Funções PostgreSQL

### exec_sql_secure(text)
- Executa SELECT-only SQL
- Bloqueia operações destrutivas
- Suporta temp tables `analysis_temp_*`

### exec_sql_secure_transaction(text)
- Múltiplos statements em transação
- CREATE TEMP + INSERT + SELECT + DROP
- Para análises com tabelas temporárias

### check_similar_templates(text, text, float)
- Detecta templates similares
- Parâmetros: pergunta, sql, threshold (default 0.7)
- Retorna: id, nome, score, is_duplicate

### approve_custom_sql_as_template(...)
- Aprova SQL e cria template analytics
- Atualiza status para 'approved'
- Retorna UUID do novo template

### is_master()
- Helper para verificar se usuário é master
- Usa `auth.users` para evitar recursão
- Verifica email pattern ou metadata->>'role'

---

## 🔄 Workflows do Sistema

### Análise com Template (Confidence ≥ 70%)
```
1. Upload de arquivo (10K linhas)
2. Parse 100% do arquivo
3. LLM recebe schema + 50 linhas sample
4. Sistema busca templates analytics
5. LLM escolhe melhor template (≥70% confidence)
6. SQL mapeado para colunas do dataset
7. PostgreSQL executa em TODAS as linhas
8. LLM interpreta e cria insights
9. Salvo em data_analyses com template_used_id
```

### Análise sem Template (Confidence < 70%)
```
1-3. Igual ao fluxo com template
4. Nenhum template ≥ 70% confidence
5. LLM gera SQL dinâmico customizado
6-8. Igual ao fluxo com template
9. Salvo em data_analyses SEM template_used_id
10. Automaticamente salvo em custom_sql_attempts
11. Master revisa em /admin/learning
12. Se aprovado → novo template em models
13. Futuras análises similares usam novo template
```

---

## 🛠️ Manutenção e Boas Práticas

### Adicionar Nova Migração

1. **Criar arquivo** com timestamp: `YYYYMMDDHHMMSS_description.sql`
2. **Documentar** propósito no cabeçalho com comentários
3. **Usar IF NOT EXISTS** para idempotência
4. **Não adicionar RLS** - use a migração mestre
5. **Testar** localmente antes de deploy

### Adicionar Políticas RLS

**NÃO** crie políticas em migrações de features!

1. Edite `20251010000000_master_rls_policies_consolidated.sql`
2. Adicione tabela ao array `tables_to_clean`
3. Crie seção com políticas da nova tabela
4. Atualize `expected_count` na validação
5. Teste com `validate-rls.sql`

### Troubleshooting Erros RLS

**Erro 403 / Permission Denied**
```sql
-- 1. Verificar se RLS está habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'sua_tabela';

-- 2. Listar políticas da tabela
SELECT * FROM pg_policies
WHERE tablename = 'sua_tabela';

-- 3. Testar como usuário específico
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM sua_tabela; -- Deve retornar apenas dados do usuário
```

**Políticas Conflitantes**
```sql
-- Listar todas as políticas com mesmo nome
SELECT schemaname, tablename, policyname, COUNT(*)
FROM pg_policies
GROUP BY schemaname, tablename, policyname
HAVING COUNT(*) > 1;

-- Resolver: Execute a migração mestre RLS que limpa tudo primeiro
```

---

## 📂 Arquivos Relacionados

- **Seed de Templates**: `supabase/seed-analytics-templates.sql`
- **Script de Validação**: `supabase/validate-rls.sql` *(a criar)*
- **Migrations Arquivadas**: `supabase/migrations_archive/README_ARCHIVE.md`

---

## 🔄 Histórico de Sanitização

### 2025-10-10: Consolidação RLS Completa
- ✅ Removidas 5 políticas duplicadas de `custom_sql_attempts`
- ✅ Criada migração mestre consolidada (51 políticas)
- ✅ Arquivada migração RLS anterior
- ✅ Atualizada documentação completa
- ✅ Reduzido de 18 para 17 migrações ativas
- ✅ 21 migrações arquivadas organizadas

**Resultado**: Sistema mais limpo, manutenível e sem conflitos de políticas.

---

## 📞 Contato e Suporte

Para questões sobre migrações:
1. Verifique este README primeiro
2. Consulte `migrations_archive/README_ARCHIVE.md` para histórico
3. Use script de validação para diagnosticar problemas
4. Em caso de dúvida, reverta para último estado conhecido estável

---

**Última Atualização**: 2025-10-10
**Versão**: 2.0 (Pós-Consolidação RLS)
