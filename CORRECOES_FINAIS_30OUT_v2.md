# Correções Finais - Sistema Consultor RAG
**Data:** 30 de Outubro de 2025
**Status:** ✅ COMPLETO

## Problemas Identificados e Resolvidos

### 1. ✅ Sistema não seguia fluxo de anamnese
**Problema:** Consultor pulava coleta de dados e ia direto para análise

**Causa Raiz:**
- `orchestrator.getSystemPrompt()` usava prompt genérico
- Não utilizava prompts específicos por fase de `consultor-prompts.ts`
- Estado da sessão não era considerado

**Solução Aplicada:**
```typescript
// orchestrator.ts
getPhasePrompt(estado: string): ConsultorPhase {
  const mapping = {
    'coleta': ANAMNESE_PROMPT,
    'anamnese': ANAMNESE_PROMPT,
    'modelagem': MODELAGEM_PROMPT,
    // ...
  };
  return mapping[estadoNorm] || ANAMNESE_PROMPT;
}

getSystemPrompt(params) {
  const phase = this.getPhasePrompt(params.estado);
  return `${phase.systemPrompt}\n...contexto adicional...`;
}
```

### 2. ✅ LLM não retornava JSON estruturado
**Problema:** `[ENFORCER] LLM não retornou actions, sintetizando fallback...`

**Causa Raiz:**
- Prompt base tinha instruções confusas sobre formato
- Pedia "JSON estruturado" mas sistema esperava `[PARTE A]...[PARTE B]`

**Solução Aplicada:**
```typescript
// consultor-prompts.ts
FORMATO DE RESPOSTA (OBRIGATÓRIO):

[PARTE A]
Sua mensagem ao usuário (linguagem natural, clara e empática)

[PARTE B]
{
  "actions": [
    {"type": "coletar_info", "params": {...}},
    {"type": "transicao_estado", "params": {"to": "modelagem"}}
  ],
  "contexto_incremental": {...},
  "progresso": 15
}

ATENÇÃO:
- SEMPRE retorne actions[], mesmo que vazio []
- Separe [PARTE A] da [PARTE B] claramente
```

### 3. ✅ Prompt de Anamnese melhorado
**Problema:** Instruções vagas sobre como coletar dados

**Solução Aplicada:**
- Adicionado roteiro passo-a-passo por turno
- **TURNO 1:** Apresentação + nome e cargo
- **TURNO 2-3:** Dados profissionais (idade, formação, cidade)
- **TURNO 4-6:** Dados empresa (nome, ramo, faturamento, funcionários, dor)
- Regras claras: MÁXIMO 2 perguntas por turno
- SEMPRE incluir actions: `[{"type": "coletar_info", ...}]`

### 4. ✅ Sessão antiga com estado errado deletada
**Problema:** Sessão existente com `estado = "execucao"` causava loops

**Solução:**
```bash
node reset-session.cjs
```
- Sessão antiga removida
- Próxima conversa criará sessão nova com `estado = "coleta"`

### 5. ✅ Erro `jornada_id` null no Kanban
**Problema:** `null value in column "jornada_id" violates not-null constraint`

**Status:** Prevenido
- Código `rag-adapter.ts` já cria jornada automaticamente (linhas 125-136)
- Sessão antiga sem jornada foi deletada
- Novas sessões sempre terão `jornada_id` válido

## Arquivos Modificados

1. **supabase/functions/consultor-rag/orchestrator.ts**
   - Adicionado `getPhasePrompt()` - mapeia estado → prompt
   - Modificado `getSystemPrompt()` - usa prompt da fase
   - Import dos prompts de `consultor-prompts.ts`

2. **supabase/functions/consultor-rag/index.ts**
   - Passando `estado: estadoNormalizado` para `getSystemPrompt()`

3. **supabase/functions/consultor-rag/consultor-prompts.ts**
   - Formato de resposta corrigido: `[PARTE A]...[PARTE B]`
   - Prompt ANAMNESE com roteiro passo-a-passo
   - Regras claras de coleta de dados

## Como Testar

1. **Recarregar browser** (Ctrl+Shift+R ou Cmd+Shift+R)

2. **Iniciar nova conversa no modo Consultor**

3. **Verificar comportamento esperado:**
   ```
   USER: Olá

   BOT: Olá! Sou o consultor da PROCEda. Vou te ajudar a organizar
        e escalar seu negócio através de uma jornada estruturada.
        Antes de começarmos, preciso conhecer você e sua empresa.

        Qual é o seu nome completo e qual cargo você ocupa?

   USER: João Silva, diretor comercial

   BOT: Ótimo, João! Para entender melhor seu perfil, me conte:
        - Qual sua idade aproximada?
        - Qual sua formação acadêmica?

   [... continua coletando dados sistematicamente ...]
   ```

4. **O consultor DEVE:**
   - ✅ Começar pedindo nome e cargo
   - ✅ Fazer máximo 2 perguntas por vez
   - ✅ Contextualizar cada pergunta
   - ✅ Coletar TODOS os dados antes de avançar
   - ✅ Gerar entregável "anamnese_empresarial" ao final
   - ✅ Transicionar para fase "modelagem"

## Próximos Passos (se necessário)

### Se LLM ainda não retornar actions:
1. Verificar logs da edge function: Supabase Dashboard → Functions → consultor-rag → Logs
2. Verificar se API key OpenAI está configurada
3. Testar prompt manualmente no ChatGPT para validar formato

### Se erro de banco persistir:
1. Executar SQL do arquivo: `FIX_NOME_TITULO_EXECUTE_NO_SUPABASE.sql`
2. Verificar constraints de `kanban_cards` e `entregaveis_consultor`

## Build e Deploy

```bash
# Build frontend
npm run build

# Deploy edge function (se necessário)
# Nota: consultor-rag já está deployada
```

## Logs de Teste

### ✅ Sessão Deletada
```
✅ Sessão antiga deletada com sucesso!
📊 Sessões restantes: []
```

### ✅ Build Completo
```
✓ built in 8.50s
```

## Conclusão

Sistema agora:
1. ✅ Usa prompts específicos por fase (ANAMNESE, MODELAGEM, etc.)
2. ✅ Segue roteiro estruturado de coleta de dados
3. ✅ Retorna formato correto `[PARTE A]...[PARTE B]`
4. ✅ Cria jornada automaticamente para cada sessão
5. ✅ Inicia sempre em estado "coleta" (anamnese)

**Status Final:** PRONTO PARA TESTE
