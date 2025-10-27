-- Seed Knowledge Base with Essential BPM Methodologies
-- This script populates the knowledge_base_documents table with foundational
-- consulting methodologies that the RAG system will use to provide context-aware advice

-- SIPOC (Suppliers, Inputs, Process, Outputs, Customers)
INSERT INTO knowledge_base_documents (
  title,
  category,
  content,
  tags,
  aplicabilidade,
  metadados,
  ativo,
  versao
) VALUES (
  'SIPOC - Mapeamento de Processos',
  'metodologia',
  '# SIPOC - Suppliers, Inputs, Process, Outputs, Customers

## O que é
SIPOC é uma ferramenta visual de alto nível para mapear processos de negócio, identificando os elementos fundamentais de qualquer processo.

## Quando usar
- Início de projetos de melhoria de processos
- Para obter visão macro antes de detalhamentos
- Quando a equipe precisa alinhar entendimento sobre um processo
- Como primeira etapa antes de modelagens detalhadas (BPMN)

## Componentes

### Suppliers (Fornecedores)
Quem fornece os recursos necessários para o processo. Podem ser:
- Fornecedores externos
- Departamentos internos
- Sistemas
- Clientes (em alguns casos)

### Inputs (Entradas)
O que é necessário para executar o processo:
- Materiais
- Informações
- Recursos humanos
- Requisitos
- Dados

### Process (Processo)
As atividades principais executadas. Devem ser:
- 4 a 7 etapas de alto nível
- Iniciadas por verbo de ação
- Sequenciais
- Compreensíveis por todos

### Outputs (Saídas)
O que o processo produz:
- Produtos
- Serviços
- Documentos
- Relatórios
- Decisões

### Customers (Clientes)
Quem recebe e utiliza as saídas:
- Clientes externos
- Departamentos internos
- Próximo processo na cadeia
- Stakeholders

## Como aplicar

1. **Defina o processo**: Nome claro e delimitação de início/fim
2. **Identifique as saídas (Outputs)**: O que o processo entrega?
3. **Identifique os clientes (Customers)**: Quem recebe estas saídas?
4. **Mapeie o processo**: 4-7 etapas de alto nível
5. **Identifique as entradas (Inputs)**: O que é necessário?
6. **Identifique os fornecedores (Suppliers)**: Quem provê as entradas?

## Benefícios
- Visão holística do processo
- Alinhamento rápido da equipe
- Identificação de gaps
- Base para melhorias
- Comunicação eficaz com stakeholders

## Quando NÃO usar
- Para processos muito simples (menos de 3 etapas)
- Quando é necessário detalhamento profundo desde o início
- Em processos extremamente complexos sem decomposição prévia

## Exemplos de aplicação
- Processos de vendas
- Processos de produção
- Processos administrativos
- Processos de atendimento ao cliente
- Processos de desenvolvimento de produtos',
  ARRAY['sipoc', 'mapeamento', 'processos', 'bpm', 'alto-nivel', 'diagnostico'],
  jsonb_build_object(
    'problemas', ARRAY['falta de clareza sobre processos', 'processos confusos', 'necessidade de visão macro', 'início de projeto bpm'],
    'contextos', ARRAY['qualquer porte', 'qualquer segmento', 'inicio de projetos', 'diagnóstico inicial'],
    'nivel_maturidade', ARRAY['iniciante', 'intermediario'],
    'tempo_aplicacao', '30-60 minutos'
  ),
  jsonb_build_object(
    'fonte', 'BPM CBOK',
    'complexidade', 'baixa',
    'prerequisitos', ARRAY['conhecimento básico do processo']
  ),
  true,
  1
);

-- Business Model Canvas
INSERT INTO knowledge_base_documents (
  title,
  category,
  content,
  tags,
  aplicabilidade,
  metadados,
  ativo,
  versao
) VALUES (
  'Business Model Canvas',
  'framework',
  '# Business Model Canvas

## O que é
Ferramenta estratégica visual para desenvolver, documentar e analisar modelos de negócio. Permite visualizar como uma empresa cria, entrega e captura valor.

## Quando usar
- Startups definindo modelo de negócio
- Empresas estabelecidas revisando estratégia
- Novos produtos ou serviços
- Análise de concorrentes
- Planejamento estratégico
- Pivotagem de negócio

## Os 9 Blocos

### 1. Segmentos de Clientes (Customer Segments)
Para quem criamos valor? Quem são nossos clientes mais importantes?
- Massa
- Nicho
- Segmentado
- Diversificado
- Multi-sided platforms

### 2. Proposta de Valor (Value Propositions)
Que valor entregamos ao cliente? Qual problema estamos resolvendo?
- Novidade
- Performance
- Customização
- Design
- Status
- Preço
- Redução de custo
- Redução de risco
- Acessibilidade
- Conveniência

### 3. Canais (Channels)
Por quais canais nossos clientes querem ser alcançados?
- Conscientização
- Avaliação
- Compra
- Entrega
- Pós-venda

Tipos: Diretos vs Indiretos, Próprios vs Parceiros

### 4. Relacionamento com Clientes (Customer Relationships)
Que tipo de relacionamento cada segmento espera?
- Assistência pessoal
- Assistência pessoal dedicada
- Self-service
- Serviços automatizados
- Comunidades
- Co-criação

### 5. Fontes de Receita (Revenue Streams)
Por qual valor nossos clientes estão dispostos a pagar?
- Venda de ativos
- Taxa de uso
- Assinatura
- Aluguel/Leasing
- Licenciamento
- Taxas de corretagem
- Publicidade

### 6. Recursos Principais (Key Resources)
Quais recursos nossa proposta de valor requer?
- Físicos
- Intelectuais
- Humanos
- Financeiros

### 7. Atividades-Chave (Key Activities)
Quais atividades nossa proposta de valor requer?
- Produção
- Resolução de problemas
- Plataforma/rede

### 8. Parcerias Principais (Key Partnerships)
Quem são nossos parceiros-chave? Quem são nossos fornecedores-chave?
- Alianças estratégicas
- Coopetição
- Joint ventures
- Relações fornecedor-comprador

### 9. Estrutura de Custos (Cost Structure)
Quais são os custos mais importantes?
- Dirigido por custo
- Dirigido por valor

Características:
- Custos fixos
- Custos variáveis
- Economias de escala
- Economias de escopo

## Como aplicar

1. **Preparação**: Imprima o canvas, tenha post-its coloridos
2. **Comece pelos clientes**: Defina segmentos de clientes
3. **Proposta de valor**: O que você oferece a cada segmento?
4. **Canais**: Como alcança e entrega valor?
5. **Relacionamento**: Como se relaciona com cada segmento?
6. **Receitas**: Como ganha dinheiro?
7. **Recursos**: O que você precisa ter?
8. **Atividades**: O que você precisa fazer?
9. **Parcerias**: Com quem você precisa trabalhar?
10. **Custos**: Quanto custa operar?

## Benefícios
- Visão holística do negócio
- Facilita comunicação
- Identifica dependências
- Permite experimentação rápida
- Base para discussões estratégicas
- Alinhamento de equipe

## Quando usar no processo de consultoria
- Fase de anamnese: Para entender modelo atual
- Fase de análise: Para identificar gaps
- Fase de recomendação: Para propor novo modelo
- Sempre que houver necessidade de visão estratégica

## Variações
- Lean Canvas (para startups)
- Value Proposition Canvas (foco em proposta de valor)
- Personal Business Model Canvas (para indivíduos)',
  ARRAY['canvas', 'estrategia', 'modelo-negocio', 'planejamento', 'startup', 'inovacao'],
  jsonb_build_object(
    'problemas', ARRAY['falta de clareza estratégica', 'modelo de negócio confuso', 'necessidade de pivotagem', 'planejamento de novos produtos'],
    'contextos', ARRAY['startups', 'pequenas empresas', 'médias empresas', 'novos produtos', 'revisão estratégica'],
    'nivel_maturidade', ARRAY['iniciante', 'intermediario', 'avancado'],
    'tempo_aplicacao', '60-120 minutos'
  ),
  jsonb_build_object(
    'fonte', 'Business Model Generation - Osterwalder & Pigneur',
    'complexidade', 'media',
    'prerequisitos', ARRAY['conhecimento do negócio', 'dados de mercado']
  ),
  true,
  1
);

-- 5W2H - Plano de Ação
INSERT INTO knowledge_base_documents (
  title,
  category,
  content,
  tags,
  aplicabilidade,
  metadados,
  ativo,
  versao
) VALUES (
  '5W2H - Plano de Ação',
  'metodologia',
  '# 5W2H - Plano de Ação Estruturado

## O que é
Ferramenta de planejamento que organiza ações de forma clara e objetiva, respondendo a 7 questões essenciais. É uma das ferramentas mais utilizadas para criar planos de ação executáveis.

## Quando usar
- Implementação de melhorias
- Projetos de mudança
- Resolução de problemas
- Planejamento de ações
- Atribuição de responsabilidades
- Controle e acompanhamento

## As 7 Questões

### What (O quê?)
**O que será feito?**
- Descreva a ação claramente
- Use verbo no infinitivo
- Seja específico e objetivo
- Evite ambiguidades

Exemplo: "Implementar sistema de gestão de estoque"

### Why (Por quê?)
**Por que será feito?**
- Justificativa da ação
- Objetivo esperado
- Benefícios antecipados
- Alinhamento estratégico

Exemplo: "Para reduzir perdas por falta de controle e melhorar precisão de pedidos"

### Where (Onde?)
**Onde será feito?**
- Local físico
- Departamento
- Filial
- Sistema
- Ambiente

Exemplo: "No depósito central e em todas as 5 filiais regionais"

### When (Quando?)
**Quando será feito?**
- Data de início
- Data de término
- Marcos intermediários
- Prazo total

Exemplo: "Início: 01/12/2025 - Término: 28/02/2026"

### Who (Quem?)
**Quem fará?**
- Responsável principal
- Equipe envolvida
- Stakeholders
- Aprovadores

Exemplo: "Responsável: João Silva (Gerente TI) | Equipe: 3 analistas + 1 consultor externo"

### How (Como?)
**Como será feito?**
- Método ou processo
- Etapas principais
- Recursos necessários
- Ferramentas

Exemplo: "
1. Levantamento de requisitos (2 semanas)
2. Seleção de fornecedor (3 semanas)
3. Implementação piloto (4 semanas)
4. Roll-out geral (6 semanas)
5. Treinamento equipes (contínuo)"

### How Much (Quanto?)
**Quanto custará?**
- Investimento total
- Custos operacionais
- Recursos financeiros
- ROI esperado

Exemplo: "
- Software: R$ 50.000
- Consultoria: R$ 30.000
- Treinamento: R$ 10.000
- Contingência: R$ 10.000
Total: R$ 100.000"

## Template de Aplicação

| What | Why | Where | When | Who | How | How Much |
|------|-----|-------|------|-----|-----|----------|
| [Ação] | [Justificativa] | [Local] | [Prazo] | [Responsável] | [Método] | [Custo] |

## Como aplicar passo a passo

1. **Liste todas as ações necessárias**: Brainstorm inicial
2. **Priorize as ações**: Use matriz de impacto x esforço
3. **Para cada ação prioritária, responda as 7 questões**
4. **Valide com stakeholders**: Garanta alinhamento
5. **Documente formalmente**: Crie o plano de ação
6. **Comunique claramente**: Todos devem conhecer suas responsabilidades
7. **Acompanhe a execução**: Reuniões periódicas de status
8. **Ajuste quando necessário**: Seja ágil

## Benefícios
- Clareza total sobre o que fazer
- Responsabilidades definidas
- Prazos estabelecidos
- Orçamento controlado
- Facilita acompanhamento
- Reduz riscos de esquecimento
- Melhora comunicação

## Erros comuns a evitar
- Ações vagas ou genéricas
- Múltiplos responsáveis (diluição)
- Prazos irrealistas
- Falta de recursos adequados
- Não acompanhar execução
- Não atualizar o plano

## Integração com outras ferramentas
- **PDCA**: 5W2H é o "P" (Plan) detalhado
- **DMAIC**: Usado na fase "Improve"
- **Kanban**: Cartões = linhas do 5W2H
- **Gantt**: Cronograma baseado no 5W2H
- **Matriz de Priorização**: Define quais ações viram 5W2H

## Quando usar no processo de consultoria
- Fase de recomendação: Estruturar ações propostas
- Fase de execução: Plano detalhado de implementação
- Sempre que identificar necessidade de ação

## Dicas práticas
- Use planilhas para facilitar acompanhamento
- Codifique ações (A01, A02...) para referência
- Defina apenas 1 responsável principal por ação
- Inclua indicadores de sucesso
- Faça revisões semanais
- Celebre conquistas',
  ARRAY['5w2h', 'plano-acao', 'planejamento', 'execucao', 'gestao-projetos', 'implementacao'],
  jsonb_build_object(
    'problemas', ARRAY['falta de clareza nas ações', 'responsabilidades indefinidas', 'projetos sem rumo', 'necessidade de implementar melhorias'],
    'contextos', ARRAY['qualquer porte', 'qualquer segmento', 'fase de execução', 'implementação de melhorias'],
    'nivel_maturidade', ARRAY['iniciante', 'intermediario', 'avancado'],
    'tempo_aplicacao', '60-90 minutos por sessão'
  ),
  jsonb_build_object(
    'fonte', 'Gestão da Qualidade - metodologia consolidada',
    'complexidade', 'baixa',
    'prerequisitos', ARRAY['ações identificadas', 'apoio da liderança']
  ),
  true,
  1
);

-- Cadeia de Valor (Value Chain)
INSERT INTO knowledge_base_documents (
  title,
  category,
  content,
  tags,
  aplicabilidade,
  metadados,
  ativo,
  versao
) VALUES (
  'Cadeia de Valor - Value Chain',
  'framework',
  '# Cadeia de Valor (Value Chain)

## O que é
Modelo conceitual criado por Michael Porter que descreve as atividades que uma organização realiza para criar valor para seus clientes. Divide as atividades em primárias e de apoio.

## Quando usar
- Análise estratégica da empresa
- Identificação de vantagens competitivas
- Otimização de processos
- Decisões de terceirização
- Análise de custos
- Mapeamento macro de processos

## Estrutura

### Atividades Primárias
Atividades diretamente relacionadas à criação e entrega do produto/serviço:

#### 1. Logística Interna (Inbound Logistics)
- Recebimento de materiais
- Armazenamento
- Controle de estoque
- Movimentação interna
- Devolução a fornecedores

#### 2. Operações (Operations)
- Transformação de inputs em outputs
- Produção/manufatura
- Montagem
- Embalagem
- Controle de qualidade
- Manutenção de equipamentos

#### 3. Logística Externa (Outbound Logistics)
- Armazenamento de produtos acabados
- Processamento de pedidos
- Expedição
- Transporte/distribuição
- Gestão de entregas

#### 4. Marketing e Vendas (Marketing & Sales)
- Pesquisa de mercado
- Publicidade e promoção
- Força de vendas
- Seleção de canais
- Precificação
- Gestão da marca

#### 5. Serviços (Service)
- Instalação
- Treinamento de clientes
- Suporte técnico
- Manutenção
- Garantia
- Peças de reposição

### Atividades de Apoio
Atividades que suportam as atividades primárias:

#### 1. Infraestrutura da Empresa
- Administração geral
- Planejamento estratégico
- Finanças
- Contabilidade
- Jurídico
- Gestão da qualidade
- Relações públicas

#### 2. Gestão de Recursos Humanos
- Recrutamento e seleção
- Treinamento e desenvolvimento
- Avaliação de desempenho
- Remuneração e benefícios
- Relações trabalhistas
- Cultura organizacional

#### 3. Desenvolvimento de Tecnologia
- P&D de produtos
- P&D de processos
- Design
- Automação
- Sistemas de informação
- Telecomunicações

#### 4. Aquisição/Compras (Procurement)
- Compra de matérias-primas
- Compra de serviços
- Negociação com fornecedores
- Gestão de contratos
- Qualificação de fornecedores

## Como aplicar

### Passo 1: Identifique as atividades
Liste todas as atividades da empresa em cada categoria

### Passo 2: Analise cada atividade
- Qual o custo?
- Qual o valor agregado?
- Como está o desempenho?
- Onde estão os gargalos?

### Passo 3: Identifique linkages
- Como as atividades se relacionam?
- Onde há desperdícios?
- Onde há sinergias?

### Passo 4: Avalie vantagens competitivas
- Em quais atividades somos melhores?
- Onde criamos mais valor?
- O que é essencial manter interno?
- O que pode ser terceirizado?

### Passo 5: Desenvolva estratégias
- Otimização de custos
- Diferenciação
- Integração vertical
- Terceirização estratégica

## Análise de Valor

Para cada atividade, pergunte:
- **Custo**: Quanto custa executar?
- **Valor**: Quanto valor cria para o cliente?
- **Essencial**: É core business?
- **Desempenho**: Quão bem executamos?
- **Benchmark**: Como nos comparamos?

## Uso na Priorização

A Cadeia de Valor ajuda a priorizar processos para melhoria:

**Alta Prioridade:**
- Atividades primárias com alto impacto no cliente
- Atividades com alto custo e baixo desempenho
- Gargalos que afetam toda a cadeia

**Média Prioridade:**
- Atividades de apoio essenciais
- Processos com oportunidades de automação
- Linkages mal coordenados

**Baixa Prioridade:**
- Atividades bem executadas
- Processos com baixo impacto
- Candidatos à terceirização

## Integração com BPM

A Cadeia de Valor fornece a visão macro. Depois:
1. **SIPOC**: Detalha processos prioritários
2. **BPMN**: Modela processos críticos
3. **5W2H**: Planeja melhorias
4. **Métricas**: Monitora desempenho

## Benefícios
- Visão estratégica completa
- Identifica onde competir
- Base para decisões de make or buy
- Alinha processos com estratégia
- Facilita análise de custos
- Identifica oportunidades de melhoria

## Exemplo de aplicação

**Indústria de alimentos:**

*Atividades Primárias Críticas:*
- Logística Interna: Controle rigoroso de perecíveis
- Operações: Conformidade sanitária
- Logística Externa: Cadeia fria
- Marketing: Diferenciação de marca
- Serviços: Recall e atendimento

*Atividades de Apoio Estratégicas:*
- Tecnologia: Rastreabilidade
- Compras: Certificação de fornecedores
- RH: Treinamento em segurança alimentar

## Quando usar no processo de consultoria
- Fase de anamnese: Entender operação completa
- Fase de modelagem: Visão macro antes do SIPOC
- Fase de diagnóstico: Identificar processos críticos
- Fase de priorização: Selecionar onde atuar',
  ARRAY['cadeia-valor', 'value-chain', 'porter', 'estrategia', 'processos', 'competitividade'],
  jsonb_build_object(
    'problemas', ARRAY['falta de visão macro', 'processos desconectados', 'necessidade de priorização', 'análise estratégica'],
    'contextos', ARRAY['pequenas empresas', 'médias empresas', 'grandes empresas', 'análise estratégica'],
    'nivel_maturidade', ARRAY['intermediario', 'avancado'],
    'tempo_aplicacao', '90-180 minutos'
  ),
  jsonb_build_object(
    'fonte', 'Michael Porter - Competitive Advantage',
    'complexidade', 'media-alta',
    'prerequisitos', ARRAY['conhecimento profundo do negócio', 'dados de custos', 'visão estratégica']
  ),
  true,
  1
);

-- Matriz de Priorização (Impacto x Esforço)
INSERT INTO knowledge_base_documents (
  title,
  category,
  content,
  tags,
  aplicabilidade,
  metadados,
  ativo,
  versao
) VALUES (
  'Matriz de Priorização - Impacto x Esforço',
  'metodologia',
  '# Matriz de Priorização - Impacto x Esforço

## O que é
Ferramenta visual para priorizar iniciativas, projetos ou processos baseada em dois critérios: o impacto esperado e o esforço necessário para implementação.

## Quando usar
- Muitas melhorias possíveis, recursos limitados
- Necessidade de priorizar processos para intervir
- Decisões sobre onde investir primeiro
- Planejamento de roadmap de melhorias
- Após diagnóstico, antes do plano de ação

## Estrutura da Matriz

A matriz é dividida em 4 quadrantes:

```
        Alto Impacto
            ↑
Pensar  |  Fazer
mais    |  Agora
--------|--------
Evitar  |  Ganhos
        |  Rápidos
        → Alto Esforço
```

### Quadrante 1: FAZER AGORA (Alto Impacto, Baixo Esforço)
**Quick Wins - Vitórias Rápidas**
- Prioridade MÁXIMA
- Implementar imediatamente
- Gera resultados rápidos
- Motiva a equipe
- Constrói credibilidade

Características:
- ROI excelente
- Riscos baixos
- Recursos mínimos
- Resultados visíveis

### Quadrante 2: PENSAR MAIS (Alto Impacto, Alto Esforço)
**Projetos Estratégicos**
- Prioridade ALTA
- Requer planejamento cuidadoso
- Pode ser quebrado em fases
- Necessita recursos significativos
- Impacto transformador

Características:
- ROI alto a médio prazo
- Exige comprometimento
- Pode envolver mudança cultural
- Necessita patrocínio executivo

### Quadrante 3: GANHOS RÁPIDOS (Baixo Impacto, Baixo Esforço)
**Fill-ins - Preenchimentos**
- Prioridade MÉDIA
- Fazer quando houver tempo
- Pequenas melhorias
- Baixo custo de oportunidade

Características:
- Melhorias incrementais
- Fácil implementação
- Mantém momentum
- Não são urgentes

### Quadrante 4: EVITAR (Baixo Impacto, Alto Esforço)
**Money Pits - Sumidouros**
- Prioridade BAIXA
- Questionar se vale a pena
- Avaliar se há alternativas
- Pode ser descartado

Características:
- ROI questionável
- Alto custo de oportunidade
- Distrai do essencial
- Considerar não fazer

## Critérios de Avaliação

### Impacto (Vertical)
Perguntas para avaliar:
- Quantos clientes serão beneficiados?
- Qual a melhoria em indicadores-chave?
- Quanto valor será gerado?
- Alinha com objetivos estratégicos?
- Resolve um problema crítico?

Escala sugerida:
- **Alto (3)**: Impacto direto em resultados, >50% de melhoria
- **Médio (2)**: Impacto moderado, 20-50% de melhoria
- **Baixo (1)**: Impacto limitado, <20% de melhoria

### Esforço (Horizontal)
Perguntas para avaliar:
- Quanto tempo levará?
- Quantas pessoas envolvidas?
- Qual o investimento necessário?
- Qual a complexidade técnica?
- Há resistência organizacional?

Escala sugerida:
- **Baixo (1)**: <1 mês, <5 pessoas, <R$10k
- **Médio (2)**: 1-3 meses, 5-15 pessoas, R$10-50k
- **Alto (3)**: >3 meses, >15 pessoas, >R$50k

## Como aplicar

### Passo 1: Liste as iniciativas
Brainstorm de todas as melhorias possíveis

### Passo 2: Defina critérios específicos
Adapte os critérios à realidade da empresa

### Passo 3: Avalie cada iniciativa
Use uma escala consistente (1-3 ou 1-5)

### Passo 4: Posicione na matriz
Coloque cada iniciativa no quadrante apropriado

### Passo 5: Discuta e ajuste
Busque consenso com stakeholders

### Passo 6: Defina sequência
Crie roadmap de implementação

### Passo 7: Planeje recursos
Aloque recursos conforme prioridade

## Template de Avaliação

| Iniciativa | Impacto (1-3) | Esforço (1-3) | Quadrante | Prioridade |
|------------|---------------|---------------|-----------|------------|
| Processo A | 3 | 1 | Fazer Agora | 1 |
| Processo B | 3 | 3 | Pensar Mais | 2 |
| Processo C | 1 | 1 | Ganhos Rápidos | 3 |
| Processo D | 1 | 3 | Evitar | 4 |

## Variações da Matriz

### Urgência x Importância (Eisenhower)
- Fazer primeiro: Urgente e Importante
- Agendar: Importante mas não urgente
- Delegar: Urgente mas não importante
- Eliminar: Nem urgente nem importante

### Valor x Complexidade
Similar a Impacto x Esforço, com foco em valor de negócio

### ROI x Risco
Para decisões de investimento

## Dicas práticas
- Use post-its em quadro branco para facilitar discussão
- Envolva stakeholders na avaliação
- Seja realista sobre esforço
- Considere dependências entre iniciativas
- Reavalie periodicamente
- Comece pelos Quick Wins para ganhar momentum

## Erros comuns
- Subestimar esforço por otimismo
- Superestimar impacto sem dados
- Não considerar capacidade da equipe
- Ignorar interdependências
- Não revisar prioridades periodicamente

## Benefícios
- Decisões objetivas e transparentes
- Alinhamento de expectativas
- Uso otimizado de recursos
- Foco no que importa
- Comunicação clara de prioridades
- Gestão de stakeholders

## Quando usar no processo de consultoria
- Fase de diagnóstico: Após identificar oportunidades
- Fase de recomendação: Definir sequência de implementação
- Sempre antes de criar plano de ação
- Para validação com cliente sobre prioridades',
  ARRAY['priorizacao', 'matriz', 'impacto-esforco', 'quick-wins', 'gestao-projetos', 'decisao'],
  jsonb_build_object(
    'problemas', ARRAY['muitas oportunidades identificadas', 'recursos limitados', 'necessidade de foco', 'decisão sobre onde começar'],
    'contextos', ARRAY['qualquer porte', 'qualquer segmento', 'após diagnóstico', 'planejamento estratégico'],
    'nivel_maturidade', ARRAY['iniciante', 'intermediario', 'avancado'],
    'tempo_aplicacao', '60-90 minutos'
  ),
  jsonb_build_object(
    'fonte', 'Gestão de Projetos - metodologia consolidada',
    'complexidade', 'baixa',
    'prerequisitos', ARRAY['lista de oportunidades', 'critérios claros', 'stakeholders envolvidos']
  ),
  true,
  1
);

-- Análise de Causa Raiz (5 Porquês)
INSERT INTO knowledge_base_documents (
  title,
  category,
  content,
  tags,
  aplicabilidade,
  metadados,
  ativo,
  versao
) VALUES (
  '5 Porquês - Análise de Causa Raiz',
  'metodologia',
  '# 5 Porquês - Análise de Causa Raiz

## O que é
Técnica de questionamento iterativo usada para explorar as relações de causa e efeito subjacentes a um problema. Pergunte "Por quê?" cinco vezes (ou quantas forem necessárias) para chegar à causa raiz.

## Quando usar
- Problemas recorrentes
- Necessidade de identificar causa raiz
- Processos com falhas frequentes
- Antes de implementar soluções
- Resolução de problemas
- Melhoria contínua

## Como funciona

### Exemplo clássico (Toyota):

**Problema:** A máquina parou de funcionar

1. **Por quê?** O fusível queimou devido a sobrecarga
2. **Por quê?** Não havia lubrificação suficiente nos rolamentos
3. **Por quê?** A bomba de lubrificação não estava bombeando suficientemente
4. **Por quê?** O eixo da bomba estava desgastado
5. **Por quê?** Não há filtro de sucção, permitindo entrada de detritos

**Causa Raiz:** Ausência de filtro de sucção na bomba
**Solução:** Instalar filtro de sucção

## Método de aplicação

### Passo 1: Defina o problema claramente
- Seja específico
- Use dados quando possível
- Foco em um problema por vez

### Passo 2: Monte a equipe certa
- Pessoas que conhecem o processo
- Diferentes perspectivas
- Quem pode implementar soluções

### Passo 3: Pergunte o primeiro "Por quê?"
- Baseie-se em fatos, não opiniões
- Busque evidências
- Documente a resposta

### Passo 4: Continue perguntando
- Cada resposta vira a próxima pergunta
- Pare quando chegar a um processo ou falha de controle
- Podem ser necessários mais ou menos de 5 porquês

### Passo 5: Identifique a causa raiz
- Geralmente é uma falha de processo
- Não pare nos sintomas
- A causa raiz deve ser algo controlável

### Passo 6: Desenvolva contramedidas
- Ataque a causa raiz, não os sintomas
- Crie plano de ação (5W2H)
- Implemente e monitore

## Template de aplicação

| Nível | Por quê? | Resposta |
|-------|----------|----------|
| Problema | - | [Descrição do problema] |
| 1º Por quê | Por que [problema]? | [Resposta baseada em fatos] |
| 2º Por quê | Por que [resposta anterior]? | [Próxima causa] |
| 3º Por quê | Por que [resposta anterior]? | [Próxima causa] |
| 4º Por quê | Por que [resposta anterior]? | [Próxima causa] |
| 5º Por quê | Por que [resposta anterior]? | [Causa raiz] |

**Causa Raiz Identificada:** _______________
**Contramedida:** _______________

## Regras importantes

### O que fazer:
- Basear-se em fatos e dados
- Envolver quem trabalha no processo
- Questionar processos, não pessoas
- Ser específico em cada nível
- Buscar causas verificáveis
- Parar quando encontrar a causa raiz

### O que NÃO fazer:
- Culpar pessoas
- Basearse em suposições
- Aceitar "erro humano" como resposta final
- Parar antes da causa raiz
- Misturar múltiplos problemas
- Não documentar o processo

## Sinais de que chegou à causa raiz

- É uma falha de processo, não de pessoa
- Está sob controle da organização
- Ao corrigi-la, o problema não volta
- É específica e acionável
- Faz sentido para a equipe

## Integração com outras ferramentas

### Diagrama de Ishikawa (Espinha de Peixe)
Use 5 Porquês em cada categoria do Ishikawa para profundidade

### DMAIC
5 Porquês na fase "Analyze" para encontrar causa raiz

### A3 Thinking
5 Porquês é o coração da análise no A3

### Kaizen
Use para identificar onde aplicar melhorias

## Exemplo prático: E-commerce

**Problema:** Taxa de abandono de carrinho em 70%

1. **Por quê?** Clientes não finalizam a compra
2. **Por quê?** Desistem na página de pagamento
3. **Por quê?** Processo de checkout tem muitos passos
4. **Por quê?** Sistema legado exige dados redundantes
5. **Por quê?** Não há integração entre cadastro e checkout

**Causa Raiz:** Falta de integração de sistemas
**Solução:** Implementar checkout em etapa única com dados pré-preenchidos

## Limitações da técnica

- Pode ser muito simplista para problemas complexos
- Depende de conhecimento da equipe
- Pode levar a múltiplas causas raízes
- Nem sempre 5 é o número certo
- Viés de confirmação pode influenciar

## Quando combinar com outras técnicas

- **Problemas complexos:** Use também Ishikawa ou FTA (Fault Tree Analysis)
- **Múltiplas causas:** Considere FMEA (Failure Mode and Effects Analysis)
- **Dados insuficientes:** Primeiro faça coleta de dados estruturada
- **Processos desconhecidos:** Mapeie o processo antes (SIPOC, BPMN)

## Benefícios
- Simples e rápido
- Não requer ferramentas especiais
- Vai além dos sintomas
- Promove pensamento profundo
- Previne recorrência
- Envolve a equipe

## Quando usar no processo de consultoria
- Fase de diagnóstico: Para entender problemas profundamente
- Sempre que cliente relatar problema recorrente
- Antes de propor soluções
- Como parte da análise de processos críticos',
  ARRAY['5-porques', 'causa-raiz', 'resolucao-problemas', 'qualidade', 'lean', 'toyota'],
  jsonb_build_object(
    'problemas', ARRAY['problemas recorrentes', 'necessidade de causa raiz', 'soluções paliativas não funcionam', 'análise superficial'],
    'contextos', ARRAY['qualquer porte', 'qualquer segmento', 'problemas operacionais', 'melhoria contínua'],
    'nivel_maturidade', ARRAY['iniciante', 'intermediario'],
    'tempo_aplicacao', '30-60 minutos'
  ),
  jsonb_build_object(
    'fonte', 'Toyota Production System',
    'complexidade', 'baixa',
    'prerequisitos', ARRAY['problema claramente definido', 'equipe que conhece o processo', 'dados disponíveis']
  ),
  true,
  1
);

COMMIT;

-- Verificação
SELECT
  title,
  category,
  array_length(tags, 1) as num_tags,
  jsonb_array_length((aplicabilidade->'problemas')::jsonb) as num_problemas,
  ativo,
  versao
FROM knowledge_base_documents
ORDER BY created_at DESC;
