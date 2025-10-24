# Migrações Duplicadas e Obsoletas - Arquivadas em 24/10/2025

## Status: ARQUIVADAS - NÃO USAR

Este diretório contém migrações que foram identificadas como duplicadas ou obsoletas durante o processo de sanitização de migrações do projeto.

---

## Problema Identificado

Durante a evolução do projeto, múltiplas migrações foram criadas para adicionar as mesmas funcionalidades, resultando em:

1. **Conflitos de execução**: Tentativas de criar colunas que já existem
2. **Migrações incompletas**: Versões antigas não continham todos os campos necessários
3. **Duplicatas exatas**: Arquivos com timestamps diferentes mas conteúdo idêntico

---

## Arquivos Arquivados

### Grupo 1: Duplicatas Exatas (Conteúdo Idêntico)

#### 20251015174239_20251015020000_create_framework_checklist_paralelo.sql
- **Status**: DUPLICATA EXATA
- **Original**: 20251015020000_create_framework_checklist_paralelo.sql
- **Motivo**: Arquivo gerado com timestamp diferente mas conteúdo 100% idêntico
- **Impacto**: Causaria erro ao tentar criar tabelas/índices já existentes
- **Substituída por**: A versão original permanece ativa

---

### Grupo 2: Migrações Incompletas - Substituídas por Versão Consolidada

#### 20251024000001_add_slug_entregaveis.sql
- **Status**: OBSOLETA - INCOMPLETA
- **O que fazia**: Adicionava apenas coluna `slug` em entregaveis_consultor
- **Problema**: Código TypeScript espera também `titulo` e `updated_at`
- **Resultado**: UPSERT falharia por colunas faltantes
- **Substituída por**: 20251024160000_fix_entregaveis_schema_complete.sql
- **Versão consolidada inclui**: slug + titulo + updated_at + backfill

#### 20251024151416_20251024000001_add_slug_entregaveis.sql
- **Status**: DUPLICATA da versão incompleta acima
- **Motivo**: Mesmo conteúdo, timestamp diferente
- **Substituída por**: 20251024160000_fix_entregaveis_schema_complete.sql

---

#### 20251024000002_backfill_entregaveis.sql
- **Status**: OBSOLETA - FUNCIONALIDADE INTEGRADA
- **O que fazia**: Backfill de dados em entregaveis_consultor
- **Problema**: Dependia da migração incompleta 20251024000001
- **Substituída por**: 20251024160000_fix_entregaveis_schema_complete.sql
- **Versão consolidada**: Inclui backfill integrado e completo

#### 20251024151438_20251024000002_backfill_entregaveis.sql
- **Status**: DUPLICATA da versão obsoleta acima
- **Motivo**: Mesmo conteúdo, timestamp diferente
- **Substituída por**: 20251024160000_fix_entregaveis_schema_complete.sql

---

### Grupo 3: Campos Redundantes - Já Existem em Migração Anterior

#### 20251024000003_add_framework_flags.sql
- **Status**: OBSOLETA - CAMPOS JÁ CRIADOS
- **O que tentava fazer**: Adicionar campos de validação de escopo em framework_checklist
  - `aguardando_validacao_escopo`
  - `escopo_validado_pelo_usuario`
  - `escopo_validacao_ts`
  - `fase_atual`
- **Problema**: TODOS esses campos já foram criados em 20251023120000_fix_framework_checklist_complete.sql
- **Impacto**: Causaria conflito/sobreposição desnecessária
- **Mantida**: 20251023120000 (versão completa e anterior)
- **Motivo do arquivamento**: Redundância total

#### 20251024151459_20251024000003_add_framework_flags.sql
- **Status**: DUPLICATA da versão redundante acima
- **Motivo**: Mesmo conteúdo, timestamp diferente
- **Mantida**: 20251023120000_fix_framework_checklist_complete.sql

---

## Migrações Mantidas (Versões Finais)

### ✅ 20251015020000_create_framework_checklist_paralelo.sql
- Cria tabelas `framework_checklist` e `processo_checklist`
- Versão original e completa
- Mantida e ativa

### ✅ 20251023120000_fix_framework_checklist_complete.sql
- Adiciona campos de CTA, validação de escopo, controle de loops
- Inclui: aguardando_validacao_escopo, escopo_validado_pelo_usuario, escopo_validacao_ts, fase_atual
- Versão mais completa que 20251024000003
- Mantida e ativa

### ✅ 20251024160000_fix_entregaveis_schema_complete.sql
- Adiciona slug + titulo + updated_at em entregaveis_consultor
- Inclui backfill automático de dados existentes
- Cria índice único (jornada_id, slug)
- Versão consolidada que substitui 20251024000001 e 20251024000002
- Mantida e ativa

---

## Matriz de Conflitos Resolvidos

| Campo/Funcionalidade | Migração Obsoleta | Migração Final Mantida |
|---------------------|-------------------|------------------------|
| `slug` (entregaveis) | 20251024000001 | 20251024160000 |
| `titulo` (entregaveis) | ❌ Não existia | 20251024160000 ✅ |
| `updated_at` (entregaveis) | ❌ Não existia | 20251024160000 ✅ |
| Backfill entregaveis | 20251024000002 | 20251024160000 |
| `aguardando_validacao_escopo` | 20251024000003 | 20251023120000 ✅ |
| `escopo_validado_pelo_usuario` | 20251024000003 | 20251023120000 ✅ |
| `escopo_validacao_ts` | 20251024000003 | 20251023120000 ✅ |
| `fase_atual` | 20251024000003 | 20251023120000 ✅ |
| framework_checklist tabela | 20251015174239 (dup) | 20251015020000 ✅ |

---

## Processo de Sanitização

### Data: 24/10/2025

### Etapas Executadas:

1. **Análise de Conflitos**
   - Identificadas 7 migrações duplicadas/obsoletas
   - Mapeados conflitos de colunas sendo criadas múltiplas vezes
   - Documentados campos faltantes em versões incompletas

2. **Validação de Versões Finais**
   - Confirmado que 20251023120000 contém TODOS os campos de validação
   - Confirmado que 20251024160000 contém slug + titulo + updated_at
   - Validado que versões finais são idempotentes

3. **Arquivamento Seguro**
   - Migrações movidas para migrations_archive/duplicates_20251024/
   - Conteúdo preservado para auditoria
   - README criado com documentação completa

4. **Resultado Final**
   - 7 arquivos arquivados
   - 3 migrações ativas mantidas
   - Zero conflitos de colunas
   - Schema final compatível com código TypeScript

---

## Impacto e Benefícios

### Antes da Sanitização:
- ❌ Erro "column already exists" em aguardando_validacao_escopo
- ❌ Erro "column already exists" em escopo_validado_pelo_usuario
- ❌ Erro "column already exists" em slug
- ❌ UPSERT falhando por falta de titulo e updated_at
- ❌ Linha temporal de migrações confusa e duplicada

### Depois da Sanitização:
- ✅ Nenhum conflito de colunas
- ✅ Schema completo com todos os campos esperados pelo código
- ✅ UPSERT funcionando corretamente em entregaveis_consultor
- ✅ Linha temporal limpa e linear
- ✅ Documentação clara do que foi removido e por quê

---

## Como Evitar Duplicatas no Futuro

### Checklist Antes de Criar Nova Migração:

1. **Verificar Migrações Existentes**
   ```bash
   # Buscar se campo já existe
   grep -r "column_name_here" supabase/migrations/

   # Buscar se tabela já existe
   grep -r "CREATE TABLE table_name" supabase/migrations/
   ```

2. **Usar IF NOT EXISTS**
   ```sql
   -- SEMPRE use IF NOT EXISTS
   DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'sua_tabela' AND column_name = 'sua_coluna'
     ) THEN
       ALTER TABLE sua_tabela ADD COLUMN sua_coluna tipo;
     END IF;
   END $$;
   ```

3. **Nomear Migrações Descritivamente**
   - Use nomes que indiquem o que a migração faz
   - Evite nomes genéricos como "fix" ou "update"
   - Inclua contexto: `add_slug_titulo_updated_at_to_entregaveis`

4. **Consolidar Features Relacionadas**
   - Se adicionar múltiplos campos relacionados, faça em uma única migração
   - Exemplo: slug + titulo + updated_at juntos, não separados

5. **Testar Localmente Primeiro**
   - Execute migração em banco local antes de commit
   - Verifique se não há erros de duplicação
   - Confirme que schema final está como esperado

6. **Documentar Dependências**
   - Se migração depende de outra, documente no header
   - Liste campos/tabelas que devem existir antes

---

## Referências

- **Documentação Principal**: `/supabase/migrations/README.md`
- **Relatório de Sanitização**: `/SANITIZACAO_MIGRACOES_CONSULTOR_24OUT2025.md`
- **Arquivo Original de Análise**: `/ANALISE_MIGRACOES_CONSULTOR.md`

---

## Contato e Suporte

Se encontrar problemas relacionados a estas migrações arquivadas:

1. **NÃO restaure** estes arquivos para o diretório de migrações
2. Consulte as versões finais mantidas listadas acima
3. Verifique a documentação de sanitização
4. Em caso de dúvida, consulte o histórico Git para ver o estado antes do arquivamento

---

**Arquivado por**: Sistema de Sanitização de Migrações
**Data**: 24 de Outubro de 2025
**Versão do Documento**: 1.0
**Status**: DEFINITIVO - NÃO MODIFICAR
