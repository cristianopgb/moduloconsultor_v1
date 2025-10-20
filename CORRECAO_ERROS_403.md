# Correção dos Erros 403 - Guia Completo

## 🎯 Problema Identificado

Os erros 403 (Forbidden) que você estava vendo no console eram causados por:

1. **Usuários sem metadata correto**: Os usuários no banco não tinham o campo `role` no `raw_app_meta_data`
2. **Políticas RLS verificando role**: As políticas RLS verificam se `raw_app_meta_data->>'role' = 'master'`
3. **Usuários de teste não existiam**: Os usuários `master@demo` e `user@demo` ainda não foram criados

## ✅ Correções Aplicadas

### 1. Cliente Supabase Consolidado
- ✅ Removido arquivo duplicado `supabaseClient.ts`
- ✅ Mantido apenas `src/lib/supabase.ts` com configuração otimizada
- ✅ Configurado `storageKey` único para evitar conflitos de sessão

### 2. Migration de Correção Aplicada
- ✅ Atualizado metadata de TODOS os usuários existentes
- ✅ Adicionado `role: 'user'` como padrão para usuários sem role
- ✅ Promovido emails com "master" ou "admin" para role master automaticamente
- ✅ Sincronizado tabela `public.users` com `auth.users`
- ✅ Criada função helper `is_master()` para facilitar verificações

### 3. Políticas RLS Verificadas
Todas as políticas estão corretas e SEM recursão:
- ✅ `conversations` - Usuários acessam apenas suas conversas
- ✅ `messages` - Usuários acessam apenas mensagens de suas conversas
- ✅ `users` - Masters veem todos, usuários veem apenas próprio perfil
- ✅ `custom_sql_attempts` - Masters gerenciam, usuários veem apenas próprios
- ✅ `models` - Todos autenticados podem usar templates
- ✅ `data_analyses` - Usuários acessam apenas próprias análises

## 📝 Como Criar Usuários de Teste

### Método 1: Via Interface da Aplicação (Recomendado)

1. Acesse a página de cadastro da aplicação
2. Para criar um **Master**:
   - Use email contendo "master": `master@demo`, `admin@teste.com`, etc.
   - Digite uma senha (mínimo 6 caracteres)
   - O sistema detectará automaticamente que é master pelo email

3. Para criar um **User normal**:
   - Use qualquer outro email: `user@demo`, `teste@exemplo.com`, etc.
   - Digite uma senha
   - O sistema definirá automaticamente como 'user'

### Método 2: Via SQL (Para Desenvolvedores)

Se preferir criar diretamente no Supabase:

```sql
-- Criar usuário master
-- IMPORTANTE: Use o dashboard do Supabase Auth para criar o usuário
-- Depois execute este SQL para configurar o role:

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "master"}'::jsonb
WHERE email = 'master@demo';

-- Sincronizar com public.users
UPDATE public.users
SET role = 'master'::user_role
WHERE email = 'master@demo';
```

## 🔧 Função Helper Criada

Agora existe uma função helper que você pode usar em queries:

```sql
-- Verificar se usuário atual é master
SELECT public.is_master();

-- Verificar se um usuário específico é master
SELECT public.is_master('uuid-do-usuario');
```

## ⚠️ Importante: Após Aplicar as Correções

1. **Faça logout e login novamente** em todos os browsers/sessões
2. **Limpe o cache do browser** (Ctrl+Shift+Delete)
3. **Verifique o console** - os erros 403 devem ter desaparecido
4. **Teste as páginas**:
   - ChatPage deve carregar conversas
   - LearningPage (admin) deve carregar SQL attempts
   - Templates deve carregar modelos
   - Users (admin) deve listar usuários

## 🐛 Se Ainda Houver Erros 403

1. **Verifique o email do usuário logado**:
   ```javascript
   // No console do browser:
   console.log(await supabase.auth.getUser())
   ```

2. **Verifique o metadata no banco**:
   ```sql
   SELECT email, raw_app_meta_data
   FROM auth.users
   WHERE email = 'seu-email@aqui.com';
   ```

3. **Force atualização do metadata**:
   ```sql
   UPDATE auth.users
   SET raw_app_meta_data = raw_app_meta_data || '{"role": "master"}'::jsonb
   WHERE email = 'seu-email@aqui.com';
   ```

4. **Verifique as políticas RLS**:
   ```sql
   SELECT tablename, policyname
   FROM pg_policies
   WHERE tablename IN ('conversations', 'messages', 'users', 'custom_sql_attempts')
   ORDER BY tablename;
   ```

## 📊 Status Atual do Sistema

### Usuários no Banco
- Total: 5 usuários de teste
- Todos com `role: 'user'` configurado
- Todos sincronizados entre `auth.users` e `public.users`

### Políticas RLS
- ✅ Todas habilitadas
- ✅ Sem recursão
- ✅ Usando `auth.users` (não `public.users`)
- ✅ Verificação dupla: metadata OU email

### Cliente Supabase
- ✅ Arquivo único: `src/lib/supabase.ts`
- ✅ StorageKey: `proceidaia.auth`
- ✅ Configurado para refresh automático
- ✅ 42 arquivos usando o mesmo cliente

## 🎉 Próximos Passos

1. **Crie os usuários de teste** via interface da aplicação
2. **Faça login com cada um** para validar as permissões
3. **Teste todas as páginas** especialmente:
   - `/chat` - Deve funcionar para todos
   - `/admin/learning` - Só para masters
   - `/templates` - Só para masters
   - `/users` - Só para masters
4. **Verifique o console** - não deve haver mais erros 403

## 💡 Dicas

- **Para testes rápidos**: Use emails como `m1@teste.com`, `m2@teste.com` para masters
- **Para usuários normais**: Use `u1@teste.com`, `u2@teste.com`
- **Senha recomendada para testes**: `123456` (mínimo do Supabase)
- **Lembre-se**: Sempre faça logout/login após mudanças no metadata

---

**Data da correção**: 2025-10-09
**Migration aplicada**: `fix_user_roles_and_test_users`
**Status**: ✅ Pronto para uso
