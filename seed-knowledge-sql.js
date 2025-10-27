import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Login as master user first
const MASTER_EMAIL = 'master@demo.com';
const MASTER_PASSWORD = 'master123'; // You'll need to know this or set it

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

## Benefícios
- Visão holística do processo
- Alinhamento rápido da equipe
- Identificação de gaps
- Base para melhorias`,
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
    }
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
9. Estrutura de Custos`,
    tags: ['canvas', 'estrategia', 'modelo-negocio', 'planejamento', 'startup'],
    aplicabilidade: {
      problemas: ['falta de clareza estratégica', 'modelo de negócio confuso'],
      contextos: ['startups', 'pequenas empresas', 'médias empresas'],
      nivel_maturidade: ['iniciante', 'intermediario', 'avancado'],
      tempo_aplicacao: '60-120 minutos'
    },
    metadados: {
      fonte: 'Osterwalder & Pigneur',
      complexidade: 'media'
    }
  },
  {
    title: '5W2H - Plano de Ação',
    category: 'metodologia',
    content: `# 5W2H - Plano de Ação Estruturado

## As 7 Questões
1. What (O quê?)
2. Why (Por quê?)
3. Where (Onde?)
4. When (Quando?)
5. Who (Quem?)
6. How (Como?)
7. How Much (Quanto?)`,
    tags: ['5w2h', 'plano-acao', 'planejamento', 'execucao'],
    aplicabilidade: {
      problemas: ['falta de clareza nas ações', 'responsabilidades indefinidas'],
      contextos: ['qualquer porte', 'qualquer segmento'],
      nivel_maturidade: ['iniciante', 'intermediario', 'avancado'],
      tempo_aplicacao: '60-90 minutos'
    },
    metadados: {
      fonte: 'Gestão da Qualidade',
      complexidade: 'baixa'
    }
  },
  {
    title: 'Matriz de Priorização - Impacto x Esforço',
    category: 'metodologia',
    content: `# Matriz de Priorização

## 4 Quadrantes
1. Fazer Agora (Alto Impacto, Baixo Esforço)
2. Pensar Mais (Alto Impacto, Alto Esforço)
3. Ganhos Rápidos (Baixo Impacto, Baixo Esforço)
4. Evitar (Baixo Impacto, Alto Esforço)`,
    tags: ['priorizacao', 'matriz', 'impacto-esforco', 'quick-wins'],
    aplicabilidade: {
      problemas: ['muitas oportunidades identificadas', 'recursos limitados'],
      contextos: ['qualquer porte', 'após diagnóstico'],
      nivel_maturidade: ['iniciante', 'intermediario'],
      tempo_aplicacao: '60-90 minutos'
    },
    metadados: {
      fonte: 'Gestão de Projetos',
      complexidade: 'baixa'
    }
  }
];

(async () => {
  try {
    console.log('Logging in as master user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: MASTER_EMAIL,
      password: MASTER_PASSWORD
    });

    if (authError) {
      console.error('❌ Auth error:', authError.message);
      console.log('\nNote: You need to login with master credentials to seed the knowledge base.');
      console.log('The knowledge base has RLS policies that only allow masters to insert documents.');
      process.exit(1);
    }

    console.log('✅ Logged in successfully\n');

    console.log('Inserting documents into knowledge base...\n');

    let successCount = 0;
    for (const doc of documents) {
      console.log(`Inserting: ${doc.title}`);
      const { data, error } = await supabase
        .from('knowledge_base_documents')
        .insert({
          ...doc,
          ativo: true,
          versao: 1
        })
        .select();

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Inserted successfully`);
        successCount++;
      }
    }

    console.log(`\n✅ ${successCount}/${documents.length} documents seeded successfully`);

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

    await supabase.auth.signOut();
  } catch (err) {
    console.error('Exception:', err.message);
    process.exit(1);
  }
})();
