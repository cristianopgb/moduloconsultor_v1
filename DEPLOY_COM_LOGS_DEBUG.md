# Deploy com Logs de Debug - Agente Executor

## O que foi feito

Adicionei logs detalhados em **TODAS** as etapas do agente executor para identificar exatamente onde está falhando:

### Logs Adicionados:

1. **Detecção de Ação**:
   ```
   [AGENTE-EXECUCAO] Ação mencionada: {titulo}
   [AGENTE-EXECUCAO] Mensagem: "{mensagem original}"
   [AGENTE-EXECUCAO] Mensagem normalizada: "{mensagem sem acentos}"
   ```

2. **Detecção de Intenção - Progresso**:
   ```
   [AGENTE-EXECUCAO] Tem keyword progresso? true/false
   [AGENTE-EXECUCAO] Match de progresso: ['50%', '50']
   [AGENTE-EXECUCAO] Tentando atualizar progresso para: 50%
   [AGENTE-EXECUCAO] Update result: { error, data }
   [AGENTE-EXECUCAO] Progresso atualizado com sucesso!
   ```

3. **Detecção de Intenção - Concluir**:
   ```
   [AGENTE-EXECUCAO] Detectou intenção de concluir
   [AGENTE-EXECUCAO] Update concluir result: { error, data }
   ```

4. **Detecção de Intenção - Iniciar**:
   ```
   [AGENTE-EXECUCAO] Detectou intenção de iniciar
   [AGENTE-EXECUCAO] Update iniciar result: { error, data }
   ```

5. **Detecção de Intenção - Bloquear/Desbloquear**:
   ```
   [AGENTE-EXECUCAO] Detectou intenção de bloquear/desbloquear
   [AGENTE-EXECUCAO] Update result: { error, data }
   ```

6. **Detecção de Intenção - Observação**:
   ```
   [AGENTE-EXECUCAO] Detectou intenção de adicionar observação
   [AGENTE-EXECUCAO] Match observação: ['observação: texto', 'texto']
   [AGENTE-EXECUCAO] Observação extraída: "texto"
   [AGENTE-EXECUCAO] Update observação result: { error, data }
   ```

### Mudanças Importantes:

1. **Removido `else if` - Agora usa apenas `if`**
   - ANTES: Se detectava "progresso", não verificava "iniciar"
   - AGORA: Verifica todas as intenções independentemente

2. **Adicionado `.select()` em todos os updates**
   - Permite ver o dado retornado após o update
   - Facilita debug de RLS e permissões

3. **Mensagens de erro nos autoActions**
   - Se falhar, o usuário vê a mensagem de erro
   - Ex: "❌ Erro ao atualizar progresso: permission denied"

---

## Como Fazer o Deploy

```bash
./deploy-agente-execucao.sh
```

---

## Como Testar e Ver os Logs

### 1. Faça o deploy da função

### 2. Teste um comando
Exemplo: "mude o progresso para 50% da ação implementar sistema de gestão financeira"

### 3. Veja os logs no Supabase Dashboard
1. Acesse: https://supabase.com/dashboard/project/YOUR_PROJECT/logs/edge-functions
2. Selecione a function: `agente-execucao`
3. Você verá logs assim:

```
[AGENTE-EXECUCAO] Processing message for jornada: xxx
[AGENTE-EXECUCAO] Ação mencionada: Implementar sistema de gestão financeira
[AGENTE-EXECUCAO] Mensagem: "mude o progresso para 50% da ação implementar sistema de gestão financeira"
[AGENTE-EXECUCAO] Mensagem normalizada: "mude o progresso para 50% da acao implementar sistema de gestao financeira"
[AGENTE-EXECUCAO] Tem keyword progresso? true
[AGENTE-EXECUCAO] Match de progresso: ['50%', '50']
[AGENTE-EXECUCAO] Tentando atualizar progresso para: 50%
[AGENTE-EXECUCAO] Update result: { error: { code: 'PGRST...', message: '...' }, data: null }
```

### 4. Identifique o Problema

Se você ver:
- ✅ `Update result: { error: null, data: [...] }` → **FUNCIONOU!**
- ❌ `Update result: { error: { message: 'permission denied' }, data: null }` → **Problema de RLS**
- ❌ `Update result: { error: { message: 'column does not exist' }, data: null }` → **Problema de schema**
- ❌ `Update result: { error: { message: 'violates foreign key constraint' }, data: null }` → **Problema de FK**

---

## Possíveis Problemas e Soluções

### Problema 1: Permission Denied / 403

**Causa**: RLS policies não permitem update via service_role_key

**Solução**: Verificar as policies em `kanban_cards`:

```sql
-- Verificar policies atuais
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'kanban_cards';
```

Precisa ter uma policy assim:
```sql
CREATE POLICY "Service role can update all cards"
  ON kanban_cards FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Problema 2: Column Does Not Exist

**Causa**: Campo `progresso` não existe na tabela

**Solução**: Verificar schema:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'kanban_cards'
ORDER BY ordinal_position;
```

Se faltar, adicionar:
```sql
ALTER TABLE kanban_cards
ADD COLUMN IF NOT EXISTS progresso INTEGER DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100);
```

### Problema 3: Não Detecta a Ação

**Logs mostram**: `[AGENTE-EXECUCAO] Processing message...` mas não mostra "Ação mencionada"

**Causa**: A detecção de ação falhou

**Debug**: Verifique se:
- Título da ação corresponde ao que você digitou
- Palavras-chave têm pelo menos 5 caracteres (`filter(p => p.length > 4)`)

### Problema 4: Não Detecta a Intenção

**Logs mostram**: "Ação mencionada" mas não mostra "Detectou intenção de..."

**Causa**: Keyword não foi detectada

**Debug**: Verifique se a mensagem contém alguma das keywords:
```typescript
progresso: ['progresso', 'andamento', '%', 'porcentagem', 'avanço', 'avanco']
```

---

## Checklist de Validação

Execute cada teste e anote os logs:

- [ ] Teste: "mude o progresso para 50% da ação sistema financeiro"
  - Log esperado: "Tem keyword progresso? true"
  - Log esperado: "Match de progresso: ['50%', '50']"
  - Log esperado: "Update result: { error: null, data: [...] }"

- [ ] Teste: "coloque a primeira ação em andamento"
  - Log esperado: "Detectou intenção de iniciar"
  - Log esperado: "Update iniciar result: { error: null, data: [...] }"

- [ ] Teste: "marque como pronto a segunda ação"
  - Log esperado: "Detectou intenção de concluir"
  - Log esperado: "Update concluir result: { error: null, data: [...] }"

---

## Próximos Passos Após Deploy

1. Execute o script de deploy
2. Faça um teste simples
3. **IMEDIATAMENTE** vá ver os logs no Supabase
4. Copie todos os logs e me envie
5. Vou identificar exatamente onde está falhando

---

**IMPORTANTE**: Com esses logs detalhados, vamos descobrir exatamente por que não está funcionando!
