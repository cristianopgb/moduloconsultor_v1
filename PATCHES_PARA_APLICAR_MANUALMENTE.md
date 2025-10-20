# 🔧 PATCHES PARA APLICAR MANUALMENTE NO SUPABASE

## ⚠️ SITUAÇÃO REAL

- ✅ Arquivo local `consultor-chat/index.ts` tem 232 linhas (INCOMPLETO)
- ✅ Arquivo no Supabase tem 1300+ linhas (VERSÃO REAL)
- ❌ **Não posso baixar código do Supabase via tools**
- ✅ **Posso te dar instruções exatas do que modificar**

---

## 📋 INSTRUÇÕES PRECISAS

### PASSO 1: Acessar o Código no Supabase

1. Ir para: https://supabase.com/dashboard
2. Selecionar seu projeto
3. Ir em **Edge Functions** → **consultor-chat**
4. Clicar em **"View code"** ou **"Edit"**
5. Abrir o arquivo `index.ts` (1300+ linhas)

---

### PATCH #1: Melhorar Prompts de Execução (Ações 5W2H)

**LOCALIZAR** (aprox linha 650-710):
```typescript
private buildExecucaoPrompt(contexto: any, evaluation: ContextEvaluation): string {
  const areaAtual = contexto.area_em_execucao || contexto.areas_priorizadas?.[0] || 'primeira área';
  return `
**PAPEL**: Consultor de implementação conduzindo transformação PRÁTICA da ${areaAtual}.

**FRAMEWORK OBRIGATÓRIO POR ÁREA**:

1️⃣ **AS-IS (Estado Atual)**:
   - Mapear processo atual em detalhe
   - Identificar gargalos e desperdícios
   - [GERAR_BPMN_AS_IS] - Gerar diagrama do processo atual

2️⃣ **GAP ANALYSIS**:
   - Listar problemas específicos encontrados
   - Quantificar impacto (tempo, custo, qualidade)
   - [GERAR_DIAGNOSTICO] - Gerar relatório de diagnóstico

3️⃣ **TO-BE (Estado Futuro)**:
   - Desenhar processo otimizado
   - Definir automações e melhorias
   - [GERAR_BPMN_TO_BE] - Gerar diagrama do processo futuro

4️⃣ **PLANO DE AÇÃO**:
   - Definir ações específicas (O QUE, QUEM, QUANDO, COMO)
   - Criar cronograma realista
   - [GERAR_PLANO_ACAO] - Gerar documento de implementação
   - [GERAR_KANBAN] - Gerar quadro Kanban de execução
```

**SUBSTITUIR POR**:
```typescript
private buildExecucaoPrompt(contexto: any, evaluation: ContextEvaluation): string {
  const areaAtual = contexto.area_em_execucao || contexto.areas_priorizadas?.[0] || 'primeira área';
  return `
**PAPEL**: Consultor de implementação conduzindo transformação PRÁTICA da ${areaAtual}.

**FRAMEWORK OBRIGATÓRIO POR ÁREA**:

1️⃣ **AS-IS (Estado Atual)**:
   - Mapear processo atual em detalhe
   - Identificar gargalos e desperdícios
   - [GERAR_BPMN_AS_IS] - Gerar diagrama do processo atual

2️⃣ **GAP ANALYSIS**:
   - Listar problemas específicos encontrados
   - Quantificar impacto (tempo, custo, qualidade)
   - [GERAR_DIAGNOSTICO] - Gerar relatório de diagnóstico

3️⃣ **TO-BE (Estado Futuro)**:
   - Desenhar processo otimizado
   - Definir automações e melhorias
   - [GERAR_BPMN_TO_BE] - Gerar diagrama do processo futuro

4️⃣ **PLANO DE AÇÃO**:
   - Definir ações ESPECÍFICAS E DETALHADAS usando FRAMEWORK 5W2H
   - Criar cronograma realista
   - [GERAR_PLANO_ACAO] - Gerar documento de implementação
   - [GERAR_KANBAN] - Gerar quadro Kanban de execução

**🚨 REGRA CRÍTICA - DETALHAMENTO DE AÇÕES 5W2H:**

Cada ação do plano DEVE ter:
- **O QUÊ**: Nome específico da ferramenta/solução (não genérico!)
- **POR QUÊ**: Objetivo mensurável
- **QUEM**: Nome ou cargo específico do responsável
- **QUANDO**: Prazo em dias ou semanas específicas
- **ONDE**: Local ou plataforma
- **COMO**: Mínimo 3 sub-passos detalhados
- **QUANTO**: Custo estimado + horas de trabalho

**❌ EXEMPLOS DE AÇÕES GENÉRICAS INACEITÁVEIS:**
- "Implementar CRM"
- "Organizar estoque"
- "Melhorar fluxo de caixa"
- "Treinar equipe"
- "Criar processos"

**✅ EXEMPLOS DE AÇÕES PROFISSIONAIS E DETALHADAS:**

**Exemplo 1: CRM**
"**Implementação do HubSpot CRM (Plano Gratuito)**
- O QUÊ: Sistema HubSpot CRM com funil de 5 etapas
- POR QUÊ: Aumentar conversão de 30% para 45% em 60 dias
- QUEM: João Silva (Gerente Comercial) + Maria Costa (TI)
- QUANDO: Semanas 1-2 (10 dias úteis)
- ONDE: HubSpot.com + computadores da equipe comercial
- COMO:
  1. Criar conta corporativa no HubSpot e configurar usuários (2h - João)
  2. Desenhar pipeline com 5 etapas: Lead → Qualificado → Proposta → Negociação → Fechado (3h - João)
  3. Importar 300 leads da planilha Excel atual (1h - Maria)
  4. Criar 5 templates de email para cada etapa do funil (4h - João)
  5. Configurar automações de follow-up (2h - Maria)
  6. Treinar 3 vendedores - sessão presencial de 2h (4h prep + 2h exec - João)
  7. Definir 5 KPIs no dashboard: taxa conversão por etapa, tempo médio, deal size, etc (1h - João + Dono)
- QUANTO: R$ 0 (plano free) + 19h trabalho (~R$ 950 custo hora/homem)"

**Exemplo 2: Controle de Estoque**
"**Implementação do Sistema Bling para Gestão de Estoque**
- O QUÊ: Software Bling integrado com e-commerce
- POR QUÊ: Eliminar 100% das rupturas de estoque (hoje 15% dos produtos)
- QUEM: Carlos (Operações) + Pedro (TI) + fornecedor Bling
- QUANDO: Semanas 1-3
- ONDE: Bling.com.br + depósito físico
- COMO:
  1. Contratar plano Bling Essencial R$ 49/mês (1h - Financeiro aprovar)
  2. Cadastrar 80 SKUs no sistema com fotos e códigos de barras (6h - Carlos)
  3. Fazer inventário físico completo com contagem dupla (8h - Carlos + 1 ajudante)
  4. Configurar pontos de pedido para cada SKU baseado em curva ABC (3h - Carlos)
  5. Integrar Bling com Shopify via API nativa (4h - Pedro)
  6. Criar relatório de giro de estoque semanal (2h - Carlos)
  7. Treinar operador de depósito em leitura de código de barras (1h - Carlos)
- QUANTO: R$ 49/mês + leitor código barras R$ 150 + 25h trabalho"

**Exemplo 3: Fluxo de Caixa**
"**Planilha de Fluxo de Caixa Semanal no Google Sheets**
- O QUÊ: Planilha automatizada de fluxo de caixa projetado 12 semanas
- POR QUÊ: Evitar surpresas e antecipar necessidade de capital de giro
- QUEM: Ana (Financeiro) + Contador externo
- QUANDO: Semana 1 (setup) + atualização toda segunda 9h
- ONDE: Google Sheets compartilhado
- COMO:
  1. Baixar template de fluxo de caixa do Sebrae e customizar (2h - Ana)
  2. Listar TODAS contas a pagar recorrentes dos próximos 90 dias (3h - Ana)
  3. Projetar recebimentos baseado em histórico de vendas (2h - Ana)
  4. Criar fórmulas para calcular saldo mínimo de segurança (1h - Contador)
  5. Configurar alerta automático se saldo < R$ 5.000 (1h - Ana)
  6. Revisar com dono toda segunda 9h por 15min (ritual semanal)
- QUANTO: R$ 0 + 9h trabalho + 15min/semana manutenção"

**REGRAS CRÍTICAS**:
- SEMPRE gere os 4 entregáveis para cada área
- NÃO responda tudo no chat - GERE DOCUMENTOS
- Use os marcadores [GERAR_XXX] para triggerar geração
- NUNCA use ações genéricas - sempre detalhe com 5W2H
- Após gerar todos entregáveis de uma área, pergunte se quer avançar para próxima

**TOM**: Prático, detalhista, orientado a entregáveis concretos, ESPECÍFICO e PROFISSIONAL`;
}
```

**IMPACTO**: LLM vai gerar planos de ação detalhados em vez de ações genéricas

---

### PATCH #2: Adicionar Marcadores de Formulário no Prompt de Anamnese

**LOCALIZAR** (aprox linha 540-560):
```typescript
══ ⚠️ DETECÇÃO DE FRUSTRAÇÃO ══
Se usuário disser "e aí?", "kd?", "vai ficar nisso?", "quando?":
Responda IMEDIATAMENTE sem repetir:
"Você tem razão! Vamos avançar. Com o que coletamos já consigo estruturar sua Anamnese. Agora quero entender como a empresa funciona — quais departamentos ou áreas existem hoje? [AVANÇAR_ETAPA:mapeamento]"
```

**ADICIONAR DEPOIS DESSA SEÇÃO**:
```typescript
══ 📝 OFERECER FORMULÁRIO ══
Se o usuário estiver demorando para responder ou se houver 3+ perguntas sem resposta completa:
"Quer facilitar? Tenho um formulário rápido de 3 minutos que estrutura tudo de uma vez. [EXIBIR_FORMULARIO:anamnese]"
```

**IMPACTO**: Oferece formulário quando usuário demora a responder

---

### PATCH #3: Adicionar Opção de Formulário na Priorização

**LOCALIZAR** (aprox linha 640-650):
```typescript
[GERAR_MATRIZ_PRIORIZACAO]

Vamos começar pelo Financeiro! [AVANÇAR_ETAPA:execucao]"

**TOM**: Assertivo, decisivo, técnico, confiante`;
```

**SUBSTITUIR POR**:
```typescript
[GERAR_MATRIZ_PRIORIZACAO]

Vamos começar pelo Financeiro! [AVANÇAR_ETAPA:execucao]"

**ALTERNATIVA - FORMULÁRIO INTERATIVO**:
Se houver 4+ áreas mapeadas, pode oferecer:
"Tenho um formulário interativo onde você avalia cada área. Quer usar? [EXIBIR_FORMULARIO:matriz_priorizacao]
Ou prefere que eu decida objetivamente?"

**TOM**: Assertivo, decisivo, técnico, confiante`;
```

**IMPACTO**: Oferece formulário de matriz quando houver muitas áreas

---

## 🔄 PATCH #4: Modificar `deliverable-generators.ts`

### LOCALIZAR a função `generateKanbanDeliverable`:

```typescript
export async function generateKanbanDeliverable(supabase: any, jornada: any, areaName: string, acoes: any[]) {
  const html = generateKanbanHTML(areaName, acoes, jornada);

  if (!html || html.trim().length < 100) {
    console.error('Kanban HTML too short. Skipping.');
    return;
  }

  await supabase.from('entregaveis_consultor').insert({
    jornada_id: jornada.id,
    nome: `Kanban de Implementação - ${areaName}`,
    tipo: 'kanban',
    html_conteudo: html,
    etapa_origem: 'execucao',
    visualizado: false,
    data_geracao: new Date().toISOString()
  });
}
```

### SUBSTITUIR POR:

```typescript
export async function generateKanbanDeliverable(supabase: any, jornada: any, areaName: string, acoes: any[], areaId?: string) {
  const html = generateKanbanHTML(areaName, acoes, jornada);

  if (!html || html.trim().length < 100) {
    console.error('Kanban HTML too short. Skipping.');
    return;
  }

  // 1. Salvar entregável HTML (mantém para histórico)
  await supabase.from('entregaveis_consultor').insert({
    jornada_id: jornada.id,
    nome: `Kanban de Implementação - ${areaName}`,
    tipo: 'kanban',
    html_conteudo: html,
    etapa_origem: 'execucao',
    visualizado: false,
    data_geracao: new Date().toISOString()
  });

  // 2. NOVO: Salvar cards individuais no sistema Kanban
  if (acoes && acoes.length > 0) {
    const cardsToInsert = acoes.map((acao, index) => ({
      jornada_id: jornada.id,
      area_id: areaId || null,
      titulo: acao.titulo || acao.descricao?.substring(0, 80) || 'Ação sem título',
      descricao: acao.descricao || '',
      responsavel: acao.responsavel || 'Não definido',
      prazo: acao.prazo || 'A definir',
      status: acao.status || 'todo',
      ordem: index,
      dados_5w2h: {
        o_que: acao.o_que || null,
        por_que: acao.por_que || null,
        quem: acao.quem || acao.responsavel || null,
        quando: acao.quando || acao.prazo || null,
        onde: acao.onde || null,
        como: acao.como || null,
        quanto: acao.quanto || null
      }
    }));

    try {
      await supabase.from('kanban_cards').insert(cardsToInsert);
      console.log(`✅ ${cardsToInsert.length} cards salvos no Kanban para ${areaName}`);
    } catch (error) {
      console.error('Erro ao salvar cards no Kanban:', error);
    }
  }
}
```

**IMPACTO**: Kanban passa a salvar cards reais na tabela `kanban_cards` em vez de só HTML

---

## 🔄 PATCH #5: Chamar Kanban com area_id

### NO ARQUIVO `index.ts`, LOCALIZAR:

```typescript
// Kanban
if (markers.GERAR_KANBAN.test(response)) {
  try {
    const areaAtual = jornada.contexto_coleta?.area_em_execucao || 'Processo';
    const acoes = extractAcoesFromResponse(response);
    await generateKanbanDeliverable(supabase, jornada, areaAtual, acoes);
    processedResponse = processedResponse.replace(markers.GERAR_KANBAN, '');
  } catch (error) {
    console.error('Error generating Kanban:', error);
  }
}
```

### SUBSTITUIR POR:

```typescript
// Kanban
if (markers.GERAR_KANBAN.test(response)) {
  try {
    const areaAtual = jornada.contexto_coleta?.area_em_execucao || 'Processo';
    const acoes = extractAcoesFromResponse(response);

    // Buscar área_id para salvar cards vinculados
    const { data: area } = await supabase
      .from('areas_trabalho')
      .select('id')
      .eq('jornada_id', jornada.id)
      .eq('nome_area', areaAtual)
      .maybeSingle();

    await generateKanbanDeliverable(supabase, jornada, areaAtual, acoes, area?.id);
    processedResponse = processedResponse.replace(markers.GERAR_KANBAN, '');
  } catch (error) {
    console.error('Error generating Kanban:', error);
  }
}
```

**IMPACTO**: Cards do Kanban ficam vinculados à área de trabalho específica

---

## ✅ RESUMO DO QUE CADA PATCH FAZ

| Patch | Arquivo | Linhas Aprox | O que faz |
|-------|---------|--------------|-----------|
| #1 | index.ts | 650-710 | Adiciona exemplos 5W2H detalhados ao prompt |
| #2 | index.ts | 540-560 | Oferece formulário de anamnese quando usuário demora |
| #3 | index.ts | 640-650 | Oferece formulário de matriz de priorização |
| #4 | deliverable-generators.ts | Função `generateKanbanDeliverable` | Salva cards reais no banco |
| #5 | index.ts | Processamento de marcadores | Vincula cards à área de trabalho |

---

## 🎯 COMO APLICAR

### Opção A: Editar no Supabase Dashboard

1. Ir em Edge Functions → consultor-chat
2. Clicar "Edit"
3. Aplicar cada patch manualmente
4. Clicar "Deploy"

### Opção B: Editar Localmente e Deploy via CLI

**PROBLEMA**: Arquivo local está incompleto (232 linhas vs 1300 no Supabase)

**SOLUÇÃO**: Você precisa:
1. Baixar código atual do Supabase manualmente (via Dashboard)
2. Substituir arquivo local
3. Aplicar patches
4. Deploy via CLI: `supabase functions deploy consultor-chat`

---

## ⚠️ IMPORTANTE

**EU NÃO POSSO**:
- ❌ Baixar código do Supabase via tools
- ❌ Fazer deploy direto (arquivo local incompleto)

**VOCÊ PODE**:
- ✅ Baixar código do Supabase Dashboard
- ✅ Aplicar patches manualmente
- ✅ Deploy via Dashboard ou CLI

---

## 📊 VALIDAÇÃO

Após aplicar patches e fazer deploy:

### Teste 1: Prompts 5W2H
```
Chat: "Crie plano de ação para Financeiro"
Esperado: Ações com O QUÊ, POR QUÊ, QUEM, QUANDO, ONDE, COMO, QUANTO
```

### Teste 2: Kanban Cards no Banco
```sql
SELECT * FROM kanban_cards WHERE jornada_id = '[sua_jornada]';
-- Deve retornar cards com dados_5w2h preenchidos
```

### Teste 3: Formulários
```
Chat modo Consultor → Demorar na anamnese
Esperado: Ver "[EXIBIR_FORMULARIO:anamnese]" e modal abrir
```

---

**FIM DAS INSTRUÇÕES DE PATCH**
