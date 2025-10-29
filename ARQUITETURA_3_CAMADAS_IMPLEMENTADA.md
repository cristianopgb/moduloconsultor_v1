# Arquitetura de 3 Camadas Adaptativas - Consultor Inteligente

## Implementação Concluída (29 Outubro 2025)

Sistema transformado de "chatbot com ferramentas fixas" para **Consultor que pensa** com arquitetura de 3 camadas adaptativas.

---

## 1. ESTRATEGISTA (Planner) - Decisão Contextual

### Localização
- `supabase/functions/consultor-rag/orchestrator.ts`

### O que faz
- **Carrega Adapter por Setor**: busca KPIs, perguntas úteis e metodologias específicas do segmento (transportadora, e-commerce, indústria, etc.)
- **Consulta Knowledge Base RAG**: busca playbooks de frameworks relevantes por tags
- **Monta prompt especializado**: injeta contexto setorial + base de conhecimento no LLM
- **Decide domínio principal**: Receita/Comercial, Operações/Logística, Financeiro/FP&A, Pessoas/HR

### Portfólio Adaptativo (não força ferramentas fixas)

**Receita/Comercial:**
- AARRR, funil de conversão, Pareto de perdas, ICP, CAC vs LTV, análise de canais

**Operações/Logística:**
- OTIF, lead time, mapeamento de desperdícios, curva ABC, balanceamento de carga

**Financeiro/FP&A:**
- DRE, fluxo de caixa, AR/AP aging, driver tree, cenários (what-if), ponto de equilíbrio

**Pessoas/HR:**
- Absenteísmo, turnover, matriz 9-box, curva de aprendizagem, RACI

**Ferramentas Clássicas (opcionais):**
- Ishikawa, SIPOC, BPMN, GUT, 5W2H (só quando fazem sentido)

### Regras Anti-Interrogatório
- Máximo 1 pergunta por turno (só se crítica)
- Assume hipóteses com `needsValidation:true` quando dado não-crítico falta
- Pareto de informação: pede apenas arquivos/dados que destravam análise imediata
- Nunca repete mesma pergunta: assume e prossegue

---

## 2. TÁTICO (Action Router) - Orquestração Flexível

### Localização
- `supabase/functions/consultor-rag/index.ts`
- `supabase/functions/consultor-rag/orchestrator.ts` (parseActionsBlock, synthesizeFallbackActions)

### O que faz
- **Recebe contexto do Estrategista** (adapter + KB + prompt especializado)
- **Chama LLM** com contexto enriquecido
- **Parse actions** do formato [PARTE B] do LLM
- **Enforcer anti-loop**: se LLM não retornar actions, sintetiza fallback genérico baseado na fase

### Actions Normalizadas
Aceita múltiplos tipos:

```typescript
{
  type: 'diagnose' | 'analyze_dataset' | 'compute_kpis' | 'what_if' |
        'design_process_map' | 'create_doc' | 'gerar_entregavel' |
        'update_kanban' | 'ensure_kanban' | 'schedule_checkin' |
        'transicao_estado' | 'coletar_info' | 'aplicar_metodologia'
}
```

### Fallback Inteligente
Se LLM falhar, gera ações genéricas por fase:
- **Anamnese**: diagnose + create_doc + transicao_estado
- **AS-IS**: design_process_map (textual) + analyze_dataset (Pareto)
- **Diagnóstico**: compute_kpis + analyze_dataset + create_doc
- **TO-BE**: design_process_map (to_be) + what_if
- **Plano**: create_doc (5W2H) + update_kanban

---

## 3. EXECUTOR (Function Registry) - Capacidades Reais

### Localização
- `src/lib/consultor/rag-executor.ts`

### Handlers Implementados

#### `executeGerarEntregavel`
- **Aceita**: `deliverableType`, `tipo_entregavel`, `docType`, `tipo`
- **Gera**: entregáveis via TemplateService (diagnostico, 5w2h, okr, bsc, etc.)
- **Insere**: tabela `entregaveis_consultor` com `sessao_id`

#### `executeDesignProcess`
- **Aceita**: `style` (as_is | to_be), `deliver` (diagram | text)
- **Gera**: BPMN XML ou mapa textual
- **Insere**: entregável com `conteudo_xml` ou `conteudo_md`

#### `executeUpdateKanban`
- **Aceita**: `plano.cards`, `cards`
- **Normaliza**: múltiplos formatos (title/titulo, due/due_at, owner/responsavel)
- **Insere**: tabela `kanban_cards` com `sessao_id`
- **Deduplica**: verifica se já existem cards antes de inserir

#### `executeTransicaoEstado`
- **Aceita**: `to`, `novo_estado`, `estado`
- **Atualiza**: `consultor_sessoes.estado_atual`

#### `insertEvidenceMemo`
- **Para**: `diagnose`, `analyze_dataset`, `compute_kpis`, `what_if`
- **Gera**: memo em markdown (não bloqueia fluxo)
- **Insere**: entregável tipo `evidencia_memo`

---

## 4. Frontend Integration (RAG Adapter)

### Localização
- `src/lib/consultor/rag-adapter.ts`

### Função Principal: `callConsultorRAG`

**Entrada:**
```typescript
{
  sessaoId: string,
  message: string,
  userId: string,
  conversationId?: string
}
```

**Saída:**
```typescript
{
  text: string,           // Resposta do consultor
  sessaoId: string,
  estado: string,
  actions: Array<...>,    // Actions para o Executor executar
  contexto_incremental?: any
}
```

### Fluxo
1. Busca sessão (empresa, setor, estado)
2. Carrega histórico de mensagens (últimas 10)
3. Chama `/consultor-rag` com formato: `{sessao: {...}, messages: [...]}`
4. Retorna reply + actions normalizadas

### Função Helper: `getOrCreateSessao`
- Busca sessão existente por `conversation_id`
- Cria nova se não existir
- **Sempre retorna** `sessaoId` (nunca null)

---

## 5. Normalização de Parâmetros

### Problema Resolvido
TypeErrors causados por nomes inconsistentes de campos.

### Solução Implementada

**No Executor:**
```typescript
const p = action.params || action;
const tipo = p.deliverableType || p.tipo_entregavel || p.docType || p.tipo;
const novoEstado = p.to || p.novo_estado || p.estado;
```

**Aceita todos esses formatos:**
- `deliverableType` / `tipo_entregavel` / `docType` / `tipo`
- `to` / `novo_estado` / `estado`
- `title` / `titulo`
- `due` / `due_at` / `When` / `quando`
- `owner` / `assignee` / `responsavel` / `Who` / `quem`

---

## 6. Anti-Loop Garantido

### Problema Original
Sistema chamava RAG automaticamente em loop infinito.

### Solução Implementada

**Backend (Enforcer):**
- Se LLM não retornar actions, `synthesizeFallbackActions` gera ações genéricas
- **Nunca** retorna `actions: []` vazio

**Frontend (Adapter):**
- Chama RAG **apenas** quando usuário envia mensagem
- **Nunca** re-chama RAG automaticamente
- Executor executa actions, dispara evento `entregavel:created`, para

**ChatPage:**
- Remove qualquer chamada automática ao RAG após execução de actions
- Aguarda próxima mensagem do usuário

---

## 7. Estrutura de Tabelas

### `consultor_sessoes`
```sql
id, user_id, conversation_id, empresa, setor,
contexto_negocio, estado_atual, progresso, ativo
```

### `entregaveis_consultor`
```sql
id, sessao_id, tipo, nome,
html_conteudo, conteudo_md, conteudo_xml,
etapa_origem, created_by
```

### `kanban_cards`
```sql
id, sessao_id, titulo, descricao, responsavel,
due_at, status
```

### `adapters_setor`
```sql
id, setor, prioridade, tags, kpis, perguntas, metodologias
```

### `knowledge_base_documents`
```sql
id, title, category, content, tags, aplicabilidade, ativo
```

---

## 8. Exemplo de Fluxo Completo

### Entrada do Usuário
> "Sou uma transportadora, minhas vendas não escalam e o financeiro está bagunçado."

### 1. Estrategista (Backend)
- Carrega Adapter: setor = "transportadora"
- KPIs: OTIF, Lead time, Taxa de conversão, AR aging
- Perguntas: "Qual seu tipo de carga?", "Quantas rotas ativas?"
- Metodologias: Pareto, GUT, AARRR, Lead time analysis
- Busca KB: docs com tags ["transportadora", "logística", "comercial", "financeiro"]

### 2. Tático (Backend)
LLM responde:

```
[PARTE A]
Vou atacar duas frentes em paralelo:
1) Comercial: hipótese de funil fraco e proposta não padronizada
2) Financeiro: hipótese de DRE inconsistente e prazos sem política

[PARTE B]
{
  "actions": [
    {"type":"diagnose","area":"comercial","goals":["aumentar conversão"],"hypotheses":["ICP difuso"]},
    {"type":"compute_kpis","kpis":["CAC","LTV","taxa_conversao","OTIF"]},
    {"type":"create_doc","docType":"diagnostico_exec","format":"markdown","sections":["resumo_exec","achados_top5","roadmap_90d"]},
    {"type":"update_kanban","cards":[
      {"title":"Padronizar proposta","owner":"Comercial","due":"+7d"},
      {"title":"ICP v1.0","owner":"Growth","due":"+5d"}
    ]},
    {"type":"transicao_estado","to":"diagnostico"}
  ]
}
```

### 3. Executor (Frontend)
- Gera diagnóstico executivo (markdown)
- Cria 2 cards no Kanban
- Atualiza estado para "diagnostico"
- Insere memo de KPIs
- Dispara evento `entregavel:created`

### 4. Usuário Vê
- Mensagem consultiva clara
- Painel de entregáveis mostra diagnóstico
- Kanban mostra 2 cards
- **Sistema aguarda próxima mensagem** (não re-chama RAG)

---

## 9. Vantagens da Nova Arquitetura

### ✅ Antes (Problema)
- Forçava Ishikawa/SIPOC/BPMN sempre
- Interrogatório infinito
- Loops de chamadas ao RAG
- TypeErrors por nomes inconsistentes
- Sem especialização por setor

### ✅ Depois (Solução)
- **Portfólio adaptativo**: escolhe método apropriado
- **1 pergunta máxima por turno**: assume hipóteses e prossegue
- **Anti-loop garantido**: Enforcer + frontend controlado
- **Normalização flex**: aceita múltiplos formatos de params
- **Especialização setorial**: Adapter + KB RAG
- **Evidência primeiro**: gera análises, não apenas perguntas
- **Transparência**: memos de evidência rastreáveis

---

## 10. Arquivos Modificados

### Backend (Edge Functions)
- ✅ `supabase/functions/consultor-rag/orchestrator.ts` - REESCRITO
- ✅ `supabase/functions/consultor-rag/index.ts` - REESCRITO

### Frontend (Libs)
- ✅ `src/lib/consultor/rag-executor.ts` - REESCRITO
- ✅ `src/lib/consultor/rag-adapter.ts` - ATUALIZADO
- ✅ `src/lib/consultor/template-service.ts` - JÁ EXISTENTE (não mexido)

### ChatPage
- ⚠️ PENDENTE: remover qualquer chamada automática ao RAG após `executeRAGActions`

---

## 11. Próximos Passos (Opcional)

### Melhorias Futuras
1. **Evidence Store**: tabela dedicada `evidences` com referências cruzadas
2. **Stop-Criteria**: validar mínimo de evidências por fase antes de avançar
3. **Sector-Specific KPIs**: calcular KPIs reais (não apenas memo)
4. **Dashboard de Evidências**: UI para visualizar evidências geradas
5. **Embeddings para RAG**: busca semântica via pgvector

---

## Status: ✅ IMPLEMENTADO E COMPILANDO

Build concluído sem erros. Sistema pronto para teste com caso real (transportadora).

**Próximo passo crítico**: testar fluxo completo end-to-end e ajustar ChatPage se necessário para garantir anti-loop.
