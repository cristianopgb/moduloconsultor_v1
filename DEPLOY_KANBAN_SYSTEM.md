# 🚀 Guia de Deploy - Sistema Kanban Avançado

## Passos Necessários

### 1️⃣ Aplicar Migração do Banco de Dados

A migração está em: `supabase/migrations/20251105000000_expand_kanban_system.sql`

**Opção A - Via Supabase Dashboard (Recomendado):**

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Copie todo o conteúdo do arquivo `supabase/migrations/20251105000000_expand_kanban_system.sql`
6. Cole no editor SQL
7. Clique em **Run** (ou pressione Ctrl+Enter)
8. Aguarde a confirmação de sucesso

**Opção B - Via CLI do Supabase:**

```bash
cd /tmp/cc-agent/59063573/project
npx supabase db push
```

### 2️⃣ Fazer Deploy da Edge Function

A edge function está em: `supabase/functions/agente-execucao/index.ts`

**Via Supabase CLI:**

```bash
# Certifique-se de estar logado
npx supabase login

# Faça o link com seu projeto (se ainda não fez)
npx supabase link --project-ref SEU_PROJECT_REF

# Faça o deploy da função
npx supabase functions deploy agente-execucao
```

**Verificar variáveis de ambiente:**

A função precisa da variável `OPENAI_API_KEY`. Verifique se já está configurada:

```bash
# Listar secrets
npx supabase secrets list

# Se não existir, adicione:
npx supabase secrets set OPENAI_API_KEY=sua-chave-aqui
```

### 3️⃣ Verificar Políticas de Storage

As políticas de storage são criadas automaticamente pela migração, mas verifique:

1. Vá em **Storage** no Supabase Dashboard
2. Verifique se o bucket `project-attachments` existe
3. Confirme que as políticas RLS estão ativas

### 4️⃣ Testar o Sistema

1. **Teste a migração:**
   - Acesse o chat do consultor
   - Verifique se a aba Kanban mostra o mini-dashboard
   - Clique em "Abrir Gestão de Projetos"

2. **Teste o Kanban:**
   - Crie uma nova ação manualmente
   - Tente arrastar entre colunas
   - Edite uma ação e salve

3. **Teste o Chat Executor:**
   - Envie uma mensagem: "Olá, como está o projeto?"
   - Teste upload de arquivo
   - Tente comandos como: "Concluí a ação [nome da ação]"

4. **Teste o Calendário:**
   - Mude para visualização de calendário
   - Clique em um dia com ações
   - Atualize o status de uma ação

## 📋 Checklist de Verificação

- [ ] Migração aplicada com sucesso (sem erros)
- [ ] Edge function `agente-execucao` deployada
- [ ] OPENAI_API_KEY configurada
- [ ] Bucket `project-attachments` criado
- [ ] Políticas RLS ativas no storage
- [ ] Mini-dashboard aparece na aba Kanban
- [ ] Botão "Abrir Gestão de Projetos" funciona
- [ ] Página de projetos abre corretamente
- [ ] Kanban permite drag-and-drop
- [ ] Modal de edição abre e salva
- [ ] Chat Executor responde mensagens
- [ ] Upload de arquivos funciona
- [ ] Calendário mostra ações corretamente
- [ ] KPIs atualizam em tempo real

## 🔍 Verificar Erros

**Se a migração falhar:**

```sql
-- Verifique se as tabelas foram criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('acao_anexos', 'project_files', 'acao_historico');

-- Verifique se as colunas foram adicionadas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'kanban_cards'
AND column_name IN ('observacoes', 'tags', 'prioridade', 'progresso', 'responsavel_id');
```

**Se a edge function não funcionar:**

```bash
# Ver logs da função
npx supabase functions logs agente-execucao --follow

# Testar localmente primeiro
npx supabase functions serve agente-execucao
```

## 🐛 Troubleshooting Comum

### Erro: "relation kanban_cards already exists"
✅ A migração já foi aplicada parcialmente. Execute apenas as partes que falharam.

### Erro: "OPENAI_API_KEY not configured"
✅ Configure a chave: `npx supabase secrets set OPENAI_API_KEY=sua-chave`

### Erro: 403 ao fazer upload de arquivos
✅ Verifique as políticas de storage no dashboard do Supabase

### Edge function retorna 400
✅ Verifique se jornada_id existe e está sendo enviado corretamente

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase Dashboard > Database > Logs
2. Verifique os logs da Edge Function
3. Confirme que todas as variáveis de ambiente estão configuradas
4. Teste a conexão com o banco de dados

## ✅ Sucesso!

Se todos os itens do checklist estiverem marcados, o sistema está pronto para uso! 🎉

Os usuários agora podem:
- Ver KPIs das ações no painel lateral
- Acessar a página completa de gestão de projetos
- Gerenciar ações com drag-and-drop
- Conversar com o Agente Executor
- Visualizar prazos no calendário
- Fazer upload de documentos
- Acompanhar métricas em tempo real
