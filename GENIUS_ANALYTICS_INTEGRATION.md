# Integração Genius no Analytics - Implementação Completa

## Resumo

Sistema implementado com sucesso que permite ao usuário solicitar uma **análise aprofundada com Genius** APÓS completar uma análise no modo Analytics. O Genius gera documentos executivos editáveis (relatórios, apresentações, planilhas) baseados no mesmo arquivo e pergunta original.

---

## Arquitetura da Solução

### 1. Fluxo do Usuário

```
1. Usuário anexa arquivo CSV/Excel no Analytics
2. Faz pergunta → Sistema gera análise completa
3. ✅ Análise pronta → Aparece botão "Aprofundar com Genius"
4. Usuário clica → Confirma uso de 1 crédito Genius
5. Sistema cria tarefa no Manus (API Genius)
6. Webhook recebe resultado → Anexos aparecem no chat
7. Usuário pode visualizar/editar/baixar documentos
```

### 2. Estrutura de Banco de Dados

#### Tabelas Modificadas

**`messages`**
- Novo campo: `analysis_source_id` (uuid, FK para `data_analyses`)
- Link entre análise Analytics e resultado Genius

**`data_analyses`**
- Novo campo: `dataset_id` (uuid, FK para `datasets`)
- Necessário para recuperar arquivo original

#### Nova Tabela: `genius_credits`

```sql
CREATE TABLE genius_credits (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE NOT NULL,
  credits_available integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  last_recharge_date timestamptz,
  last_recharge_amount integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

#### Funções RPC

1. **`get_genius_credits(p_user_id uuid)`**
   - Retorna créditos disponíveis do usuário
   - Cria registro automático se não existir

2. **`consume_genius_credit(p_user_id uuid, p_task_id text)`**
   - Consome 1 crédito ao criar tarefa Genius
   - Validação de créditos disponíveis
   - Retorna erro se insuficiente

3. **`add_genius_credits(p_user_id uuid, p_amount integer)`**
   - Adiciona créditos (recarga/compra)
   - Apenas para masters/sistema de pagamento

---

## Componentes Criados

### 1. `GeniusUpgradeButton.tsx`

**Localização**: `src/components/Chat/GeniusUpgradeButton.tsx`

**Funcionalidades**:
- Verifica créditos disponíveis do usuário
- Detecta se já existe análise Genius para esta análise
- Modal de confirmação com preview de custo
- Prepara arquivo original (download do storage → base64)
- Cria tarefa no Manus via `GeniusApiService`
- Adiciona mensagens otimistas no chat
- Scroll automático até resultado

**Estados**:
- Normal: Gradiente azul-roxo com contador de créditos
- Já gerado: Verde com "Ver Análise Genius" (scroll até mensagem)
- Sem créditos: Desabilitado com tooltip
- Loading: Spinner + "Processando..."

### 2. `GeniusMessageRenderer.tsx`

**Localização**: `src/components/Chat/GeniusMessageRenderer.tsx`

**Funcionalidades**:
- Renderiza mensagens do tipo `genius_result`
- Status indicator (pending → running → completed/failed)
- Grid de anexos com preview cards
- Modal de visualização/edição de arquivos
- Indicador de créditos consumidos

**Design**:
- Background gradiente cinza-roxo
- Border lateral roxa
- Grid responsivo de anexos (2 cols desktop, 1 mobile)
- Ícones por tipo de arquivo

### 3. `geniusCredits.ts`

**Localização**: `src/lib/geniusCredits.ts`

**Funções**:
- `getGeniusCredits(userId)`: Busca créditos disponíveis
- `hasGeniusCredits(userId, required)`: Verifica suficiência
- `consumeGeniusCredit(userId, taskId)`: Consome crédito (webhook)
- `addGeniusCredits(userId, amount)`: Adiciona créditos
- `getCreditsErrorMessage(error)`: Formata mensagens amigáveis

---

## Modificações em Componentes Existentes

### 1. `AnalysisResultCard.tsx`

**Mudanças**:
- Adicionados props: `conversationId?`, `dataset_id?`, `file_metadata?`
- Novo botão "Aprofundar com Genius" no footer
- Condição: Apenas se `status === 'completed'` e `dataset_id` existe
- Texto explicativo sobre análise avançada

**Antes**:
```
[Exportar Análise Completa]
```

**Depois**:
```
[Exportar Análise Completa]

Deseja uma análise ainda mais profunda?
[✨ Aprofundar com Genius] (5 créditos)
```

### 2. `ChatPage.tsx`

**Mudanças**:
- Importado `GeniusMessageRenderer` e `GeniusAttachmentModal`
- Estado: `selectedGeniusAttachment`
- Renderização condicional de mensagens `genius_result`
- Modal de anexos Genius no final do componente

**Lógica de Renderização**:
```typescript
messages.map(m => {
  if (m.message_type === 'genius_result') {
    return <GeniusMessageRenderer ... />
  }
  // Renderização normal...
})
```

### 3. `MessageContent.tsx`

**Mudanças**:
- Passa `conversationId` para `AnalysisResultCard`

---

## Fluxo Técnico Detalhado

### Criação da Tarefa Genius

1. **Usuário clica no botão** → Abre modal de confirmação
2. **Confirmação** → Inicia processamento:
   ```typescript
   // 1. Verificar créditos
   const credits = await getGeniusCredits(userId)
   if (credits < 1) throw Error('Insuficiente')

   // 2. Recuperar arquivo do storage
   const { data: dataset } = await supabase
     .from('datasets')
     .select('file_path, name, size, mime_type')
     .eq('id', datasetId)
     .single()

   const { data: fileBlob } = await supabase.storage
     .from('datasets')
     .download(dataset.file_path)

   // 3. Converter para base64
   const base64 = await blobToBase64(fileBlob)

   // 4. Montar prompt enriquecido
   const prompt = `
   Análise Executiva Completa - Aprofundamento
   Pergunta Original: ${userQuestion}

   Por favor, gere documentos executivos completos incluindo:
   - Relatório executivo detalhado
   - Apresentação de resultados profissional
   - Planilha de dados processados
   - Dashboard interativo (se aplicável)
   `

   // 5. Criar mensagens otimistas
   await supabase.from('messages').insert([
     { role: 'user', content: '✨ Solicitando análise com Genius...' },
     { role: 'assistant', message_type: 'genius_result',
       genius_status: 'pending', analysis_source_id: analysisId }
   ])

   // 6. Chamar API Genius
   const response = await GeniusApiService.createTask({
     prompt,
     files: [{ filename, content: base64, size_bytes, mime_type }],
     conversationId
   })

   // 7. Atualizar com task_id
   await supabase.from('messages')
     .update({ external_task_id: response.task_id })
     .eq('id', placeholderId)
   ```

### Recebimento via Webhook

O webhook `genius-webhook` (já existente) atualiza automaticamente:
- `genius_status`: 'running' → 'completed'
- `genius_attachments`: Array de arquivos gerados
- `genius_credit_usage`: Créditos consumidos

### Realtime Update

O listener de realtime (já existente no ChatPage) detecta a atualização e re-renderiza automaticamente a mensagem com os anexos.

---

## Persistência e Histórico

### Link entre Análises

```
data_analyses (Analytics)
     ↓
  [analysis_source_id]
     ↓
messages (Genius Result)
```

**Query para buscar análise Genius de uma análise Analytics**:
```sql
SELECT m.*
FROM messages m
WHERE m.message_type = 'genius_result'
  AND m.analysis_source_id = '...'
```

### Reabertura de Conversa

Ao reabrir conversa antiga:
1. Sistema carrega todas as mensagens
2. Análises Analytics renderizadas via `AnalysisResultCard`
3. Análises Genius renderizadas via `GeniusMessageRenderer`
4. Ambas aparecem em ordem cronológica
5. Botão Genius muda para "Ver Análise Genius" se já existe

---

## Gestão de Créditos

### Sistema de Créditos

- **Analytics**: Usa tokens (modelo pay-per-token)
- **Genius**: Usa créditos (modelo pay-per-análise)
- **Separação clara**: Permite monetização diferenciada

### Preços Sugeridos (exemplo)

```
Plano Basic:
- 1000 tokens Analytics inclusos
- 0 créditos Genius
- Recarga: R$ 10 por 3 créditos Genius

Plano Pro:
- 5000 tokens Analytics inclusos
- 5 créditos Genius inclusos
- Recarga: R$ 30 por 10 créditos

Plano Enterprise:
- Tokens Analytics ilimitados
- 20 créditos Genius inclusos/mês
- Recarga: R$ 50 por 20 créditos
```

### Adicionar Créditos (Admin)

```sql
-- Via SQL (masters)
SELECT add_genius_credits(
  '123e4567-e89b-12d3-a456-426614174000'::uuid,  -- user_id
  10  -- quantidade
);

-- Ou via Supabase RPC no código
await supabase.rpc('add_genius_credits', {
  p_user_id: userId,
  p_amount: 10
})
```

### Seed para Testes

```bash
# Adicionar 10 créditos para todos os usuários
psql $DATABASE_URL -f supabase/seed-genius-credits.sql
```

---

## UI/UX Design

### Botão Genius

**Estados Visuais**:

1. **Disponível** (tem créditos):
   ```
   bg-gradient-to-r from-blue-600 to-purple-600
   shadow-lg shadow-purple-500/20
   hover:shadow-purple-500/40

   [✨ Aprofundar com Genius] (5 ✨)
   ```

2. **Já Gerado**:
   ```
   bg-green-600
   shadow-lg shadow-green-500/20

   [✓ Ver Análise Genius]
   ```

3. **Sem Créditos**:
   ```
   bg-gray-700
   cursor-not-allowed
   opacity-50

   [✨ Aprofundar com Genius]
   ⚠️ Sem créditos disponíveis
   ```

4. **Loading**:
   ```
   [⟳ Processando...]
   ```

### Modal de Confirmação

```
┌─────────────────────────────────────┐
│ ✨ Análise Genius                   │
│                                     │
│ O Genius vai gerar uma análise      │
│ executiva completa com documentos   │
│ editáveis...                        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Custo da análise:        1 ✨   │ │
│ │ Créditos disponíveis:    5 ✨   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Cancelar]  [Confirmar]             │
└─────────────────────────────────────┘
```

### Mensagem Genius no Chat

```
┌────────────────────────────────────────┐
│ ✨ Análise Genius                      │
│                                        │
│ ⟳ Processando análise avançada...     │
│ Tempo estimado: 2-5 minutos            │
└────────────────────────────────────────┘

↓ (após completar)

┌────────────────────────────────────────┐
│ ✨ Análise Genius                      │
│                                        │
│ ✓ Análise concluída com sucesso!      │
│                                        │
│ 📎 Documentos Gerados (4)              │
│                                        │
│ ┌──────────────┐  ┌──────────────┐   │
│ │ 📄 Relatório │  │ 📊 Apresenta │   │
│ │ Executivo    │  │ ção.pptx     │   │
│ │ 250 KB       │  │ 1.2 MB       │   │
│ └──────────────┘  └──────────────┘   │
│                                        │
│ ┌──────────────┐  ┌──────────────┐   │
│ │ 📈 Dados.xlsx│  │ 🖼️ Dashboard │   │
│ │ 85 KB        │  │ HTML         │   │
│ └──────────────┘  └──────────────┘   │
│                                        │
│ Créditos utilizados: 1 ✨              │
└────────────────────────────────────────┘
```

---

## Testes Recomendados

### 1. Teste de Fluxo Completo

```
✅ Anexar CSV no Analytics
✅ Fazer pergunta → Ver análise completa
✅ Clicar em "Aprofundar com Genius"
✅ Confirmar no modal
✅ Ver mensagem "Processando..."
✅ Aguardar webhook (2-5 min)
✅ Ver documentos gerados
✅ Abrir modal de cada documento
✅ Baixar arquivos
✅ Verificar créditos atualizados
```

### 2. Teste de Créditos

```
✅ Usuário com 0 créditos → Botão desabilitado
✅ Usuário com 1 crédito → Pode gerar 1 análise
✅ Após usar → Créditos decrementados
✅ Adicionar créditos via SQL → Contador atualiza
```

### 3. Teste de Persistência

```
✅ Gerar análise Genius
✅ Recarregar página
✅ Ambas análises (Analytics + Genius) aparecem
✅ Botão muda para "Ver Análise Genius"
✅ Clicar → Scroll até mensagem existente
```

### 4. Teste de Erros

```
✅ Arquivo não encontrado → Mensagem clara
✅ API Manus falha → Retry automático
✅ Timeout → Status atualizado
✅ Sem créditos → Modal informativo
```

---

## Comandos Úteis

### Aplicar Migration

```bash
# Já aplicada automaticamente via mcp__supabase__apply_migration
# Arquivo: 20251123000000_add_genius_integration_to_analytics.sql
```

### Adicionar Créditos para Teste

```bash
# Via psql
psql $DATABASE_URL -f supabase/seed-genius-credits.sql

# Via RPC (código)
const { data } = await supabase.rpc('add_genius_credits', {
  p_user_id: userId,
  p_amount: 10
})
```

### Verificar Créditos de Usuário

```sql
SELECT
  u.email,
  gc.credits_available,
  gc.credits_used
FROM genius_credits gc
JOIN auth.users u ON u.id = gc.user_id
WHERE u.id = '...';
```

### Listar Análises Genius

```sql
SELECT
  m.id,
  m.content,
  m.genius_status,
  m.analysis_source_id,
  jsonb_array_length(m.genius_attachments) as num_attachments,
  m.genius_credit_usage,
  m.created_at
FROM messages m
WHERE m.message_type = 'genius_result'
ORDER BY m.created_at DESC;
```

---

## Checklist de Deploy

### Backend
- [x] Migration aplicada (`add_genius_integration_to_analytics`)
- [x] Tabela `genius_credits` criada
- [x] Funções RPC criadas e testadas
- [x] RLS policies configuradas
- [ ] Seed de créditos executado (opcional)

### Frontend
- [x] `GeniusUpgradeButton` criado
- [x] `GeniusMessageRenderer` criado
- [x] `geniusCredits.ts` criado
- [x] `AnalysisResultCard` modificado
- [x] `ChatPage` modificado
- [x] `MessageContent` modificado
- [x] Build concluído com sucesso

### Edge Functions
- [x] `genius-create-task` (já existe)
- [x] `genius-webhook` (já existe)
- [x] `genius-continue-task` (já existe)
- [x] Webhook registrado no Manus

### Testes
- [ ] Fluxo completo Analytics → Genius
- [ ] Sistema de créditos
- [ ] Persistência de mensagens
- [ ] Modal de anexos
- [ ] Tratamento de erros

---

## Próximos Passos (Opcional)

### 1. Sistema de Pagamento
- Integrar Stripe para compra de créditos
- Página de recarga de créditos
- Histórico de transações

### 2. Analytics de Uso
- Dashboard de uso de créditos por usuário
- Relatório de análises Genius geradas
- Métricas de conversão Analytics → Genius

### 3. Melhorias de UX
- Preview de análise Genius antes de confirmar
- Estimativa de tempo por tipo de arquivo
- Notificação push quando análise completar
- Comparação lado-a-lado: Analytics vs Genius

### 4. Otimizações
- Cache de arquivos já baixados
- Compressão de base64 para envio
- Chunking de arquivos grandes
- Retry inteligente com backoff

---

## Suporte e Troubleshooting

### Erro: "Arquivo original não encontrado"

**Causa**: `dataset_id` nulo ou arquivo deletado do storage

**Solução**:
```sql
-- Verificar se dataset existe
SELECT id, file_path FROM datasets WHERE id = '...';

-- Verificar se arquivo existe no storage
SELECT * FROM storage.objects WHERE bucket_id = 'datasets' AND name = '...';
```

### Erro: "Créditos Genius insuficientes"

**Causa**: Usuário sem créditos ou registro não criado

**Solução**:
```sql
-- Verificar créditos
SELECT * FROM genius_credits WHERE user_id = '...';

-- Adicionar créditos
SELECT add_genius_credits('...'::uuid, 10);
```

### Erro: "Falha ao criar tarefa Genius"

**Causa**: API Manus indisponível ou API key inválida

**Solução**:
1. Verificar secret `MANUS_API_KEY` no Supabase
2. Testar API Manus diretamente
3. Verificar logs da edge function

### Mensagem não atualiza após webhook

**Causa**: Listener realtime não ativo

**Solução**:
1. Verificar console do browser por erros de realtime
2. Recarregar página
3. Verificar se mensagem foi atualizada no banco:
   ```sql
   SELECT genius_status, genius_attachments
   FROM messages
   WHERE id = '...';
   ```

---

## Conclusão

Sistema de integração Genius no Analytics implementado com sucesso!

**Benefícios**:
- ✅ Upgrade natural: Analytics → Genius
- ✅ Monetização clara: Créditos vs Tokens
- ✅ Persistência completa: Histórico preservado
- ✅ Zero quebra: Genius separado ainda funciona
- ✅ Modular: Fácil de manter e estender

**Pronto para uso em produção após**:
1. Adicionar créditos iniciais aos usuários
2. Testar fluxo completo
3. Configurar monitoramento de uso
4. Documentar para usuários finais
