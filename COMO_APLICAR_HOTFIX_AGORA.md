# 🚀 Como Aplicar o Hotfix AGORA

**Tempo estimado:** 5 minutos
**Pré-requisitos:** Acesso ao Supabase Dashboard

---

## Passo 1: Aplicar Migration SQL (2 minutos)

### Opção A: Via SQL Editor (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/sql/new
2. Cole o conteúdo abaixo:

```sql
/*
  # Add user_id column to messages table

  1. Changes
    - Add `user_id` column to `messages` table (nullable for backward compatibility)
    - Add foreign key constraint to `auth.users`
    - Create index on `user_id` for performance
    - Update RLS policies to include user_id checks

  2. Security
    - Column is nullable to maintain compatibility with existing messages
    - RLS policies updated to check user_id where available
*/

-- 1) Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='messages' AND column_name='user_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN user_id uuid;

    -- Add foreign key constraint
    ALTER TABLE public.messages
      ADD CONSTRAINT fk_messages_user_id
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Create index for performance
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);

-- 3) Update RLS policies to include user_id checks
DROP POLICY IF EXISTS "Users can read own messages" ON messages;
CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
```

3. Clique em "Run" (ou F5)
4. Aguarde mensagem de sucesso: "Success. No rows returned"

### Opção B: Via Supabase CLI

```bash
supabase db push
```

---

## Passo 2: Deploy da Edge Function (3 minutos)

### Opção A: Via Supabase CLI (Recomendado)

```bash
# Na pasta do projeto:
supabase functions deploy consultor-chat
```

### Opção B: Via Dashboard Manual

1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/functions/consultor-chat
2. Clique em "Edit Function"
3. Copie TODO o conteúdo de: `supabase/functions/consultor-chat/index.ts`
4. Cole no editor
5. Clique em "Deploy"
6. Aguarde: "Function deployed successfully"

---

## Passo 3: Verificar Deployment (1 minuto)

### Verificar Migration

No SQL Editor, execute:

```sql
-- Deve retornar uma linha com 'user_id'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages' AND column_name = 'user_id';
```

**Resultado esperado:**
```
column_name | data_type | is_nullable
user_id     | uuid      | YES
```

### Verificar Edge Function

No terminal ou logs:

```bash
# Ver logs em tempo real
supabase functions logs consultor-chat --tail

# Ou faça um teste simples via curl:
curl -X POST https://[seu-projeto].supabase.co/functions/v1/consultor-chat \
  -H "Authorization: Bearer [sua-anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá", "conversation_id": "test-123", "user_id": "test-user"}'
```

**Resultado esperado:** Resposta JSON sem erro 400

---

## Passo 4: Testar na Interface (2 minutos)

1. Acesse sua aplicação
2. Inicie nova conversa
3. Aguarde apresentação
4. Diga "sim" quando propor anamnese
5. Preencha formulário de anamnese
6. Envie

**Verificar:**
- ✅ Entregável de anamnese aparece na aba "Entregáveis"
- ✅ Timeline mostra "Formulário recebido: anamnese"
- ✅ Timeline mostra "Entregável gerado: anamnese"
- ✅ LLM comenta sobre dados antes de propor Canvas
- ✅ Canvas NÃO abre automaticamente

Se todos os ✅ aparecerem: **SUCESSO!** 🎉

---

## ⚠️ Troubleshooting

### Erro: "Could not find the 'user_id' column"

**Causa:** Migration não foi aplicada
**Solução:** Executar Passo 1 novamente

### Erro: "Function not found"

**Causa:** Deploy da edge function falhou
**Solução:** Executar Passo 2 novamente

### Forms ainda abrem em cascata

**Causa:** Código antigo ainda em cache
**Solução:**
1. Fazer hard refresh (Ctrl+Shift+R ou Cmd+Shift+R)
2. Limpar cache do browser
3. Verificar se o deploy foi concluído

### Timeline não aparece

**Causa:** Erro silencioso de inserção
**Solução:**
1. Verificar logs: `supabase functions logs consultor-chat`
2. Verificar se tabela timeline_consultor existe:
```sql
SELECT * FROM timeline_consultor LIMIT 1;
```

### Entregáveis não são gerados

**Causa:** OPENAI_API_KEY não configurada ou inválida
**Solução:**
1. Verificar secrets: `supabase secrets list`
2. Configurar se necessário: `supabase secrets set OPENAI_API_KEY=sk-...`

---

## 📊 Métricas de Sucesso

Após aplicar o hotfix, você deve observar:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Forms em cascata | ✅ Sim | ❌ Não |
| Erro 400 user_id | ✅ Sim | ❌ Não |
| Entregáveis gerados | ❌ Não | ✅ Sim |
| Timeline registra | ❌ Não | ✅ Sim |
| Loop anamnese | ✅ Sim | ❌ Não |
| Validação aguarda | ❌ Não | ✅ Sim |

---

## 🎯 Próximos Passos

Após confirmar que tudo funciona:

1. Testar fluxo completo (Anamnese → Canvas → Cadeia → Matriz → Validação → Execução)
2. Verificar entregáveis gerados na aba "Entregáveis"
3. Verificar timeline na interface
4. Testar com múltiplos usuários
5. Monitorar logs por 24h para verificar estabilidade

---

## 📞 Suporte

Se encontrar problemas que não estão no Troubleshooting:

1. Copiar logs completos: `supabase functions logs consultor-chat > logs.txt`
2. Verificar estado da jornada no banco:
```sql
SELECT
  id,
  etapa_atual,
  aguardando_validacao,
  contexto_coleta::jsonb ? 'anamnese' as tem_anamnese,
  contexto_coleta::jsonb ? 'canvas' as tem_canvas,
  contexto_coleta::jsonb ? 'cadeia_valor' as tem_cadeia
FROM jornadas_consultor
WHERE user_id = '[seu-user-id]'
ORDER BY created_at DESC
LIMIT 1;
```

---

**Última atualização:** 23 de Outubro de 2025
**Status:** Pronto para produção ✅
