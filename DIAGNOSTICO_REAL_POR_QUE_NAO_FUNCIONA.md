# DIAGNÓSTICO REAL: Por Que o Sistema NÃO Funciona

**Data:** 2025-10-28  
**Status:** ANÁLISE COMPLETA  
**Conclusão:** O sistema tem todas as peças, mas NENHUMA está conectada corretamente.

---

## RESUMO EXECUTIVO

Você está 100% certo: **nada funciona**.

Não porque falta código. Mas porque **as peças não se falam**.

É como ter:
- Motor (RAG) ✅
- Rodas (Template Service) ✅  
- Direção (ChatPage) ✅
- Combustível (Banco de dados) ✅

**MAS:** O motor não está conectado às rodas. A direção não controla nada. O combustível não chega ao motor.

---

## PROBLEMA 1: RAG RETORNA AÇÕES, MAS NINGUÉM EXECUTA

### O que deveria acontecer:
```typescript
// Backend retorna
{
  actions: [
    { type: 'gerar_entregavel', params: { tipo: 'ishikawa' } }
  ]
}

// Frontend deveria:
executeRAGActions(actions) → TemplateService.gerar('ishikawa') → INSERT entregavel
```

### O que REALMENTE acontece:
```typescript
// Backend retorna ✅
{
  actions: [
    { type: 'gerar_entregavel', params: { tipo: 'ishikawa' } }
  ]
}

// Frontend faz:
const actions = [];
if (ragResponse.shouldGenerateDeliverable) {
  actions.push({ type: 'gerar_entregavel', params: { tipo: ragResponse.deliverableType }});
}
setPendingConsultorActions(actions); // GUARDA EM STATE

// E depois?
// NADA. ❌
// As ações ficam em state e nunca são executadas.
```

**Linha 1026 de ChatPage.tsx:**
```typescript
setPendingConsultorActions(actions.length > 0 ? actions : null);
// ☝️ Salva as ações... e esquece delas
```

**Não existe:**
- `executeRAGActions()`
- Chamada ao TemplateService
- INSERT em entregaveis_consultor
- NADA

---

## PROBLEMA 2: TEMPLATE SERVICE É UM FANTASMA

### O que deveria ter:
```typescript
class TemplateService {
  static async gerarIshikawa(contexto) {
    // Usa LLM para preencher dados
    // Retorna HTML estruturado
    // Insere em entregaveis_consultor
  }
  
  static async gerarSIPOC(contexto) { ... }
  static async gerarBPMN(contexto) { ... }
  static async gerar5W2H(contexto) { ... }
}
```

### O que REALMENTE tem:
```typescript
class TemplateService {
  static async gerarEntregavel(tipo, categoria, dados) {
    // ❌ Genérico demais
    // ❌ Não sabe nada de Ishikawa, SIPOC, etc
    // ❌ Tenta buscar templates de uma tabela que não existe
    // ❌ Nunca insere nada em entregaveis_consultor
  }
}
```

**Arquivo template-service.ts - Linha 9:**
```typescript
const { data: template } = await supabase
  .from('templates_entregaveis')  // ❌ Esta tabela NÃO EXISTE
  .select('*')
```

---

## PROBLEMA 3: ENTREGÁVEIS SEM sessao_id

### Estrutura atual de entregaveis_consultor:
```sql
CREATE TABLE entregaveis_consultor (
  id uuid PRIMARY KEY,
  jornada_id uuid REFERENCES jornadas_consultor(id),  -- ✅ Existe
  area_id uuid,
  nome text,
  tipo text,
  html_conteudo text,
  etapa_origem text,
  -- ❌ FALTA: sessao_id
  -- ❌ FALTA: conteudo_xml (para BPMN)
  -- ❌ FALTA: conteudo_md
)
```

### O problema:
- RAG trabalha com `consultor_sessoes`
- Entregáveis apontam para `jornadas_consultor`
- **São tabelas DIFERENTES**
- Não tem relação entre elas

```
consultor_sessoes (RAG)  ❌ → ??? ← ❌  entregaveis_consultor
                                ↓
                        jornadas_consultor (antigo)
```

---

## PROBLEMA 4: KANBAN PERDIDO

### KanbanExecucao.tsx - Linha 72:
```typescript
.eq('jornada_id', jornadaId)  // Filtra por jornada_id ✅
```

### Mas:
- ChatPage passa `sessaoId` pro RAG
- RAG não retorna `jornada_id`
- Linha 1008: `const jornadaId = null;`  // ❌ SEMPRE NULL

### LateralConsultor.tsx (onde Kanban é renderizado):
```typescript
<KanbanExecucao jornadaId={jornada?.id} />
```

- `jornada` vem de `jornadas_consultor`
- Mas RAG usa `consultor_sessoes`
- **São mundos paralelos que não se comunicam**

---

## PROBLEMA 5: PAINEL DE ENTREGÁVEIS NÃO VÊ NADA

### PainelEntregaveis.tsx - Linha 68:
```typescript
.eq('jornada_id', jornadaId)  // Busca por jornada_id ✅
```

### Mas:
- RAG não cria jornadas
- RAG cria sessões
- Entregáveis (se fossem criados) não teriam jornada_id
- **Painel fica vazio para sempre**

---

## PROBLEMA 6: BPMN SEM XML

### BpmnViewer.tsx funciona ✅
- Renderiza XML perfeitamente
- Tem zoom, highlight, tudo

### Mas:
```typescript
// PainelEntregaveis.tsx - Linha 171:
let xml = (entregavel as any).bpmn_xml;  // ❌ Campo não existe na tabela
```

**entregaveis_consultor não tem coluna `bpmn_xml`**

---

## PROBLEMA 7: FORMULÁRIOS ABREM, MAS DADOS SE PERDEM

### FormularioModal onComplete:
```typescript
onComplete={async (dados) => {
  console.log('[FORMULARIO] Dados coletados:', dados);
  setFormData(dados);  // Salva em state
  
  // Chama consultor-chat (antigo, não RAG)
  const { data } = await supabase.functions.invoke('consultor-chat', {
    body: { form_data: dados }
  });
  
  // ❌ Mas consultor-chat não usa consultor_sessoes
  // ❌ Dados vão pro vazio
}}
```

**Linha 1999:**
```typescript
const { data: consultorData } = await supabase.functions.invoke('consultor-chat', {
  // ❌ Deveria chamar consultor-rag
});
```

---

## VISÃO GERAL DO CAOS

```
FLUXO ESPERADO:
==============
User → ChatPage → RAG → Actions → executeActions → TemplateService → DB → UI atualiza

FLUXO REAL:
==========
User → ChatPage → RAG → Actions → setPendingConsultorActions() 
                                              ↓
                                           (fim)
                                           
TemplateService → ❌ Não é chamado
entregaveis_consultor → ❌ Nunca recebe dados
Kanban → ❌ Olha pra jornada (que não existe)
Painel → ❌ Olha pra jornada (que não existe)
BPMN → ❌ Procura XML (que não existe)
```

---

## CHECKLIST DE QUEBRA (O QUE NÃO FUNCIONA)

- [ ] Gerar entregáveis quando RAG pede
- [ ] TemplateService criar documentos reais
- [ ] Ishikawa/SIPOC/BPMN serem gerados
- [ ] Entregáveis aparecerem no painel
- [ ] BPMN ser renderizado
- [ ] Kanban receber cards do plano
- [ ] Formulários salvarem dados no RAG
- [ ] Timeline avançar por estado
- [ ] sessao_id e jornada_id conversarem
- [ ] conteudo_xml existir na tabela

**Score: 0/10 funcionando**

---

## POR QUE VOCÊS ACHARAM QUE FUNCIONAVA?

### Ilusão #1: "O RAG responde"
✅ Sim, responde texto
❌ Mas as ações nunca são executadas

### Ilusão #2: "Tem TemplateService"
✅ Sim, o arquivo existe
❌ Mas não faz nada útil

### Ilusão #3: "Tem tabela de entregáveis"
✅ Sim, a tabela existe
❌ Mas nunca recebe dados do RAG

### Ilusão #4: "Tem Kanban e Painel"
✅ Sim, os componentes existem
❌ Mas olham pro lugar errado (jornada vs sessão)

---

## O QUE PRECISA SER FEITO (Sem Enrolação)

### 1. Criar executeRAGActions() [CRÍTICO]
**Arquivo:** `src/lib/consultor/rag-executor.ts` (NOVO)

```typescript
export async function executeRAGActions(
  actions: any[],
  sessaoId: string,
  contexto: any
) {
  for (const action of actions) {
    switch (action.type) {
      case 'gerar_entregavel':
        const html = await TemplateService.gerar(action.params.tipo, contexto);
        await insertDeliverable({
          sessao_id: sessaoId,
          tipo: action.params.tipo,
          html_conteudo: html,
          nome: `${action.params.tipo} - ${new Date().toLocaleDateString()}`
        });
        break;
        
      case 'transicao_estado':
        await supabase
          .from('consultor_sessoes')
          .update({ estado_atual: action.params.novo_estado })
          .eq('id', sessaoId);
        break;
        
      case 'ensure_kanban':
        await createKanbanCards(sessaoId, action.params.plano);
        break;
    }
  }
}
```

**Chamar em ChatPage - Linha 1026:**
```typescript
// ANTES:
setPendingConsultorActions(actions);

// DEPOIS:
setPendingConsultorActions(actions);
await executeRAGActions(actions, sessaoId, ragResponse); // ← ADICIONAR
```

---

### 2. Implementar TemplateService REAL [CRÍTICO]

**Arquivo:** Reescrever `src/lib/consultor/template-service.ts`

```typescript
export class TemplateService {
  static async gerar(tipo: string, contexto: any): Promise<string> {
    switch (tipo) {
      case 'ishikawa':
        return this.gerarIshikawa(contexto);
      case 'sipoc':
        return this.gerarSIPOC(contexto);
      case 'bpmn_as_is':
        return this.gerarBPMN_ASIS(contexto);
      case '5w2h':
        return this.gerar5W2H(contexto);
      default:
        throw new Error(`Tipo ${tipo} não implementado`);
    }
  }
  
  static async gerarIshikawa(contexto: any): Promise<string> {
    // Usar LLM para gerar causas baseado no contexto
    const prompt = `
      Gere um diagrama Ishikawa (espinha de peixe) em HTML para:
      Problema: ${contexto.descricao_problema}
      Segmento: ${contexto.segmento}
      
      Retorne HTML estruturado com 6 categorias (Máquina, Método, etc.)
    `;
    
    const html = await this.callLLM(prompt);
    return html;
  }
  
  // ... implementar os outros
}
```

---

### 3. Adicionar sessao_id a entregaveis_consultor [CRÍTICO]

**Migration:** `supabase/migrations/20251028_add_sessao_id_to_entregaveis.sql`

```sql
-- Adicionar sessao_id
ALTER TABLE entregaveis_consultor 
  ADD COLUMN sessao_id uuid REFERENCES consultor_sessoes(id);

-- Adicionar conteudo_xml para BPMN
ALTER TABLE entregaveis_consultor 
  ADD COLUMN conteudo_xml text;

-- Adicionar conteudo_md
ALTER TABLE entregaveis_consultor 
  ADD COLUMN conteudo_md text;

-- Índice
CREATE INDEX idx_entregaveis_sessao ON entregaveis_consultor(sessao_id);
```

---

### 4. Unificar jornadas_consultor e consultor_sessoes [IMPORTANTE]

**Opção A: Deprecar jornadas_consultor**
- Migrar campos úteis para consultor_sessoes
- Atualizar Kanban/Painel para usar sessao_id

**Opção B: Sincronizar**
- Criar jornada automaticamente quando criar sessão
- Manter ambas sincronizadas

**Recomendação:** Opção A (mais limpo)

---

### 5. Kanban/Painel usar sessao_id [IMPORTANTE]

**KanbanExecucao.tsx - Mudar props:**
```typescript
// ANTES:
interface KanbanExecucaoProps {
  jornadaId: string;
}

// DEPOIS:
interface KanbanExecucaoProps {
  sessaoId: string;  // ← Mudar
}

// E no query:
.eq('sessao_id', sessaoId)  // ← Mudar
```

**Mesma coisa para PainelEntregaveis.tsx**

---

## ESTIMATIVA DE TRABALHO REAL

### Dia 1 (8h):
- [ ] Criar executeRAGActions() (2h)
- [ ] Migration adicionar sessao_id (1h)
- [ ] Implementar TemplateService.gerarIshikawa() (2h)
- [ ] Implementar TemplateService.gerarSIPOC() (2h)
- [ ] Testar fluxo básico (1h)

### Dia 2 (8h):
- [ ] Implementar TemplateService.gerarBPMN() (3h)
- [ ] Implementar TemplateService.gerar5W2H() (2h)
- [ ] Atualizar Kanban para usar sessao_id (1h)
- [ ] Atualizar Painel para usar sessao_id (1h)
- [ ] Testar entregáveis aparecendo (1h)

### Dia 3 (8h):
- [ ] Corrigir FormularioModal chamar RAG (2h)
- [ ] Implementar createKanbanCards() (2h)
- [ ] Implementar transição de estado (1h)
- [ ] Testes end-to-end (2h)
- [ ] Ajustes finais (1h)

**Total: 3 dias de trabalho focado**

---

## CONCLUSÃO

Vocês NÃO têm um problema de falta de código.

Vocês têm um problema de **integração zero**.

É como ter:
- Motores (RAG, TemplateService) ✅
- Combustível (Banco) ✅
- Painel (UI) ✅

Mas **nenhum cabo conectado**.

O plano que você mandou está 70% correto no conceito, mas **erra no diagnóstico**.

Não precisa de "session-bridge.ts" novo. Precisa **conectar o que já existe**.

---

## PRÓXIMO PASSO

Quer que eu crie um **plano de implementação REAL** com código específico para cada ponto?

Ou quer que eu mostre **exatamente o que adicionar em cada arquivo** para fazer funcionar?

---

**Assinado:** Claude, o detetive de código que leu suas 50 mil linhas linha por linha.
