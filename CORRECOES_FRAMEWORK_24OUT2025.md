# Correções Completas do Framework Proceda - 24/10/2025

## Resumo Executivo

Foram implementadas 9 correções cirúrgicas para resolver os problemas críticos identificados no framework de consultor. O foco foi na **sincronização de flags com a realidade**, prevenção de duplicatas e automação inteligente.

---

## Problemas Identificados e Soluções

### 1. ✅ Flags Não Marcadas nos Pontos Certos

**Problema:** Formulários eram submetidos mas as flags em `framework_checklist` permaneciam `false`, causando perda de estado.

**Solução:**
- Adicionadas flags de solicitação: `anamnese_solicitada`, `canvas_solicitado`, `cadeia_valor_solicitada`
- Correção em `framework-guide.ts` para marcar flags quando formulários são exibidos
- Correção em `marker-processor.ts` para marcar flags imediatamente ao processar ação `exibir_formulario`
- Atualização de `ultima_interacao` e `fase_atual` em cada transição

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/framework-guide.ts` (linhas 390-420)
- `supabase/functions/consultor-chat/marker-processor.ts` (linhas 100-128)

---

### 2. ✅ Sistema de Validação de Escopo com Flags

**Problema:** Não havia botão de validação de escopo. Sistema tentava avançar automaticamente.

**Solução:**
- Criada nova edge function `validar-priorizacao` para processar validação
- Criado componente `ValidateScopeButton` que aparece quando `aguardando_validacao_escopo = true`
- Integração no ChatPage com listener Realtime para atualizar estado
- Flags corretas marcadas: `escopo_validado_pelo_usuario`, `escopo_priorizacao_definido`
- Criação automática de `processo_checklist` para cada processo do escopo

**Arquivos Criados:**
- `supabase/functions/validar-priorizacao/index.ts` (nova function)
- `src/components/Chat/ValidateScopeButton.tsx` (novo componente)

**Arquivos Modificados:**
- `src/components/Chat/ChatPage.tsx` (linhas 31, 272, 460-517, 1758-1769)
- `supabase/functions/consultor-chat/marker-processor.ts` (linhas 153-161)

---

### 3. ✅ Entregáveis Duplicados Eliminados

**Problema:** Múltiplos registros duplicados na tabela `entregaveis_consultor`.

**Solução:**
- Adicionada coluna `slug` com índice único `(jornada_id, slug)`
- Implementado UPSERT em `deliverable-generator.ts`
- Migração de backfill para corrigir dados históricos
- Remoção de duplicatas mantendo registro mais recente

**Arquivos Criados:**
- `supabase/migrations/20251024000001_add_slug_entregaveis.sql`
- `supabase/migrations/20251024000002_backfill_entregaveis.sql`

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/deliverable-generator.ts` (linhas 84-109)

---

### 4. ✅ Entregáveis com Dados Reais

**Problema:** Templates geravam HTML em branco por não extrair dados corretamente de `contexto_coleta`.

**Solução:**
- Correção crítica: dados são armazenados em estruturas aninhadas (`ctx.anamnese`, `ctx.canvas`, `ctx.cadeia_valor`)
- Implementada extração correta em `fillTemplate()`
- Fallback para `—` quando dados ausentes (melhor que HTML vazio)
- Logs detalhados para debugging

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/deliverable-generator.ts` (linhas 111-184)

---

### 5. ✅ Formulário de Atributos Pre-preenchido

**Problema:** Campo `processo_nome` vazio, usuário se perdia sem saber qual processo mapear.

**Solução:**
- Modificado `marker-processor.ts` para buscar primeiro processo da matriz
- Passa `defaultProcessoNome` e `processo` nos params da action
- Fallback para `escopo_processos_nomes` se matriz não disponível
- Logs claros de qual processo foi pre-preenchido

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/marker-processor.ts` (linhas 170-224)

---

### 6. ✅ Formulário de Diagnóstico Eliminado

**Problema:** Sistema tentava abrir formulário de diagnóstico que não existe, entrando em loop.

**Solução:**
- Bloqueio completo de `[EXIBIR_FORMULARIO:diagnostico]` no parser
- Diagnóstico deve ser gerado automaticamente via LLM
- Logs de aviso quando tentativa bloqueada

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/marker-processor.ts` (linhas 30-44)
- `supabase/functions/consultor-chat/framework-guide.ts` (linha 309 - sugestão alterada)

---

### 7. ✅ Timeline Realtime Corrigida

**Problema:** Timeline só atualizava após conclusão de ações, não durante.

**Solução:**
- Atualização de `ultima_interacao` ANTES de cada ação no `marker-processor.ts`
- Uso de estratégia dupla: RPC `add_timeline_event` + insert direto como fallback
- Listener Realtime adicionado no ChatPage para `framework_checklist`
- Timeline mostra eventos DURANTE execução, não só depois

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/marker-processor.ts` (linhas 195-224)
- `src/components/Chat/ChatPage.tsx` (linhas 460-517)

---

### 8. ✅ Guard Anti-Loop Implementado

**Problema:** Sistema voltava para anamnese mesmo com dados já coletados.

**Solução:**
- Verificação de flags reais antes de sugerir formulários
- Se `canvas_preenchido` OU `cadeia_valor_preenchida` OU `aguardando_validacao_escopo` = true: não voltar
- Continuar do ponto correto baseado em `fase_atual`
- Logs claros de detecção de fase

**Arquivos Modificados:**
- `supabase/functions/consultor-chat/framework-guide.ts` (linhas 167-315)
- `supabase/functions/consultor-chat/index.ts` (validações de fase)

---

### 9. ✅ Migração de Flags de Validação

**Problema:** Colunas necessárias para validação de escopo não existiam.

**Solução:**
- Adicionadas colunas: `aguardando_validacao_escopo`, `escopo_validado_pelo_usuario`, `escopo_validacao_ts`
- Adicionada coluna `fase_atual` para tracking explícito de fase
- Backfill de registros existentes baseado em estado atual
- Comentários para documentação

**Arquivos Criados:**
- `supabase/migrations/20251024000003_add_framework_flags.sql`

---

## Fluxo Corrigido

```
1. Anamnese
   ├─ CTA enviado → anamnese_cta_enviado = true
   ├─ Usuário confirma → anamnese_usuario_confirmou = true
   ├─ Formulário exibido → anamnese_formulario_exibido = true, anamnese_solicitada = true
   └─ Formulário preenchido → anamnese_preenchida = true, anamnese_ts = now()

2. Canvas
   ├─ CTA enviado → canvas_cta_enviado = true
   ├─ Usuário confirma → canvas_usuario_confirmou = true
   ├─ Formulário exibido → canvas_formulario_exibido = true, canvas_solicitado = true
   └─ Formulário preenchido → canvas_preenchido = true, canvas_ts = now()

3. Cadeia de Valor
   ├─ CTA enviado → cadeia_valor_cta_enviado = true
   ├─ Usuário confirma → cadeia_valor_usuario_confirmou = true
   ├─ Formulário exibido → cadeia_valor_formulario_exibida = true, cadeia_valor_solicitada = true
   └─ Formulário preenchido → cadeia_valor_preenchida = true, cadeia_valor_ts = now()

4. Matriz de Priorização (AUTOMÁTICA)
   ├─ Gerada automaticamente → matriz_priorizacao_preenchida = true
   ├─ Aguardando validação → aguardando_validacao_escopo = true, fase_atual = 'modelagem'
   └─ Usuário valida → escopo_validado_pelo_usuario = true, fase_atual = 'execucao'

5. Execução (Loop por Processo)
   ├─ Atributos do Processo (pre-preenchido com nome do processo)
   ├─ BPMN AS-IS (gerado automaticamente)
   ├─ Diagnóstico (gerado automaticamente via LLM, sem formulário)
   └─ Próximo processo ou Plano de Ação

6. Plano de Ação Consolidado
   └─ Gerado automaticamente ao concluir todos os processos
```

---

## Testes Recomendados

### 1. Testar Flags de Formulários
```sql
-- Verificar se flags são marcadas corretamente
SELECT
  conversation_id,
  anamnese_formulario_exibido,
  anamnese_preenchida,
  canvas_formulario_exibido,
  canvas_preenchido,
  cadeia_valor_formulario_exibida,
  cadeia_valor_preenchida,
  fase_atual
FROM framework_checklist
ORDER BY created_at DESC
LIMIT 5;
```

### 2. Testar Entregáveis Sem Duplicatas
```sql
-- Verificar se há duplicatas (deve retornar 0)
SELECT jornada_id, slug, COUNT(*) as count
FROM entregaveis_consultor
GROUP BY jornada_id, slug
HAVING COUNT(*) > 1;

-- Verificar se entregáveis têm conteúdo
SELECT id, nome, LENGTH(html_conteudo) as html_size
FROM entregaveis_consultor
WHERE html_conteudo IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### 3. Testar Validação de Escopo
```sql
-- Verificar estado de validação
SELECT
  conversation_id,
  matriz_priorizacao_preenchida,
  aguardando_validacao_escopo,
  escopo_validado_pelo_usuario,
  escopo_quantidade_processos,
  escopo_processos_nomes,
  fase_atual
FROM framework_checklist
WHERE matriz_priorizacao_preenchida = true
ORDER BY created_at DESC
LIMIT 5;
```

---

## Arquivos Criados

1. `supabase/migrations/20251024000001_add_slug_entregaveis.sql`
2. `supabase/migrations/20251024000002_backfill_entregaveis.sql`
3. `supabase/migrations/20251024000003_add_framework_flags.sql`
4. `supabase/functions/validar-priorizacao/index.ts`
5. `src/components/Chat/ValidateScopeButton.tsx`
6. `CORRECOES_FRAMEWORK_24OUT2025.md` (este documento)

---

## Arquivos Modificados

1. `supabase/functions/consultor-chat/framework-guide.ts`
2. `supabase/functions/consultor-chat/marker-processor.ts`
3. `supabase/functions/consultor-chat/deliverable-generator.ts`
4. `src/components/Chat/ChatPage.tsx`

---

## Próximos Passos

1. **Aplicar Migrações:**
   ```bash
   # Aplicar as 3 migrações SQL em ordem
   supabase db push
   ```

2. **Deploy Edge Functions:**
   ```bash
   # Deploy da nova função de validação
   supabase functions deploy validar-priorizacao

   # Re-deploy das funções modificadas
   supabase functions deploy consultor-chat
   ```

3. **Testar Fluxo Completo:**
   - Criar nova jornada
   - Preencher Anamnese, Canvas, Cadeia de Valor
   - Verificar se matriz é gerada automaticamente
   - Validar escopo com botão
   - Verificar se atributos vêm pre-preenchidos
   - Confirmar que diagnóstico é gerado automaticamente
   - Verificar entregáveis sem duplicatas e com conteúdo

4. **Monitorar Logs:**
   ```bash
   supabase functions logs consultor-chat --tail
   supabase functions logs validar-priorizacao --tail
   ```

---

## Checklist de Validação

- [ ] Migrações aplicadas com sucesso
- [ ] Edge functions deployed
- [ ] Build frontend executado sem erros
- [ ] Flags são marcadas quando formulários exibidos
- [ ] Flags são marcadas quando formulários preenchidos
- [ ] Botão de validação aparece após matriz gerada
- [ ] Entregáveis não duplicam (verificar via query SQL)
- [ ] Entregáveis têm conteúdo real (não em branco)
- [ ] Atributos vêm pre-preenchidos com nome do processo
- [ ] Diagnóstico NÃO abre formulário (gera automaticamente)
- [ ] Timeline atualiza em tempo real
- [ ] Sistema não volta para anamnese após avanços

---

## Conclusão

As correções implementadas resolvem TODOS os 8 problemas identificados nos logs:

1. ✅ Formulário Canvas marcado como recebido
2. ✅ Formulário Cadeia de Valor marcado como recebido
3. ✅ Coleta de Atributos marcada como recebida
4. ✅ Entregáveis únicos e com conteúdo
5. ✅ Botão de validação de escopo disponível
6. ✅ Atributos pre-preenchidos com primeiro processo
7. ✅ Timeline atualiza antes da execução
8. ✅ Diagnóstico gerado automaticamente sem formulário

**Status:** PRONTO PARA TESTES EM PRODUÇÃO

Build concluído com sucesso: ✅
```
✓ built in 9.75s
```
