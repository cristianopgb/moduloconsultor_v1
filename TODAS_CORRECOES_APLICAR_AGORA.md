# TODAS AS CORREÇÕES - APLICAR AGORA

## ✅ JÁ APLICADO

### 1. Migration Completa
**Arquivo**: `/supabase/migrations/20251031180000_fix_all_consultor_issues.sql`
- Normaliza estado_atual (coleta → anamnese)
- Garante coluna progresso existe
- Adiciona sessao_id em acoes_plano
- Corrige estrutura de entregaveis_consultor
- Add RLS policies para service role
- Cria trigger auto-atualização de progresso
- Limpa dados órfãos

**Status**: ✅ Criado, precisa ser aplicado no Supabase

### 2. Frontend - rag-adapter.ts
**Arquivo**: `/src/lib/consultor/rag-adapter.ts` linha 120

**JÁ CORRIGIDO:**
```typescript
return {
  text: data?.reply ?? '',
  estado: data?.fase ?? data?.estado ?? 'coleta',  // Lê fase primeiro
  turno_atual: data?.turno_atual ?? 1,
  anamnese_completa: data?.anamnese_completa ?? false,
  contexto_coletado: data?.contexto_coletado ?? 0,
  sessaoId: sessaoId,
  actions: data?.actions_processadas ? [] : (data?.actions || []),
  progresso: data?.progresso
};
```

**Status**: ✅ Já aplicado

### 3. Edge Function - Auto-detecção Melhorada
**Arquivo**: `/supabase/functions/consultor-rag/index.ts` linha 289

**JÁ CORRIGIDO:**
```typescript
// Check both root level and nested in anamnese object
const anamneseData = contextData.anamnese || contextData;
const collectedFields = requiredFields.filter(field => {
  return anamneseData[field] != null || contextData[field] != null;
});
```

**Status**: ✅ Já aplicado

---

## 🔧 PRECISA APLICAR

### 4. Edge Function - Retornar Ambos os Campos
**Arquivo**: `/supabase/functions/consultor-rag/index.ts` linha ~532

**MUDAR DE:**
```typescript
return new Response(
  JSON.stringify({
    reply: responseText,
    fase: novaFase,  // ← Só retorna 'fase'
    progresso: progressoAtualizado,
    aguardando_validacao: aguardandoValidacaoNova,
    entregaveis_gerados: entregaveisGerados.length,
    actions_processadas: actions.length
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

**MUDAR PARA:**
```typescript
return new Response(
  JSON.stringify({
    reply: responseText,
    fase: novaFase,              // Para Edge Function
    estado: novaFase,            // Para Frontend (compatibilidade)
    progresso: progressoAtualizado,
    aguardando_validacao: aguardandoValidacaoNova,
    entregaveis_gerados: entregaveisGerados.length,
    actions_processadas: actions.length,
    actions: actions             // Passar actions para frontend
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

---

### 5. Edge Function - Atualizar COLUNA progresso
**Arquivo**: `/supabase/functions/consultor-rag/index.ts` linha ~470

**MUDAR DE:**
```typescript
await supabase
  .from('consultor_sessoes')
  .update({
    contexto_coleta: novoContexto,
    estado_atual: novaFase,
    aguardando_validacao: aguardandoValidacaoNova,
    updated_at: new Date().toISOString()
  })
  .eq('id', body.sessao_id);
```

**MUDAR PARA:**
```typescript
await supabase
  .from('consultor_sessoes')
  .update({
    contexto_coleta: novoContexto,
    estado_atual: novaFase,
    progresso: progressoAtualizado,  // ← ADICIONAR ESTA LINHA
    aguardando_validacao: aguardandoValidacaoNova,
    updated_at: new Date().toISOString()
  })
  .eq('id', body.sessao_id);
```

---

### 6. Edge Function - Auto-Detecção para TODAS as Fases
**Arquivo**: `/supabase/functions/consultor-rag/index.ts` linha ~288

**MUDAR DE:**
```typescript
// CRITICAL FIX: Auto-detect phase completion and inject transition if missing
if (faseAtual === 'anamnese' && actions.length === 0) {
  // ... código de detecção ...
}
```

**MUDAR PARA:**
```typescript
// CRITICAL FIX: Auto-detect phase completion and inject transition if missing
if (actions.length === 0) {
  // Detecção para anamnese
  if (faseAtual === 'anamnese') {
    const requiredFields = ['nome', 'cargo', 'idade', 'formacao', 'empresa', 'segmento', 'faturamento', 'funcionarios', 'dor_principal', 'expectativa'];
    const contextData = { ...contexto, ...contextoIncremental };
    const anamneseData = contextData.anamnese || contextData;
    const collectedFields = requiredFields.filter(field => {
      return anamneseData[field] != null || contextData[field] != null;
    });

    console.log('[CONSULTOR] Anamnese completion check:', {
      required: requiredFields.length,
      collected: collectedFields.length,
      fields: collectedFields,
      hasAnamneseNested: !!contextData.anamnese,
      anamneseKeys: Object.keys(anamneseData).length
    });

    if (collectedFields.length >= 8) {
      console.log('[CONSULTOR] AUTO-TRANSITION: Anamnese complete, forcing transition to mapeamento');
      actions.push(
        {
          type: 'gerar_entregavel',
          params: {
            tipo: 'anamnese_empresarial',
            contexto: { ...anamneseData, ...contextoIncremental }
          }
        },
        {
          type: 'transicao_estado',
          params: { to: 'mapeamento' }
        }
      );
      progressoAtualizado = 30;
    }
  }

  // Detecção para mapeamento
  if (faseAtual === 'mapeamento') {
    const contextData = { ...contexto, ...contextoIncremental };
    const mapeamentoData = contextData.mapeamento || {};

    // Se tem canvas e cadeia de valor preenchidos
    if (mapeamentoData.canvas_completo || mapeamentoData.cadeia_valor_completa) {
      console.log('[CONSULTOR] AUTO-TRANSITION: Mapeamento complete, forcing transition to investigacao');
      actions.push(
        {
          type: 'gerar_entregavel',
          params: {
            tipo: 'canvas_model',
            contexto: mapeamentoData
          }
        },
        {
          type: 'transicao_estado',
          params: { to: 'investigacao' }
        }
      );
      progressoAtualizado = 45;
    }
  }

  // TODO: Adicionar detecção para outras fases conforme necessário
}
```

---

### 7. ChatPage.tsx - Ler Progresso Correto
**Arquivo**: `/src/components/Chat/ChatPage.tsx`

**PROCURAR POR**: Lugares onde lê `sessao.progresso` ou `data.progresso`

**GARANTIR QUE LÊ**: `data.progresso` do response da Edge Function, não só da sessão

---

### 8. LateralConsultor.tsx - Exibir Progresso
**Arquivo**: `/src/components/Consultor/LateralConsultor.tsx`

**PROCURAR POR**: Componente de progresso/progress bar

**GARANTIR QUE**:
- Lê `sessao.progresso` (coluna do banco, agora atualizada)
- Mostra corretamente 0-100%
- Atualiza em tempo real

---

### 9. Remover Referências a gamificacao_conversa
**Arquivo**: `/src/components/Chat/ChatPage.tsx` linha ~391

**PROCURAR POR**:
```typescript
[GAMIFICATION] realtime subscription disabled (gamificacao_conversa removed)
```

**CONFIRMAR QUE**:
- Não há tentativas de ler de `gamificacao_conversa`
- Usa apenas `gamificacao_consultor`
- Busca por `sessao_id` ao invés de `conversation_id`

---

### 10. Conectar ValidateScopeButton
**Arquivo**: `/src/components/Chat/ChatPage.tsx`

**PROCURAR POR**: `aguardando_validacao === 'escopo'`

**ADICIONAR**:
```typescript
// Quando aguardando validação de escopo, mostrar botão
{aguardandoValidacao === 'escopo' && (
  <ValidateScopeButton
    sessaoId={sessaoId}
    onValidate={() => {
      // Chamar edge function validar-escopo
      // Ou simplesmente remover aguardando_validacao
      supabase
        .from('consultor_sessoes')
        .update({ aguardando_validacao: null })
        .eq('id', sessaoId);
    }}
  />
)}
```

---

## 📋 CHECKLIST DE APLICAÇÃO

### Banco de Dados:
- [ ] Aplicar migration `20251031180000_fix_all_consultor_issues.sql` no Supabase

### Edge Function:
- [ ] Correção #4: Retornar `estado` E `fase` e `actions`
- [ ] Correção #5: Atualizar coluna `progresso` no banco
- [ ] Correção #6: Auto-detecção para todas as fases
- [ ] Deploy Edge Function atualizada

### Frontend:
- [ ] Correção #7: ChatPage ler progresso correto
- [ ] Correção #8: LateralConsultor exibir progresso
- [ ] Correção #9: Remover gamificacao_conversa
- [ ] Correção #10: Conectar ValidateScopeButton
- [ ] Build e deploy frontend

---

## 🧪 TESTE COMPLETO APÓS APLICAÇÃO

### Teste 1: Fluxo Anamnese → Mapeamento
1. Criar nova conversa modo Consultor
2. Responder 6 perguntas de anamnese
3. ✅ Verificar: sistema avança automaticamente para mapeamento
4. ✅ Verificar: entregável "anamnese_empresarial" foi gerado
5. ✅ Verificar: progresso mostra 30%
6. ✅ Verificar: timeline registrou transição

### Teste 2: Progresso Visível
1. Abrir lateral do consultor
2. ✅ Ver barra de progresso
3. ✅ Ver percentual correto (15% em anamnese, 30% em mapeamento, etc)

### Teste 3: Entregáveis
1. Completar anamnese
2. ✅ Ver entregável na lista
3. ✅ Clicar e visualizar HTML
4. ✅ Conteúdo correto e formatado

### Teste 4: Timeline
1. Ver timeline na lateral
2. ✅ Eventos de transição aparecem
3. ✅ Timestamps corretos
4. ✅ Fases nomeadas corretamente

### Teste 5: Kanban (quando chegar em execução)
1. Completar todas as fases
2. ✅ Kanban com cards gerados
3. ✅ Cards têm ação_id correto
4. ✅ Pode mover cards entre colunas

---

## 🚨 ERROS COMUNS E SOLUÇÕES

### Erro: "Invalid API key"
- **Causa**: Service role key incorreta
- **Solução**: Verificar `.env` e secrets do Supabase

### Erro: "column 'progresso' does not exist"
- **Causa**: Migration não foi aplicada
- **Solução**: Rodar migration `20251031180000_fix_all_consultor_issues.sql`

### Erro: "estado: undefined" no console
- **Causa**: Edge Function não retornando campo correto
- **Solução**: Aplicar correção #4 (retornar `estado` E `fase`)

### Erro: Loop infinito mesmo após correções
- **Causa**: Auto-detecção não encontrando campos
- **Solução**: Verificar estrutura de `contexto_coleta` no banco, garantir que dados estão nested corretamente

### Erro: Timeline não atualiza
- **Causa**: Trigger não foi criado ou RLS bloqueando
- **Solução**: Migration inclui RLS para service_role, garantir que Edge Function usa service_role_key

---

## 📦 ARQUIVOS PARA DEPLOY

### Supabase:
1. `supabase/migrations/20251031180000_fix_all_consultor_issues.sql`
2. `supabase/functions/consultor-rag/index.ts` (com correções #4, #5, #6)
3. `supabase/functions/consultor-rag/consultor-prompts.ts` (já tem correções)

### Frontend:
1. `src/lib/consultor/rag-adapter.ts` (✅ já corrigido)
2. `src/components/Chat/ChatPage.tsx` (correções #7, #9, #10)
3. `src/components/Consultor/LateralConsultor.tsx` (correção #8)

---

## ⏱️ ORDEM DE APLICAÇÃO

1. **PRIMEIRO**: Aplicar migration no Supabase (cria estrutura correta)
2. **SEGUNDO**: Atualizar Edge Function com correções #4, #5, #6
3. **TERCEIRO**: Deploy Edge Function
4. **QUARTO**: Atualizar frontend com correções #7, #8, #9, #10
5. **QUINTO**: Build e deploy frontend
6. **SEXTO**: Testar fluxo completo end-to-end

---

## ✅ CRITÉRIOS DE SUCESSO

Sistema está funcionando quando:
- ✅ Anamnese avança para mapeamento automaticamente após 6 respostas
- ✅ Entregável "anamnese_empresarial" é gerado
- ✅ Progresso mostra 30% em mapeamento
- ✅ Timeline registra "Avançou para fase: mapeamento"
- ✅ Não há loop infinito
- ✅ Console não mostra "estado: coleta" quando deveria ser "mapeamento"
- ✅ Edge Function logs mostram "AUTO-TRANSITION" ou actions gerados pelo LLM
- ✅ Banco mostra `estado_atual = 'mapeamento'` e `progresso = 30`

**SE TODOS OS CRITÉRIOS FOREM ATENDIDOS, O SISTEMA ESTÁ FUNCIONAL.**
