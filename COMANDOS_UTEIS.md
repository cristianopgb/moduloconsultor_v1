# Comandos Úteis - Sistema de Migrações

Este documento lista comandos úteis para gerenciar e diagnosticar o sistema de migrações.

---

## 🔍 Diagnóstico

### Verificar estado das migrações
```bash
# Listar migrações ativas
ls -la supabase/migrations/*.sql

# Contar migrações ativas
ls -1 supabase/migrations/*.sql | wc -l

# Listar migrações arquivadas
find supabase/migrations_archive -name '*.sql'
```

### Analisar políticas RLS
```bash
# Contar CREATE POLICY por arquivo
grep -c "CREATE POLICY" supabase/migrations/*.sql | grep -v ":0$"

# Listar arquivos com políticas
grep -l "CREATE POLICY" supabase/migrations/*.sql

# Ver todas as políticas criadas
grep "CREATE POLICY" supabase/migrations/*.sql | sed 's/.*CREATE POLICY //' | sed 's/"//g'
```

### Verificar conflitos
```bash
# Procurar políticas duplicadas (mesmo nome)
grep -h "CREATE POLICY" supabase/migrations/*.sql | sort | uniq -d

# Procurar por tabela específica
grep -n "custom_sql_attempts" supabase/migrations/*.sql
```

---

## 🗄️ SQL - Executar no Supabase SQL Editor

### Listar todas as políticas ativas
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE WHEN qual IS NOT NULL THEN 'YES' ELSE 'NO' END as has_using,
  CASE WHEN with_check IS NOT NULL THEN 'YES' ELSE 'NO' END as has_with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;
```

### Contar políticas por tabela
```sql
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC, tablename;
```

### Detectar políticas duplicadas
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  COUNT(*) as duplicates
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
GROUP BY schemaname, tablename, policyname
HAVING COUNT(*) > 1;
```

### Verificar RLS habilitado
```sql
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Listar políticas de uma tabela específica
```sql
-- Substituir 'custom_sql_attempts' pela tabela desejada
SELECT 
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'custom_sql_attempts'
ORDER BY policyname;
```

### Verificar storage buckets
```sql
SELECT 
  b.id as bucket_name,
  b.public,
  COUNT(p.policyname) as policy_count
FROM storage.buckets b
LEFT JOIN pg_policies p 
  ON p.schemaname = 'storage' 
  AND p.tablename = 'objects'
  AND p.policyname LIKE b.id || '%'
GROUP BY b.id, b.public
ORDER BY b.id;
```

---

## 🛠️ Manutenção

### Validar integridade RLS
```bash
# Executar script de validação completo
# (Copie conteúdo de supabase/validate-rls.sql para SQL Editor)
```

### Build do projeto
```bash
# Verificar se não há erros TypeScript
npm run build

# Executar em modo dev
npm run dev
```

### Criar nova migração
```bash
# Gerar timestamp atual
date +%Y%m%d%H%M%S

# Criar arquivo (substitua YYYYMMDDHHMMSS)
touch supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

---

## 📊 Reporting

### Gerar relatório de políticas
```sql
-- Relatório completo de todas as políticas
WITH policy_stats AS (
  SELECT 
    tablename,
    COUNT(*) as total_policies,
    COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_policies,
    COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_policies,
    COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_policies,
    COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_policies,
    COUNT(*) FILTER (WHERE cmd = 'ALL') as all_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT 
  tablename,
  total_policies,
  select_policies,
  insert_policies,
  update_policies,
  delete_policies,
  all_policies
FROM policy_stats
ORDER BY total_policies DESC, tablename;
```

### Comparar estado esperado vs real
```sql
-- Compara com estado esperado da migração mestre
WITH expected AS (
  SELECT * FROM (VALUES
    ('users', 4),
    ('custom_sql_attempts', 5),
    ('ai_agents', 1),
    ('ai_providers', 1),
    ('analyses', 5),
    ('datasets', 5),
    ('documents', 5),
    ('projects', 5),
    ('conversations', 5),
    ('messages', 5),
    ('data_analyses', 4)
  ) AS t(table_name, expected_count)
),
actual AS (
  SELECT 
    tablename,
    COUNT(*) as actual_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT 
  e.table_name,
  e.expected_count,
  COALESCE(a.actual_count, 0) as actual_count,
  CASE 
    WHEN COALESCE(a.actual_count, 0) = e.expected_count THEN '✅ OK'
    WHEN COALESCE(a.actual_count, 0) > e.expected_count THEN '⚠️  EXCESSO'
    ELSE '❌ FALTAM'
  END as status
FROM expected e
LEFT JOIN actual a ON e.table_name = a.tablename
ORDER BY e.table_name;
```

---

## 🔧 Troubleshooting

### Erro: Política duplicada
```sql
-- Dropar política específica
DROP POLICY IF EXISTS "nome_da_politica" ON nome_da_tabela;

-- Ou executar migração mestre que limpa tudo
-- (veja: 20251010000000_master_rls_policies_consolidated.sql)
```

### Erro: RLS não habilitado
```sql
-- Habilitar RLS em tabela
ALTER TABLE nome_da_tabela ENABLE ROW LEVEL SECURITY;
```

### Erro 403: Permission Denied
```sql
-- 1. Verificar se RLS está habilitado
SELECT rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'sua_tabela';

-- 2. Verificar políticas da tabela
SELECT * FROM pg_policies 
WHERE tablename = 'sua_tabela';

-- 3. Testar permissão específica
-- (execute como usuário específico no SQL Editor)
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid-aqui';
SELECT * FROM sua_tabela;
```

### Resetar todas as políticas
```sql
-- ⚠️  CUIDADO: Remove TODAS as políticas
-- Apenas use se souber o que está fazendo
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies 
    WHERE schemaname IN ('public', 'storage')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Depois, execute a migração mestre para recriar:
-- 20251010000000_master_rls_policies_consolidated.sql
```

---

## 📚 Referências Rápidas

### Arquivos Importantes
```
supabase/
├── migrations/
│   ├── README.md                              ← Documentação principal
│   ├── 20251010000000_master_rls_policies_*.sql  ← Migração mestre RLS
│   └── *.sql                                  ← Outras migrações
├── migrations_archive/
│   └── README_ARCHIVE.md                      ← Histórico de arquivados
├── validate-rls.sql                           ← Script de validação
└── seed-analytics-templates.sql               ← Seed de templates

Raiz do projeto:
├── SANITIZACAO_RLS_COMPLETA.md                ← Este relatório
└── COMANDOS_UTEIS.md                          ← Comandos (este arquivo)
```

### Links Úteis
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- PostgreSQL Policies: https://www.postgresql.org/docs/current/sql-createpolicy.html
- Troubleshooting: `supabase/migrations/README.md` seção "Troubleshooting"

---

## 🎯 Checklist de Validação

Use esta checklist após qualquer mudança em migrações:

```bash
# 1. Executar validação SQL
# (Copie supabase/validate-rls.sql para SQL Editor)

# 2. Build do projeto
npm run build

# 3. Verificar políticas
grep -c "CREATE POLICY" supabase/migrations/*.sql

# 4. Verificar duplicatas
grep -h "CREATE POLICY" supabase/migrations/*.sql | sort | uniq -d

# 5. Revisar README
cat supabase/migrations/README.md
```

Se todos passarem: ✅ Sistema OK

---

**Última atualização**: 2025-10-10  
**Versão**: 1.0
