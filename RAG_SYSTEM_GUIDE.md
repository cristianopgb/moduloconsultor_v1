# Guia do Sistema RAG + Orquestração - Proceda Consultor

## Visão Geral

O novo sistema de consultoria foi implementado seguindo a arquitetura **RAG (Retrieval-Augmented Generation) + Orquestração**, substituindo a abordagem anterior que tinha problemas de loops e estados inconsistentes.

## Arquitetura

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────────┐
│  Edge Function: consultor-rag/index.ts  │
│  - Gerencia sessões                     │
│  - Coordena componentes                 │
│  - Chama LLM                            │
└──────┬──────────────────────────────────┘
       │
       ├──> ┌──────────────────┐
       │    │  Orchestrator    │
       │    │  - Determina     │
       │    │    próximas      │
       │    │    ações         │
       │    │  - Gerencia      │
       │    │    transições    │
       │    └──────────────────┘
       │
       └──> ┌──────────────────┐
            │   RAG Engine     │
            │  - Busca docs    │
            │  - Ranking       │
            │  - Contexto LLM  │
            └──────────────────┘
                    │
                    v
            ┌──────────────────┐
            │ Knowledge Base   │
            │  - SIPOC         │
            │  - Canvas        │
            │  - 5W2H          │
            │  - Matriz        │
            └──────────────────┘
```

## Componentes Principais

### 1. Knowledge Base (Base de Conhecimento)

**Tabela:** `knowledge_base_documents`

Armazena metodologias, frameworks e melhores práticas de consultoria.

**Campos principais:**
- `title`: Nome da metodologia
- `category`: metodologia | framework | best_practice
- `content`: Conteúdo completo em Markdown
- `tags`: Array de tags para busca
- `aplicabilidade`: JSON com contextos de uso
- `embedding`: Vetor para busca semântica (futuro)
- `ativo`: Se o documento está ativo

**Documentos incluídos:**
1. ✅ SIPOC - Mapeamento de Processos
2. ✅ Business Model Canvas
3. ✅ 5W2H - Plano de Ação
4. ✅ Cadeia de Valor (Value Chain)
5. ✅ Matriz de Priorização (Impacto x Esforço)
6. ✅ 5 Porquês - Análise de Causa Raiz

### 2. Sessões de Consultoria

**Tabela:** `consultor_sessoes`

Rastreia cada jornada de consultoria com um cliente.

**Campos principais:**
- `user_id`: Usuário/empresa
- `conversation_id`: Ligação com chat
- `titulo_problema`: Resumo do problema
- `contexto_negocio`: Informações coletadas (JSON)
- `metodologias_aplicadas`: Array de metodologias usadas
- `estado_atual`: coleta | analise | diagnostico | recomendacao | execucao
- `progresso`: 0-100%
- `entregaveis_gerados`: IDs dos entregáveis criados

### 3. Orquestrador

**Arquivo:** `supabase/functions/consultor-rag/orchestrator.ts`

**Responsabilidades:**
- Determina próximas ações baseado no estado da sessão
- Gerencia transições entre estados
- Identifica metodologias aplicáveis via RAG
- Coordena coleta de informações

**Estados do fluxo:**
1. **coleta**: Coletar informações essenciais do negócio
2. **analise**: Aplicar metodologias de análise
3. **diagnostico**: Gerar diagnóstico situacional
4. **recomendacao**: Criar plano de ação
5. **execucao**: Acompanhar implementação

**Tipos de ações:**
- `coletar_info`: Fazer pergunta específica
- `aplicar_metodologia`: Usar framework da knowledge base
- `gerar_entregavel`: Criar documento
- `transicao_estado`: Avançar para próxima fase
- `validar`: Validar com cliente

### 4. RAG Engine

**Arquivo:** `supabase/functions/consultor-rag/rag-engine.ts`

**Responsabilidades:**
- Buscar documentos relevantes na knowledge base
- Ranking por relevância
- Construir contexto para LLM
- Gerenciar embeddings (futuro)

**Métodos principais:**
```typescript
// Busca documentos por query
async buscarDocumentos(query, filtros): Promise<ResultadoRAG>

// Busca por categoria
async buscarPorCategoria(categoria): Promise<DocumentoKnowledge[]>

// Busca por tags
async buscarPorTags(tags): Promise<DocumentoKnowledge[]>

// Adicionar novo documento
async adicionarDocumento(documento): Promise<string>
```

### 5. Edge Function Principal

**Arquivo:** `supabase/functions/consultor-rag/index.ts`

**Fluxo de processamento:**

```
1. Recebe mensagem do usuário
   ↓
2. Busca ou cria sessão de consultoria
   ↓
3. Atualiza contexto com form_data (se houver)
   ↓
4. Orquestrador determina próximas ações
   ↓
5. RAG busca conhecimento relevante
   ↓
6. Constrói prompt enriquecido com:
   - Estado da sessão
   - Contexto do negócio
   - Conhecimento da RAG
   - Ações recomendadas
   ↓
7. LLM processa e gera resposta
   ↓
8. Executa ação principal (se houver)
   ↓
9. Atualiza progresso
   ↓
10. Retorna resposta + ações para o front
```

## Como Popular a Knowledge Base

### Opção 1: Via Script (Requer credenciais de master)

```bash
# Edite o script com as credenciais
# Em seed-knowledge-sql.js, configure:
# MASTER_EMAIL e MASTER_PASSWORD

node seed-knowledge-sql.js
```

### Opção 2: Via SQL Direto (Bypass RLS)

Execute o arquivo `supabase/seed-knowledge-base.sql` com privilégios de superusuário:

```bash
psql -h <host> -U postgres -d postgres -f supabase/seed-knowledge-base.sql
```

### Opção 3: Via Interface Admin

Se houver interface admin no front-end, usuários master podem adicionar documentos manualmente.

## Como Usar o Sistema

### Do Front-End

```typescript
// Chamar a edge function
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/consultor-rag`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: "Estou com problemas no meu processo de vendas",
      user_id: userId,
      conversation_id: conversationId, // opcional
      sessao_id: sessaoId, // opcional
      form_data: { // opcional
        empresa_nome: "Minha Empresa",
        segmento: "Varejo"
      }
    })
  }
);

const data = await response.json();

// Resposta contém:
// - response: Texto da IA
// - sessao_id: ID da sessão de consultoria
// - estado_atual: Estado do fluxo
// - progresso: 0-100%
// - actions: Array de ações para o front executar
// - rag_info: Informações sobre documentos usados
```

### Ações Retornadas

O sistema pode retornar ações para o front-end:

```typescript
{
  actions: [
    {
      type: 'exibir_formulario',
      params: { tipo: 'anamnese' }
    },
    {
      type: 'gerar_entregavel',
      params: { tipo: 'plano_acao' }
    },
    {
      type: 'exibir_metodologia',
      params: {
        metodologia: 'SIPOC',
        instrucoes: '...'
      }
    }
  ]
}
```

## Segurança (RLS)

### Knowledge Base Documents

- ✅ **SELECT**: Todos os usuários autenticados podem ler documentos ativos
- ✅ **INSERT**: Apenas masters podem inserir documentos
- ✅ **UPDATE**: Apenas masters podem atualizar documentos
- ✅ **DELETE**: Apenas masters podem deletar documentos

### Consultor Sessões

- ✅ **SELECT**: Usuários podem ver apenas suas próprias sessões
- ✅ **INSERT**: Usuários podem criar suas próprias sessões
- ✅ **UPDATE**: Usuários podem atualizar apenas suas sessões
- ✅ **DELETE**: Apenas masters podem deletar sessões

### Orquestrador Ações

- ✅ **SELECT**: Usuários podem ver logs das suas sessões
- ✅ **INSERT**: Sistema pode inserir logs (via service role key)

## Próximos Passos

### Fase 2: Melhorias do RAG

1. ⬜ Implementar busca semântica com embeddings
2. ⬜ Adicionar mais documentos à knowledge base
3. ⬜ Implementar cache de embeddings
4. ⬜ Melhorar algoritmo de ranking

### Fase 3: Adapters para o Front

1. ⬜ Criar adapter que conecta consultor-rag com front atual
2. ⬜ Implementar fallback para consultor-chat antigo
3. ⬜ Migração gradual dos usuários

### Fase 4: Painel Master

1. ⬜ Interface para gerenciar knowledge base
2. ⬜ Analytics de metodologias mais usadas
3. ⬜ Feedback sobre eficácia das recomendações

## Testando o Sistema

### Teste 1: Query Simples

```bash
curl -X POST https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/consultor-rag \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Preciso melhorar meu processo de vendas",
    "user_id": "YOUR_USER_ID"
  }'
```

### Teste 2: Com Contexto

```bash
curl -X POST https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/consultor-rag \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Estou pronto para começar a anamnese",
    "user_id": "YOUR_USER_ID",
    "form_data": {
      "empresa_nome": "Tech Solutions",
      "segmento": "Tecnologia",
      "porte": "pequena"
    }
  }'
```

## Troubleshooting

### Problema: Knowledge base vazia

**Solução:** Execute o script de seed com credenciais de master:
```bash
node seed-knowledge-sql.js
```

### Problema: RLS Policy error ao inserir

**Solução:** Certifique-se de estar autenticado como usuário master:
```typescript
await supabase.auth.signInWithPassword({
  email: 'master@demo.com',
  password: 'sua-senha'
});
```

### Problema: RAG não retorna documentos relevantes

**Diagnóstico:**
```sql
-- Verificar documentos na base
SELECT title, category, tags FROM knowledge_base_documents WHERE ativo = true;

-- Testar busca textual
SELECT title, ts_rank(to_tsvector('portuguese', content), websearch_to_tsquery('portuguese', 'processo vendas')) as rank
FROM knowledge_base_documents
WHERE to_tsvector('portuguese', content) @@ websearch_to_tsquery('portuguese', 'processo vendas')
ORDER BY rank DESC;
```

### Problema: Sessão não avança de estado

**Diagnóstico:** Verifique logs do orquestrador:
```sql
SELECT * FROM orquestrador_acoes
WHERE sessao_id = 'YOUR_SESSION_ID'
ORDER BY created_at DESC
LIMIT 10;
```

## Diferenças do Sistema Antigo

| Aspecto | Sistema Antigo (FSM) | Sistema Novo (RAG) |
|---------|---------------------|-------------------|
| Controle de fluxo | FSM rígido + Checklist | Orquestrador flexível |
| Conhecimento | Hard-coded nos prompts | Knowledge base dinâmica |
| Decisões | Markers + Regex | LLM + RAG contextual |
| Escalabilidade | Difícil adicionar metodologias | Fácil: adicionar documento |
| Manutenção | Alta complexidade | Componentes isolados |
| Loops | Frequentes | Prevenidos pelo orquestrador |

## Suporte

Para dúvidas ou problemas:
1. Verifique logs da edge function no Supabase Dashboard
2. Consulte tabela `orquestrador_acoes` para histórico de decisões
3. Revise documentação dos componentes nos arquivos `.ts`

---

**Status:** ✅ Sistema implementado e pronto para testes
**Versão:** 1.0 (27/10/2025)
**Próxima ação:** Popular knowledge base e realizar testes integrados
