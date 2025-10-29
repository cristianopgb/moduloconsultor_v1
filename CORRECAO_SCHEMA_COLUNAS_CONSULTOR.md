# 🔧 Correção: Colunas empresa/setor não existem em consultor_sessoes

## ❌ ERRO IDENTIFICADO

```
Error 42703: column consultor_sessoes.empresa does not exist
Error 42703: column consultor_sessoes.setor does not exist
```

### Contexto
O código tentava fazer SELECT de colunas `empresa` e `setor` diretamente, mas essas colunas **não existem** na tabela. Os dados estão dentro do campo JSON `contexto_negocio`:

```json
contexto_negocio: {
  "empresa_nome": "Acme Corp",
  "segmento": "tecnologia",
  ...
}
```

---

## ✅ SOLUÇÃO

### Arquivo: `src/lib/consultor/rag-adapter.ts`

#### ANTES (linha 64-68)
```typescript
const { data: sessao } = await supabase
  .from('consultor_sessoes')
  .select('id, empresa, setor, estado_atual, contexto_negocio')  // ❌
  .eq('id', request.sessaoId)
  .single();
```

#### DEPOIS (linha 64-74)
```typescript
const { data: sessao, error: sessaoError } = await supabase
  .from('consultor_sessoes')
  .select(`
    id,
    estado_atual,
    contexto_negocio,
    empresa:contexto_negocio->>empresa_nome,  // ✅ Extrai do JSON
    setor:contexto_negocio->>segmento          // ✅ Extrai do JSON
  `)
  .eq('id', request.sessaoId)
  .maybeSingle();  // ✅ Melhor que single() para evitar exceções
```

---

## 🎯 O QUE MUDOU

### 1. Extração JSON do PostgreSQL
Usamos o operador `->>` do PostgreSQL para extrair campos do JSON:
- `contexto_negocio->>empresa_nome` → retorna `empresa`
- `contexto_negocio->>segmento` → retorna `setor`

### 2. Colunas Virtuais
As colunas `empresa` e `setor` são criadas "on-the-fly" na query, não no schema.

### 3. Melhor Tratamento de Erro
- Trocado `.single()` por `.maybeSingle()`
- Adicionado verificação de `sessaoError`
- Log de erro mais detalhado

---

## 📚 SCHEMA CORRETO DA TABELA

```sql
CREATE TABLE consultor_sessoes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  conversation_id UUID REFERENCES conversations,
  titulo_problema TEXT,
  contexto_negocio JSONB DEFAULT '{}',  -- ✅ Dados em JSON
  estado_atual TEXT CHECK (...),
  progresso INTEGER,
  ativo BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Estrutura do contexto_negocio
```json
{
  "empresa_nome": "Nome da Empresa",
  "segmento": "setor",
  "porte": "pequeno|medio|grande",
  "num_funcionarios": 50,
  "faturamento_anual": 1000000,
  "area_foco": "vendas",
  ...
}
```

---

## 🔍 POR QUE USAR JSON?

### ✅ Vantagens
1. **Flexibilidade:** Adicionar novos campos sem ALTER TABLE
2. **Contexto Rico:** Armazenar dados estruturados complexos
3. **Performance:** Um único campo em vez de dezenas de colunas
4. **Evolução:** Schema pode mudar sem breaking changes

### Como Acessar
```typescript
// No código TypeScript
const empresa = sessao.contexto_negocio?.empresa_nome;
const setor = sessao.contexto_negocio?.segmento;

// Na query SQL
SELECT 
  contexto_negocio->>'empresa_nome' as empresa,
  contexto_negocio->>'segmento' as setor
FROM consultor_sessoes;

// No PostgREST (Supabase client)
.select('empresa:contexto_negocio->>empresa_nome')
```

---

## ✅ VALIDAÇÃO

### Build
```bash
✓ 1729 modules transformed
✓ built in 8.64s
✅ ZERO ERROS
```

### Query de Teste
```sql
-- Verificar que colunas empresa/setor NÃO existem
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'consultor_sessoes'
  AND column_name IN ('empresa', 'setor');
-- Resultado: 0 linhas ✅

-- Verificar que contexto_negocio existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'consultor_sessoes'
  AND column_name = 'contexto_negocio';
-- Resultado: contexto_negocio | jsonb ✅
```

---

## 📝 ARQUIVOS MODIFICADOS

1. ✅ `src/lib/consultor/rag-adapter.ts`
   - Linhas 64-74: Query corrigida com extração JSON
   - Adicionado tratamento de erro
   - Trocado `.single()` por `.maybeSingle()`

---

## 🚀 IMPACTO

- **Severidade:** 🔴 CRÍTICO (impedia buscar sessão)
- **Escopo:** Chamadas ao consultor-rag
- **Usuários afetados:** 100% ao usar modo consultor
- **Correção:** ✅ IMEDIATA
- **Deploy:** ✅ SIM (código frontend)
- **Migração DB:** ❌ NÃO (schema já está correto)

---

## 📊 CHECKLIST

- [x] Erro identificado (42703 - colunas inexistentes)
- [x] Causa raiz: SELECT de colunas que não existem
- [x] Correção: Usar extração JSON do PostgreSQL
- [x] Build validado
- [x] Documentação atualizada
- [ ] **Deploy no ambiente de produção**
- [ ] Teste manual: criar sessão consultor

---

## 🎓 PADRÕES POSTGRESQL + JSON

### Operadores JSON no PostgreSQL

| Operador | Retorno | Exemplo |
|----------|---------|---------|
| `->` | JSON | `contexto_negocio->'empresa_nome'` → `"Acme"` |
| `->>` | TEXT | `contexto_negocio->>'empresa_nome'` → `Acme` |
| `#>` | JSON | `contexto_negocio#>'{dados,nome}'` |
| `#>>` | TEXT | `contexto_negocio#>>'{dados,nome}'` |

### No Supabase Client
```typescript
// Extração simples
.select('empresa:contexto_negocio->>empresa_nome')

// Múltiplos campos
.select(`
  id,
  empresa:contexto_negocio->>empresa_nome,
  setor:contexto_negocio->>segmento,
  porte:contexto_negocio->>porte
`)

// Filtrar por campo JSON
.eq('contexto_negocio->>segmento', 'tecnologia')
```

---

## 🔄 EVOLUÇÃO DO SCHEMA

### Antes (Schema Incorreto Esperado)
```sql
-- O código esperava:
empresa TEXT,
setor TEXT,
```

### Agora (Schema Real)
```sql
-- O schema real é:
contexto_negocio JSONB,
```

### Migração Futura (se quiser denormalizar)
```sql
-- SE decidir criar colunas reais no futuro:
ALTER TABLE consultor_sessoes
  ADD COLUMN empresa TEXT 
    GENERATED ALWAYS AS (contexto_negocio->>'empresa_nome') STORED,
  ADD COLUMN setor TEXT
    GENERATED ALWAYS AS (contexto_negocio->>'segmento') STORED;
```

---

**Status:** ✅ CORRIGIDO
**Data:** 29/10/2025
**Método:** Extração JSON PostgreSQL
**Próximo passo:** Deploy e teste
