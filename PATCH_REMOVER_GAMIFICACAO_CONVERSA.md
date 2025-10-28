# Patch: Remover Referências a gamificacao_conversa

## Contexto

Após remoção da tabela `gamificacao_conversa` na migration `20251027210000_cleanup_consultor_obsolete_code.sql`, é necessário remover/comentar código legado que ainda referencia esta tabela.

## Arquivos Afetados

### 1. `src/components/Consultor/LateralConsultor.tsx`

**Linhas a Comentar/Remover**:

#### Linhas 167-173 (dentro de onGamUpdate):
```typescript
// CÓDIGO LEGADO - gamificacao_conversa foi removida
// const { data } = await supabase.from('gamificacao_conversa').select('*').eq('conversation_id', conversationId).maybeSingle();
// if (data) {
//   setConvXpTotal(data.xp_total ?? null)
//   setConvNivel(data.nivel ?? null)
//   setLastUpdate(new Date())
// }
```

#### Linhas 194-207 (busca inicial de gamificação por conversa):
```typescript
// CÓDIGO LEGADO - gamificacao_conversa foi removida
// const { data: gamData } = await supabase
//   .from('gamificacao_conversa')
//   .select('*')
//   .eq('conversation_id', conversationId)
//   .maybeSingle()
// if (gamData) {
//   setConvXpTotal(gamData.xp_total ?? 0)
//   setConvNivel(gamData.nivel ?? 1)
// }
```

**Nota**: Este componente usa gamificação por conversa (approach obsoleto). O sistema ativo usa `gamificacao_consultor` vinculado a `jornada_id` via hook `useGamificacaoPorJornada`.

**Ação Recomendada**:
- Comentar código legado OU
- Refatorar componente para usar `useGamificacaoPorJornada(jornada?.id)`

---

### 2. `src/components/Chat/ChatPage.tsx`

**Linhas a Comentar/Remover**:

#### Linha 280 (função pollGamification):
```typescript
// CÓDIGO LEGADO - gamificacao_conversa foi removida
// const { data: gamData, error: gamErr } = await supabase
//   .from('gamificacao_conversa')
//   .select('*')
//   .eq('conversation_id', current.id)
//   .maybeSingle()
```

#### Linha 545 (Realtime subscription):
```typescript
// CÓDIGO LEGADO - gamificacao_conversa foi removida
// .on('postgres_changes', {
//   event: '*',
//   schema: 'public',
//   table: 'gamificacao_conversa',
//   filter: `conversation_id=eq.${current.id}`
// }, ...
```

#### Linhas 625-628 (reset de gamificação ao criar conversa):
```typescript
// CÓDIGO LEGADO - gamificacao_conversa foi removida
// await supabase.from('gamificacao_conversa').delete().eq('conversation_id', data.id)
// const { error: gamError } = await supabase.from('gamificacao_conversa').insert({
//   conversation_id: data.id,
//   ...
// })
```

---

### 3. `scripts/test_consultor_form_submission.js` (Script de Teste)

**Linha 55**:
```javascript
// CÓDIGO LEGADO - gamificacao_conversa foi removida
// const { data: gam, error: gamErr } = await supabase.from('gamificacao_conversa').select('*').eq('conversation_id', conv.id).maybeSingle()
```

**Ação**: Comentar ou deletar (é apenas script de teste)

---

## Impacto

### Antes da Limpeza:
- ⚠️ Código tenta buscar tabela que não existe
- ⚠️ Erros silenciosos em `catch {}` blocks
- ⚠️ Confusão sobre qual sistema de gamificação usar

### Depois da Limpeza:
- ✅ Zero tentativas de acessar tabela inexistente
- ✅ Código mais claro e direto
- ✅ Um único sistema de gamificação (jornada_id based)

---

## Sistema Ativo (Manter)

O sistema CORRETO de gamificação está em:

```typescript
// Hook React para gamificação por jornada
src/components/Consultor/Gamificacao/useGamificacaoPorJornada.ts

// Funções utilitárias
src/lib/consultor/gamificacao.ts

// Uso:
const gami = useGamificacaoPorJornada(jornadaId); // { xp_total, nivel }
```

**Exemplo de Uso Correto**:
```typescript
// ✅ CORRETO - usa jornada_id
import { useGamificacaoPorJornada } from '../Consultor/Gamificacao/useGamificacaoPorJornada';

function MeuComponente({ jornadaId }) {
  const { xp_total, nivel } = useGamificacaoPorJornada(jornadaId);

  return (
    <div>
      <p>XP: {xp_total}</p>
      <p>Nível: {nivel}</p>
    </div>
  );
}
```

---

## Decisão de Implementação

Há duas opções:

### Opção A: Comentar Código Legado (Conservadora)
- Manter código comentado como referência histórica
- Adicionar comentários `// OBSOLETO:` explicando mudança
- Permite rollback rápido se necessário

### Opção B: Deletar Código Legado (Recomendada)
- Remove código completamente
- Refatora componentes para usar sistema ativo
- Codebase mais limpo e claro

---

## Implementação Recomendada

**OPÇÃO B** é recomendada, com os seguintes passos:

1. Remover todas as referências a `gamificacao_conversa`
2. Refatorar componentes para usar `useGamificacaoPorJornada`
3. Testar fluxo completo de gamificação
4. Validar que XP e níveis funcionam corretamente

---

## Checklist de Validação

Após aplicar patch:

- [ ] Buscar `gamificacao_conversa` no código - deve retornar 0 resultados
- [ ] Testar criação de jornada - deve criar gamificação automaticamente
- [ ] Testar ganho de XP - deve atualizar `gamificacao_consultor`
- [ ] Testar Realtime - hook deve detectar mudanças
- [ ] Verificar console do navegador - não deve haver erros de tabela não encontrada

---

## Nota Importante

**NÃO APLICAR** este patch até que a migration `20251027210000_cleanup_consultor_obsolete_code.sql` seja executada no banco de dados. Caso contrário, o sistema perderá funcionalidade.

**Ordem Correta**:
1. ✅ Executar migration SQL (remove tabela)
2. ✅ Aplicar este patch (remove código)
3. ✅ Testar sistema completo
4. ✅ Deploy em produção
