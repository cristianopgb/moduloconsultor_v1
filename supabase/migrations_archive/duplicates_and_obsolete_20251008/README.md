# Migrações Arquivadas - Duplicatas e Obsoletas (2025-10-08)

Este diretório contém migrações que foram arquivadas por serem duplicatas ou obsoletas.

## Arquivos Arquivados

### 1. Duplicatas Exatas (3 arquivos)

#### `20251008013946_analytics_v2_complete.sql`
- **Razão:** Duplicata exata de `20251008000002_analytics_v2_complete.sql`
- **Conteúdo:** Cria tabela `data_analyses` e função `exec_sql_secure`
- **Mantido:** `20251008000002_analytics_v2_complete.sql` (versão original)

#### `20251008150000_fix_exec_sql_secure_temp_tables.sql`
- **Razão:** Duplicata exata de `20251008015808_fix_exec_sql_secure_temp_tables.sql`
- **Conteúdo:** Modifica `exec_sql_secure` para suportar CREATE TEMP TABLE e INSERT
- **Mantido:** `20251008015808_fix_exec_sql_secure_temp_tables.sql` (versão original)

#### `20251008021356_20251008160000_fix_temp_table_validation.sql`
- **Razão:** Duplicata exata de `20251008160000_fix_temp_table_validation.sql`
- **Conteúdo:** Corrige regex pattern para aceitar UUIDs maiúsculos
- **Mantido:** `20251008160000_fix_temp_table_validation.sql` (versão original)

### 2. Migrações Obsoletas (2 arquivos)

#### `20251008000000_create_data_analyses_table.sql`
- **Razão:** Substituída pela versão consolidada `20251008000002_analytics_v2_complete.sql`
- **Conteúdo:** Cria apenas a tabela `data_analyses`
- **Problema:** Versão incompleta - falta a função `exec_sql_secure`
- **Substituído por:** `20251008000002_analytics_v2_complete.sql` (versão mais completa)

#### `20251008000001_create_exec_sql_secure.sql`
- **Razão:** Substituída pela versão consolidada `20251008000002_analytics_v2_complete.sql`
- **Conteúdo:** Cria apenas a função `exec_sql_secure` (versão básica)
- **Problema:** Versão incompleta - falta a tabela `data_analyses`
- **Substituído por:** `20251008000002_analytics_v2_complete.sql` (versão mais completa)

### 3. Migrações com Problemas (1 arquivo)

#### `20251008034103_recreate_get_analysis_safe_function.sql`
- **Razão:** Função com referências a colunas inexistentes
- **Problema:** Tenta retornar colunas `interpretation` e `charts_config` que não existem na tabela `data_analyses`
- **Impacto:** Causaria erro em runtime se executada
- **Observação:** A tabela `data_analyses` tem apenas `ai_response` (jsonb) para armazenar esses dados

## Migrações Válidas Mantidas (14 arquivos)

### Storage e RLS:
1. `20251004000000_consolidate_storage_policies.sql`
2. `20251004094037_fix_models_rls_policies.sql`
3. `20251006175004_add_templates_storage_policies.sql`
4. `20251006175818_fix_templates_storage_policies_conflict.sql`

### Índices:
5. `20251006170841_add_tags_index_to_models.sql`
6. `20251006174009_fix_tags_index_size_limit.sql`
7. `20251006175034_remove_problematic_gin_indexes.sql`

### Analytics (em ordem de execução):
8. `20251008000002_analytics_v2_complete.sql` - Cria tabela e função base
9. `20251008015808_fix_exec_sql_secure_temp_tables.sql` - Suporta temp tables
10. `20251008023616_fix_exec_sql_secure_compound_statements.sql` - Cria exec_sql_secure_transaction
11. `20251008033816_allow_complex_select_queries.sql` - Permite CTEs e queries complexas
12. `20251008033853_fix_messages_analysis_foreign_key.sql` - Corrige FK messages.analysis_id
13. `20251008160000_fix_temp_table_validation.sql` - Corrige validação de UUID

### Template System:
14. `20251008152235_add_unified_template_system_v2.sql` - Sistema unificado de templates

## Segurança

Todos os arquivos arquivados podem ser restaurados se necessário. Eles foram movidos para este diretório em vez de deletados para preservar o histórico.

## Data de Arquivamento

2025-10-08 17:07 UTC
