# Deploy: Fix Genius Analytics Visualization

## Problema Corrigido
Quando o usuário solicita análise Genius a partir do módulo Analytics, o resultado não aparecia no Analytics (apenas no Apresentação). Isso ocorria porque o webhook não preservava o campo `analysis_source_id`.

## Solução Implementada
Adicionado preservação do campo `analysis_source_id` no webhook durante update da mensagem.

**Arquivo modificado:**
- `supabase/functions/genius-webhook/index.ts` (linhas 413-416)

## Como Fazer Deploy

### Passo 1: Login no Supabase
```bash
npx supabase login
```

### Passo 2: Link do Projeto
```bash
npx supabase link --project-ref gljoasdvlaitplbmbtzg
```

### Passo 3: Deploy da Edge Function
```bash
npx supabase functions deploy genius-webhook
```

## Validação

### Teste após deploy:
1. Acesse o módulo **Analytics**
2. Faça análise de um arquivo CSV
3. Clique no botão **"Ver Análise Genius"**
4. Aguarde a conclusão da tarefa (2-3 minutos)
5. Verifique se o resultado do Genius **aparece no Analytics**

### Comportamento esperado:
- ✅ Resultado aparece no módulo Analytics
- ✅ Resultado continua aparecendo no módulo Apresentação
- ✅ Campo `analysis_source_id` é preservado durante todo o ciclo

## Impacto
- **Zero mudanças** na UI/UX
- **Zero mudanças** no fluxo de processamento
- **Apenas correção** da visualização no Analytics

## Detalhes Técnicos

### O que foi mudado:
```typescript
// ANTES (linha 411)
if (message) {
  messageUpdate.content = message;
}

await supabase
  .from("messages")
  .update(messageUpdate)
  .eq("id", existingMessage.id);

// DEPOIS (linhas 409-421)
if (message) {
  messageUpdate.content = message;
}

// Preserve analysis_source_id if exists
if (existingMessage.analysis_source_id) {
  messageUpdate.analysis_source_id = existingMessage.analysis_source_id;
}

await supabase
  .from("messages")
  .update(messageUpdate)
  .eq("id", existingMessage.id);
```

### Por que isso funciona:
1. O botão "Ver Análise Genius" salva `analysis_source_id` na mensagem inicial
2. O webhook atualiza a mensagem quando a tarefa completa
3. Antes: o update perdia o campo `analysis_source_id`
4. Agora: o update preserva o campo
5. O filtro do ChatPage (linha 2267) agora encontra o campo e exibe a mensagem

## Próximos Passos (Após Deploy)
Depois de validar que a correção funciona, podemos focar em:
- Otimização de performance (reduzir os 2-5s de preparação do arquivo)
- Melhorar feedback visual durante processamento
- Adicionar cache local para arquivos já analisados
