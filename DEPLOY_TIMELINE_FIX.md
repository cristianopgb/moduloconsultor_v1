# Deploy: Correção da Timeline

## 🚀 Passos para Deploy

### 1. Deploy da Edge Function

A Edge Function precisa ser deployada via Supabase CLI ou Dashboard:

#### Opção A: Via Supabase CLI (se autenticado)
```bash
npx supabase functions deploy consultor-rag
```

#### Opção B: Via Supabase Dashboard
1. Acesse: https://supabase.com/dashboard/project/YOUR_PROJECT/functions
2. Encontre a função `consultor-rag`
3. Clique em "Deploy" ou "Update"
4. Cole o conteúdo do arquivo: `supabase/functions/consultor-rag/index.ts`
5. Salve e aguarde deploy

### 2. Build do Frontend (Já Concluído ✅)
```bash
npm run build
```

### 3. Deploy do Frontend

Após o build, faça deploy da pasta `dist/` para seu host:

```bash
# Exemplo para Vercel
vercel --prod

# Exemplo para Netlify
netlify deploy --prod --dir=dist

# Ou copie manualmente a pasta dist/ para seu servidor
```

## 🧪 Como Testar Após Deploy

### Teste 1: Verificar Logs da Edge Function
1. Acesse Supabase Dashboard > Logs > Edge Functions
2. Filtre por `consultor-rag`
3. Interaja com o Consultor
4. Verifique se aparece:
   ```
   [CONSULTOR] ✅ Context updated. New phase: execucao
   [CONSULTOR] ✅ Jornada etapa_atual updated to: execucao
   ```

### Teste 2: Verificar Timeline no Frontend
1. Abra o aplicativo
2. Inicie ou continue uma sessão do Consultor
3. Complete a anamnese
4. **Observe a timeline no painel lateral direito**
5. Confirme que a bolinha muda de "Anamnese" para "Mapeamento Geral"

### Teste 3: Verificar Console do Browser
1. Abra DevTools (F12)
2. Vá para Console
3. Interaja com o Consultor
4. Verifique logs:
   ```
   [LateralConsultor] Jornada updated via realtime: execucao
   [JornadaTimeline] Etapa atual changed to: execucao
   ```

### Teste 4: Query no Banco de Dados
```sql
-- Verificar se as fases estão sincronizadas
SELECT
  j.etapa_atual as jornada_fase,
  s.estado_atual as sessao_fase,
  j.updated_at
FROM jornadas_consultor j
JOIN consultor_sessoes s ON s.jornada_id = j.id
ORDER BY j.updated_at DESC
LIMIT 5;
```

**Resultado esperado:** `jornada_fase` = `sessao_fase` para todas as sessões ativas.

## 🔍 Troubleshooting

### Problema: Timeline ainda não atualiza

#### Verificação 1: Edge Function deployada?
```bash
# Liste funções deployadas
npx supabase functions list
```
Confirme que `consultor-rag` está na lista e com timestamp recente.

#### Verificação 2: Logs da Edge Function
- Vá para Supabase Dashboard > Logs > Edge Functions
- Procure por `[CONSULTOR] ✅ Jornada etapa_atual updated to:`
- Se não aparecer, a função não foi deployada corretamente

#### Verificação 3: Realtime funcionando?
- Abra console do browser
- Procure por `[LateralConsultor] Jornada updated via realtime:`
- Se não aparecer, verifique se Realtime está habilitado no Supabase

#### Verificação 4: Cache do Browser
```bash
# Limpe o cache do browser
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

#### Verificação 5: Query manual no banco
```sql
-- Force update manual para testar
UPDATE jornadas_consultor
SET etapa_atual = 'execucao',
    updated_at = NOW()
WHERE conversation_id = 'SEU_CONVERSATION_ID';
```
Após executar, a timeline deve atualizar via realtime.

## 📋 Checklist de Deploy

- [ ] Edge Function `consultor-rag` deployada
- [ ] Frontend buildado (`npm run build`)
- [ ] Frontend deployado
- [ ] Teste 1: Logs Edge Function ✓
- [ ] Teste 2: Timeline atualiza visualmente ✓
- [ ] Teste 3: Logs console browser ✓
- [ ] Teste 4: Query banco sincronizada ✓
- [ ] Cache do browser limpo
- [ ] Testado em modo incognito

## 🎯 Resultado Esperado

### ANTES (Quebrado)
```
Timeline: 🔴 Anamnese (travada)
Banco:    ✅ execucao
Logs:     ✅ Context updated. New phase: execucao
```

### DEPOIS (Corrigido)
```
Timeline: ✅ Execução (atualizada)
Banco:    ✅ execucao
Logs:     ✅ Jornada etapa_atual updated to: execucao
```

## 📞 Suporte

Se após seguir todos os passos a timeline ainda não atualizar:

1. Verifique se há erros no console do browser (F12)
2. Verifique logs da Edge Function no Supabase Dashboard
3. Execute a query de verificação no banco
4. Abra uma issue com:
   - Screenshot da timeline travada
   - Logs do console
   - Logs da Edge Function
   - Resultado da query de verificação

---

**Última atualização:** 2025-11-25
**Build status:** ✅ SUCESSO
