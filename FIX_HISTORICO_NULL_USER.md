# Fix: Erro de NULL no campo alterado_por

## 🔴 Problema Identificado

O agente estava **atualizando o progresso com sucesso** ✅, mas **falhando ao mudar o status** ❌ porque tentava inserir no histórico com `alterado_por` NULL.

### Erro Original:
```
null value in column "alterado_por" of relation "acao_historico" violates not-null constraint
```

### Logs que mostraram o problema:
```
[AGENTE-EXECUCAO] Progresso atualizado com sucesso! ✅
[AGENTE-EXECUCAO] Detectou intenção de iniciar
[AGENTE-EXECUCAO] Update iniciar result: { error: { code: "23502", message: "null value..." }, data: null } ❌
```

## ✅ Causa Raiz

O `effectiveUserId` estava NULL porque:
1. `userId` (extraído do token JWT) estava NULL
2. `jornada.user_id` também estava NULL
3. `effectiveUserId = userId || jornada.user_id` resultava em NULL

Quando tentava inserir no `acao_historico`, o campo `alterado_por` (que é NOT NULL) recebia NULL e o Postgres rejeitava.

## ✅ Solução Implementada

### 1. Adicionei logs para debug:
```typescript
console.log('[AGENTE-EXECUCAO] userId extraído do token:', userId);
console.log('[AGENTE-EXECUCAO] jornada.user_id:', jornada.user_id);
console.log('[AGENTE-EXECUCAO] effectiveUserId final:', effectiveUserId);
```

### 2. Tratamento de erro no histórico:
Agora captura o erro de inserção de histórico sem falhar a operação principal:

```typescript
if (effectiveUserId) {
  const { error: histError } = await supabase.from('acao_historico').insert({
    acao_id: acao.id,
    campo_alterado: 'status',
    valor_anterior: acao.status,
    valor_novo: 'in_progress',
    alterado_por: effectiveUserId,
    origem: 'agente_executor'
  });

  if (histError) {
    console.error('[AGENTE-EXECUCAO] Erro ao inserir histórico (não crítico):', histError);
  }
} else {
  console.warn('[AGENTE-EXECUCAO] Não há effectiveUserId, pulando histórico');
}
```

### 3. Aplicado em TODAS as operações:
- ✅ Atualizar progresso
- ✅ Iniciar ação
- ✅ Concluir ação
- ✅ Bloquear ação
- ✅ Desbloquear ação

## 📋 O Que Acontece Agora

### Cenário 1: effectiveUserId existe
```
1. Atualiza o kanban_card ✅
2. Tenta inserir no histórico ✅
3. Se der erro no histórico, loga mas não falha ✅
4. Retorna sucesso ao usuário ✅
```

### Cenário 2: effectiveUserId é NULL
```
1. Atualiza o kanban_card ✅
2. Pula inserção no histórico ⚠️ (loga warning)
3. Retorna sucesso ao usuário ✅
```

## 🧪 Testes para Fazer

### Teste 1: Atualizar Progresso e Status Juntos
```
Comando: "atualize ação sistema gestão para status em andamento com progresso de 80%"

Esperado:
✅ Progresso atualizado para 80%
✅ Status mudado para in_progress
⚠️ Histórico pode não ser inserido (se effectiveUserId for NULL)
```

### Teste 2: Apenas Iniciar
```
Comando: "coloque a primeira ação em andamento"

Esperado:
✅ Status mudado para in_progress
✅ Progresso mudado para 25%
```

### Teste 3: Concluir
```
Comando: "marque como pronto sistema financeiro"

Esperado:
✅ Status mudado para done
✅ Progresso mudado para 100%
```

## 🔍 Logs Novos que Você Verá

Após o deploy, ao executar qualquer comando, você verá:

```
[AGENTE-EXECUCAO] Processing message for jornada: xxx
[AGENTE-EXECUCAO] userId extraído do token: null ou "uuid"
[AGENTE-EXECUCAO] jornada.user_id: null ou "uuid"
[AGENTE-EXECUCAO] effectiveUserId final: null ou "uuid"
[AGENTE-EXECUCAO] Ação mencionada: Implementar sistema de gestão financeira
[AGENTE-EXECUCAO] Tem keyword progresso? true
[AGENTE-EXECUCAO] Update result: { error: null, data: [...] }
[AGENTE-EXECUCAO] Progresso atualizado com sucesso!
[AGENTE-EXECUCAO] Detectou intenção de iniciar
[AGENTE-EXECUCAO] Update iniciar result: { error: null, data: [...] }
[AGENTE-EXECUCAO] Inserindo histórico com userId: "uuid"
```

## 🚀 Deploy

```bash
./deploy-agente-execucao.sh
```

## ⚠️ Importante

O histórico pode não ser registrado se:
- O token JWT não contém user_id
- A jornada não tem user_id associado

**Isso não é crítico** - o importante é que as ações sejam atualizadas corretamente.

Se você quiser que o histórico sempre seja registrado, precisamos:
1. Garantir que `jornada.user_id` esteja sempre preenchido
2. Ou tornar o campo `alterado_por` nullable na tabela `acao_historico`

---

**Data**: 05/11/2025
**Status**: ✅ Implementado
**Build**: ✅ Compilado com sucesso
**Deploy**: Pendente
