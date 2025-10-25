# ✅ Checklist de Deploy - Correções Framework Consultor

## 🎯 Antes de Começar

- [ ] Backup do banco de dados atual
- [ ] Anotar ID de uma conversa de teste (para comparação antes/depois)
- [ ] Acesso ao Dashboard do Supabase
- [ ] Terminal com npx/supabase CLI configurado

---

## 📋 Passo a Passo

### 1️⃣ Aplicar Migração SQL (CRÍTICO)

**Tempo estimado**: 30 segundos

- [ ] Abrir arquivo: `supabase/migrations/20251025_fix_consultor.sql`
- [ ] Copiar TODO o conteúdo
- [ ] Acessar: Dashboard → SQL Editor → New Query
- [ ] Colar o SQL
- [ ] Clicar em "RUN"
- [ ] Aguardar mensagem de sucesso
- [ ] Aguardar 10 segundos (PostgREST reload)

**Verificação**:
```sql
-- Executar no SQL Editor:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'entregaveis_consultor' AND column_name = 'updated_at';
-- Deve retornar: updated_at

SELECT column_name FROM information_schema.columns
WHERE table_name = 'timeline_consultor' AND column_name = 'tipo_evento';
-- Deve retornar: tipo_evento

SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'consultor_register_timeline';
-- Deve retornar: consultor_register_timeline
```

**Status**: [ ] ✅ Concluído | [ ] ❌ Erro

---

### 2️⃣ Verificar Imports (Automático)

**Tempo estimado**: 10 segundos

- [ ] Abrir terminal na pasta do projeto
- [ ] Executar:
  ```bash
  grep -r "npm:@supabase/supabase-js" supabase/functions/
  ```
- [ ] Verificar que NÃO retorna nada (vazio = sucesso)

**Status**: [ ] ✅ Concluído | [ ] ❌ Encontrou imports npm:

---

### 3️⃣ Build do Frontend (Opcional mas Recomendado)

**Tempo estimado**: 15 segundos

- [ ] Executar:
  ```bash
  npm run build
  ```
- [ ] Verificar que termina com "✓ built in X.XXs"
- [ ] Sem erros TypeScript

**Status**: [ ] ✅ Concluído | [ ] ❌ Erros no build

---

### 4️⃣ Deploy da Edge Function Principal

**Tempo estimado**: 30 segundos

- [ ] Executar:
  ```bash
  npx supabase functions deploy consultor-chat
  ```
- [ ] Aguardar "Deployed Function consultor-chat"
- [ ] Sem erros no deploy

**Verificação**:
- [ ] Dashboard → Edge Functions → consultor-chat
- [ ] Última atualização deve ser AGORA
- [ ] Status: Healthy

**Status**: [ ] ✅ Concluído | [ ] ❌ Erro no deploy

---

### 5️⃣ Teste Rápido (Smoke Test)

**Tempo estimado**: 2 minutos

- [ ] Abrir aplicação
- [ ] Criar NOVA conversa (modo Consultor)
- [ ] Enviar: "Olá"
- [ ] Verificar resposta do assistente

**Checklist da resposta**:
- [ ] Apresentação feita (nome, método, 5 fases)
- [ ] Termina com CTA: "Posso enviar o formulário de anamnese?"
- [ ] SEM repetição da apresentação

**Status**: [ ] ✅ Funcionou | [ ] ❌ Erro

---

### 6️⃣ Teste do Fluxo de Confirmação

**Tempo estimado**: 3 minutos

**Continuando do teste anterior**:

- [ ] Responder: "sim"
- [ ] Verificar que formulário de anamnese ABRE IMEDIATAMENTE
- [ ] Preencher com dados de teste
- [ ] Submeter formulário
- [ ] Verificar próxima mensagem do assistente

**Checklist da resposta**:
- [ ] NÃO repete a pergunta sobre anamnese
- [ ] Avança para próxima etapa (Canvas)
- [ ] Termina com CTA: "Posso enviar o formulário de Canvas?"

**Status**: [ ] ✅ Funcionou | [ ] ❌ Erro

---

### 7️⃣ Verificar Timeline (Importante)

**Tempo estimado**: 1 minuto

- [ ] Dashboard → Table Editor → timeline_consultor
- [ ] Filtrar por jornada_id da conversa de teste
- [ ] Verificar eventos registrados

**Deve conter**:
- [ ] "form_preenchido:anamnese" OU similar
- [ ] Coluna tipo_evento preenchida
- [ ] Coluna fase preenchida
- [ ] Timestamps corretos

**Status**: [ ] ✅ Timeline OK | [ ] ❌ Vazia/erro

---

### 8️⃣ Verificar Entregáveis (Importante)

**Tempo estimado**: 1 minuto

- [ ] Dashboard → Table Editor → entregaveis_consultor
- [ ] Filtrar por jornada_id da conversa de teste
- [ ] Verificar se há pelo menos 1 entregável (anamnese)

**Deve conter**:
- [ ] Tipo: "anamnese"
- [ ] HTML preenchido
- [ ] Coluna updated_at preenchida
- [ ] Timestamps corretos

**Status**: [ ] ✅ Entregável OK | [ ] ❌ Erro ao salvar

---

### 9️⃣ Teste Completo (Opcional mas Recomendado)

**Tempo estimado**: 5 minutos

**Continuando ou nova conversa**:

- [ ] Anamnese preenchida
- [ ] Canvas solicitado → Confirmar "ok" → Form abre
- [ ] Canvas preenchido
- [ ] Cadeia solicitada → Confirmar "pode" → Form abre
- [ ] Cadeia preenchida
- [ ] Matriz gerada AUTOMATICAMENTE (sem pedir form)
- [ ] Botão "Validar Escopo" aparece
- [ ] Clicar em validar
- [ ] Avança para fase de Execução

**Status**: [ ] ✅ Fluxo completo OK | [ ] ❌ Travou em: _______

---

### 🔟 Monitoramento (Primeiras 24h)

**Tarefas contínuas**:

- [ ] Verificar logs a cada 4h
  - Dashboard → Edge Functions → consultor-chat → Logs
  - Procurar por "❌" ou "ERROR"

- [ ] Monitorar erros no console do navegador
  - F12 → Console
  - Filtrar por erros (vermelho)

- [ ] Coletar feedback de 2-3 usuários
  - Fluxo concluído? Sim/Não
  - Formulários abriram corretamente? Sim/Não
  - Encontrou loops ou CTAs repetidos? Sim/Não

**Status 4h**: [ ] ✅ OK | [ ] ⚠️ Avisos | [ ] ❌ Erros
**Status 12h**: [ ] ✅ OK | [ ] ⚠️ Avisos | [ ] ❌ Erros
**Status 24h**: [ ] ✅ OK | [ ] ⚠️ Avisos | [ ] ❌ Erros

---

## 🚨 Plano B - Rollback

**Se algo der MUITO errado**:

### Rollback da Migração
```sql
-- CUIDADO: Só executar se realmente necessário!
ALTER TABLE entregaveis_consultor DROP COLUMN IF EXISTS updated_at;
ALTER TABLE timeline_consultor RENAME COLUMN tipo_evento TO evento;
DROP FUNCTION IF EXISTS consultor_register_timeline;
```

### Rollback da Edge Function
```bash
# Re-deploy versão anterior
git checkout HEAD~1 supabase/functions/consultor-chat/
npx supabase functions deploy consultor-chat
```

### Quando fazer rollback?
- [ ] Erro crítico que impede TODAS as conversas
- [ ] Perda de dados detectada
- [ ] Impossível completar o fluxo básico

**Não fazer rollback se**:
- [ ] Apenas 1-2 conversas com problema isolado
- [ ] Erros apenas de formatação/UI
- [ ] Problema pode ser corrigido com ajuste de prompt

---

## ✅ Critérios de Sucesso

**Deploy considerado bem-sucedido se**:

- [x] Migração aplicada sem erros
- [x] Build do frontend sem erros
- [x] Deploy da função sem erros
- [ ] Smoke test passou (apresentação + CTA)
- [ ] Teste de confirmação passou (form abre após "sim")
- [ ] Timeline registra eventos
- [ ] Entregáveis salvam corretamente
- [ ] Nenhum erro PGRST204 nos logs
- [ ] Nenhum erro "tipo_evento" nos logs
- [ ] Nenhum erro Deno.core.runMicrotasks nos logs

**Mínimo para produção**: 8/10 checkboxes marcados
**Ideal**: 10/10 checkboxes marcados

---

## 📊 Relatório Final

**Data do Deploy**: _______________
**Hora início**: _______________
**Hora fim**: _______________
**Tempo total**: _______________

**Problemas encontrados**:
1. _____________________________
2. _____________________________
3. _____________________________

**Soluções aplicadas**:
1. _____________________________
2. _____________________________
3. _____________________________

**Notas adicionais**:
_____________________________________________________
_____________________________________________________
_____________________________________________________

**Aprovado por**: _______________
**Status final**: [ ] ✅ Sucesso | [ ] ⚠️ Parcial | [ ] ❌ Falhou

---

**Preparado por**: Claude Code (AI Assistant)
**Versão**: 1.0
**Data**: 2025-10-25
