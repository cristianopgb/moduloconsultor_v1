import type { Conquista } from '../../types/consultor';

export const AREAS_PADRAO = [
  'Financeiro',
  'Comercial',
  'Marketing',
  'Recursos Humanos',
  'Operações',
  'Tecnologia da Informação',
  'Jurídico',
  'Administrativo'
] as const;

export const ETAPAS_JORNADA = {
  ANAMNESE: 'anamnese',
  MAPEAMENTO: 'mapeamento',
  PRIORIZACAO: 'priorizacao',
  EXECUCAO: 'execucao'
} as const;

export const ETAPAS_AREA = {
  AGUARDANDO: 'aguardando',
  AS_IS: 'as_is',
  ANALISE: 'analise',
  PLANO: 'plano',
  EXECUCAO: 'execucao',
  CONCLUIDA: 'concluida'
} as const;

export const STATUS_ACAO = {
  A_FAZER: 'a_fazer',
  EM_ANDAMENTO: 'em_andamento',
  BLOQUEADO: 'bloqueado',
  CONCLUIDO: 'concluido'
} as const;

export const XP_VALORES = {
  ANAMNESE_COMPLETA: 100,
  MAPEAMENTO_COMPLETO: 250,
  PRIORIZACAO_DEFINIDA: 50,
  AS_IS_AREA: 200,
  DIAGNOSTICO_APROVADO: 150,
  PLANO_ACAO_APROVADO: 300,
  ACAO_CONCLUIDA: 50,
  AREA_COMPLETADA_BONUS: 500
} as const;

export const XP_POR_NIVEL = 1000;

export const CONQUISTAS_DISPONIVEIS: Omit<Conquista, 'data_desbloqueio' | 'xp_ganho'>[] = [
  {
    id: 'primeiro_passo',
    nome: 'Primeiro Passo',
    descricao: 'Completou a anamnese empresarial',
    icone: 'CheckCircle'
  },
  {
    id: 'visionario',
    nome: 'Visionário',
    descricao: 'Mapeou todas as áreas do negócio',
    icone: 'Eye'
  },
  {
    id: 'estrategista',
    nome: 'Estrategista',
    descricao: 'Definiu a priorização das áreas',
    icone: 'Target'
  },
  {
    id: 'analista',
    nome: 'Analista',
    descricao: 'Aprovou o primeiro diagnóstico',
    icone: 'BarChart3'
  },
  {
    id: 'executor',
    nome: 'Executor',
    descricao: 'Aprovou o primeiro plano de ação',
    icone: 'ClipboardCheck'
  },
  {
    id: 'persistente',
    nome: 'Persistente',
    descricao: 'Completou a primeira ação',
    icone: 'Zap'
  },
  {
    id: 'maestro',
    nome: 'Maestro',
    descricao: 'Completou uma área inteira',
    icone: 'Award'
  },
  {
    id: 'transformador',
    nome: 'Transformador',
    descricao: 'Completou todas as áreas priorizadas',
    icone: 'Trophy'
  },
  {
    id: 'dedicado_7dias',
    nome: 'Dedicado',
    descricao: '7 dias consecutivos trabalhando',
    icone: 'Calendar'
  },
  {
    id: 'incansavel_30dias',
    nome: 'Incansável',
    descricao: '30 dias consecutivos trabalhando',
    icone: 'Flame'
  }
];

export const TEMPLATE_NOMES = {
  ANAMNESE: 'anamnese-empresarial',
  MAPA_GERAL: 'mapa-processos-geral',
  TABELA_PRIORIZACAO: 'tabela-priorizacao',
  MAPA_AREA: 'mapa-processos-area',
  BPMN_AS_IS: 'bpmn-as-is-area',
  DIAGNOSTICO: 'diagnostico-area',
  PLANO_ACAO: 'plano-acao-5w2h'
} as const;

export const PERGUNTAS_ANAMNESE = {
  usuario: [
    'Qual é o seu nome completo?',
    'Qual é o seu cargo atual na empresa?',
    'Há quanto tempo você trabalha nesta empresa?',
    'Quais são seus principais objetivos pessoais com este processo de transformação?'
  ],
  empresa: [
    'Qual é o nome da empresa?',
    'Em qual segmento/setor a empresa atua?',
    'Qual é o porte da empresa (microempresa, pequena, média, grande)?',
    'Há quanto tempo a empresa está no mercado?',
    'Qual é o faturamento anual aproximado?',
    'Quantos colaboradores a empresa possui?'
  ],
  expectativas: [
    'Quais são os 3 principais desafios que a empresa enfrenta hoje?',
    'Quais são as metas de curto prazo (próximos 6 meses)?',
    'Quais são as metas de médio prazo (próximos 12-18 meses)?',
    'Quais são as metas de longo prazo (2-3 anos)?',
    'O que você espera alcançar ao final desta jornada de transformação?'
  ]
};

export const PERGUNTAS_MAPEAMENTO_GERAL = {
  financeiro: [
    'A empresa possui área/departamento financeiro estruturado?',
    'Quem é o responsável pela área financeira?',
    'Quais são as principais atividades financeiras realizadas?',
    'Quais sistemas/ferramentas são utilizados?',
    'Quais são as principais dores/desafios na área financeira?'
  ],
  comercial: [
    'A empresa possui área/equipe comercial?',
    'Quem lidera a área comercial?',
    'Como funciona o processo de vendas?',
    'Quais ferramentas/sistemas são utilizados para vendas?',
    'Quais são os principais desafios comerciais?'
  ],
  marketing: [
    'Existe uma área de marketing estruturada?',
    'Quem é responsável pelas ações de marketing?',
    'Quais canais de marketing são utilizados?',
    'Como é feito o planejamento e execução de campanhas?',
    'Quais são as principais dificuldades em marketing?'
  ],
  rh: [
    'A empresa possui área de Recursos Humanos?',
    'Quem cuida dos processos de RH?',
    'Como são realizados recrutamento, seleção e treinamento?',
    'Existe política de gestão de pessoas definida?',
    'Quais são os desafios na gestão de pessoas?'
  ],
  operacoes: [
    'Como está estruturada a área de operações?',
    'Quem é responsável pelas operações?',
    'Quais são os principais processos operacionais?',
    'Quais sistemas/tecnologias são utilizados?',
    'Quais são os gargalos operacionais?'
  ],
  ti: [
    'A empresa possui área de TI?',
    'Quem é responsável pela tecnologia?',
    'Qual infraestrutura tecnológica está em uso?',
    'Como são tratadas demandas de TI?',
    'Quais são os principais desafios tecnológicos?'
  ],
  juridico: [
    'Existe área jurídica interna ou é terceirizada?',
    'Quem cuida das questões legais?',
    'Quais tipos de demandas jurídicas são mais frequentes?',
    'Como são geridos contratos e documentos legais?',
    'Quais são os principais riscos jurídicos?'
  ],
  administrativo: [
    'Como está estruturada a área administrativa?',
    'Quem coordena as atividades administrativas?',
    'Quais processos administrativos são críticos?',
    'Quais ferramentas são utilizadas?',
    'Quais são as dificuldades administrativas?'
  ]
};

export const ATRIBUTOS_PROCESSO = [
  { key: 'input', label: 'Entradas (Inputs)', prompt: 'Quais são as entradas necessárias para este processo?' },
  { key: 'output', label: 'Saídas (Outputs)', prompt: 'Quais são os resultados gerados por este processo?' },
  { key: 'ferramentas', label: 'Ferramentas e Sistemas', prompt: 'Quais ferramentas, sistemas ou softwares são utilizados?' },
  { key: 'metricas', label: 'Métricas e KPIs', prompt: 'Quais métricas ou indicadores são acompanhados neste processo?' },
  { key: 'regras', label: 'Regras de Negócio', prompt: 'Quais são as regras, políticas ou critérios de aprovação deste processo?' },
  { key: 'fluxo_trabalho', label: 'Fluxo de Trabalho', prompt: 'Descreva a sequência de atividades deste processo, passo a passo.' },
  { key: 'pessoas', label: 'Pessoas Envolvidas', prompt: 'Quem são os responsáveis e envolvidos neste processo?' }
];

export const MENSAGEM_APRESENTACAO = `Olá! Sou o **Consultor Proceda IA**, especializado em transformação organizacional.

Estou aqui para conduzir você no processo de transformação da sua empresa, utilizando uma metodologia comprovada que vai desde o entendimento profundo do seu negócio até a implementação de ações práticas de melhoria.

**Podemos começar** ou gostaria de **mais explicações** sobre mim e o processo?`;

export const EXPLICACAO_METODOLOGIA = `Perfeito! Deixa eu explicar como funciona nossa jornada juntos:

## 📋 Nossa Metodologia

### 1. Anamnese Empresarial
Primeiro, vou conhecer você, sua empresa e seus objetivos. Isso me ajuda a personalizar todo o processo.

### 2. Mapeamento Geral
Vou entender todas as áreas do seu negócio e como elas se relacionam, criando uma visão completa da cadeia de valor.

### 3. Priorização Estratégica
Juntos, vamos definir por qual área começar, baseado em impacto, urgência e viabilidade.

### 4. Transformação por Área
Para cada área, seguimos 4 etapas:
- **AS-IS**: Mapeamento detalhado da situação atual
- **Análise**: Diagnóstico profundo com gaps e oportunidades
- **Plano de Ação**: Criação de ações práticas (5W2H)
- **Execução**: Acompanhamento da implementação

## 🎯 O que você ganha

- Documentos profissionais em cada etapa
- Visão clara de processos e fluxos
- Diagnósticos baseados em best practices
- Planos de ação estruturados e práticos
- Acompanhamento contínuo via chat especialista

## ⏱️ Tempo estimado

- Anamnese: 15-20 minutos
- Mapeamento: 30-40 minutos
- Cada área: 1-2 horas (pode trabalhar múltiplas áreas em paralelo)

**Vamos iniciar?** Qualquer dúvida é só perguntar.`;

export const EXPLICACAO_METODOLOGIA_SEM_SAUDACAO = `Nossa metodologia em 5 fases:

**1. Anamnese Empresarial** → Conhecer você, sua empresa e objetivos (15-20 min)

**2. Mapeamento Geral** → Entender todas as áreas e como se relacionam (30-40 min)

**3. Priorização** → Definir por onde começar baseado em impacto e viabilidade

**4. Transformação por Área** → Para cada área priorizada:
   - Mapeamento detalhado (AS-IS)
   - Diagnóstico profundo
   - Plano de ação (5W2H)
   - Acompanhamento da execução

**5. Resultados** → Documentos profissionais, diagnósticos baseados em best practices, e planos estruturados

**Vamos iniciar?** Qualquer dúvida é só perguntar.`;
