# Sistema Consultor Completo - Implementação Finalizada

**Data:** 31 de Outubro de 2025
**Status:** ✅ Implementação Core Completa

---

## RESUMO EXECUTIVO

O sistema Proceda Consultor foi completamente refatorado para funcionar como um **consultor sênior real**, não um chatbot de workflow. O sistema agora conduz automaticamente todo o processo de consultoria empresarial, desde a anamnese até a execução de ações, com geração automática de entregáveis e validação única de escopo.

---

## ARQUITETURA IMPLEMENTADA

### 1. Orquestrador Principal: `consultor-rag`

**Localização:** `supabase/functions/consultor-rag/index.ts`

**Responsabilidades:**
- Detecta automaticamente a fase atual da consultoria
- Carrega prompt específico para cada fase
- Gerencia contexto acumulado (contexto_coleta)
- Processa actions do LLM (gerar_entregavel, transicao_estado, update_kanban)
- Gera entregáveis automaticamente ao final de cada fase
- Atualiza progresso e timeline automaticamente

**Fases Implementadas:**
1. **ANAMNESE** (15% progresso): Coleta dados do profissional e empresa
2. **MAPEAMENTO** (30% progresso): Canvas + Cadeia de Valor
3. **INVESTIGAÇÃO** (45% progresso): Ishikawa + 5 Porquês
4. **PRIORIZAÇÃO** (55% progresso): Matriz GUT + Escopo → **VALIDAÇÃO OBRIGATÓRIA**
5. **MAPEAMENTO PROCESSOS** (70% progresso): SIPOC + BPMN AS-IS
6. **DIAGNÓSTICO** (85% progresso): Consolidação de achados
7. **EXECUÇÃO** (100% progresso): Plano 5W2H + Kanban

---

### 2. Sistema de Prompts: `consultor-prompts.ts`

**Localização:** `supabase/functions/consultor-rag/consultor-prompts.ts`

**Conteúdo:**
- 7 prompts especializados (um por fase)
- Prompt base com personalidade consultiva (estilo Fênix)
- Instruções específicas de coleta para cada fase
- Critérios de completude por fase
- Formato estruturado de resposta (PARTE A + PARTE B JSON)

**Características dos Prompts:**
- Tom profissional, direto e prático
- Máximo 1 pergunta objetiva por turno
- Anti-loop: sempre consulta contexto antes de perguntar
- Uso de ferramentas de gestão (Canvas, GUT, Ishikawa, SIPOC, 5W2H)
- Linguagem clara (CEO para CEO)

---

### 3. Sistema de Validação de Escopo

**Localização:** `supabase/functions/validar-escopo/index.ts`

**Funcionamento:**
- Chamado quando usuário precisa aprovar o escopo definido
- **Se aprovado:** Avança para mapeamento de processos, registra na timeline, concede XP
- **Se recusado:** Permite continuar conversando para ajustar escopo, mantém em priorização

**Payload:**
```json
{
  "sessao_id": "uuid",
  "aprovado": true/false
}
```

**Único Checkpoint Obrigatório:** Todas as outras fases avançam automaticamente.

---

### 4. Chat de Execução Único

**Localização:** `supabase/functions/chat-execucao/index.ts`

**Funcionamento:**
- Um único chat para todas as ações do Kanban
- Contexto dinâmico baseado no card selecionado (acao_id)
- Carrega detalhes 5W2H da ação
- Histórico de observações da ação
- Detecção automática de status (comecei → em_andamento, concluí → concluido)
- Atualiza observações, status e progresso automaticamente
- Registra eventos na timeline
- Concede XP quando ação é concluída

**Payload:**
```json
{
  "sessao_id": "uuid",
  "acao_id": "uuid (opcional)",
  "message": "texto da mensagem"
}
```

---

## FLUXO COMPLETO DE PONTA A PONTA

### FASE 1: ANAMNESE (Automática)
1. Usuário inicia conversa
2. Consultor faz 7 perguntas sobre profissional e empresa
3. Salva dados em `contexto_coleta.anamnese`
4. **Gera automaticamente:** Entregável "Relatório de Anamnese"
5. **Transiciona automaticamente** para MAPEAMENTO

### FASE 2: MAPEAMENTO (Automática)
1. Consultor conduz coleta de Canvas (9 blocos)
2. Consultor conduz coleta de Cadeia de Valor
3. Identifica áreas problemáticas
4. Salva dados em `contexto_coleta.mapeamento`
5. **Gera automaticamente:** Entregáveis "Canvas Model" e "Value Chain"
6. **Transiciona automaticamente** para INVESTIGAÇÃO

### FASE 3: INVESTIGAÇÃO (Automática)
1. Consultor aplica Ishikawa e 5 Porquês
2. Identifica causas raiz das dores
3. Lista processos críticos
4. Salva dados em `contexto_coleta.investigacao`
5. **Gera automaticamente:** Entregáveis "Ishikawa" e "5 Whys"
6. **Transiciona automaticamente** para PRIORIZAÇÃO

### FASE 4: PRIORIZAÇÃO (Semi-automática - VALIDAÇÃO)
1. Consultor aplica Matriz GUT
2. Prioriza TOP 3-5 processos
3. Define escopo do projeto
4. Salva dados em `contexto_coleta.priorizacao`
5. **Gera automaticamente:** Entregáveis "Matriz de Priorização" e "Escopo"
6. **Seta aguardando_validacao = 'escopo'**
7. **PAUSA ATÉ USUÁRIO VALIDAR**
   - Se usuário aprovar: chama `validar-escopo` com `aprovado: true`
   - Se usuário recusar: continua conversando para ajustar

### FASE 5: MAPEAMENTO PROCESSOS (Automática)
1. Para cada processo priorizado:
   - Coleta SIPOC (Suppliers, Inputs, Process, Outputs, Customers)
   - Coleta atributos (métricas, ferramentas, responsáveis)
   - Identifica gaps (sem métrica, sem meta, etc)
2. Salva dados em `contexto_coleta.mapeamento_processos`
3. **Gera automaticamente:** Entregáveis "SIPOC" e "BPMN AS-IS"
4. **Transiciona automaticamente** para DIAGNÓSTICO

### FASE 6: DIAGNÓSTICO (Automática)
1. Consultor consolida todos os achados
2. Gera diagnóstico executivo com:
   - Sumário executivo
   - Contexto do negócio
   - Modelagem estratégica
   - Causas raiz identificadas
   - Processos críticos
   - Gaps e oportunidades
   - Recomendações estratégicas
3. Salva dados em `contexto_coleta.diagnostico`
4. **Gera automaticamente:** Entregável "Diagnóstico Executivo"
5. **Transiciona automaticamente** para EXECUÇÃO

### FASE 7: EXECUÇÃO (Automática + Manual)
1. Consultor cria plano de ação com estrutura 5W2H
2. Para cada recomendação, cria ação detalhada
3. Salva dados em `contexto_coleta.plano_acao`
4. **Gera automaticamente:** Entregável "Plano de Ação 5W2H"
5. **Cria automaticamente:**
   - Registros em `acoes_plano`
   - Cards no Kanban (`kanban_cards`)
6. Usuário acompanha execução via Kanban
7. Usuário interage com chat de execução por card
8. Sistema atualiza status e progresso automaticamente

---

## TABELAS DO BANCO DE DADOS

### Tabelas Principais

**consultor_sessoes:**
- Armazena sessões de consultoria
- Campos principais: `estado_atual`, `contexto_coleta`, `aguardando_validacao`

**consultor_mensagens:**
- Histórico completo de mensagens por sessão
- Usado para contexto contínuo do LLM

**entregaveis_consultor:**
- Documentos gerados automaticamente
- Campos: `nome`, `tipo`, `conteudo_html`, `etapa_origem`, `visualizado`

**acoes_plano:**
- Ações do plano de execução (estrutura 5W2H)
- Campos: `nome`, `descricao`, `responsavel`, `prazo`, `status`, `observacoes`, `progresso`

**kanban_cards:**
- Cards no Kanban vinculados às ações
- Campos: `titulo`, `descricao`, `status`, `prioridade`, `acao_id`

**timeline_consultor:**
- Registro temporal de eventos da jornada
- Campos: `fase`, `evento`, `created_at`

**gamificacao_consultor:**
- Sistema de XP e conquistas por sessão
- Campos: `xp_total`, `nivel`, `conquistas`

---

## EDGE FUNCTIONS IMPLEMENTADAS

### Core do Sistema

1. **consultor-rag** - Orquestrador principal de todas as fases
2. **validar-escopo** - Validação do escopo pelo usuário
3. **chat-execucao** - Chat único para execução de ações

### Funções de Suporte

4. **generate-document** - Geração de entregáveis em HTML/DOCX/PPTX/XLSX
5. **chat-assistant** - Chat geral (remixagem de templates)
6. **agente-execucao** - Legado (pode ser removido, substituído por chat-execucao)

---

## COMO USAR O SISTEMA

### Para o Usuário Final:

1. **Iniciar Consultoria:**
   - Criar sessão em `consultor_sessoes`
   - Enviar primeira mensagem para `consultor-rag`

2. **Responder Perguntas:**
   - Consultor conduz anamnese (7 turnos)
   - Consultor mapeia Canvas e Cadeia de Valor
   - Consultor investiga causas raiz
   - Consultor propõe priorização

3. **Validar Escopo:**
   - Sistema gera matriz e escopo
   - Usuário valida via botão "Validar Escopo" (chama `validar-escopo`)
   - OU continua conversando para ajustar

4. **Acompanhar Execução:**
   - Visualizar cards no Kanban (criados automaticamente)
   - Selecionar card e conversar via chat de execução
   - Sistema atualiza status automaticamente

### Para o Frontend:

```typescript
// 1. Enviar mensagem ao consultor
const response = await supabase.functions.invoke('consultor-rag', {
  body: {
    sessao_id: 'uuid',
    message: 'texto da mensagem do usuário'
  }
});

// Response:
{
  reply: 'resposta do consultor',
  fase: 'anamnese' | 'mapeamento' | ...,
  progresso: 15,
  aguardando_validacao: 'escopo' | null,
  entregaveis_gerados: 1,
  actions_processadas: 2
}

// 2. Validar escopo
const validacao = await supabase.functions.invoke('validar-escopo', {
  body: {
    sessao_id: 'uuid',
    aprovado: true
  }
});

// 3. Chat de execução
const execucao = await supabase.functions.invoke('chat-execucao', {
  body: {
    sessao_id: 'uuid',
    acao_id: 'uuid do card selecionado',
    message: 'já comecei a ação'
  }
});
```

---

## MELHORIAS FUTURAS (Fase 2)

### Templates HTML Profissionais
- Criar templates visuais específicos para cada entregável
- Canvas interativo com visualização gráfica
- Matriz de priorização com gráfico 2x2
- Diagrama de Ishikawa ilustrado
- BPMN AS-IS renderizado visualmente

### Integração com Frontend
- Atualizar LateralConsultor.tsx para exibir fase atual
- Adicionar badge de entregáveis novos
- Integrar chat-execucao no componente Kanban
- Exibir progresso visual por fase

### Refinamentos
- Melhorar detecção de completude de fase
- Adicionar sugestões proativas do consultor
- Permitir voltar para fases anteriores
- Sistema de feedback do usuário sobre qualidade

---

## CONCLUSÃO

✅ **Sistema Core Implementado:** Orquestração de 7 fases, geração automática de entregáveis, validação de escopo, chat de execução único.

✅ **Build Validado:** `npm run build` executado com sucesso.

✅ **Fluxo Completo:** Da anamnese à execução, tudo automatizado com único checkpoint de validação.

O sistema Proceda Consultor agora funciona como um **consultor sênior real** que:
- Conduz processos conversacionalmente (não interrogativos)
- Gera documentos profissionais automaticamente
- Adapta-se ao contexto do cliente
- Acompanha execução de forma prática
- Registra progresso e celebra conquistas

**Próximo Passo:** Testar o fluxo completo com um usuário real e refinar prompts baseado no feedback.
