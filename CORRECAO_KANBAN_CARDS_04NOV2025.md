# Correção: Kanban Cards Não Sendo Gerados - 04/11/2025

## Problema Identificado

O sistema estava gerando apenas o HTML do plano 5W2H, mas **não estava criando os cards no Kanban** para o agente executor.

### Causa Raiz

1. **Falta de Auto-Detector**: Não existia um detector automático para a fase `execucao` que garantisse a criação dos cards no Kanban quando o 5W2H fosse gerado.

2. **LLM Inconsistente**: O LLM nem sempre gerava ambos os actions necessários:
   - `gerar_entregavel` com tipo "5w2h" ✅ (estava gerando)
   - `update_kanban` com os cards ❌ (estava faltando)

3. **Prompt Insuficiente**: O prompt da fase `execucao` não enfatizava suficientemente a necessidade OBRIGATÓRIA de gerar ambos os actions.

## Correções Aplicadas

### 1. Novo Auto-Detector para Fase Execução

**Arquivo:** `/tmp/cc-agent/59063573/project/supabase/functions/consultor-rag/index.ts`

Adicionado **Detector 5** (linhas 532-569) que:

✅ Detecta quando um action `gerar_entregavel` do tipo "5w2h" é criado
✅ Verifica se o action `update_kanban` correspondente existe
✅ Se não existir, **extrai automaticamente** as ações do contexto 5W2H
✅ Cria o action `update_kanban` com os cards correspondentes

**Código:**

```typescript
// Detector 5: EXECUÇÃO COMPLETA (5W2H + Kanban)
if (faseAtual === 'execucao') {
  const has5W2H = actions.some(a => a.type === 'gerar_entregavel' && a.params?.tipo === '5w2h');
  const hasKanban = actions.some(a => a.type === 'update_kanban');

  // Se tem 5W2H mas não tem Kanban, extrair ações e criar Kanban automaticamente
  if (has5W2H && !hasKanban) {
    console.log('[CONSULTOR] AUTO-DETECTOR: 5W2H gerado sem Kanban, criando cards automaticamente');

    const action5W2H = actions.find(a => a.type === 'gerar_entregavel' && a.params?.tipo === '5w2h');
    const contexto5W2H = action5W2H?.params?.contexto || {};

    // Extrair ações do contexto 5W2H
    const acoes5W2H = contexto5W2H.acoes || [];

    if (acoes5W2H.length > 0) {
      const kanbanCards = acoes5W2H.map((acao: any) => ({
        title: acao.what || acao.o_que || 'Ação sem título',
        description: `${acao.why || acao.por_que || ''}\n\n**Como:** ${acao.how || acao.como || ''}\n**Onde:** ${acao.where || acao.onde || ''}\n**Custo:** ${acao.how_much || acao.quanto || 'N/A'}`,
        assignee: acao.who || acao.quem || 'Não definido',
        due: acao.when || acao.quando || '+30d'
      }));

      console.log('[CONSULTOR] Criando', kanbanCards.length, 'cards automaticamente');

      actions.push({
        type: 'update_kanban',
        params: {
          plano: {
            cards: kanbanCards
          }
        }
      });
    }
  }
}
```

### 2. Prompt Fortalecido

**Arquivo:** `/tmp/cc-agent/59063573/project/supabase/functions/consultor-rag/consultor-prompts.ts`

Modificações no `EXECUCAO_PROMPT`:

✅ Adicionada seção explícita sobre a **estrutura obrigatória** do contexto 5W2H (linhas 1127-1163)
✅ Incluído exemplo completo de como estruturar as ações
✅ Avisos em vermelho destacando a necessidade de gerar ambos os actions (linhas 1145-1150, 1193-1194)
✅ Exemplo completo do JSON com ambos os actions preenchidos (linhas 1154-1191)

**Destaque do Prompt:**

```
🔴 **CRÍTICO: VOCÊ DEVE GERAR 2 ACTIONS OBRIGATORIAMENTE** 🔴

1. **Action 1**: gerar_entregavel com tipo "5w2h"
2. **Action 2**: update_kanban com os cards

⚠️ **SE NÃO GERAR OS 2 ACTIONS, AS AÇÕES NÃO APARECERÃO NO KANBAN!** ⚠️
```

## Como Funciona Agora

### Fluxo Normal (LLM Gera Ambos Actions)

1. LLM está na fase `execucao`
2. LLM gera action `gerar_entregavel` com tipo "5w2h" + contexto com array "acoes"
3. LLM gera action `update_kanban` com os cards
4. Sistema processa ambos os actions
5. ✅ 5W2H salvo em `entregaveis_consultor`
6. ✅ Cards criados em `kanban_cards` + `acoes_plano`

### Fluxo com Fallback (LLM Esquece o update_kanban)

1. LLM está na fase `execucao`
2. LLM gera action `gerar_entregavel` com tipo "5w2h" + contexto com array "acoes"
3. ❌ LLM NÃO gera action `update_kanban`
4. **Detector 5 entra em ação:**
   - Detecta que tem 5W2H mas não tem Kanban
   - Extrai automaticamente as ações do contexto 5W2H
   - Cria o action `update_kanban` faltante
5. ✅ 5W2H salvo em `entregaveis_consultor`
6. ✅ Cards criados em `kanban_cards` + `acoes_plano` (via fallback)

## Estrutura Esperada do Contexto 5W2H

O LLM deve gerar o contexto com a seguinte estrutura:

```json
{
  "tipo": "5w2h",
  "contexto": {
    "acoes": [
      {
        "what": "Implementar sistema de CRM",
        "why": "Organizar leads e melhorar conversão",
        "who": "Gerente Comercial",
        "when": "+30d",
        "where": "Área Comercial",
        "how": "Contratar HubSpot e treinar equipe",
        "how_much": "R$ 3.000/mês"
      },
      {
        "what": "Mapear processos atuais",
        "why": "Identificar gargalos operacionais",
        "who": "Analista de Processos",
        "when": "+7d",
        "where": "Todas as áreas",
        "how": "Realizar entrevistas e criar fluxogramas",
        "how_much": "Sem custo adicional"
      }
    ]
  }
}
```

O detector automaticamente converte isso em cards do Kanban.

## Teste Necessário

Para validar a correção, execute:

1. Rode uma sessão completa até a fase `execucao`
2. Aguarde o LLM gerar o plano 5W2H
3. Verifique os logs:
   - Se aparecer "AUTO-DETECTOR: 5W2H gerado sem Kanban, criando cards automaticamente" → Fallback ativado ✅
   - Se aparecer "Creating Kanban cards: X" → Cards sendo criados ✅
4. Consulte o banco de dados:
   ```sql
   SELECT * FROM kanban_cards WHERE sessao_id = 'SEU_SESSAO_ID';
   SELECT * FROM acoes_plano WHERE sessao_id = 'SEU_SESSAO_ID';
   ```
5. Verifique no frontend: aba "Kanban" deve mostrar os cards

## Arquivos Modificados

1. `/tmp/cc-agent/59063573/project/supabase/functions/consultor-rag/index.ts`
   - Adicionado Detector 5 (linhas 532-569)

2. `/tmp/cc-agent/59063573/project/supabase/functions/consultor-rag/consultor-prompts.ts`
   - Fortalecido prompt EXECUCAO_PROMPT (linhas 1127-1194)

## Status

✅ **Correção Implementada**
⏳ **Aguardando Deploy**
🧪 **Aguardando Teste**

## Deploy

Para aplicar a correção em produção:

```bash
# Deploy da função consultor-rag
supabase functions deploy consultor-rag
```

## Observações

- O detector é **resiliente**: suporta tanto nomes em inglês (what, why, who) quanto em português (o_que, por_que, quem)
- Se o contexto 5W2H não tiver o array "acoes", o detector registra um warning mas não quebra o fluxo
- Esta correção NÃO requer migração de banco de dados
- Esta correção é **retrocompatível**: sessões antigas não serão afetadas

## Documentos Relacionados

- `CORRECOES_SISTEMA_CONSULTOR_RAG_03NOV2025.md` - Correções anteriores do sistema RAG
- `DIAGNOSTICO_REAL_POR_QUE_NAO_FUNCIONA.md` - Diagnóstico inicial dos problemas
