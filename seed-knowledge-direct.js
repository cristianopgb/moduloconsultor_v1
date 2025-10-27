import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const documents = [
  {
    title: 'SIPOC - Mapeamento de Processos',
    category: 'metodologia',
    content: `# SIPOC - Suppliers, Inputs, Process, Outputs, Customers

## O que é
SIPOC é uma ferramenta visual de alto nível para mapear processos de negócio, identificando os elementos fundamentais de qualquer processo.

## Quando usar
- Início de projetos de melhoria de processos
- Para obter visão macro antes de detalhamentos
- Quando a equipe precisa alinhar entendimento sobre um processo
- Como primeira etapa antes de modelagens detalhadas (BPMN)

## Componentes

### Suppliers (Fornecedores)
Quem fornece os recursos necessários para o processo.

### Inputs (Entradas)
O que é necessário para executar o processo.

### Process (Processo)
As atividades principais executadas (4 a 7 etapas de alto nível).

### Outputs (Saídas)
O que o processo produz.

### Customers (Clientes)
Quem recebe e utiliza as saídas.

## Benefícios
- Visão holística do processo
- Alinhamento rápido da equipe
- Identificação de gaps
- Base para melhorias
- Comunicação eficaz com stakeholders`,
    tags: ['sipoc', 'mapeamento', 'processos', 'bpm', 'alto-nivel', 'diagnostico'],
    aplicabilidade: {
      problemas: ['falta de clareza sobre processos', 'processos confusos', 'necessidade de visão macro'],
      contextos: ['qualquer porte', 'qualquer segmento', 'inicio de projetos'],
      nivel_maturidade: ['iniciante', 'intermediario'],
      tempo_aplicacao: '30-60 minutos'
    },
    metadados: {
      fonte: 'BPM CBOK',
      complexidade: 'baixa',
      prerequisitos: ['conhecimento básico do processo']
    },
    ativo: true,
    versao: 1
  },
  {
    title: 'Business Model Canvas',
    category: 'framework',
    content: `# Business Model Canvas

## O que é
Ferramenta estratégica visual para desenvolver, documentar e analisar modelos de negócio.

## Os 9 Blocos

1. Segmentos de Clientes
2. Proposta de Valor
3. Canais
4. Relacionamento com Clientes
5. Fontes de Receita
6. Recursos Principais
7. Atividades-Chave
8. Parcerias Principais
9. Estrutura de Custos

## Quando usar
- Startups definindo modelo de negócio
- Empresas estabelecidas revisando estratégia
- Novos produtos ou serviços
- Análise de concorrentes
- Planejamento estratégico`,
    tags: ['canvas', 'estrategia', 'modelo-negocio', 'planejamento', 'startup'],
    aplicabilidade: {
      problemas: ['falta de clareza estratégica', 'modelo de negócio confuso', 'necessidade de pivotagem'],
      contextos: ['startups', 'pequenas empresas', 'médias empresas', 'novos produtos'],
      nivel_maturidade: ['iniciante', 'intermediario', 'avancado'],
      tempo_aplicacao: '60-120 minutos'
    },
    metadados: {
      fonte: 'Business Model Generation - Osterwalder & Pigneur',
      complexidade: 'media',
      prerequisitos: ['conhecimento do negócio', 'dados de mercado']
    },
    ativo: true,
    versao: 1
  },
  {
    title: '5W2H - Plano de Ação',
    category: 'metodologia',
    content: `# 5W2H - Plano de Ação Estruturado

## O que é
Ferramenta de planejamento que organiza ações de forma clara e objetiva, respondendo a 7 questões essenciais.

## As 7 Questões

1. **What (O quê?)** - O que será feito?
2. **Why (Por quê?)** - Por que será feito?
3. **Where (Onde?)** - Onde será feito?
4. **When (Quando?)** - Quando será feito?
5. **Who (Quem?)** - Quem fará?
6. **How (Como?)** - Como será feito?
7. **How Much (Quanto?)** - Quanto custará?

## Quando usar
- Implementação de melhorias
- Projetos de mudança
- Resolução de problemas
- Planejamento de ações
- Atribuição de responsabilidades`,
    tags: ['5w2h', 'plano-acao', 'planejamento', 'execucao', 'implementacao'],
    aplicabilidade: {
      problemas: ['falta de clareza nas ações', 'responsabilidades indefinidas', 'projetos sem rumo'],
      contextos: ['qualquer porte', 'qualquer segmento', 'fase de execução'],
      nivel_maturidade: ['iniciante', 'intermediario', 'avancado'],
      tempo_aplicacao: '60-90 minutos'
    },
    metadados: {
      fonte: 'Gestão da Qualidade',
      complexidade: 'baixa',
      prerequisitos: ['ações identificadas', 'apoio da liderança']
    },
    ativo: true,
    versao: 1
  },
  {
    title: 'Cadeia de Valor - Value Chain',
    category: 'framework',
    content: `# Cadeia de Valor (Value Chain)

## O que é
Modelo conceitual criado por Michael Porter que descreve as atividades que uma organização realiza para criar valor.

## Atividades Primárias
1. Logística Interna
2. Operações
3. Logística Externa
4. Marketing e Vendas
5. Serviços

## Atividades de Apoio
1. Infraestrutura da Empresa
2. Gestão de Recursos Humanos
3. Desenvolvimento de Tecnologia
4. Aquisição/Compras

## Quando usar
- Análise estratégica da empresa
- Identificação de vantagens competitivas
- Otimização de processos
- Decisões de terceirização`,
    tags: ['cadeia-valor', 'value-chain', 'porter', 'estrategia', 'processos'],
    aplicabilidade: {
      problemas: ['falta de visão macro', 'processos desconectados', 'necessidade de priorização'],
      contextos: ['pequenas empresas', 'médias empresas', 'grandes empresas'],
      nivel_maturidade: ['intermediario', 'avancado'],
      tempo_aplicacao: '90-180 minutos'
    },
    metadados: {
      fonte: 'Michael Porter - Competitive Advantage',
      complexidade: 'media-alta',
      prerequisitos: ['conhecimento profundo do negócio', 'dados de custos']
    },
    ativo: true,
    versao: 1
  },
  {
    title: 'Matriz de Priorização - Impacto x Esforço',
    category: 'metodologia',
    content: `# Matriz de Priorização - Impacto x Esforço

## O que é
Ferramenta visual para priorizar iniciativas baseada em impacto e esforço.

## 4 Quadrantes

1. **Fazer Agora** (Alto Impacto, Baixo Esforço) - Quick Wins
2. **Pensar Mais** (Alto Impacto, Alto Esforço) - Projetos Estratégicos
3. **Ganhos Rápidos** (Baixo Impacto, Baixo Esforço) - Fill-ins
4. **Evitar** (Baixo Impacto, Alto Esforço) - Money Pits

## Quando usar
- Muitas melhorias possíveis, recursos limitados
- Necessidade de priorizar processos
- Decisões sobre onde investir primeiro
- Após diagnóstico, antes do plano de ação`,
    tags: ['priorizacao', 'matriz', 'impacto-esforco', 'quick-wins', 'decisao'],
    aplicabilidade: {
      problemas: ['muitas oportunidades identificadas', 'recursos limitados', 'necessidade de foco'],
      contextos: ['qualquer porte', 'qualquer segmento', 'após diagnóstico'],
      nivel_maturidade: ['iniciante', 'intermediario', 'avancado'],
      tempo_aplicacao: '60-90 minutos'
    },
    metadados: {
      fonte: 'Gestão de Projetos',
      complexidade: 'baixa',
      prerequisitos: ['lista de oportunidades', 'critérios claros']
    },
    ativo: true,
    versao: 1
  },
  {
    title: '5 Porquês - Análise de Causa Raiz',
    category: 'metodologia',
    content: `# 5 Porquês - Análise de Causa Raiz

## O que é
Técnica de questionamento iterativo para explorar relações de causa e efeito. Pergunte "Por quê?" cinco vezes para chegar à causa raiz.

## Como funciona

Problema → Por quê? → Resposta 1
Resposta 1 → Por quê? → Resposta 2
Resposta 2 → Por quê? → Resposta 3
Resposta 3 → Por quê? → Resposta 4
Resposta 4 → Por quê? → Causa Raiz

## Quando usar
- Problemas recorrentes
- Necessidade de identificar causa raiz
- Processos com falhas frequentes
- Antes de implementar soluções

## Benefícios
- Simples e rápido
- Vai além dos sintomas
- Promove pensamento profundo
- Previne recorrência`,
    tags: ['5-porques', 'causa-raiz', 'resolucao-problemas', 'qualidade', 'lean'],
    aplicabilidade: {
      problemas: ['problemas recorrentes', 'necessidade de causa raiz', 'soluções paliativas não funcionam'],
      contextos: ['qualquer porte', 'qualquer segmento', 'problemas operacionais'],
      nivel_maturidade: ['iniciante', 'intermediario'],
      tempo_aplicacao: '30-60 minutos'
    },
    metadados: {
      fonte: 'Toyota Production System',
      complexidade: 'baixa',
      prerequisitos: ['problema claramente definido', 'equipe que conhece o processo']
    },
    ativo: true,
    versao: 1
  }
];

(async () => {
  try {
    console.log('Inserting documents into knowledge base...\n');

    for (const doc of documents) {
      console.log(`Inserting: ${doc.title}`);
      const { data, error } = await supabase
        .from('knowledge_base_documents')
        .insert(doc)
        .select();

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Inserted successfully`);
      }
    }

    console.log('\n✅ All documents seeded');

    // Verify
    const { data: docs, error: queryError } = await supabase
      .from('knowledge_base_documents')
      .select('title, category, tags')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('\nQuery error:', queryError);
    } else {
      console.log(`\n📚 Total documents in knowledge base: ${docs.length}\n`);
      docs.forEach(doc => {
        console.log(`- ${doc.title} [${doc.category}]`);
        console.log(`  Tags: ${doc.tags.join(', ')}\n`);
      });
    }
  } catch (err) {
    console.error('Exception:', err.message);
    process.exit(1);
  }
})();
