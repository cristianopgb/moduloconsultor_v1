# Genius Create Task - Edge Function

Edge Function para criar tarefas na API Manus.im com suporte a upload de arquivos.

## Configuração Necessária

### 1. MANUS_API_KEY (OBRIGATÓRIO)

Esta Edge Function requer o secret `MANUS_API_KEY` configurado no Supabase.

**Como configurar:**

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **Project Settings** > **Edge Functions**
4. Na seção **Secrets**, adicione:
   - **Name:** `MANUS_API_KEY`
   - **Value:** Seu token JWT obtido em https://manus.im

**Formato esperado:**
- O token deve ser um JWT válido (3 segmentos separados por ponto)
- Exemplo: `eyJhbGc...header.eyJpc3M...payload.SflKxw...signature`

**Como obter o token:**
1. Acesse https://manus.im
2. Faça login ou crie uma conta
3. Acesse a seção de API ou configurações
4. Copie seu API token/key

### 2. Verificar configuração

Após configurar o secret, teste com:

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/genius-create-task' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Teste de conexão",
    "conversation_id": "test-uuid",
    "files": []
  }'
```

## Erros Comuns

### Erro 503: "Serviço Genius não configurado"

**Causa:** MANUS_API_KEY não está configurado ou está em formato inválido.

**Solução:** Configure o secret conforme instruções acima.

### Erro 401: "invalid token: token is malformed"

**Causa:** O MANUS_API_KEY está configurado mas é inválido ou expirou.

**Solução:**
1. Verifique se copiou o token completo (todos os 3 segmentos do JWT)
2. Gere um novo token no dashboard do Manus
3. Atualize o secret no Supabase

## Features

- ✅ Upload de até 5 arquivos por tarefa
- ✅ Limite de 25MB por arquivo
- ✅ Limite total de 100MB
- ✅ Validação de MIME types e magic bytes
- ✅ Retry com exponential backoff
- ✅ Telemetria completa com trace_id
- ✅ Suporte a PDF, Excel, CSV, imagens, Word, PowerPoint

## Formatos Suportados

- PDF (`.pdf`)
- Excel (`.xlsx`, `.xls`)
- CSV (`.csv`)
- Imagens (`.png`, `.jpg`, `.jpeg`)
- Word (`.docx`)
- PowerPoint (`.pptx`)
- Texto (`.txt`)

## Limites

| Parâmetro | Limite |
|-----------|--------|
| Arquivos por tarefa | 5 |
| Tamanho por arquivo | 25 MB |
| Tamanho total | 100 MB |
| Prompt | 5000 caracteres |

## Logs e Telemetria

A função gera logs estruturados em JSON com os seguintes eventos:

- `task_creation_started` - Início do processo
- `upload_started` - Início de upload de arquivo
- `upload_completed` - Upload concluído com sucesso
- `upload_failed` - Falha no upload
- `task_created` - Tarefa criada com sucesso
- `task_creation_failed` - Falha na criação da tarefa
- `api_key_validation_failed` - Validação do API key falhou

Cada log inclui o `trace_id` para correlação e debugging.
