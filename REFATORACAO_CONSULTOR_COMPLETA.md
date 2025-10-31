# Refatoração Completa do Módulo Consultor - 31/10/2025

## Problema Identificado

O módulo consultor estava inviável devido a:

1. **Arquitetura Fragmentada**: 61 migrações totais, 33 relacionadas ao consultor, com tabelas duplicadas e colunas inexistentes
2. **Fluxo de Conversação Quebrado**: LLM perdia contexto entre turnos, ações mal parseadas, múltiplos fallbacks
3. **Base de Conhecimento Inativa**: Existia mas não era usada corretamente
4. **Migrações Destrutivas**: Múltiplas tentativas de adicionar mesmas colunas, policies duplicadas

## Solução Implementada

### 1. Schema Consolidado

**Nova Tabela**: `consultor_mensagens`
- Armazena histórico completo de conversação
- Campos: id, sessao_id, role (system/user/assistant), content, metadata, created_at
- RLS policies simples: usuários veem apenas suas mensagens
- Funções helper: `get_consultor_history()` e `add_consultor_message()`

**Tabela Existente Otimizada**: `consultor_sessoes`
- Mantém estado e contexto acumulado
- Campo `contexto_coleta` para dados coletados progressivamente
- Campo `estado_atual` para fase da consultoria
- Sem dependências de tabelas obsoletas (jornadas_consultor removida)

**Migration**: `20251031000000_consultor_refactor_complete.sql`

### 2. Edge Function Simplificada

**Arquivo**: `supabase/functions/consultor-rag/index.ts`

**Fluxo Linear**:
```
1. Recebe mensagem do usuário
2. Carrega histórico completo de mensagens do banco
3. Carrega contexto acumulado da sessão
4. Monta prompt com knowledge base e adapter do setor
5. Chama OpenAI com histórico completo
6. Salva mensagem do usuário no histórico
7. Salva resposta do assistente no histórico
8. Atualiza contexto incremental se houver dados novos
9. Retorna resposta ao usuário
```

**Características**:
- Sem orchestrator, sem action parsing complexo
- Histórico persistente garante contexto entre recarregamentos
- LLM recebe todas mensagens anteriores a cada chamada
- Prompt focado em anamnese de 7 turnos
- Formato de resposta simples: [PARTE A] texto + [PARTE B] json com contexto

### 3. Frontend Adapter Simplificado

**Arquivo**: `src/lib/consultor/rag-adapter.ts`

**Interface**:
```typescript
interface ConsultorResponse {
  text: string;              // Resposta para exibir ao usuário
  estado: string;            // coleta, mapeamento, etc
  turno_atual: number;       // 1-7 durante anamnese
  anamnese_completa: boolean; // true quando completar 7 turnos
  contexto_coletado: number;  // quantidade de dados já coletados
  sessaoId: string;
}
```

**Funções**:
- `getOrCreateSessao()`: Cria ou recupera sessão para usuário/conversa
- `callConsultorRAG()`: Chama Edge Function e retorna resposta

### 4. Prompts Estruturados

**Anamnese em 7 Turnos**:
1. Nome completo e cargo
2. Idade e formação acadêmica
3. Nome da empresa
4. Segmento de atuação e produtos/serviços
5. Faturamento anual estimado
6. Principal dor ou desafio
7. Expectativa de sucesso

**Regras do Prompt**:
- Sempre verifica contexto já coletado antes de perguntar
- Nunca repete perguntas
- Faz apenas 1 pergunta direta por turno
- Informa "Turno X/7" em cada resposta
- Bloqueia transição de estado até completar anamnese

## Arquivos Arquivados

Movidos para `archive_consultor_refactor/`:
- `index-old-backup.ts` (Edge Function antiga com orchestrator)
- `orchestrator.ts` (Camada de orquestração complexa)
- `rag-engine.ts` (Engine RAG não utilizada)
- `rag-adapter-old.ts` (Adapter antigo com actions)
- `rag-executor.ts` (Executor de actions não necessário)

## Como Usar

### Backend (Edge Function já deployada)

A Edge Function está em: `supabase/functions/consultor-rag/index.ts`

**Request**:
```json
{
  "sessao_id": "uuid-da-sessao",
  "message": "Meu nome é João Silva e sou CEO"
}
```

**Response**:
```json
{
  "reply": "Turno 2/7: Qual é sua idade e formação acadêmica?",
  "estado": "coleta",
  "turno_atual": 2,
  "anamnese_completa": false,
  "contexto_coletado": 2
}
```

### Frontend

```typescript
import { callConsultorRAG, getOrCreateSessao } from '@/lib/consultor/rag-adapter';

// Criar ou recuperar sessão
const sessaoId = await getOrCreateSessao(userId, conversationId);

// Enviar mensagem
const response = await callConsultorRAG({
  sessaoId,
  userId,
  conversationId,
  message: 'João Silva, CEO'
});

console.log(response.text); // Exibir para usuário
console.log(response.turno_atual); // Mostrar progresso
```

## Próximos Passos

1. ✅ Schema consolidado criado
2. ✅ Edge Function simplificada
3. ✅ Adapter frontend criado
4. ✅ Arquivos obsoletos movidos
5. ⏳ Atualizar componentes para usar nova API
6. ⏳ Testar fluxo completo end-to-end
7. ⏳ Adicionar geração de documentos após anamnese

## Diferenças Principais

### Antes
- 3 camadas (Estrategista, Tático, Executor)
- Actions parsing com 5 fallbacks
- Orchestrator complexo
- Contexto perdido entre turnos
- Estado em múltiplas tabelas

### Depois
- 1 camada linear
- Histórico persistente completo
- Contexto sempre disponível
- Sem parsing complexo
- 2 tabelas simples (sessoes + mensagens)

## Benefícios

1. **Confiabilidade**: Histórico garante que LLM nunca perde contexto
2. **Simplicidade**: Código direto e fácil de debugar
3. **Manutenibilidade**: Sem abstrações complexas
4. **Performance**: Menos queries, menos processamento
5. **Testabilidade**: Fluxo linear é fácil de testar

## Notas Técnicas

- Migration aplicada com sucesso: `20251031000000_consultor_refactor_complete.sql`
- Tabela `consultor_mensagens` criada com RLS ativo
- Helper functions `get_consultor_history` e `add_consultor_message` disponíveis
- Edge Function usa OpenAI GPT-4o-mini com temperature 0.7
- Histórico carregado em ordem cronológica crescente
- Contexto mesclado: atual + incremental sem perder dados anteriores
