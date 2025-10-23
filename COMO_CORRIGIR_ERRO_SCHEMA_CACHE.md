# 🔧 Como Corrigir o Erro PGRST205 - Schema Cache

## O Problema

O erro `PGRST205: "Could not find the table in the schema cache"` acontece quando o PostgREST (a camada API do Supabase) não reconhece as tabelas que existem no banco de dados. As tabelas existem fisicamente, mas o cache do PostgREST está desatualizado.

## Sintomas

- Erro 404 ao tentar acessar tabelas (users, conversations, models, etc)
- Mensagem: "Could not find the table 'public.tablename' in the schema cache"
- Impossível fazer login/cadastro
- Templates não aparecem
- Nova conversa não pode ser criada

## Solução Completa

### Passo 1: Executar Script SQL de Correção

1. Abra o **Supabase Dashboard**
2. Vá para **SQL Editor** no menu lateral
3. Clique em **New Query**
4. Abra o arquivo `supabase/fix-schema-cache.sql` do projeto
5. Copie TODO o conteúdo
6. Cole no SQL Editor
7. Clique em **Run** (ou Ctrl/Cmd + Enter)

**O que o script faz:**
- ✅ Força reload do schema cache do PostgREST
- ✅ Corrige permissões do role `authenticator`
- ✅ Habilita RLS em tabelas críticas
- ✅ Cria políticas RLS básicas se não existirem
- ✅ Lista status de todas as tabelas

**Tempo estimado:** 10-15 segundos

### Passo 2: Aguardar Propagação

1. Aguarde **10-15 segundos** após executar o script
2. O PostgREST precisa processar o comando NOTIFY
3. Não faça nada durante este período

### Passo 3: Recarregar o Aplicativo

1. Volte para o aplicativo web
2. Pressione **F5** ou Ctrl/Cmd + R para recarregar completamente
3. Limpe o cache do navegador se necessário (Ctrl/Cmd + Shift + R)
4. Tente fazer login ou criar conta novamente

### Passo 4: Verificar se Funcionou

Abra o **DevTools** (F12) e verifique o console:

**Se funcionou:**
- ✅ Não aparecem mais erros PGRST205
- ✅ Você consegue fazer login/cadastro
- ✅ Templates carregam corretamente
- ✅ Pode criar nova conversa

**Se ainda há problemas:**
- Continue para o Passo 5

### Passo 5: Reiniciar o Projeto Supabase (Se Necessário)

Se o problema persistir após 2 minutos:

1. Vá para **Project Settings** no Supabase Dashboard
2. Aba **General**
3. Role até o final da página
4. Clique em **Pause project**
5. Aguarde até o projeto pausar completamente (30 segundos)
6. Clique em **Restore project**
7. Aguarde 1-2 minutos para o projeto iniciar completamente
8. Tente acessar o aplicativo novamente

**ATENÇÃO:** Pausar o projeto interrompe todos os serviços temporariamente!

## Correções Aplicadas no Frontend

O código do frontend foi melhorado para lidar com erros PGRST205:

### AuthContext (src/contexts/AuthContext.tsx)

**Melhorias:**
- ✅ Limpeza automática de tokens inválidos
- ✅ Tratamento de erros de refresh token
- ✅ Retry logic no cadastro de usuários
- ✅ Fallback para criação manual se trigger falhar
- ✅ Prevenção de memory leaks com mounted flag

### ChatPage (src/components/Chat/ChatPage.tsx)

**Melhorias:**
- ✅ Retry automático ao carregar templates (3 tentativas)
- ✅ Retry automático ao carregar conversas (3 tentativas)
- ✅ Delay incremental entre tentativas (2s, 4s, 6s)
- ✅ Fallback gracioso com array vazio
- ✅ Logs detalhados para debugging

## Testando a Correção

### Teste 1: Cadastro de Novo Usuário

1. Acesse a página de cadastro
2. Preencha email e senha
3. Escolha role: "user" ou "master"
4. Clique em "Cadastrar"
5. **Esperado:** Cadastro bem-sucedido e login automático

### Teste 2: Carregar Templates

1. Faça login
2. Vá para o Chat
3. Observe o console do DevTools
4. **Esperado:** Mensagem "✅ X templates carregados"

### Teste 3: Criar Nova Conversa

1. No Chat, clique no botão "+" (Nova Conversa)
2. **Esperado:** Nova conversa criada sem erros
3. Verifique a lista lateral de conversas

### Teste 4: Módulo Consultor

1. Mude para modo "Consultor" no toggle
2. Envie uma mensagem
3. **Esperado:** Lateral direita aparece com Jornada/Docs/Kanban

## Troubleshooting Avançado

### Erro: "relation does not exist"

Significa que a tabela realmente não existe. Verifique no Table Editor do Supabase se a tabela está lá.

**Solução:** Execute as migrations faltantes.

### Erro: "permission denied for table"

Problema de RLS ou permissões.

**Solução:**
1. Execute o script `fix-schema-cache.sql` novamente
2. Verifique se RLS está habilitado: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
3. Verifique políticas: `SELECT * FROM pg_policies WHERE tablename = 'nome_da_tabela'`

### Erro: "JWT expired" ou "Invalid Refresh Token"

Token de autenticação expirou.

**Solução:**
1. Faça logout
2. Limpe localStorage: `localStorage.clear()`
3. Recarregue a página (F5)
4. Faça login novamente

### Console mostra retry infinito

O schema cache não está sendo atualizado.

**Solução:**
1. Pause e restore o projeto Supabase
2. Aguarde 2 minutos completos
3. Execute o script SQL novamente
4. Recarregue o aplicativo

## Monitoramento

Para monitorar a saúde do sistema:

### SQL para Verificar Tabelas Visíveis

```sql
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### SQL para Contar Políticas RLS

```sql
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

### SQL para Verificar Permissões

```sql
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('authenticated', 'anon', 'authenticator')
ORDER BY table_name, grantee;
```

## Prevenção

Para evitar este problema no futuro:

1. **Sempre use migrations** para alterações no schema
2. **Execute NOTIFY após DDL**: `NOTIFY pgrst, 'reload schema';`
3. **Teste em ambiente de staging** antes de produção
4. **Monitore logs do PostgREST** no Supabase Dashboard
5. **Configure alertas** para erros PGRST205

## Suporte

Se nada funcionar:

1. Tire prints dos erros no console
2. Exporte os logs do PostgREST (Dashboard → Edge Functions → Logs)
3. Verifique se há incidentes no [status.supabase.com](https://status.supabase.com)
4. Entre em contato com suporte do Supabase se for problema de infraestrutura

---

**Última atualização:** 23 de outubro de 2025
**Status:** Correções aplicadas e testadas
