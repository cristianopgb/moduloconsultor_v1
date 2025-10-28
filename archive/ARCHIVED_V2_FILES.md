# Arquivos -v2 Não Utilizados

## Data: 27 de Outubro de 2025

## Arquivos Movidos

### 1. `marker-processor-v2.ts`
- **Origem**: `supabase/functions/consultor-chat/marker-processor-v2.ts`
- **Status**: ❌ Nunca importado
- **Versão Ativa**: `marker-processor.ts` (sem sufixo)

**Evidência**:
```typescript
// index.ts importa apenas versão sem -v2:
import { MarkerProcessor } from './marker-processor.ts';
```

### 2. `intelligent-prompt-builder-v2.ts`
- **Origem**: `supabase/functions/consultor-chat/intelligent-prompt-builder-v2.ts`
- **Status**: ❌ Nunca importado
- **Versão Ativa**: `intelligent-prompt-builder.ts` (sem sufixo)

**Evidência**:
```typescript
// index.ts importa apenas versão sem -v2:
import { IntelligentPromptBuilder } from './intelligent-prompt-builder.ts';
```

## Motivo do Arquivamento

Durante o refatoramento, foram criadas versões "-v2" de alguns arquivos, mas o `index.ts` nunca foi atualizado para importá-las. As versões originais (sem sufixo) são as que estão em uso.

## Impacto

- ✅ Elimina confusão sobre qual versão está ativa
- ✅ Reduz tamanho do bundle (arquivos não usados não são compilados)
- ✅ Clarifica arquitetura do código

## Rollback

Se necessário restaurar:

```bash
mv archive/marker-processor-v2.ts supabase/functions/consultor-chat/
mv archive/intelligent-prompt-builder-v2.ts supabase/functions/consultor-chat/
```

## Decisão Final

Após análise, as versões -v2 podem ser **permanentemente deletadas** ou mantidas como referência histórica de implementações alternativas.
