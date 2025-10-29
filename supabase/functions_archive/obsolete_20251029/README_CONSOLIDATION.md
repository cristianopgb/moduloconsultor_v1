# Edge Functions Obsoletas - Consolidação 29/10/2025

## Funções Arquivadas

### consultor-chat/
**Motivo:** Substituída completamente por `consultor-rag`

**Arquitetura Antiga:**
- Usava `jornadas_consultor` + `areas_trabalho`
- Sistema chat-based com FSM manual
- Gamificação acoplada ao fluxo
- Formulários inline no chat

**Arquitetura Nova (consultor-rag):**
- Usa `consultor_sessoes` (RAG-based)
- Estrategista + Tático + Executor
- Knowledge Base + Sector Adapters
- Actions[] desacopladas

**Status:** Código preservado para referência histórica, mas NÃO DEVE ser usado.

---

## Impacto da Remoção

✅ Zero impacto - função não era mais chamada pelo frontend
✅ consultor-rag implementa 100% da funcionalidade (melhorada)
✅ Reduce surface area (menos código para manter)

---

## Outras Funções Obsoletas (já arquivadas anteriormente)

- gerar-bpmn
- gerar-diagnostico
- gerar-entregavel
- gerar-plano-acao

**Todas substituídas por:** template-service.ts + rag-executor.ts

---

## Funções Ativas (Validadas)

✅ consultor-rag - Principal (3-layer architecture)
✅ update-session-context - Session management seguro
✅ recalculate-progress - Progresso manual
✅ analyze-file - Analytics V2
✅ generate-document - DOCX generation
✅ template-fill - Template rendering
✅ query-dataset - SQL queries
... (outras funções de suporte)

---

**Data do Arquivamento:** 29 de Outubro de 2025
**Responsável:** Sistema de Auditoria Automática
