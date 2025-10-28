# Archived Obsolete Edge Functions - 27/10/2025

## Motivo do Arquivamento

Estas Edge Functions foram **criadas mas nunca invocadas** pelo frontend ou outras funções. Durante o refatoramento do módulo consultor, a lógica foi consolidada em `consultor-chat/deliverable-generator.ts`.

## Análise Detalhada

Ver: `/RELATORIO_ANALISE_CONSULTOR_27OUT2025.md`

## Funções Arquivadas

### 1. `gerar-diagnostico`
- **Status**: ❌ Nunca invocada
- **Evidência**: Zero referências `functions.invoke('gerar-diagnostico')` no código
- **Substituída por**: `consultor-chat/deliverable-generator.ts`

### 2. `gerar-plano-acao`
- **Status**: ❌ Nunca invocada
- **Evidência**: Zero referências `functions.invoke('gerar-plano-acao')` no código
- **Substituída por**: `consultor-chat/deliverable-generator.ts`

### 3. `gerar-bpmn`
- **Status**: ❌ Nunca invocada
- **Evidência**: Zero referências `functions.invoke('gerar-bpmn')` no código
- **Substituída por**: `consultor-chat/deliverable-generator.ts`

### 4. `gerar-entregavel`
- **Status**: ❌ Nunca invocada
- **Evidência**: Zero referências `functions.invoke('gerar-entregavel')` no código
- **Substituída por**: `consultor-chat/deliverable-generator.ts`

## Implementação Ativa

Toda a lógica de geração de entregáveis foi consolidada em:

```typescript
supabase/functions/consultor-chat/
├── deliverable-generator.ts    // Gerador unificado (ATIVO)
├── deliverable-generators.ts   // Helpers de geração (ATIVO)
└── deliverable-engine.ts       // Engine de templates (ATIVO)
```

## Impacto da Remoção

- ✅ Reduz número de Edge Functions de 26 para 22 (15% menos)
- ✅ Elimina confusão sobre qual função chamar
- ✅ Acelera deploy (menos funções para compilar)
- ✅ Reduz surface de manutenção

## Rollback (Se Necessário)

Para restaurar estas funções:

```bash
mv supabase/functions_archive/obsolete_20251027/* supabase/functions/
```

**Nota**: Não recomendado. Se funcionalidade for necessária, usar `consultor-chat` que já implementa tudo.

## Data de Arquivamento

**27 de Outubro de 2025**

## Decisão Final

Após 3 meses sem uso, estas funções podem ser **permanentemente deletadas**.
