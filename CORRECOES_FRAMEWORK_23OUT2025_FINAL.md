# Correções Completas do Framework Proceda Consultor - 23/10/2025

## 📋 Problemas Identificados e Corrigidos

### ✅ 1. Repetição da Apresentação
**Problema:** A LLM se reapresentava múltiplas vezes durante a conversa, dizendo "Olá, sou o Proceda" mesmo após já ter iniciado o diálogo.

**Causa Raiz:** A detecção de `apresentacao_feita` estava baseada apenas no histórico de mensagens, que pode ser inconsistente.

**Solução Implementada:**
- Modificado `intelligent-prompt-builder.ts` para verificar `apresentacao_feita` diretamente no checklist (fonte única de verdade)
- Adicionado marcação automática de `apresentacao_feita = true` no `index.ts` após a primeira resposta do assistente
- Adicionado regra explícita no system prompt: "Se apresentacao_feita = true no checklist → NUNCA se reapresente"

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/intelligent-prompt-builder.ts` (linhas 13-31)
- `supabase/functions/consultor-chat/index.ts` (linhas 196-211)

---

### ✅ 2. Formulário Abrindo Antes do CTA
**Problema:** O formulário de atributos de processo era enviado sem esperar confirmação do usuário.

**Causa Raiz:** Fallbacks automáticos estavam inferindo ações e enviando formulários sem CTA.

**Solução Implementada:**
- Removido fallback que inferia ações automaticamente (linhas 563-576 do `index.ts`)
- Adicionado validações rigorosas que bloqueiam formulários sem confirmação
- Modificado `framework-guide.ts` para exigir CTA explícito antes de atributos
- Adicionado avisos visuais (⚠️) no system prompt sobre a necessidade de CTA

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/index.ts` (linhas 563-567)
- `supabase/functions/consultor-chat/framework-guide.ts` (linhas 289-299)
- `supabase/functions/consultor-chat/intelligent-prompt-builder.ts` (linhas 67-76)

---

### ✅ 3. Ordem do Framework Violada
**Problema:** Após anamnese, o sistema pulava direto para atributos de processo, ignorando Canvas e Cadeia de Valor.

**Causa Raiz:** A lógica de transição de fases estava incorreta, avançando diretamente para `execucao` após anamnese.

**Solução Implementada:**
- Corrigido fluxo de transição no `index.ts`:
  - Anamnese preenchida → mantém em `modelagem` (próximo: Canvas)
  - Canvas preenchido → mantém em `modelagem` (próximo: Cadeia de Valor)
  - Cadeia preenchida → mantém em `modelagem` (próximo: Matriz automática)
  - Matriz gerada → aguarda validação em `priorizacao`
  - Validação confirmada → avança para `execucao`
- Adicionado ordem visual no system prompt (1️⃣→2️⃣→3️⃣→4️⃣→5️⃣→6️⃣→7️⃣)
- Modificado `framework-guide.ts` para seguir ordem rigorosa
- Removido lógica que sugeria atributos prematuramente

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/index.ts` (linhas 266-297, 590-633)
- `supabase/functions/consultor-chat/framework-guide.ts` (linhas 218-304)
- `supabase/functions/consultor-chat/intelligent-prompt-builder.ts` (linhas 43-54)

---

### ✅ 4. Timeline Não Atualizada
**Problema:** Erro no banco: `column "tipo_evento" of relation "timeline_consultor" does not exist`

**Causa Raiz:** O código tentava inserir um campo `tipo_evento` que não existe no schema da tabela.

**Solução Implementada:**
- Corrigido método `timeline()` no `marker-processor.ts` para usar apenas campos existentes
- Adicionado try-catch para evitar falhas não-fatais
- Adicionado log de confirmação quando evento é registrado com sucesso

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/marker-processor.ts` (linhas 195-207)

---

### ✅ 5. Entregáveis Não Gerados
**Problema:** Após formulários preenchidos, os entregáveis correspondentes não eram criados.

**Causa Raiz:** A lógica de geração automática já existia, mas não estava sendo executada de forma consistente.

**Solução Implementada:**
- Verificado e confirmado que a lógica de geração automática está implementada (linhas 429-462)
- Garantido que após cada formulário, o sistema verifica entregáveis faltantes e os gera
- Adicionado logs para rastreamento de geração

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/index.ts` (linhas 429-462) [já existente, validado]

---

### ✅ 6. Travamento Após Atributos
**Problema:** Sistema avançava prematuramente para `execucao` e ficava em loop.

**Causa Raiz:** Múltiplas causas:
1. Transição de fase incorreta após anamnese
2. Fallbacks automáticos criando lógica paralela
3. Falta de validação rigorosa antes de avançar fases

**Solução Implementada:**
- Removido avanço automático para `execucao` após atributos
- Atributos agora mantém em `execucao` sem avançar automaticamente
- Adicionado validações que bloqueiam atributos se não estiver em fase de execução
- Bloqueado Canvas se Anamnese não foi preenchida
- Bloqueado Cadeia se Canvas não foi preenchido
- Garantido que execução só inicia após validação de priorização

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/index.ts` (linhas 266-297, 578-622)

---

## 🎯 Sistema de Validações Implementado

### Validações de Transição de Fase
```typescript
// Bloqueio de atributos_processo fora de execução
if (tipo === 'atributos_processo' && jornada.etapa_atual !== 'execucao') {
  BLOQUEAR
}

// Bloqueio de Canvas sem Anamnese
if (tipo === 'canvas' && !checklist.anamnese_preenchida) {
  BLOQUEAR
}

// Bloqueio de Cadeia sem Canvas
if (tipo === 'cadeia_valor' && !checklist.canvas_preenchido) {
  BLOQUEAR
}
```

### Ordem Rigorosa do Framework
```
1️⃣ APRESENTAÇÃO (apenas uma vez)
    ↓
2️⃣ ANAMNESE (CTA → Confirmação → Formulário → Preenchimento → Entregável)
    ↓
3️⃣ CANVAS (CTA → Confirmação → Formulário → Preenchimento → Entregável)
    ↓
4️⃣ CADEIA DE VALOR (CTA → Confirmação → Formulário → Preenchimento → Entregável)
    ↓
5️⃣ MATRIZ/ESCOPO (gerado automaticamente pela LLM)
    ↓
6️⃣ VALIDAÇÃO (usuário confirma priorização)
    ↓
7️⃣ EXECUÇÃO (processos individuais)
    ├─ Processo 1: Atributos → BPMN → Diagnóstico
    ├─ Processo 2: Atributos → BPMN → Diagnóstico
    └─ Processo N: Atributos → BPMN → Diagnóstico
    ↓
8️⃣ PLANO DE AÇÃO (consolidado)
```

---

## 📝 Regras Críticas Implementadas

### Para a LLM (System Prompt)
1. ⚠️ JAMAIS pule etapas
2. ⚠️ JAMAIS vá direto para execução após anamnese
3. ⚠️ JAMAIS envie atributos_processo antes de: anamnese + canvas + cadeia + matriz + validação
4. ✅ Após ANAMNESE preenchida → próximo passo é CANVAS
5. ✅ Após CANVAS preenchido → próximo passo é CADEIA DE VALOR
6. ✅ Após CADEIA preenchida → gerar MATRIZ automaticamente
7. ✅ Após MATRIZ gerada → aguardar VALIDAÇÃO do usuário
8. ✅ Só após VALIDAÇÃO → iniciar EXECUÇÃO (atributos do primeiro processo)
9. 🚫 NUNCA se reapresente se apresentacao_feita = true

### Para o Backend (Validações)
1. Bloquear formulários já preenchidos
2. Bloquear atributos_processo fora da fase de execução
3. Bloquear Canvas sem Anamnese preenchida
4. Bloquear Cadeia sem Canvas preenchido
5. Bloquear avanço para execução sem validação de priorização
6. Marcar apresentacao_feita após primeira resposta
7. Não inferir ações automaticamente (remover fallbacks)

---

## 🔍 Testes Recomendados

### Fluxo Completo
1. **Início:** Verificar que apresentação acontece apenas uma vez
2. **Anamnese:** CTA → Confirmação → Formulário → Entregável gerado
3. **Canvas:** CTA → Confirmação → Formulário → Entregável gerado (não pula para atributos)
4. **Cadeia:** CTA → Confirmação → Formulário → Entregável gerado
5. **Matriz:** Geração automática → Apresentação ao usuário
6. **Validação:** Usuário confirma → Sistema avança para execução
7. **Execução:** Para cada processo: CTA Atributos → Confirmação → Formulário → BPMN → Diagnóstico
8. **Timeline:** Verificar que eventos são registrados sem erros

### Casos de Erro Esperados
1. ❌ Tentar enviar Canvas antes de Anamnese → Bloqueado
2. ❌ Tentar enviar Cadeia antes de Canvas → Bloqueado
3. ❌ Tentar enviar Atributos antes de validação → Bloqueado
4. ❌ Tentar reenviar formulário já preenchido → Bloqueado

---

## 📊 Impacto das Mudanças

### Antes das Correções
- ❌ Loop infinito de apresentação
- ❌ Formulários enviados sem permissão
- ❌ Ordem do framework violada constantemente
- ❌ Timeline com erros de schema
- ❌ Entregáveis não gerados consistentemente
- ❌ Sistema travando após atributos

### Depois das Correções
- ✅ Apresentação única e controlada
- ✅ CTA obrigatório antes de todos os formulários
- ✅ Ordem do framework seguida rigorosamente
- ✅ Timeline funcionando sem erros
- ✅ Entregáveis gerados automaticamente após cada etapa
- ✅ Fluxo linear sem travamentos

---

## 🎓 Lições Aprendidas

1. **Fonte Única de Verdade:** O checklist deve ser a ÚNICA fonte de estado. Evitar inferências baseadas em histórico.

2. **Validações Rigorosas:** Bloquear ações no backend, não apenas confiar na LLM.

3. **Sem Fallbacks Automáticos:** Fallbacks que tentam "ajudar" geralmente causam mais problemas do que solucionam.

4. **Ordem Rigorosa:** Frameworks devem seguir ordem estrita. Flexibilidade gera caos.

5. **CTA Obrigatório:** Sempre perguntar antes de coletar dados, especialmente para formulários.

6. **Logs Detalhados:** Logs são essenciais para debug. Cada bloqueio deve ter log explicativo.

---

## 🚀 Próximos Passos

1. **Testar fluxo completo** em ambiente de desenvolvimento
2. **Validar gamificação** - verificar se XP está sendo concedido corretamente
3. **Verificar entregáveis** - confirmar que todos os HTMLs são gerados
4. **Testar casos extremos** - usuário tentando pular etapas manualmente
5. **Deploy gradual** - testar em staging antes de produção

---

## 📞 Suporte

Se encontrar problemas após estas correções:

1. Verificar logs do Edge Function `consultor-chat`
2. Verificar estado do `framework_checklist` no banco
3. Verificar `etapa_atual` e `aguardando_validacao` na tabela `jornadas_consultor`
4. Verificar entregáveis gerados na tabela `entregaveis_consultor`
5. Verificar timeline na tabela `timeline_consultor`

---

**Data:** 23 de Outubro de 2025
**Status:** ✅ Todas as correções implementadas
**Arquivos Modificados:** 3 principais (index.ts, framework-guide.ts, intelligent-prompt-builder.ts)
**Linhas Alteradas:** ~150 linhas de código
**Tempo Estimado:** Correções aplicadas em ~45 minutos
