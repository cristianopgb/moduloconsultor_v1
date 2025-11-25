# Fix: Timeline não atualizava fase visualmente

## Problema
A timeline do módulo Consultor não atualizava visualmente a fase atual mesmo quando:
- Os logs mostravam: `[CONSULTOR] ✅ Context updated. New phase: concluido`
- O banco de dados da tabela `consultor_sessoes` era atualizado
- O realtime estava configurado corretamente

A UI permanecia travada na fase `anamnese` independente da progressão real.

## Causa Raiz
A Edge Function `consultor-rag` atualizava apenas a tabela `consultor_sessoes.estado_atual`, mas **não atualizava** a tabela `jornadas_consultor.etapa_atual`.

O componente `JornadaTimeline` lê de `jornadas_consultor.etapa_atual` via prop `jornada`, então sempre mostrava a fase inicial porque esse campo nunca era sincronizado.

### Estrutura das Tabelas

**`consultor_sessoes`:**
- `estado_atual` ← Era atualizado ✅
- `contexto_coleta` ← Era atualizado ✅
- `jornada_id` (FK)

**`jornadas_consultor`:**
- `etapa_atual` ← **NÃO era atualizado** ❌
- `progresso_geral`
- `contexto_coleta`

## Solução Implementada

### 1. Edge Function: Sincronizar jornadas_consultor
**Arquivo:** `supabase/functions/consultor-rag/index.ts` (linha ~1482)

Adicionado bloco para atualizar `jornadas_consultor` imediatamente após atualizar `consultor_sessoes`:

```typescript
// Atualizar também a tabela jornadas_consultor para sincronizar etapa_atual
if (sessao.jornada_id) {
  await supabase
    .from('jornadas_consultor')
    .update({
      etapa_atual: novaFase,
      progresso_geral: progressoAtualizado,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessao.jornada_id);

  console.log('[CONSULTOR] ✅ Jornada etapa_atual updated to:', novaFase);
}
```

**Resultado:**
- Ambas as tabelas são sincronizadas quando a fase muda
- O realtime dispara corretamente
- A UI atualiza automaticamente

### 2. LateralConsultor: Log de Debug no Realtime
**Arquivo:** `src/components/Consultor/LateralConsultor.tsx` (linha ~194)

Adicionado log para monitorar atualizações via realtime:

```typescript
.on(
  'postgres_changes',
  { event: '*', schema: 'public', table: 'jornadas_consultor', filter: `id=eq.${jornada.id}` },
  (payload) => {
    console.log('[LateralConsultor] Jornada updated via realtime:', payload.new?.etapa_atual)
    loadJornada(false)
  }
)
```

### 3. JornadaTimeline: Log de Mudança de Etapa
**Arquivo:** `src/components/Consultor/Timeline/JornadaTimeline.tsx` (linha ~229)

Adicionado useEffect para monitorar mudanças na prop:

```typescript
useEffect(() => {
  if (jornada?.etapa_atual) {
    console.log('[JornadaTimeline] Etapa atual changed to:', jornada.etapa_atual)
  }
}, [jornada?.etapa_atual])
```

### 4. LateralConsultor: Key para Forçar Re-render
**Arquivo:** `src/components/Consultor/LateralConsultor.tsx` (linha ~372)

Adicionada key composta para garantir remount quando etapa muda:

```typescript
<JornadaTimeline
  key={`${jornada?.id}-${jornada?.etapa_atual}-${lastUpdate.getTime()}`}
  jornada={jornada}
/>
```

## Fluxo de Atualização (Antes vs Depois)

### ❌ ANTES (Quebrado)
1. Usuário interage no chat
2. Edge Function atualiza `consultor_sessoes.estado_atual`
3. Edge Function **NÃO** atualiza `jornadas_consultor.etapa_atual`
4. Realtime dispara mas busca dados desatualizados
5. UI não muda (travada em `anamnese`)

### ✅ DEPOIS (Corrigido)
1. Usuário interage no chat
2. Edge Function atualiza `consultor_sessoes.estado_atual`
3. Edge Function **atualiza** `jornadas_consultor.etapa_atual` ✨
4. Realtime dispara e busca dados corretos
5. UI atualiza para fase correta (ex: `execucao`, `concluido`)

## Testes Recomendados

### Teste 1: Progressão de Fase
1. Iniciar nova sessão do Consultor
2. Completar anamnese
3. Verificar se timeline mostra "Mapeamento Geral" como atual
4. Continuar até "Execução"
5. Confirmar que timeline reflete cada mudança

### Teste 2: Logs de Debug
1. Abrir console do browser
2. Interagir com o Consultor
3. Observar logs:
   - `[CONSULTOR] ✅ Context updated. New phase: X`
   - `[CONSULTOR] ✅ Jornada etapa_atual updated to: X`
   - `[LateralConsultor] Jornada updated via realtime: X`
   - `[JornadaTimeline] Etapa atual changed to: X`

### Teste 3: Realtime Multi-Tab
1. Abrir 2 abas com a mesma sessão
2. Interagir em uma aba
3. Verificar se a outra aba atualiza automaticamente

## Query de Verificação

Para verificar se a sincronização está funcionando:

```sql
SELECT
  j.id as jornada_id,
  j.etapa_atual as jornada_fase,
  s.estado_atual as sessao_fase,
  j.progresso_geral,
  j.updated_at
FROM jornadas_consultor j
LEFT JOIN consultor_sessoes s ON s.jornada_id = j.id
WHERE j.conversation_id = 'SEU_CONVERSATION_ID'
ORDER BY j.updated_at DESC;
```

Ambos os campos `jornada_fase` e `sessao_fase` devem ter o mesmo valor após cada interação.

## Impacto

### Performance
- ✅ Impacto mínimo: 1 query UPDATE adicional por mudança de fase
- ✅ Queries são indexadas (PK)
- ✅ Realtime já existente, sem overhead adicional

### Compatibilidade
- ✅ Retrocompatível (não quebra funcionalidades existentes)
- ✅ Funciona com sessões antigas (próxima mudança sincroniza)
- ✅ Não requer migração de dados

### Manutenibilidade
- ✅ Logs de debug facilitam troubleshooting
- ✅ Código mais claro (sincronização explícita)
- ✅ Previne bugs similares no futuro

## Deploy

### Edge Function
```bash
npx supabase functions deploy consultor-rag
```

### Frontend
```bash
npm run build
```
Build concluído com sucesso ✅

## Arquivos Modificados

1. `supabase/functions/consultor-rag/index.ts` - Sincronização de jornadas_consultor
2. `src/components/Consultor/LateralConsultor.tsx` - Log realtime + key otimizada
3. `src/components/Consultor/Timeline/JornadaTimeline.tsx` - Log de mudança de etapa

---

**Status:** ✅ IMPLEMENTADO E TESTADO (build)
**Data:** 2025-11-25
**Prioridade:** CRÍTICA (bloqueava UX principal do módulo)
