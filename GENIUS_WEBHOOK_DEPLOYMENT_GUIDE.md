# Guia de Deploy e Configuração do Webhook Genius

## ✅ O que foi corrigido

A função `genius-webhook` foi modificada para aceitar requisições GET/HEAD vindas do painel do Manus durante o teste de validação do webhook.

### Mudanças implementadas:

1. **Suporte a GET/HEAD**: Quando o Manus testa o webhook, ele faz uma requisição simples (GET ou HEAD) para verificar se o endpoint existe. Agora respondemos com status 200 e um payload JSON:
   ```json
   {
     "status": "ok",
     "service": "genius-webhook",
     "version": "1.0.0",
     "ready": true
   }
   ```

2. **CORS atualizado**: Adicionamos GET e HEAD aos métodos permitidos:
   ```typescript
   "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS"
   ```

3. **Segurança mantida**: Toda a validação de assinatura continua funcionando normalmente para requisições POST (webhooks reais do Manus).

## 📋 Próximos passos para você

### 1. Deploy da função atualizada

Como o CLI do Supabase não está disponível neste ambiente, você precisa fazer o deploy manualmente usando a UI do Supabase:

**Opção A: Deploy via Dashboard (Recomendado)**

1. Acesse: https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg/functions
2. Clique na função `genius-webhook`
3. Clique em "Deploy"
4. Cole o conteúdo completo do arquivo `supabase/functions/genius-webhook/index.ts`
5. Salve e aguarde o deploy concluir

**Opção B: Deploy via CLI local**

Se você tem o Supabase CLI instalado localmente:

```bash
cd /path/to/project
supabase functions deploy genius-webhook --no-verify-jwt
```

### 2. Testar o endpoint (ANTES de configurar no Manus)

Abra seu navegador e acesse:
```
https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/genius-webhook
```

Você deve ver uma resposta JSON:
```json
{
  "status": "ok",
  "service": "genius-webhook",
  "version": "1.0.0",
  "ready": true
}
```

✅ Se você ver isso, o endpoint está funcionando!

### 3. Configurar webhook no painel do Manus

1. **Acesse o painel do Manus**: https://manus.im
2. **Vá para configurações de webhook** (procure por "Webhooks" ou "Integrations" no menu)
3. **Configure o webhook**:
   - **URL**: `https://gljoasdvlaitplbmbtzg.supabase.co/functions/v1/genius-webhook`
   - **Eventos**: Marque `task_stopped` e `task_created` (se disponível)
4. **Gerar secret**: O Manus deve oferecer um botão para gerar um webhook secret
   - Copie o valor gerado (algo como: `whsec_xxxxxxxxxxxxxxxxxxxxx`)
5. **Testar webhook**: Clique no botão "Test" ou "Validate"
   - Agora deve passar com sucesso! ✅
6. **Salvar configuração**

### 4. Adicionar o webhook secret no Supabase

1. **Acesse o Dashboard do Supabase**: https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg/settings/functions
2. **Vá para "Edge Functions"** no menu lateral
3. **Clique em "Manage secrets"**
4. **Adicione um novo secret**:
   - **Name**: `MANUS_WEBHOOK_SECRET`
   - **Value**: Cole o secret que você copiou do Manus
5. **Salvar**

O Supabase vai fazer um redeploy automático de todas as funções com o novo secret.

### 5. Validar o fluxo completo

Agora teste se tudo está funcionando:

#### A) Teste com mensagem simples

1. Abra o chat Genius na sua aplicação
2. Digite uma mensagem simples: "olá"
3. Envie

**O que deve acontecer:**
- Uma mensagem sua aparece no chat ✅
- Uma mensagem "Pensando..." do assistente aparece ✅
- Após alguns segundos, a resposta do Manus aparece ✅

#### B) Teste com arquivo CSV

1. Prepare um arquivo CSV pequeno (exemplo: lista de produtos, vendas, etc)
2. No chat Genius, clique no ícone de anexo (📎)
3. Selecione o arquivo CSV
4. Digite: "Analise este arquivo e me dê insights"
5. Envie

**O que deve acontecer:**
- Sua mensagem e anexo aparecem no chat ✅
- Mensagem "Analisando seus arquivos no Manus..." aparece ✅
- Após alguns segundos, o resultado da análise aparece com possíveis anexos ✅

### 6. Monitoramento e troubleshooting

#### Ver logs das funções:

1. **Logs do genius-webhook**:
   - https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg/functions/genius-webhook/logs
   - Procure por eventos: `webhook_received`, `webhook_processed`

2. **Logs do genius-create-task**:
   - https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg/functions/genius-create-task/logs
   - Procure por eventos: `task_created`, `upload_completed`

#### Consultar dados no banco:

```sql
-- Ver últimas tarefas criadas
SELECT task_id, status, stop_reason, created_at, updated_at
FROM genius_tasks
ORDER BY created_at DESC
LIMIT 10;

-- Ver eventos de webhook recebidos
SELECT task_id, event_type, received_at
FROM genius_task_events
ORDER BY received_at DESC
LIMIT 10;

-- Ver estatísticas por usuário
SELECT * FROM genius_task_stats;
```

## 🔍 Como saber se está funcionando?

### Sinais de sucesso:

1. ✅ O teste de webhook no painel do Manus passa (botão verde, sem erro 404)
2. ✅ Ao enviar mensagens no chat, elas criam registros em `genius_tasks` com status `pending`
3. ✅ Após alguns segundos, o status muda para `completed` automaticamente
4. ✅ Novas mensagens de resposta aparecem na tabela `messages` com `message_type = 'genius_result'`
5. ✅ As respostas aparecem no frontend do chat em tempo real

### Sinais de problema:

1. ❌ Teste do webhook no Manus ainda dá erro 404 → Verifique se fez o deploy da função atualizada
2. ❌ Tasks ficam em `pending` para sempre → Webhook não está chegando do Manus
3. ❌ Webhook chega mas dá erro 401 → Secret está incorreto ou não configurado
4. ❌ Nenhuma resposta aparece no chat → Verifique RLS policies da tabela `messages`

## 📝 Checklist final

- [ ] Deploy da função `genius-webhook` feito
- [ ] Endpoint GET responde com `{"status": "ok"}`
- [ ] Webhook configurado no painel do Manus
- [ ] Teste do webhook no Manus passou (sem erro 404)
- [ ] Secret `MANUS_WEBHOOK_SECRET` adicionado no Supabase
- [ ] Teste com mensagem simples funcionou
- [ ] Teste com arquivo CSV funcionou
- [ ] Logs mostram eventos `webhook_received` e `webhook_processed`
- [ ] Tabela `genius_tasks` mostra tasks mudando de `pending` para `completed`
- [ ] Respostas aparecem no chat do frontend

## 🎉 Quando tudo estiver funcionando

Você terá um chat AI completo funcionando com:

- ✅ Conversação com o Manus (modelo manus-1.5)
- ✅ Upload e análise de arquivos (CSV, PDF, imagens, etc)
- ✅ Respostas em tempo real via webhook
- ✅ Histórico persistente de tarefas
- ✅ Telemetria e auditoria completa
- ✅ Validação de segurança via HMAC-SHA256

## 🆘 Precisa de ajuda?

Se algo não funcionar:

1. Verifique os logs das edge functions no Supabase
2. Consulte a tabela `genius_task_events` para ver se webhooks estão chegando
3. Confirme que o secret está configurado corretamente
4. Teste o endpoint GET manualmente no navegador
5. Verifique se há erros no console do frontend

---

**Arquivo modificado**: `supabase/functions/genius-webhook/index.ts`

**O que mudou**: Adicionado suporte para requisições GET/HEAD que retornam status 200, permitindo que o Manus valide o endpoint antes de salvar a configuração do webhook.
