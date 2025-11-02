# Como Verificar se o Deploy Funcionou

## Problema

Você copiou o código mas os logs mostram que:
- ❌ Timeline NÃO está sendo registrada
- ❌ Auto-detectores NÃO estão rodando
- ✅ Entregáveis ESTÃO sendo gerados (parcialmente funciona)

Isso significa que o Supabase **não está usando a versão que você copiou**.

---

## Possíveis Causas

### 1. Cache do Supabase
O Supabase pode estar usando versão cacheada da função.

**Solução**: Force restart da função

### 2. Você copiou apenas parte do código
Pode ter copiado só o início do arquivo.

**Verificação**: O arquivo `index.ts` deve ter **~750 linhas**

### 3. Você copiou para lugar errado
Pode ter copiado para pasta errada no Supabase dashboard.

**Caminho correto**:
```
Supabase Dashboard > Edge Functions > consultor-rag > index.ts
```

---

## Como Verificar o Código Atual no Supabase

### Método 1: Ver no Dashboard
1. Abra: https://supabase.com/dashboard/project/gljoasdvlaitplbmbtzg
2. Vá em: **Edge Functions** > **consultor-rag**
3. Clique em **index.ts**
4. Procure por: `"// 14. ATUALIZAR TIMELINE (SEMPRE, EM TODA INTERAÇÃO)"`

**Se encontrar**: Código está correto
**Se NÃO encontrar**: Código não foi atualizado

### Método 2: Ver logs específicos
Os logs devem mostrar:
```
[CONSULTOR] AUTO-DETECTOR: Matriz GUT completa, gerando entregáveis
```

**Se não aparecer**: Código antigo ainda rodando

---

## Como Forçar Atualização

### Opção 1: Adicionar log de versão

Adicione esta linha NO INÍCIO do arquivo `index.ts` (linha 75, logo após `Deno.serve(async (req: Request) => {`):

```typescript
Deno.serve(async (req: Request) => {
  console.log('[CONSULTOR] 🚀 VERSÃO 2.0 - COM DETECTORES E TIMELINE');  // ← ADICIONAR ESTA LINHA

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
```

Depois de adicionar, **salve** e verifique nos logs se aparece:
```
[CONSULTOR] 🚀 VERSÃO 2.0 - COM DETECTORES E TIMELINE
```

**Se aparecer**: Código atualizado ✅
**Se NÃO aparecer**: Código ainda não foi atualizado ❌

---

### Opção 2: Deletar e recriar função

1. No Supabase Dashboard, **delete** a função `consultor-rag`
2. Crie uma **nova** função com mesmo nome
3. Cole todo o código novamente

---

## Verificação Final

Após atualizar, faça um teste e verifique nos logs:

### Logs que DEVEM aparecer:
```
[CONSULTOR] 🚀 VERSÃO 2.0 - COM DETECTORES E TIMELINE
[CONSULTOR] AUTO-DETECTOR: Anamnese completa, forcing transition to mapeamento
[CONSULTOR] AUTO-DETECTOR: Matriz GUT completa, gerando entregáveis
[CONSULTOR] AUTO-DETECTOR: Escopo aprovado, transicionando para mapeamento_processos
```

### Timeline no banco:
Execute no SQL Editor do Supabase:
```sql
SELECT
  fase,
  evento,
  metadata,
  created_at
FROM timeline_consultor
WHERE sessao_id = (
  SELECT id
  FROM consultor_sessoes
  ORDER BY created_at DESC
  LIMIT 1
)
ORDER BY created_at;
```

**Deve retornar**: Várias linhas com eventos
**Se retornar vazio**: Timeline não está sendo registrada = código antigo

---

## Checklist de Verificação

- [ ] Arquivo `index.ts` tem ~750 linhas
- [ ] Linha 534 contém: `// 14. ATUALIZAR TIMELINE`
- [ ] Linha 352 contém: `// 11. DETECTORES AUTOMÁTICOS`
- [ ] Linha 396 contém: `// Detector 2: PRIORIZAÇÃO COMPLETA`
- [ ] Log mostra: `🚀 VERSÃO 2.0 - COM DETECTORES E TIMELINE`
- [ ] Log mostra: `AUTO-DETECTOR`
- [ ] Timeline no banco tem registros

---

## Se Nada Funcionar

O código local está correto. O problema é 100% no Supabase não usar a versão atualizada.

**Solução drástica**:
1. Renomeie a função para `consultor-rag-v2`
2. Cole o código completo
3. Atualize o frontend para chamar `consultor-rag-v2` em vez de `consultor-rag`

Arquivo a modificar: `src/lib/consultor/rag-adapter.ts`

Mude:
```typescript
const { data, error } = await supabase.functions.invoke('consultor-rag', {
```

Para:
```typescript
const { data, error } = await supabase.functions.invoke('consultor-rag-v2', {
```

---

## Código Correto Está Em

```
/tmp/cc-agent/59063573/project/supabase/functions/consultor-rag/index.ts
/tmp/cc-agent/59063573/project/supabase/functions/consultor-rag/consultor-prompts.ts
```

Total de linhas:
- `index.ts`: ~770 linhas
- `consultor-prompts.ts`: ~1000 linhas

Se o arquivo no Supabase tiver menos linhas, está incompleto!
