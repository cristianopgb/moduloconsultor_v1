# Arquivamento de Funções Legadas - 03/11/2025

## Motivo do Arquivamento

Este arquivamento foi realizado como parte do **Plano de Correção Completa do Sistema Consultor RAG**.

As funções arquivadas aqui são versões antigas do módulo consultor que:
- Causavam conflitos com a versão RAG atual (`consultor-rag`)
- Não são mais utilizadas no fluxo atual
- Foram substituídas pela arquitetura unificada do `consultor-rag/index.ts`

## Funções Arquivadas

### 1. **agente-execucao/**
- **Função:** Agente especializado em executar ações do plano 5W2H
- **Status:** Substituído pela lógica integrada no `consultor-rag`
- **Motivo:** Funcionalidade agora é parte do fluxo unificado na fase de "execucao"

### 2. **chat-execucao/**
- **Função:** Chat específico para fase de execução
- **Status:** Redundante com `consultor-rag`
- **Motivo:** Todas as fases são gerenciadas pelo orquestrador principal

### 3. **validar-escopo/**
- **Função:** Validação manual de escopo após priorização
- **Status:** Lógica substituída por detectores automáticos
- **Motivo:** Detector 3 no `consultor-rag` gerencia validação de escopo automaticamente

### 4. **validar-priorizacao/**
- **Função:** Validação de matriz de priorização
- **Status:** Lógica substituída por detectores automáticos
- **Motivo:** Detector 2 no `consultor-rag` gerencia priorização e escopo

### 5. **chat-analyze/** (se existir)
- **Função:** Chat de análise genérico
- **Status:** Não relacionado ao fluxo consultor atual
- **Motivo:** Evitar confusão com módulo de analytics separado

### 6. **chat-assistant/** (se existir)
- **Função:** Assistente genérico de chat
- **Status:** Não relacionado ao fluxo consultor específico
- **Motivo:** Consultor tem orquestrador dedicado

## Versão Atual (Ativa)

**`consultor-rag/`** - Orquestrador completo que gerencia:
- ✅ Anamnese (coleta de informações)
- ✅ Mapeamento (Canvas + Cadeia de Valor)
- ✅ Investigação (Ishikawa + 5 Porquês)
- ✅ Priorização (Matriz GUT + Escopo)
- ✅ Mapeamento de Processos (SIPOC + BPMN)
- ✅ Diagnóstico (consolidação)
- ✅ Execução (Plano 5W2H + Kanban)

## Correções Aplicadas

Este arquivamento faz parte das seguintes correções:

1. **Loop de Priorização:** Correção da flag `aguardando_validacao`
2. **Entregáveis Invisíveis:** Adição de `jornada_id` e correção do campo `tipo`
3. **Timeline não atualiza:** Validação de schema e nomenclatura
4. **Parser robusto:** Detectores funcionando independentemente de actions

## Reversão (Se Necessário)

Se por algum motivo for necessário reverter:

```bash
# Mover funções de volta
cp -r /tmp/cc-agent/59063573/project/supabase/functions_archive/pre_rag_fix_20251103/* \
      /tmp/cc-agent/59063573/project/supabase/functions/

# Remover versão atual
rm -rf /tmp/cc-agent/59063573/project/supabase/functions/consultor-rag
```

**⚠️ NÃO RECOMENDADO** - As funções antigas têm os bugs identificados no diagnóstico.

## Data de Arquivamento

**03 de Novembro de 2025**

## Responsável

Sistema Automático de Correção - Plano de Correção Completa

## Referências

- Documento de diagnóstico: Ver raiz do projeto
- Logs de erro: Ver `supabase-logs-*.csv`
- Schema de tabelas: Ver anexos do diagnóstico
