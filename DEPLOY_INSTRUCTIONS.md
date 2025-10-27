# Instruções de Deploy - Sistema RAG

## Status Atual

✅ **Código pronto e corrigido:**
- `/supabase/functions/consultor-rag/index.ts` - Edge function principal
- `/supabase/functions/consultor-rag/orchestrator.ts` - Orquestrador
- `/supabase/functions/consultor-rag/rag-engine.ts` - Motor RAG

✅ **Database schema criado:**
- Tabelas: `knowledge_base_documents`, `consultor_sessoes`, `orquestrador_acoes`
- RLS policies configuradas

✅ **Seed scripts prontos:**
- `/seed-knowledge-sql.js` - Script para popular knowledge base

## Próximos Passos

### 1. Popular Knowledge Base

Antes de fazer deploy, a knowledge base precisa ser populada. Você tem duas opções:

#### Opção A: Via script (requer login como master)

```bash
# Edite seed-knowledge-sql.js e configure as credenciais:
# MASTER_EMAIL = 'master@demo.com'
# MASTER_PASSWORD = 'sua-senha'

node seed-knowledge-sql.js
```

#### Opção B: Via SQL direto (mais simples)

```bash
# Use o Supabase Dashboard -> SQL Editor
# Cole o conteúdo de supabase/seed-knowledge-base.sql
# Execute diretamente no dashboard
```

### 2. Deploy da Edge Function

A edge function utiliza 3 arquivos que precisam ser enviados juntos:

```bash
# Via Supabase CLI (se disponível)
supabase functions deploy consultor-rag

# Ou via dashboard:
# Vá em Edge Functions -> New Function
# Nome: consultor-rag
# Cole o conteúdo de index.ts
# Adicione orchestrator.ts e rag-engine.ts como dependências
```

### 3. Configurar Environment Variables

A edge function requer estas variáveis de ambiente:

```
OPENAI_API_KEY=sk-...
```

Configurar no Supabase Dashboard -> Edge Functions -> consultor-rag -> Settings

As demais variáveis (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) já estão disponíveis automaticamente.

### 4. Testar a Function

```bash
curl -X POST https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/consultor-rag \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Preciso melhorar meu processo de vendas",
    "user_id": "bf19980f-c9b1-4684-85ad-f0a9055d5521"
  }'
```

### 5. Integrar com Front-End

Criar adapter que conecta o novo sistema com a UI existente:

```typescript
// src/lib/consultor/rag-adapter.ts
export async function callConsultorRAG(params: {
  message: string;
  userId: string;
  conversationId?: string;
  sessaoId?: string;
  formData?: any;
}) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/consultor-rag`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    }
  );

  return response.json();
}
```

## Troubleshooting

### Erro: "Module not found orchestrator.ts"

**Solução:** O deploy via MCP tool tem limitações com múltiplos arquivos. Use:
1. Supabase CLI: `supabase functions deploy consultor-rag`
2. Dashboard: Upload manual dos 3 arquivos
3. Ou: Inline todo código em um único arquivo (não recomendado)

### Erro: "OPENAI_API_KEY not configured"

**Solução:** Configure a variável de ambiente no Supabase Dashboard

### Erro: Knowledge base vazia

**Solução:** Execute seed script conforme instruções acima

### Erro: RLS policy violation

**Solução:** Certifique-se de que:
1. Usuário está autenticado
2. Políticas RLS foram aplicadas corretamente
3. Se inserindo na knowledge base, usuário é master

## Verificação de Deploy

Após deploy, verifique:

1. ✅ Edge function aparece no dashboard
2. ✅ Logs mostram function inicializando corretamente
3. ✅ Teste simples retorna resposta
4. ✅ Knowledge base tem pelo menos 4-6 documentos
5. ✅ Sessões são criadas corretamente
6. ✅ Orquestrador registra ações no log

## Arquitetura Implementada

```
Front-End (React)
      ↓
Adapter (rag-adapter.ts)
      ↓
Edge Function (consultor-rag/index.ts)
      ├→ Orchestrator (orchestrator.ts)
      │   └→ Determina ações e transições
      │
      └→ RAG Engine (rag-engine.ts)
          └→ Busca conhecimento relevante
              ↓
          Knowledge Base (PostgreSQL)
              - SIPOC
              - Canvas
              - 5W2H
              - Matriz
              - 5 Porquês
              - Cadeia de Valor
```

## Próximas Melhorias

### Fase 2: RAG Semântico
- [ ] Implementar busca com embeddings
- [ ] Adicionar cache de embeddings
- [ ] Melhorar algoritmo de ranking

### Fase 3: Adapters Completos
- [ ] Criar fallback para sistema antigo
- [ ] Migração gradual dos usuários
- [ ] A/B testing entre sistemas

### Fase 4: Analytics
- [ ] Dashboard de metodologias mais usadas
- [ ] Métricas de sucesso das consultorias
- [ ] Feedback loop para melhorias

---

**Desenvolvido em:** 27/10/2025
**Sistema:** Proceda - Consultor com RAG + Orquestração
**Status:** ✅ Código pronto, pendente deploy e testes
