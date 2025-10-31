# AUDITORIA COMPLETA - TODOS OS ERROS DO SISTEMA

## MAPEAMENTO COMPLETO DE NOMES DE CAMPOS/FASES

### 1. PROBLEMA: 3 Nomenclaturas Diferentes para "Fase"

#### Database (consultor_sessoes):
- `estado_atual` (coluna principal)
- Valores possíveis: `'coleta'`, `'mapeamento'`, `'priorizacao'`, `'execucao'`

#### Edge Function (consultor-rag/index.ts):
- Retorna: `fase` (não `estado`!)
- Valores esperados: `'anamnese'`, `'mapeamento'`, `'investigacao'`, `'priorizacao'`, `'mapeamento_processos'`, `'diagnostico'`, `'execucao'`

#### Frontend (ChatPage.tsx):
- Espera: `etapa` ou `estado`
- Lê: `data.estado` (mas Edge Function retorna `data.fase`)

#### Prompts (consultor-prompts.ts):
- Usa: `'anamnese'`, `'modelagem'`, `'investigacao'`, `'priorizacao'`, `'mapeamento'`, `'diagnostico'`, `'execucao'`

### **CONFLITO CRÍTICO:**
```
Database     Edge Function    Frontend    Prompts
---------------------------------------------------------
coleta   →   anamnese    →   estado      anamnese
mapeamento → mapeamento  →   etapa       modelagem
priorizacao→ priorizacao →   estado      priorizacao
execucao   → execucao    →   etapa       execucao
```

---

## 2. PROBLEMA: Estrutura do Contexto Inconsistente

### Edge Function Salva Assim:
```json
{
  "anamnese": {
    "nome": "Cristiano",
    "cargo": "sócio operacional",
    ...
  },
  "fase_atual": "mapeamento",
  "progresso": 30
}
```

### Edge Function Lê Assim (ERRADO):
```typescript
const contextData = { ...contexto, ...contextoIncremental };
const collectedFields = Object.keys(contextData).filter(...)
// ❌ NÃO ENCONTRA OS CAMPOS porque estão dentro de contextData.anamnese!
```

### Solução:
```typescript
const anamneseData = contextData.anamnese || contextData;
const collectedFields = requiredFields.filter(field => {
  return anamneseData[field] != null || contextData[field] != null;
});
```

---

## 3. PROBLEMA: Timeline Consultor vs Timeline Geral

### Tabelas Existentes:
1. `timeline_consultor` - específica para consultor
2. `timeline` - geral do sistema (não usada no consultor?)

### Uso Inconsistente:
- Edge Function insere em `timeline_consultor` ✅
- Frontend pode estar lendo de `timeline` ❌
- Triggers podem estar atualizando tabela errada

---

## 4. PROBLEMA: Acoes_Plano sem Sessao_ID?

### Schema Atual:
```sql
CREATE TABLE acoes_plano (
  id uuid,
  nome text,
  descricao text,
  responsavel text,
  prazo date,
  status text,
  sessao_id uuid  -- TEM ou NÃO TEM?
)
```

### Edge Function Assume que TEM:
```typescript
await supabase
  .from('acoes_plano')
  .insert({
    sessao_id: body.sessao_id,  // ← Pode dar erro se coluna não existe!
    nome: card.title,
    ...
  })
```

---

## 5. PROBLEMA: Entregáveis Consultor - Campo 'nome' vs 'slug'

### Migrations Recentes Adicionaram:
- `slug` (nullable)
- `nome_titulo` (para diferenciar nome técnico de nome visual)

### Edge Function Usa:
```typescript
.insert({
  sessao_id: body.sessao_id,
  nome: tipoEntregavel,  // ← 'anamnese_empresarial'
  titulo: `${tipoEntregavel} - ...`,
  tipo: 'html',
  conteudo_html: htmlContent,
  etapa_origem: faseAtual  // ← Usa fase interna, mas pode não bater com etapa_origem esperada
})
```

### Problema:
- `etapa_origem` recebe `'anamnese'` mas schema pode esperar `'coleta'`?
- `nome` vs `slug` - qual usar?

---

## 6. PROBLEMA: Gamificação por Conversa vs por Sessão

### Tabelas:
1. `gamificacao_consultor` (por sessao_id)
2. `gamificacao_conversa` (por conversation_id) - REMOVIDA?

### Edge Function Atualiza:
```typescript
await supabase
  .from('gamificacao_consultor')
  .upsert({
    sessao_id: body.sessao_id,
    xp_total: xpAtual + xpFase,
    ...
  }, {
    onConflict: 'sessao_id'
  });
```

### Frontend Lê de Onde?
- ChatPage.tsx menciona `gamificacao_conversa` removida
- Pode estar tentando ler tabela que não existe mais

---

## 7. PROBLEMA: Kanban Cards - Relacionamento Duplo

### Schema:
```sql
CREATE TABLE kanban_cards (
  id uuid,
  sessao_id uuid,  -- FK para consultor_sessoes
  acao_id uuid,    -- FK para acoes_plano
  titulo text,
  descricao text,
  status text,
  prioridade text
)
```

### Edge Function Cria:
```typescript
// 1. Cria ação
const { data: acao } = await supabase.from('acoes_plano').insert(...).select().single();

// 2. Cria card referenciando ação
await supabase.from('kanban_cards').insert({
  sessao_id: body.sessao_id,
  acao_id: acao.id,
  ...
});
```

### Problema:
- Se `acoes_plano` não tem `sessao_id`, a relação quebra
- Kanban pode ter cards órfãos

---

## 8. PROBLEMA: Chat-Executor Nunca Chamado

### Função Existe:
`supabase/functions/chat-execucao/index.ts`

### Mas Nunca é Chamada:
- ChatPage.tsx não referencia
- Consultor-rag não chama
- Quando criar ações no Kanban, quem executa?

---

## 9. PROBLEMA: Validação de Escopo

### Edge Function:
```typescript
if (novaFase === 'mapeamento_processos') {
  aguardandoValidacaoNova = 'escopo';
  console.log('[CONSULTOR] Waiting for scope validation');
}
```

### Mas Frontend:
- Não tem botão "Validar Escopo"
- `ValidateScopeButton.tsx` existe mas não está conectado ao fluxo
- Sessão fica travada aguardando validação que nunca vem

---

## 10. PROBLEMA: Templates de Entregáveis

### Edge Function Chama:
```typescript
const htmlContent = getTemplateForType(tipoEntregavel, contexto);
```

### Arquivo:
`supabase/functions/_shared/deliverable-templates.ts`

### Problema:
- Templates podem estar desatualizados
- Não está usando `templates_entregaveis` do banco
- Hardcoded ao invés de dinâmico

---

## 11. PROBLEMA: Progresso Nunca Atualiza

### Edge Function Define:
```typescript
const PHASE_PROGRESS: Record<string, number> = {
  'anamnese': 15,
  'mapeamento': 30,
  'investigacao': 45,
  'priorizacao': 55,
  'mapeamento_processos': 70,
  'diagnostico': 85,
  'execucao': 100
};
```

### Mas Salva Onde?
- Atualiza `contexto_coleta.progresso` no JSON
- MAS não atualiza coluna `progresso` da tabela `consultor_sessoes`

### Frontend Lê:
- Pode estar lendo `sessao.progresso` (coluna) que nunca muda
- Ao invés de `sessao.contexto_coleta.progresso` (JSON)

---

## 12. PROBLEMA: Auto-Detecção Nunca Funciona

### Código Atual:
```typescript
if (faseAtual === 'anamnese' && actions.length === 0) {
  const collectedFields = requiredFields.filter(...);

  if (collectedFields.length >= 8) {
    console.log('[CONSULTOR] AUTO-TRANSITION: ...');
    actions.push(...);
  }
}
```

### MAS:
- `faseAtual` vem de `PHASE_NORMALIZE[sessao.estado_atual]`
- Se `sessao.estado_atual` é `'coleta'`, normaliza para `'anamnese'` ✅
- Mas se já está em `'mapeamento'`, a condição nunca dispara!
- **Só detecta na fase ANAMNESE, não nas outras!**

---

## RESUMO DOS ERROS

### Críticos (Impedem Funcionamento):
1. ❌ Edge Function retorna `fase`, Frontend lê `estado`
2. ❌ Contexto nested (`anamnese: {}`) não é lido corretamente
3. ❌ Progresso não atualiza coluna do banco
4. ❌ Auto-detecção só funciona para anamnese
5. ❌ Validação de escopo trava o fluxo

### Graves (Causam Inconsistências):
6. ⚠️ 3 nomenclaturas diferentes para fases
7. ⚠️ Timeline pode estar na tabela errada
8. ⚠️ Acoes_plano pode não ter sessao_id
9. ⚠️ Gamificação referencia tabela removida
10. ⚠️ Chat-executor nunca é chamado

### Menores (Melhorias Necessárias):
11. 🔸 Templates hardcoded ao invés de dinâmicos
12. 🔸 Kanban cards podem ficar órfãos
13. 🔸 Error handling insuficiente

---

## PLANO DE CORREÇÃO COMPLETO

### Fase 1: Normalização de Nomes (CRÍTICO)
1. ✅ Criar mapeamento unificado de fases
2. ✅ Edge Function retornar `estado` E `fase` (compatibilidade)
3. ✅ Frontend ler `data.fase ?? data.estado`
4. ✅ Atualizar TODOS os arquivos para usar nomenclatura consistente

### Fase 2: Corrigir Estrutura de Contexto
5. ✅ Edge Function ler de `contexto.anamnese` e `contexto.mapeamento`, etc
6. ✅ Auto-detecção funcionar para TODAS as fases
7. ✅ Progresso atualizar coluna do banco, não só JSON

### Fase 3: Corrigir Fluxo de Entregáveis
8. ✅ Templates usar tabela `templates_entregaveis`
9. ✅ Entregável salvar com `etapa_origem` correto
10. ✅ Timeline registrar todas transições

### Fase 4: Corrigir Ações e Kanban
11. ✅ Garantir `acoes_plano` tem `sessao_id`
12. ✅ Kanban cards criar corretamente
13. ✅ Chat-executor ser chamado quando necessário

### Fase 5: Corrigir Validações
14. ✅ Validação de escopo funcionar ou ser removida
15. ✅ Gamificação usar tabela correta
16. ✅ Error handling completo

---

## ARQUIVOS QUE PRECISAM CORREÇÃO

### Edge Functions (Supabase):
1. `/supabase/functions/consultor-rag/index.ts` - 15+ correções
2. `/supabase/functions/consultor-rag/consultor-prompts.ts` - normalização
3. `/supabase/functions/_shared/deliverable-templates.ts` - templates
4. `/supabase/functions/chat-execucao/index.ts` - integração

### Frontend (React):
5. `/src/lib/consultor/rag-adapter.ts` - field mapping
6. `/src/components/Chat/ChatPage.tsx` - leitura de estado
7. `/src/components/Consultor/LateralConsultor.tsx` - progresso
8. `/src/components/Consultor/Timeline/JornadaTimeline.tsx` - timeline

### Database (Migrations):
9. Nova migration para normalizar `estado_atual`
10. Nova migration para garantir colunas necessárias
11. Nova migration para corrigir RLS policies

---

## ESTIMATIVA DE CORREÇÕES

- **Arquivos a modificar**: 11
- **Linhas de código**: ~500 linhas
- **Tempo estimado**: 2-3 horas de correções focadas
- **Risco**: Médio (muitas mudanças interdependentes)

---

## PRÓXIMOS PASSOS

1. Aplicar TODAS as correções listadas acima de uma vez
2. Testar fluxo completo: anamnese → mapeamento → ... → execução
3. Verificar cada entregável gerado
4. Confirmar timeline atualiza
5. Validar Kanban funciona
6. Verificar gamificação

**SEM MAIS CORREÇÕES PARCIAIS. TUDO DE UMA VEZ AGORA.**
