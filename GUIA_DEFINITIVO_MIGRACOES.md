# 🗂️ Guia Definitivo de Migrações - Proceda

**Última Atualização:** 30/10/2025
**Status:** 54 migrações no total (muitas obsoletas/duplicadas)

---

## ⚠️ O PROBLEMA

Você tem razão de estar confuso. O projeto tem **54 migrações** acumuladas ao longo do tempo, com:
- ❌ Duplicatas (múltiplas tentativas de fix)
- ❌ Arquivos obsoletos
- ❌ Conflitos entre versões
- ❌ Falta de clareza sobre o que aplicar

---

## ✅ A SOLUÇÃO SIMPLES

**IGNORE AS 54 MIGRAÇÕES.** Você só precisa saber se o banco está funcionando ou não.

### Teste Rápido (30 segundos)

```bash
node check-migrations-status.cjs
```

**Resultado esperado:**
```
✅ Core tables found: 3/3
   - consultor_sessoes
   - jornadas_consultor
   - entregaveis_consultor

✅ No orphan sessions
🎉 All core tables exist! Database is ready.
```

**Se isso aparecer:** ✅ **VOCÊ ESTÁ PRONTO!** Ignore migrações e vá direto para:
```bash
npm run dev
```

---

## 🚨 Se Tabelas NÃO Existirem

Isso significa que as migrações NÃO foram aplicadas no Supabase.

### Opção 1: Usar Supabase CLI (Recomendado)

```bash
# Fazer login
npx supabase login

# Fazer link com projeto
npx supabase link --project-ref SEU_PROJECT_REF

# Aplicar TODAS migrações de uma vez
npx supabase db push
```

### Opção 2: Aplicar SQL Manualmente (Fallback)

Se CLI não funcionar, você pode aplicar o SQL essencial manualmente no **Supabase Dashboard > SQL Editor**:

#### Script 1: Tabelas Core (copie e cole)

```sql
-- ESTE É O ÚNICO SQL QUE VOCÊ PRECISA SE TUDO MAIS FALHAR

-- 1. Criar tabela jornadas_consultor
CREATE TABLE IF NOT EXISTS jornadas_consultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empresa_nome text,
  etapa_atual text DEFAULT 'anamnese' NOT NULL,
  dados_anamnese jsonb DEFAULT '{}'::jsonb,
  areas_priorizadas jsonb DEFAULT '[]'::jsonb,
  progresso_geral integer DEFAULT 0,
  conversation_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Criar tabela consultor_sessoes
CREATE TABLE IF NOT EXISTS consultor_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid,
  titulo_problema text DEFAULT 'Nova Consultoria',
  empresa text,
  setor text,
  estado_atual text DEFAULT 'coleta' NOT NULL,
  jornada_id uuid REFERENCES jornadas_consultor(id),
  contexto_negocio jsonb DEFAULT '{}'::jsonb,
  metodologias_aplicadas text[] DEFAULT ARRAY[]::text[],
  documentos_usados text[] DEFAULT ARRAY[]::text[],
  historico_rag jsonb[] DEFAULT ARRAY[]::jsonb[],
  entregaveis_gerados text[] DEFAULT ARRAY[]::text[],
  progresso integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Criar tabela entregaveis_consultor
CREATE TABLE IF NOT EXISTS entregaveis_consultor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid REFERENCES consultor_sessoes(id) ON DELETE CASCADE,
  jornada_id uuid REFERENCES jornadas_consultor(id) ON DELETE CASCADE NOT NULL,
  area_id uuid,
  nome text NOT NULL,
  tipo text NOT NULL,
  html_conteudo text DEFAULT '',
  conteudo_xml text,
  conteudo_md text,
  etapa_origem text NOT NULL,
  template_usado_id uuid,
  visualizado boolean DEFAULT false,
  data_geracao timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 4. Habilitar RLS
ALTER TABLE jornadas_consultor ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultor_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregaveis_consultor ENABLE ROW LEVEL SECURITY;

-- 5. Policies básicas
DROP POLICY IF EXISTS "Users can view own journeys" ON jornadas_consultor;
CREATE POLICY "Users can view own journeys"
  ON jornadas_consultor FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own journeys" ON jornadas_consultor;
CREATE POLICY "Users can create own journeys"
  ON jornadas_consultor FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own sessions" ON consultor_sessoes;
CREATE POLICY "Users can view own sessions"
  ON consultor_sessoes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sessions" ON consultor_sessoes;
CREATE POLICY "Users can create own sessions"
  ON consultor_sessoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own deliverables" ON entregaveis_consultor;
CREATE POLICY "Users can view own deliverables"
  ON entregaveis_consultor FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jornadas_consultor
      WHERE jornadas_consultor.id = entregaveis_consultor.jornada_id
      AND jornadas_consultor.user_id = auth.uid()
    )
  );

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_user_id ON consultor_sessoes(user_id);
CREATE INDEX IF NOT EXISTS idx_consultor_sessoes_jornada_id ON consultor_sessoes(jornada_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_consultor_user_id ON jornadas_consultor(user_id);
CREATE INDEX IF NOT EXISTS idx_entregaveis_jornada_id ON entregaveis_consultor(jornada_id);
```

**Cole esse SQL no Supabase Dashboard > SQL Editor > Run**

Isso cria as 3 tabelas essenciais com RLS e policies.

---

## 🧹 Limpeza (Opcional)

Se quiser limpar a pasta de migrações depois que tudo estiver funcionando:

```bash
# Mover migrações antigas para arquivo
mkdir -p supabase/migrations_historical
mv supabase/migrations/202510[0-2]*.sql supabase/migrations_historical/

# Manter apenas as essenciais
# (não faça isso agora, apenas quando tudo estiver 100% funcionando)
```

---

## 📋 As 4 Migrações Que Importam

Se você REALMENTE quer entender o que foi criado hoje:

1. **20251011150427_create_consultor_module_schema.sql**
   - Cria as tabelas principais (jornadas, sessoes, entregaveis)
   - Esta é a MAIS IMPORTANTE

2. **20251030000000_add_missing_consultor_columns.sql**
   - Adiciona colunas empresa, setor, jornada_id se não existirem
   - Idempotente (pode rodar múltiplas vezes)

3. **20251030120000_backfill_jornadas_for_sessoes.sql**
   - Cria jornadas para sessões órfãs
   - Só roda se houver sessões sem jornada_id

4. **20251030130000_fix_duplicate_policies.sql**
   - Remove e recria policies (fix do erro que você teve)
   - Usa DROP IF EXISTS antes de CREATE

**Você NÃO precisa rodar manualmente.** Supabase aplica automaticamente quando você faz `db push`.

---

## 🎯 Resumo Executivo

### O Que Você Realmente Precisa Fazer:

#### Passo 1: Verificar se banco está OK

```bash
node check-migrations-status.cjs
```

#### Passo 2A: Se banco OK (3 tabelas existem)

```bash
npm run dev
# Pronto! Abra http://localhost:5173
```

#### Passo 2B: Se banco NÃO OK (tabelas faltando)

```bash
# Opção 1: CLI
npx supabase login
npx supabase link --project-ref SEU_REF
npx supabase db push

# Opção 2: Manual
# Copie o SQL acima e cole no Supabase Dashboard > SQL Editor
```

#### Passo 3: Testar

```bash
npm run dev
# Login → Chat → Nova Conversa → Modo "Consultor"
```

---

## 🔍 Debug Rápido

### Erro: "jornada_id is required"

```bash
# Rodar backfill
node apply-backfill.cjs

# Deve mostrar: "0 sessões without jornada_id"
```

### Erro: "policy already exists"

**Ignorar.** Isso só acontece se rodar migração duplicada. Sistema continua funcionando.

### Erro: "table does not exist"

**Banco não tem as tabelas.** Ver Passo 2B acima.

---

## 💡 Por Que 54 Migrações?

O projeto evoluiu ao longo de meses com múltiplas tentativas de:
- Criar módulo consultor
- Adicionar gamificação
- Implementar RAG
- Fixar bugs
- Refatorar estrutura

**Resultado:** Muita história acumulada.

**Solução:** As últimas 4 migrações consolidam TUDO que você precisa.

---

## ✅ Checklist Final

- [ ] Rodei `node check-migrations-status.cjs`
- [ ] Vi "3/3 core tables found" ✅
- [ ] Rodei `npm run dev`
- [ ] Abri http://localhost:5173
- [ ] Criei conversa modo "Consultor"
- [ ] Consultor respondeu normalmente
- [ ] Zero erros 500

**Se todos esses checks passaram: 🎉 VOCÊ ESTÁ PRONTO!**

Ignore as 54 migrações. O código está funcionando.

---

*Guia criado em: 30/10/2025*
*Objetivo: Acabar com a confusão de migrações de uma vez por todas*
