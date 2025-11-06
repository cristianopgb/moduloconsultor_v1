# Diagnóstico Completo - Problemas nos Entregáveis

## 📋 Resumo dos Problemas

1. ❌ **Anamnese** - Expectativa de sucesso aparece como N/A
2. ❌ **Cadeia de Valor** - Faltam processos de gestão e apoio
3. ❌ **Matriz de Priorização** - Não está sendo preenchida
4. ❌ **Escopo** - Repete matriz e fica em branco
5. ❌ **BPMN** - Repete SIPOC e não renderiza imagem
6. ❌ **Diagnóstico** - Mostra HTML no documento
7. ❌ **5W2H** - Gera em branco com N/A

---

## 1. Anamnese - Expectativa de Sucesso N/A

### 🔍 Diagnóstico:
- Campo coletado como `expectativa_sucesso` no prompt
- JSON de transição usa apenas `expectativa`
- Template busca `expectativa` OU `expectativa_sucesso` OU `expectativas`

### 📍 Localização do Problema:

**Arquivo**: `supabase/functions/consultor-rag/consultor-prompts.ts`

**Linha 233**:
```typescript
Action: {"type": "coletar_info", "params": {"campo": "expectativa_sucesso"}}
```

**Linha 265**:
```typescript
"expectativa": "VALOR_REAL"  // ❌ Nome diferente!
```

### ✅ Solução:
Padronizar para `expectativa` em todos os lugares OU garantir que ambos sejam salvos.

---

## 2. Cadeia de Valor - Faltam Processos

### 🔍 Diagnóstico:
- Prompt menciona "Turno 7: Processos de Apoio" e "Turno 8: Processos de Gestão"
- MAS não tem instruções EXPLÍCITAS de como perguntar
- LLM pula direto para consolidação

### 📍 Localização do Problema:

**Arquivo**: `supabase/functions/consultor-rag/consultor-prompts.ts`

**Linha 539-540**: Menciona os turnos mas não detalha as perguntas

### ✅ Solução:
Adicionar perguntas explícitas:
```
TURNO 7: Processos de Apoio
- "Quais processos SUPORTAM a operação? Ex: RH, Financeiro, TI..."
Action: {"type": "coletar_info", "params": {"campo": "processos_apoio"}}

TURNO 8: Processos de Gestão
- "E processos GERENCIAIS? Ex: Planejamento, Controle, Qualidade..."
Action: {"type": "coletar_info", "params": {"campo": "processos_gestao"}}
```

---

## 3. Matriz de Priorização - Não Preenchida

### 🔍 Diagnóstico:
Precisa investigar onde é gerada

### 📍 Arquivos para Investigar:
- `supabase/functions/_shared/deliverable-templates.ts` (linha 334)
- Prompts do consultor que geram matriz

### ✅ Próximos Passos:
1. Verificar se o action `gerar_entregavel` com tipo `matriz_priorizacao` existe
2. Verificar se o template está recebendo dados corretos

---

## 4. Escopo - Repete Matriz e Fica Branco

### 🔍 Diagnóstico:
Possível problema de tipo incorreto ou template não existe

### 📍 Verificar:
```bash
grep -n "escopo\|scope" supabase/functions/_shared/deliverable-templates.ts
```

### ✅ Solução:
Criar template específico para escopo ou corrigir tipo no action

---

## 5. BPMN - Não Renderiza Imagem

### 🔍 Diagnóstico:
- Template provavelmente retorna XML do BPMN
- Frontend não está renderizando com bpmn-js

### 📍 Verificar:
1. O que o template `generateBPMNHTML` retorna?
2. O frontend tem componente `BpmnViewer`?
3. O viewer está sendo usado no preview?

### ✅ Solução:
1. Se template retorna XML: adicionar renderização via bpmn-js
2. Se template retorna SIPOC: corrigir para gerar BPMN correto

---

## 6. Diagnóstico - Mostra HTML

### 🔍 Diagnóstico:
HTML não está sendo sanitizado ou o preview não está renderizando corretamente

### 📍 Verificar:
- Como o documento de diagnóstico é exibido no frontend
- Se há escape de HTML onde não deveria

### ✅ Solução:
Usar `dangerouslySetInnerHTML` ou renderizar em iframe

---

## 7. 5W2H - Gera em Branco com N/A

### 🔍 Diagnóstico:
Dados não estão sendo coletados ou template não está recebendo

### 📍 Localização:
**Arquivo**: `supabase/functions/_shared/deliverable-templates.ts` (linha 403)

### ✅ Verificar:
1. Se action `gerar_entregavel` com tipo `5w2h` está sendo chamado
2. Que dados o template espera receber
3. Se os dados estão no contexto correto

---

## 🎯 Plano de Ação

### Prioridade ALTA (afetam todos os usuários):
1. ✅ Corrigir Anamnese - expectativa de sucesso
2. ✅ Corrigir Cadeia de Valor - adicionar perguntas explícitas
3. ✅ Corrigir Matriz de Priorização - verificar geração

### Prioridade MÉDIA:
4. ✅ Corrigir BPMN - renderização de imagem
5. ✅ Corrigir Diagnóstico - sanitização HTML
6. ✅ Corrigir 5W2H - dados em branco

### Prioridade BAIXA:
7. ✅ Corrigir Escopo - investigar duplicação

---

## 📝 Próximos Passos

1. Ler cada template para entender estrutura esperada
2. Verificar prompts para ver se dados estão sendo coletados
3. Verificar actions para ver se entregáveis estão sendo gerados
4. Corrigir um por vez e testar

---

**Data**: 05/11/2025
**Status**: 🔍 Diagnóstico Completo
**Próximo**: Começar correções
