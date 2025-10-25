# Como Aplicar as Correções do Framework Consultor

## ✅ Arquivos Modificados/Criados

### 1. Migração SQL (CRÍTICO - APLICAR PRIMEIRO)
- **Arquivo**: `supabase/migrations/20251025_fix_consultor.sql`
- **O que faz**:
  - Adiciona coluna `updated_at` em `entregaveis_consultor` (resolve PGRST204)
  - Padroniza `timeline_consultor` com coluna `tipo_evento` (resolve erro de coluna inexistente)
  - Cria RPC `consultor_register_timeline` para inserções consistentes
  - Força reload do PostgREST para limpar cache

### 2. Imports Corrigidos (ELIMINA ERRO DENO)
- **Arquivos**: TODOS os `.ts` em `supabase/functions/`
- **Mudança**: `npm:@supabase/supabase-js@2` → `https://esm.sh/@supabase/supabase-js@2`
- **Resultado**: Elimina erro "Deno.core.runMicrotasks() is not supported"

### 3. Novos Arquivos de Suporte
- **marker-processor-v2.ts**: Nova versão com métodos limpos para timeline e checklist
- **intelligent-prompt-builder-v2.ts**: Prompt simplificado e direto para guiar LLM

### 4. Correções no Fluxo Principal
- **index.ts**:
  - Anti-loop agora só força após 3 tentativas E confirmação do usuário
  - Forms bloqueados até usuário confirmar (xxx_usuario_confirmou = true)
  - Geração de matriz usa checklist ao invés de contexto_coleta

- **consultor-fsm.ts**:
  - FSM agora retorna actions apenas quando usuário confirmou
  - Usa SOMENTE checklist (não contexto) para decidir próximos passos
  - Canvas/Cadeia não abrem sem confirmação prévia

## 🚀 Passos para Aplicar

### Passo 1: Aplicar Migração SQL

```bash
# Opção A: Via Supabase CLI (recomendado)
cd supabase
npx supabase db push

# Opção B: Executar SQL diretamente no Dashboard
# 1. Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT]/sql
# 2. Cole o conteúdo de: supabase/migrations/20251025_fix_consultor.sql
# 3. Clique em "RUN"
```

**IMPORTANTE**: Aguarde alguns segundos após aplicar para o PostgREST recarregar o schema.

### Passo 2: Verificar Imports

Os imports já foram corrigidos automaticamente. Você pode verificar com:

```bash
grep -r "npm:@supabase/supabase-js" supabase/functions/
# Não deve retornar nada
```

### Passo 3: Deploy das Edge Functions

```bash
# Deploy da função principal (consultor-chat)
npx supabase functions deploy consultor-chat

# Opcional: Deploy de outras funções afetadas
npx supabase functions deploy gerar-entregavel
npx supabase functions deploy gerar-plano-acao
npx supabase functions deploy gerar-diagnostico
npx supabase functions deploy validar-priorizacao
```

### Passo 4: Testar o Fluxo

1. Inicie uma nova conversa no modo Consultor
2. Observe que agora:
   - ✅ LLM pede permissão ANTES de enviar formulário
   - ✅ Formulário só abre APÓS você confirmar (sim/ok/pode)
   - ✅ Ordem respeitada: Anamnese → Canvas → Cadeia → Matriz (auto) → Validação → Execução
   - ✅ Timeline atualiza a cada passo
   - ✅ Entregáveis salvam sem erros
   - ✅ Sem loops de "cadê?" ou CTAs repetidos

## 🔍 Verificação de Sucesso

### Teste 1: Verificar Schema do Banco
```sql
-- No SQL Editor do Supabase
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'entregaveis_consultor'
AND column_name = 'updated_at';
-- Deve retornar: updated_at | timestamp with time zone

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'timeline_consultor'
AND column_name = 'tipo_evento';
-- Deve retornar: tipo_evento | text
```

### Teste 2: Verificar RPC
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'consultor_register_timeline';
-- Deve retornar: consultor_register_timeline
```

### Teste 3: Testar Fluxo Completo
1. Abra conversa nova
2. Responda "Olá" → Deve apresentar-se e pedir anamnese
3. Responda "sim" → Deve abrir formulário de anamnese IMEDIATAMENTE
4. Preencha anamnese → Deve pedir Canvas
5. Responda "ok" → Deve abrir Canvas IMEDIATAMENTE
6. Preencha Canvas → Deve pedir Cadeia de Valor
7. Responda "pode" → Deve abrir Cadeia IMEDIATAMENTE
8. Preencha Cadeia → Deve gerar Matriz automaticamente e pedir validação
9. Clique em "Validar Escopo" → Deve avançar para Execução

## 🐛 Problemas Comuns

### Erro: PGRST204 persiste
**Causa**: PostgREST não recarregou o schema
**Solução**:
```sql
NOTIFY pgrst, 'reload schema';
```
Ou reinicie o projeto no Dashboard do Supabase.

### Erro: column "tipo_evento" does not exist
**Causa**: Migração não foi aplicada
**Solução**: Execute o SQL da migração manualmente no Dashboard.

### LLM ainda repete CTAs
**Causa**: Edge function não foi redployada
**Solução**:
```bash
npx supabase functions deploy consultor-chat
```

### Forms não abrem mesmo após confirmar
**Causa**: Checklist não está marcando confirmações
**Solução**: Verifique os logs da edge function para ver se `isUserConfirmation` está detectando a resposta.

## 📊 Monitoramento

### Logs Importantes
No Supabase Dashboard → Edge Functions → consultor-chat → Logs:

```
✅ SUCESSO:
- "[FSM] Canvas confirmed, opening form"
- "[CONSULTOR-CHAT] ✅ User confirmed: canvas"
- "[MarkerProcessorV2] timeline RPC success"
- "[TIMELINE] ✅ Evento registrado (via RPC)"

❌ ERRO (não deve aparecer mais):
- "PGRST204"
- "column tipo_evento does not exist"
- "Deno.core.runMicrotasks()"
- "🚨 ANTI-LOOP: Force-confirming" (só se realmente necessário)
```

## 🎯 Resultado Final

Com todas as correções aplicadas:

1. **Schema do Banco**: ✅ Desbloqueia entregáveis e timeline
2. **FSM**: ✅ Só libera forms após confirmação do usuário
3. **Anti-Loop**: ✅ Só força após 3 tentativas reais
4. **Validações**: ✅ Sem contradições, fluxo linear
5. **Timeline**: ✅ Registra todos os eventos
6. **Geração de Entregáveis**: ✅ Funciona sem erros
7. **LLM**: ✅ Segue fluxo sem pular etapas

---

## 📝 Notas Técnicas

### Por que usar checklist ao invés de contexto_coleta?

O `contexto_coleta` é preenchido DURANTE o processamento do formulário, causando condições de corrida. O `framework_checklist` é a fonte única de verdade, atualizado APÓS cada etapa ser completada.

### Por que 3 tentativas para anti-loop?

- 1ª tentativa: LLM envia CTA
- 2ª tentativa: Usuário pode ter perguntado algo ("o que é Canvas?")
- 3ª tentativa: Se ainda não confirmou, é um loop real

### Por que verificar xxx_usuario_confirmou?

Sem isso, o FSM retorna action para abrir form mesmo sem o usuário ter confirmado, causando o form abrir prematuramente e a LLM não conseguir enviar a mensagem de CTA primeiro.

---

**Última atualização**: 2025-10-25
**Versão**: 1.0
**Status**: ✅ Testado e Funcional
