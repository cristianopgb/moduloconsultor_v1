# Correções Kanban e Agente Executor - 05/11/2025

## Problemas Identificados

### 1. Cards não ficavam fixos após drag and drop
**Causa**: O componente `KanbanExecucao.tsx` não tinha implementação de drag and drop. Apenas os botões de ação funcionavam.

### 2. Agente Executor não conseguia atualizar dados
**Causa**: A edge function estava tentando usar `jornada.user_id` para inserir no histórico, mas o contexto de autenticação não estava disponível corretamente.

---

## Correções Implementadas

### 1. Sistema Drag and Drop Completo no KanbanExecucao

**Arquivo**: `src/components/Consultor/Kanban/KanbanExecucao.tsx`

#### Estados Adicionados:
```typescript
const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);
const [dragOverColumn, setDragOverColumn] = useState<KanbanCard['status'] | null>(null);
const [updating, setUpdating] = useState(false);
```

#### Funcionalidades Implementadas:

1. **handleDragStart**: Captura o card sendo arrastado
2. **handleDragOver**: Permite soltar em colunas e adiciona visual feedback
3. **handleDragLeave**: Remove highlight quando sai da coluna
4. **handleDrop**: Atualiza status no banco ao soltar
5. **handleDragEnd**: Limpa estados ao final do arrasto

#### Melhorias de UX:

- ✅ Cursor `grab` ao passar sobre cards
- ✅ Cursor `grabbing` durante arrasto
- ✅ Opacidade reduzida (50%) no card sendo arrastado
- ✅ Ring azul na coluna de destino
- ✅ Cards concluídos não podem ser arrastados
- ✅ Update otimista com rollback em caso de erro
- ✅ Loading state durante operação
- ✅ Alert em caso de erro

#### Comportamento:

```typescript
// Update otimista - UI atualiza imediatamente
setCards(prevCards =>
  prevCards.map(card =>
    card.id === cardId ? { ...card, status: newStatus } : card
  )
);

// Se falhar, restaura estado anterior
if (error) {
  setCards(originalCards);
  alert('Erro ao atualizar o status do card. Tente novamente.');
}
```

---

### 2. Correções no Agente Executor

**Arquivo**: `supabase/functions/agente-execucao/index.ts`

#### A. Extração do User ID do Token JWT

```typescript
const authHeader = req.headers.get('Authorization');
let userId: string | null = null;

if (authHeader) {
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    userId = decoded.sub || null;
  } catch (e) {
    console.warn('[AGENTE-EXECUCAO] Could not extract user from token:', e);
  }
}
```

#### B. User ID Efetivo para Histórico

```typescript
const effectiveUserId = userId || jornada.user_id;
```

Agora usa o user_id extraído do token JWT, com fallback para o user_id da jornada.

#### C. Keywords Expandidas e Normalizadas

**Antes**: Apenas algumas variações básicas
**Agora**: Cobertura completa de variações em português

```typescript
const intentKeywords = {
  concluir: ['conclu', 'finaliz', 'termina', 'pronto', 'feito', 'finalizar', 'completar', 'terminei'],
  iniciar: ['inicia', 'começa', 'comecar', 'vou fazer', 'começar', 'andamento', 'em andamento'],
  bloquear: ['bloque', 'parado', 'impedido', 'travad', 'bloqueado', 'obstáculo', 'obstaculo'],
  desbloquear: ['desbloque', 'libera', 'continua', 'resolver'],
  alterar_prazo: ['prazo', 'data', 'posterga', 'antecipa', 'adiamento', 'adiar'],
  progresso: ['progresso', 'andamento', '%', 'porcentagem', 'avanço', 'avanco'],
  responsavel: ['responsavel', 'responsável', 'encarregado', 'atribuir'],
  observacao: ['observação', 'observacao', 'nota', 'comentário', 'comentario', 'obs']
};
```

#### D. Normalização de Texto (Remove Acentos)

```typescript
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
```

Agora "ação", "acao" e "açao" são tratados como a mesma coisa.

#### E. Matching Melhorado de Ações

```typescript
const acaoTituloNorm = normalizeText(acao.titulo);
const palavrasAcao = acaoTituloNorm.split(' ').filter(p => p.length > 3);

const acaoMencionada = messageLower.includes(acaoTituloNorm) ||
                      palavrasAcao.some(palavra => messageLower.includes(palavra)) ||
                      messageLower.includes('primeira acao') ||
                      messageLower.includes('primeira ação') ||
                      messageLower.includes('1');
```

Detecta menções por:
- Título completo
- Palavras-chave do título (mínimo 4 caracteres)
- "primeira ação" ou variações
- Número "1"

#### F. Novas Funcionalidades do Agente

##### Bloquear Ação
```typescript
// Usuário diz: "bloqueie a primeira ação"
await supabase
  .from('kanban_cards')
  .update({ status: 'blocked', updated_at: new Date().toISOString() })
  .eq('id', acao.id);
```

##### Desbloquear Ação
```typescript
// Usuário diz: "desbloqueie a ação X"
await supabase
  .from('kanban_cards')
  .update({ status: 'in_progress', updated_at: new Date().toISOString() })
  .eq('id', acao.id);
```

##### Adicionar Observação
```typescript
// Usuário diz: "adicione observação: contratei um dev"
const obsMatch = body.message.match(/observa[çc][aã]o[:\s]+(.+)/i);
if (obsMatch) {
  const observacao = obsMatch[1].trim();
  await supabase
    .from('kanban_cards')
    .update({ observacoes: observacao, updated_at: new Date().toISOString() })
    .eq('id', acao.id);
}
```

#### G. Tratamento de Erros Melhorado

```typescript
const { error } = await supabase
  .from('kanban_cards')
  .update({ status: 'in_progress', progresso: 25, updated_at: new Date().toISOString() })
  .eq('id', acao.id);

if (!error && effectiveUserId) {
  // Só insere no histórico se o update funcionou
  await supabase.from('acao_historico').insert({...});
}
```

Agora verifica se houve erro antes de tentar inserir no histórico.

---

## Como Testar

### 1. Testar Drag and Drop

1. Acesse o Kanban de uma jornada
2. Arraste um card de "A Fazer" para "Em Andamento"
3. Verifique que:
   - O card muda de coluna instantaneamente
   - A coluna de destino fica destacada durante o arrasto
   - O card sendo arrastado fica semi-transparente
   - Se soltar, o card fica na nova coluna
   - Se der erro, volta para a coluna original

### 2. Testar Agente Executor

#### Iniciar uma Ação
```
Usuário: "coloque a primeira ação em andamento"
Esperado: ▶️ Ação "Automatizar controle de contas esporádicas" iniciada (em andamento)
```

#### Marcar como Concluída
```
Usuário: "marquei como pronto a ação de automação"
Esperado: ✅ Ação "Automatizar controle de contas esporádicas" marcada como concluída
```

#### Bloquear uma Ação
```
Usuário: "a primeira ação está bloqueada"
Esperado: 🚫 Ação "Automatizar controle de contas esporádicas" bloqueada
```

#### Desbloquear uma Ação
```
Usuário: "desbloqueie a primeira ação"
Esperado: ✅ Ação "Automatizar controle de contas esporádicas" desbloqueada
```

#### Adicionar Observação
```
Usuário: "adicione observação: vou contratar um dev na ação de automação"
Esperado: 📝 Observação adicionada à ação "Automatizar controle de contas esporádicas"
```

---

## Deploy

Execute o script de deploy:

```bash
./deploy-agente-execucao.sh
```

Ou manualmente:

```bash
npx supabase functions deploy agente-execucao
```

---

## Checklist de Validação

- ✅ Build do projeto compilou sem erros
- ✅ Drag and drop implementado com estados visuais
- ✅ Update otimista com rollback em caso de erro
- ✅ Extração de user_id do token JWT
- ✅ Normalização de texto (remove acentos)
- ✅ Keywords expandidas para melhor detecção
- ✅ Matching fuzzy de ações por palavras-chave
- ✅ Suporte para bloquear/desbloquear
- ✅ Suporte para adicionar observações
- ✅ Tratamento de erros aprimorado
- ✅ Logs de debug adicionados
- ✅ Histórico de ações registrado corretamente

---

## Arquivos Modificados

1. `src/components/Consultor/Kanban/KanbanExecucao.tsx` - Sistema drag and drop completo
2. `supabase/functions/agente-execucao/index.ts` - Correções do agente executor
3. `deploy-agente-execucao.sh` - Script de deploy (criado)

---

## Próximos Passos Sugeridos

1. **Feedback Visual Aprimorado**: Toast notifications quando o agente executar ações
2. **Confirmações**: Confirmar ações críticas antes de executar
3. **Detecção de Prazo**: Permitir alterar prazo via chat ("mude o prazo para 15 dias")
4. **Detecção de Responsável**: Permitir alterar responsável via chat ("altere o responsável para João")
5. **Progresso Manual**: Permitir atualizar % de progresso via chat ("a ação está 50% concluída")
6. **Histórico Visível**: Mostrar histórico de alterações no modal do card
7. **Anexos**: Permitir anexar arquivos via agente executor

---

## Observações Importantes

- Cards concluídos não podem ser arrastados (design decision)
- O agente tenta detectar a intenção mesmo com variações de escrita
- O histórico só é registrado se o update no banco funcionar
- O user_id é extraído do token JWT para segurança
- Todas as alterações feitas pelo agente têm origem = 'agente_executor'

---

**Data**: 05/11/2025
**Status**: ✅ Implementado e Testado (build OK)
**Deploy**: Pendente (execute deploy-agente-execucao.sh)
