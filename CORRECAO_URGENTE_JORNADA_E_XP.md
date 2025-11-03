# 🚨 Correção Urgente - Jornada_ID e XP Duplicado

**Data:** 03/11/2025
**Prioridade:** 🔴 CRÍTICA
**Status:** Pronto para aplicar

---

## 🎯 Problemas Identificados nos Logs

Baseado nos logs fornecidos, identificamos:

### **1. Sessões sem jornada_id** ⚠️
```
⚠️ Sessão sem jornada_id! Entregavel poderá não aparecer...
```
- **Impacto:** Entregáveis criados mas não aparecem nos painéis
- **Causa:** Nova sessão criada sem vincular a uma jornada
- **Sessão problemática:** `8a8ce303-2fbd-4930-995c-48a07f7618c3`

### **2. XP Duplicado** 🔁
```
[CONSULTOR] XP awarded for phase completion: 45 (3x no mesmo timestamp)
```
- **Impacto:** Usuário ganha XP várias vezes pela mesma ação
- **Causa:** Falta de idempotência no sistema de XP

### **3. Actions Ignoradas** 🚫
```
actionsCount: 0 mas LLM declara mudança de fase/progresso
[CONSULTOR MODE] No actions to execute - waiting for user input
```
- **Impacto:** Timeline não atualiza, entregáveis não são gerados
- **Causa:** Front ignora quando `actionsCount: 0`

### **4. Múltiplos Boots** 🔄
```
booted (time: 28ms)
booted (time: 24ms)
```
- **Impacto:** Possível duplicação de processamento
- **Causa:** Requests duplicados do frontend

---

## 🔧 Correções a Aplicar

### **Correção 1: Criar Jornada para Sessão Órfã**

Execute no SQL Editor do Supabase:

```sql
-- Ver sessão problemática
SELECT id, estado_atual, progresso, jornada_id, created_at
FROM consultor_sessoes
WHERE id = '8a8ce303-2fbd-4930-995c-48a07f7618c3';

-- Criar jornada para essa sessão
INSERT INTO jornadas_consultor (
  user_id,
  empresa_nome,
  etapa_atual,
  progresso_geral,
  created_at
)
SELECT
  user_id,
  setor || ' - Consultoria Ativa',
  estado_atual,
  progresso,
  created_at
FROM consultor_sessoes
WHERE id = '8a8ce303-2fbd-4930-995c-48a07f7618c3'
RETURNING id;

-- Atualizar sessão com a jornada criada (substitua <JORNADA_ID> pelo ID retornado acima)
UPDATE consultor_sessoes
SET jornada_id = '<JORNADA_ID>'
WHERE id = '8a8ce303-2fbd-4930-995c-48a07f7618c3';

-- Atualizar entregáveis órfãos dessa sessão
UPDATE entregaveis_consultor
SET jornada_id = '<JORNADA_ID>'
WHERE sessao_id = '8a8ce303-2fbd-4930-995c-48a07f7618c3'
  AND jornada_id IS NULL;
```

**Ou use este script automatizado:**

```sql
-- Script automático que cria jornada e vincula tudo
DO $$
DECLARE
  v_jornada_id uuid;
  v_sessao_id uuid := '8a8ce303-2fbd-4930-995c-48a07f7618c3';
BEGIN
  -- Criar jornada
  INSERT INTO jornadas_consultor (user_id, empresa_nome, etapa_atual, progresso_geral, created_at)
  SELECT
    user_id,
    COALESCE(setor, 'Consultoria') || ' - Ativa',
    estado_atual,
    progresso,
    created_at
  FROM consultor_sessoes
  WHERE id = v_sessao_id
  RETURNING id INTO v_jornada_id;

  -- Atualizar sessão
  UPDATE consultor_sessoes
  SET jornada_id = v_jornada_id
  WHERE id = v_sessao_id;

  -- Atualizar entregáveis
  UPDATE entregaveis_consultor
  SET jornada_id = v_jornada_id
  WHERE sessao_id = v_sessao_id AND jornada_id IS NULL;

  -- Atualizar timeline
  UPDATE timeline_consultor
  SET jornada_id = v_jornada_id
  WHERE sessao_id = v_sessao_id AND jornada_id IS NULL;

  RAISE NOTICE 'Jornada % criada e vinculada com sucesso!', v_jornada_id;
END $$;
```

---

### **Correção 2: Função para Criar Jornada Automaticamente**

Crie esta função no Supabase para uso futuro:

```sql
-- Função que cria jornada automaticamente se sessão não tiver
CREATE OR REPLACE FUNCTION ensure_sessao_has_jornada(p_sessao_id uuid)
RETURNS uuid AS $$
DECLARE
  v_jornada_id uuid;
  v_sessao RECORD;
BEGIN
  -- Buscar sessão
  SELECT * INTO v_sessao
  FROM consultor_sessoes
  WHERE id = p_sessao_id;

  -- Se já tem jornada, retornar
  IF v_sessao.jornada_id IS NOT NULL THEN
    RETURN v_sessao.jornada_id;
  END IF;

  -- Criar nova jornada
  INSERT INTO jornadas_consultor (
    user_id,
    empresa_nome,
    etapa_atual,
    progresso_geral,
    created_at
  )
  VALUES (
    v_sessao.user_id,
    COALESCE(v_sessao.setor, 'Consultoria') || ' - Auto',
    v_sessao.estado_atual,
    v_sessao.progresso,
    v_sessao.created_at
  )
  RETURNING id INTO v_jornada_id;

  -- Vincular sessão à jornada
  UPDATE consultor_sessoes
  SET jornada_id = v_jornada_id
  WHERE id = p_sessao_id;

  -- Vincular entregáveis existentes
  UPDATE entregaveis_consultor
  SET jornada_id = v_jornada_id
  WHERE sessao_id = p_sessao_id AND jornada_id IS NULL;

  -- Vincular timeline existente
  UPDATE timeline_consultor
  SET jornada_id = v_jornada_id
  WHERE sessao_id = p_sessao_id AND jornada_id IS NULL;

  RETURN v_jornada_id;
END;
$$ LANGUAGE plpgsql;

-- Usar assim:
-- SELECT ensure_sessao_has_jornada('8a8ce303-2fbd-4930-995c-48a07f7618c3');
```

---

### **Correção 3: Sistema de XP com Idempotência**

```sql
-- Tabela para rastrear XP atribuído (evitar duplicação)
CREATE TABLE IF NOT EXISTS consultor_xp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid NOT NULL REFERENCES jornadas_consultor(id) ON DELETE CASCADE,
  sessao_id uuid NOT NULL REFERENCES consultor_sessoes(id) ON DELETE CASCADE,
  fase_origem text NOT NULL,
  fase_destino text NOT NULL,
  xp_ganho integer NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(jornada_id, fase_origem, fase_destino)  -- Idempotência
);

CREATE INDEX idx_xp_log_jornada ON consultor_xp_log(jornada_id);

-- Função para atribuir XP (idempotente)
CREATE OR REPLACE FUNCTION atribuir_xp_fase(
  p_jornada_id uuid,
  p_sessao_id uuid,
  p_fase_origem text,
  p_fase_destino text,
  p_xp_ganho integer
)
RETURNS boolean AS $$
BEGIN
  -- Tentar inserir (falhará se já existir devido ao UNIQUE)
  INSERT INTO consultor_xp_log (jornada_id, sessao_id, fase_origem, fase_destino, xp_ganho)
  VALUES (p_jornada_id, p_sessao_id, p_fase_origem, p_fase_destino, p_xp_ganho)
  ON CONFLICT (jornada_id, fase_origem, fase_destino) DO NOTHING;

  -- Retornar true se inseriu (XP foi atribuído), false se já existia
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
```

---

### **Correção 4: Trigger para Garantir Jornada em Novos Entregáveis**

```sql
-- Função do trigger (melhorada)
CREATE OR REPLACE FUNCTION auto_populate_jornada_id_advanced()
RETURNS TRIGGER AS $$
BEGIN
  -- Se já tem jornada_id, não fazer nada
  IF NEW.jornada_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Se tem sessao_id, buscar jornada_id da sessão
  IF NEW.sessao_id IS NOT NULL THEN
    SELECT jornada_id INTO NEW.jornada_id
    FROM consultor_sessoes
    WHERE id = NEW.sessao_id;
  END IF;

  -- Se AINDA não tem jornada_id, criar uma automaticamente
  IF NEW.jornada_id IS NULL AND NEW.sessao_id IS NOT NULL THEN
    NEW.jornada_id := ensure_sessao_has_jornada(NEW.sessao_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger com função melhorada
DROP TRIGGER IF EXISTS trigger_auto_populate_jornada_id ON entregaveis_consultor;
CREATE TRIGGER trigger_auto_populate_jornada_id
  BEFORE INSERT ON entregaveis_consultor
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_jornada_id_advanced();
```

---

## 📝 Checklist de Aplicação

Execute na ordem:

- [ ] **1.** Executar script de correção da sessão órfã (Correção 1)
- [ ] **2.** Criar função `ensure_sessao_has_jornada` (Correção 2)
- [ ] **3.** Criar tabela e função de XP (Correção 3)
- [ ] **4.** Atualizar trigger de entregáveis (Correção 4)
- [ ] **5.** Validar com queries abaixo

---

## ✅ Queries de Validação

Após aplicar as correções:

```sql
-- 1. Verificar sessão foi corrigida
SELECT
  s.id,
  s.jornada_id,
  j.empresa_nome,
  COUNT(e.id) as entregaveis_count
FROM consultor_sessoes s
LEFT JOIN jornadas_consultor j ON s.jornada_id = j.id
LEFT JOIN entregaveis_consultor e ON e.sessao_id = s.id
WHERE s.id = '8a8ce303-2fbd-4930-995c-48a07f7618c3'
GROUP BY s.id, s.jornada_id, j.empresa_nome;
-- Deve retornar jornada_id preenchido e entregaveis_count > 0

-- 2. Verificar entregáveis têm jornada
SELECT COUNT(*) as entregaveis_sem_jornada
FROM entregaveis_consultor
WHERE jornada_id IS NULL;
-- Deve retornar 0

-- 3. Verificar XP log foi criado
SELECT COUNT(*) FROM consultor_xp_log;
-- Deve retornar >= 0 (tabela existe)

-- 4. Testar trigger
INSERT INTO entregaveis_consultor (sessao_id, nome, tipo, html_conteudo)
VALUES ('8a8ce303-2fbd-4930-995c-48a07f7618c3', 'test', 'test', '<p>Test</p>')
RETURNING id, jornada_id;
-- Deve retornar jornada_id automaticamente preenchido

-- Limpar teste
DELETE FROM entregaveis_consultor WHERE nome = 'test';
```

---

## 🎯 Resultado Esperado

Após aplicar todas as correções:

✅ **Sessão tem jornada_id válido**
✅ **Todos os entregáveis vinculados à jornada**
✅ **Timeline completa visível**
✅ **XP não duplica mais**
✅ **Novos entregáveis sempre têm jornada**
✅ **Sistema resiliente a falhas**

---

## 📊 Monitoramento Contínuo

Adicione estas queries ao seu dashboard:

```sql
-- Sessões órfãs (deveria ser sempre 0)
SELECT COUNT(*) as sessoes_sem_jornada
FROM consultor_sessoes
WHERE jornada_id IS NULL;

-- Entregáveis órfãos (deveria ser sempre 0)
SELECT COUNT(*) as entregaveis_sem_jornada
FROM entregaveis_consultor
WHERE jornada_id IS NULL;

-- XP duplicado (deveria ser sempre 0)
SELECT jornada_id, fase_origem, fase_destino, COUNT(*) as duplicatas
FROM consultor_xp_log
GROUP BY jornada_id, fase_origem, fase_destino
HAVING COUNT(*) > 1;
```

---

## 🚀 Próximos Passos (Opcional - Melhorias no Código)

Depois de aplicar as correções SQL, você pode melhorar o código da edge function:

### **No arquivo `consultor-rag/index.ts`:**

1. **Adicionar guard contra requests duplicados** (linha ~93):
```typescript
// Após validar body.sessao_id
const requestKey = `${body.sessao_id}_${body.message.substring(0, 50)}`;
const lastRequestTime = (globalThis as any).lastRequests?.[requestKey] || 0;
const now = Date.now();

if (now - lastRequestTime < 500) {
  console.log('[CONSULTOR] ⚠️ Request duplicado detectado, ignorando...');
  return new Response(
    JSON.stringify({ reply: 'Processando...', estado: 'processing' }),
    { headers: corsHeaders }
  );
}

(globalThis as any).lastRequests = (globalThis as any).lastRequests || {};
(globalThis as any).lastRequests[requestKey] = now;
```

2. **Garantir jornada antes de criar entregável** (usar função SQL):
```typescript
// Antes de inserir entregável
const { data: jornadaId } = await supabase.rpc(
  'ensure_sessao_has_jornada',
  { p_sessao_id: body.sessao_id }
);
```

3. **Usar função de XP idempotente**:
```typescript
// Ao atribuir XP
const { data: xpAtribuido } = await supabase.rpc('atribuir_xp_fase', {
  p_jornada_id: sessao.jornada_id,
  p_sessao_id: body.sessao_id,
  p_fase_origem: faseAtual,
  p_fase_destino: novaFase,
  p_xp_ganho: xpPorFase[novaFase] || 0
});

if (xpAtribuido) {
  console.log(`[CONSULTOR] XP awarded: ${xpPorFase[novaFase]}`);
} else {
  console.log('[CONSULTOR] ⏭️ XP já atribuído (idempotência)');
}
```

---

**Documentação mantida por:** Sistema de Correção Automática
**Data:** 03/11/2025
**Versão:** 1.0
