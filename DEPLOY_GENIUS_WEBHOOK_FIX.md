# Deploy do Fix do Genius Webhook

## Problema Corrigido

O webhook do Genius estava configurado apenas para aceitar registros do Manus, mas não processava eventos reais de conclusão de tarefas (`task_stopped`). Isso resultava em tarefas ficando permanentemente em status "pending" e o usuário nunca recebia respostas do Genius.

## Mudanças Implementadas

### 1. Webhook Completo (`supabase/functions/genius-webhook/index.ts`)

Substituído o código stub por implementação completa que:

- ✅ Processa eventos `task_created` (apenas auditoria)
- ✅ Processa eventos `task_stopped` (atualiza tarefa e cria mensagem)
- ✅ Implementa idempotência via `genius_task_events`
- ✅ Valida assinatura HMAC quando `GENIUS_WEBHOOK_SECRET` está configurado
- ✅ Cria ou atualiza mensagens do assistente com o resultado
- ✅ Processa anexos (attachments) com expires_at
- ✅ Calcula latência e registra métricas
- ✅ Logging estruturado para debugging

### 2. Frontend (`src/components/Chat/GeniusChat.tsx`)

Removido a criação prematura de mensagem do assistente:

- ❌ **Antes**: Criava mensagem temporária "Pensando..." antes do webhook
- ✅ **Agora**: Webhook cria a mensagem real quando tarefa completa

## Como Fazer Deploy

### Passo 1: Fazer Deploy do Webhook

```bash
# Na raiz do projeto
npx supabase functions deploy genius-webhook --no-verify-jwt
```

### Passo 2: Verificar Variáveis de Ambiente

No Supabase Dashboard > Edge Functions, confirme que estas variáveis estão configuradas:

- `GENIUS_WEBHOOK_SECRET` = `dd16419459bd5400b9e19a5070debf4cb56492c77e20...` (já configurado)
- `MANUS_API_KEY` = `449c0dba10840e1b1f8483d14177faf86f82e674a406...` (já configurado)

### Passo 3: Frontend (Automático)

O Vite detecta mudanças automaticamente. Se necessário:

```bash
npm run build
```

### Passo 4: Testar

1. Abra o Genius Chat
2. Envie uma mensagem: "olá"
3. Aguarde a resposta do Manus
4. Verifique os logs no Supabase Dashboard > Edge Functions > genius-webhook

## Logs Esperados

### Quando Manus envia evento `task_stopped`:

```json
{
  "event": "webhook_received",
  "event_id": "evt_xxx",
  "event_type": "task_stopped",
  "task_id": "4gVnKbzV7X39wYRYta8cbP",
  "stop_reason": "finish"
}
```

```json
{
  "event": "message_created",
  "message_id": "uuid",
  "task_id": "4gVnKbzV7X39wYRYta8cbP"
}
```

```json
{
  "event": "webhook_processed",
  "task_id": "4gVnKbzV7X39wYRYta8cbP",
  "stop_reason": "finish",
  "latency_ms": 2500
}
```

## Verificação no Banco de Dados

### Verificar tarefa foi atualizada:

```sql
SELECT
  task_id,
  status,
  stop_reason,
  latency_ms,
  created_at,
  updated_at
FROM genius_tasks
WHERE task_id = 'YW5njvmnzVtnkSLorP7EKJ';
```

Status esperado: `completed`
Stop reason esperado: `finish`

### Verificar mensagem foi criada:

```sql
SELECT
  id,
  role,
  content,
  message_type,
  genius_status,
  external_task_id,
  created_at
FROM messages
WHERE external_task_id = 'YW5njvmnzVtnkSLorP7EKJ';
```

Deve existir mensagem com:
- `role` = 'assistant'
- `message_type` = 'genius_result'
- `genius_status` = 'completed'
- `content` = resposta do Manus

### Verificar evento foi auditado:

```sql
SELECT
  event_id,
  event_type,
  task_id,
  received_at
FROM genius_task_events
WHERE task_id = 'YW5njvmnzVtnkSLorP7EKJ'
ORDER BY received_at DESC;
```

## Troubleshooting

### Problema: Webhook retorna 401 (Unauthorized)

**Causa**: Assinatura inválida ou secret incorreto

**Solução**:
1. Verifique se `GENIUS_WEBHOOK_SECRET` está configurado corretamente
2. Confirme que o secret no Manus dashboard é o mesmo
3. Verifique timestamp (não pode ter mais de 5 minutos de diferença)

### Problema: Mensagem não aparece no frontend

**Causa 1**: Realtime não está inscrito corretamente

**Solução**:
1. Verifique console do navegador: deve ver `[Genius] Task update:`
2. Confirme que `genius_tasks` está na publicação realtime
3. Execute: `ALTER PUBLICATION supabase_realtime ADD TABLE genius_tasks;`

**Causa 2**: RLS bloqueando acesso

**Solução**:
1. Webhook usa `service_role`, não deve ser bloqueado
2. Verifique políticas RLS na tabela `messages`

### Problema: Task fica em "pending" indefinidamente

**Causa**: Webhook não está sendo chamado pelo Manus

**Solução**:
1. Verifique URL do webhook no Manus dashboard
2. Confirme que o webhook está "Habilitado"
3. Teste manualmente com curl:

```bash
curl -X POST https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/genius-webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

Resposta esperada: `{"success":true,"message":"Webhook registered successfully."}`

## Estrutura de Payload do Manus

### task_stopped (finish):

```json
{
  "event_id": "evt_xxx",
  "event_type": "task_stopped",
  "task_detail": {
    "task_id": "4gVnKbzV7X39wYRYta8cbP",
    "message": "Olá! Como posso ajudá-lo?",
    "stop_reason": "finish",
    "credit_usage": 150,
    "task_url": "https://manus.im/task/xxx",
    "attachments": [
      {
        "file_name": "analysis.pdf",
        "url": "https://...",
        "size_bytes": 50000,
        "mime_type": "application/pdf",
        "expires_at": "2025-11-21T00:00:00Z"
      }
    ]
  }
}
```

### task_stopped (ask):

```json
{
  "event_id": "evt_yyy",
  "event_type": "task_stopped",
  "task_detail": {
    "task_id": "4gVnKbzV7X39wYRYta8cbP",
    "message": "Preciso de mais informações. Qual o período da análise?",
    "stop_reason": "ask"
  }
}
```

## Próximos Passos

Após deploy bem-sucedido:

1. ✅ Teste com mensagem simples
2. ✅ Teste com upload de arquivo
3. ✅ Teste cenário "ask" (quando Manus pede mais info)
4. ✅ Monitore logs por 24h para verificar estabilidade
5. ✅ Configure alertas para falhas no webhook

## Rollback (Se Necessário)

Se algo der errado, reverter para stub:

```bash
git checkout HEAD~1 supabase/functions/genius-webhook/index.ts
npx supabase functions deploy genius-webhook --no-verify-jwt
```

**IMPORTANTE**: Não fazer rollback sem investigar, pois stub não processa eventos reais!
