# CRITICAL: consultor-rag/index.ts Foi Truncado Acidentalmente

## O Problema
O arquivo `supabase/functions/consultor-rag/index.ts` foi truncado de 850 linhas para apenas 112 linhas durante a tentativa de deploy.

## O Que Funcionava
- Sistema de detectores automáticos de completude de fases
- RAG integration com knowledge base
- Infinite loop fix (linha 676: aguardandoValidacaoNova = null)
- Anamnese detector com validação de 10 campos obrigatórios
- Timeline automática
- Gamificação por fase

## Correções Já Aplicadas (Intactas)
✅ `/tmp/cc-agent/59063573/project/supabase/functions/_shared/deliverable-templates.ts`
   - Canvas template com suporte a múltiplos formatos de dados (canvas_ prefixado)
   - Value Chain template com categorização automática de processos
   - Management processes section adicionada
   - Executive summaries adicionados em ambos

## Como Restaurar

### Opção 1: Usar backup do sistema
```bash
# Se houver backup git ou similar
git checkout supabase/functions/consultor-rag/index.ts
```

### Opção 2: Reconstituir manualmente
O arquivo deve ter aproximadamente 850 linhas com estas seções principais:

1. **Imports e configuração** (linhas 1-73)
2. **Main Deno.serve handler** (linhas 74-118)
3. **Buscar sessão e contexto** (linhas 103-210)
4. **Chamar LLM** (linhas 236-262)
5. **Parser multi-estratégia** (linhas 264-352)
6. **Detectores automáticos** (linhas 359-543)
   - Detector 1: ANAMNESE COMPLETA (linhas 366-421) - **REQUER 10/10 CAMPOS**
   - Detector 2: PRIORIZAÇÃO COMPLETA (linhas 423-477)
   - Detector 3: VALIDAÇÃO DE ESCOPO (linhas 479-503)
   - Detector 4: MAPEAMENTO PROCESSOS (linhas 505-543)
   - Detector 5: VALIDAÇÃO DE TRANSIÇÃO (linhas 545-558)
7. **Salvar mensagens** (linhas 560-594)
8. **Processar actions** (linhas 596-721)
9. **Atualizar contexto** (linhas 723-818)
10. **Retornar resposta** (linhas 820-850)

### Opção 3: Deploy apenas do template fix
Como as correções principais estão em `deliverable-templates.ts`, podemos:

```bash
# Testar se o Edge Function atual funciona com os novos templates
# Os templates são importados dinamicamente via getTemplateForType()
```

## Próximos Passos
1. Restaurar consultor-rag/index.ts com conteúdo completo
2. Confirmar que linha 676 tem: `aguardandoValidacaoNova = null;`
3. Confirmar que linha 389 tem: `if (collectedFields.length === 10 && !hasTransition && !hasEntregavel)`
4. Deploy completo com todas as dependências

## Status Atual
- ❌ consultor-rag/index.ts truncado (112 linhas ao invés de 850)
- ✅ deliverable-templates.ts com fixes do Canvas e Value Chain
- ✅ consultor-prompts.ts intacto (1199 linhas)
- ✅ Outros arquivos _shared/ intactos
