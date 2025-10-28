const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://gljoasdvlaitplbmbtzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsam9hc2R2bGFpdHBsYm1idHpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDAwOTE2NSwiZXhwIjoyMDY5NTg1MTY1fQ.BqEqPO5fMaI5WpEkkvQKdcw-JQl5c0PBxe0JB3OBGCY';

const supabase = createClient(supabaseUrl, supabaseKey);

const sectors = [
  {
    setor_nome: 'Saúde',
    setor_descricao: 'Clínicas, hospitais, consultórios, laboratórios',
    kpis: [
      { nome: 'Taxa de Ocupação', descricao: '% de leitos ou salas ocupados', formula: '(Leitos Ocupados / Total Leitos) × 100', meta_ideal: '75-85%' },
      { nome: 'Tempo Médio de Espera', descricao: 'Tempo que paciente aguarda atendimento', formula: 'Soma Tempos de Espera / Número de Pacientes', meta_ideal: '< 30 minutos' },
      { nome: 'No-Show Rate', descricao: 'Taxa de faltas em consultas', formula: '(Consultas Faltadas / Total Agendadas) × 100', meta_ideal: '< 10%' }
    ],
    perguntas_anamnese: [
      { campo: 'tipo_estabelecimento', pergunta: 'Tipo de estabelecimento?', tipo: 'select', opcoes: ['Consultório', 'Clínica', 'Hospital', 'Laboratório'] },
      { campo: 'especialidades', pergunta: 'Quais especialidades atende?', tipo: 'text' },
      { campo: 'num_profissionais', pergunta: 'Quantos profissionais de saúde?', tipo: 'number' }
    ],
    metodologias_recomendadas: ['SIPOC', '5W2H', 'Matriz de Priorização'],
    problemas_comuns: ['Longa fila de espera', 'Alta taxa de no-show', 'Baixa produtividade médica', 'Gestão de agenda ineficiente'],
    entregaveis_tipicos: ['Protocolo de Atendimento', 'Fluxo de Agendamento Otimizado', 'SLA de Atendimento'],
    tags: ['saude', 'clinica', 'hospital', 'medicina'],
    prioridade: 9
  },
  {
    setor_nome: 'Educação',
    setor_descricao: 'Escolas, cursos, universidades, treinamentos',
    kpis: [
      { nome: 'Taxa de Evasão', descricao: '% de alunos que abandonam', formula: '(Alunos Evadidos / Total Matriculados) × 100', meta_ideal: '< 10%' },
      { nome: 'NPS', descricao: 'Satisfação dos alunos', formula: '% Promotores - % Detratores', meta_ideal: '> 60' },
      { nome: 'Taxa de Conversão', descricao: '% de leads que matriculam', formula: '(Matrículas / Leads) × 100', meta_ideal: '> 20%' }
    ],
    perguntas_anamnese: [
      { campo: 'tipo_ensino', pergunta: 'Tipo de ensino oferecido?', tipo: 'select', opcoes: ['Presencial', 'Online', 'Híbrido'] },
      { campo: 'nivel_ensino', pergunta: 'Nível de ensino?', tipo: 'multiselect', opcoes: ['Fundamental', 'Médio', 'Superior', 'Cursos Livres'] },
      { campo: 'num_alunos', pergunta: 'Quantos alunos ativos?', tipo: 'number' }
    ],
    metodologias_recomendadas: ['Business Model Canvas', '5W2H', 'SIPOC'],
    problemas_comuns: ['Alta taxa de evasão', 'Baixa conversão de leads', 'Inadimplência elevada', 'Dificuldade de escalar'],
    entregaveis_tipicos: ['Plano de Retenção de Alunos', 'Funil de Conversão Otimizado', 'Jornada do Aluno'],
    tags: ['educacao', 'escola', 'curso', 'ensino'],
    prioridade: 8
  },
  {
    setor_nome: 'Alimentação',
    setor_descricao: 'Restaurantes, bares, lanchonetes, food service',
    kpis: [
      { nome: 'CMV', descricao: '% do custo dos ingredientes', formula: '(Custo Ingredientes / Faturamento) × 100', meta_ideal: '28-35%' },
      { nome: 'Ticket Médio', descricao: 'Valor médio por cliente', formula: 'Faturamento / Número de Clientes', meta_ideal: 'Crescimento constante' },
      { nome: 'Taxa de Ocupação', descricao: '% de mesas ocupadas', formula: '(Mesas Ocupadas / Total Mesas) × 100', meta_ideal: '> 70%' }
    ],
    perguntas_anamnese: [
      { campo: 'tipo_estabelecimento', pergunta: 'Tipo de estabelecimento?', tipo: 'select', opcoes: ['Restaurante', 'Bar', 'Lanchonete', 'Delivery'] },
      { campo: 'capacidade_lugares', pergunta: 'Capacidade de lugares?', tipo: 'number' },
      { campo: 'faz_delivery', pergunta: 'Trabalha com delivery?', tipo: 'select', opcoes: ['Sim, próprio', 'Sim, por apps', 'Não'] }
    ],
    metodologias_recomendadas: ['SIPOC', 'Cadeia de Valor', '5W2H'],
    problemas_comuns: ['CMV alto', 'Falta de padronização', 'Rotatividade de funcionários', 'Tempo de preparo longo'],
    entregaveis_tipicos: ['Ficha Técnica de Pratos', 'Plano de Redução de CMV', 'Cardápio Engenhado'],
    tags: ['alimentacao', 'restaurante', 'bar', 'gastronomia'],
    prioridade: 7
  },
  {
    setor_nome: 'Logística e Transportes',
    setor_descricao: 'Transportadoras, entregas, armazenagem, distribuição',
    kpis: [
      { nome: 'OTIF', descricao: 'Entregas no prazo e completas', formula: '(Entregas OTIF / Total Entregas) × 100', meta_ideal: '> 95%' },
      { nome: 'Custo por Km', descricao: 'Custo operacional por km', formula: 'Custos Totais / Total Km Rodados', meta_ideal: 'Redução contínua' },
      { nome: 'Taxa de Ocupação de Frota', descricao: '% da capacidade utilizada', formula: '(Peso Transportado / Capacidade Total) × 100', meta_ideal: '> 80%' }
    ],
    perguntas_anamnese: [
      { campo: 'tipo_operacao', pergunta: 'Tipo de operação?', tipo: 'multiselect', opcoes: ['Transporte Rodoviário', 'Armazenagem', 'Distribuição Urbana'] },
      { campo: 'tamanho_frota', pergunta: 'Tamanho da frota?', tipo: 'text' },
      { campo: 'area_atuacao', pergunta: 'Área de atuação?', tipo: 'select', opcoes: ['Local', 'Regional', 'Nacional'] }
    ],
    metodologias_recomendadas: ['SIPOC', 'Cadeia de Valor', '5 Porquês'],
    problemas_comuns: ['Rotas não otimizadas', 'Alto custo de combustível', 'Atrasos recorrentes', 'Ociosidade de veículos'],
    entregaveis_tipicos: ['Plano de Roteirização', 'Matriz de Custos Logísticos', 'SLA de Entregas'],
    tags: ['logistica', 'transportes', 'entregas'],
    prioridade: 6
  },
  {
    setor_nome: 'Hotelaria e Turismo',
    setor_descricao: 'Hotéis, pousadas, resorts, agências de viagem',
    kpis: [
      { nome: 'Taxa de Ocupação', descricao: '% de quartos ocupados', formula: '(Quartos Ocupados / Total Quartos) × 100', meta_ideal: '> 70%' },
      { nome: 'RevPAR', descricao: 'Revenue per Available Room', formula: 'Receita de Hospedagem / Total Quartos Disponíveis', meta_ideal: 'Crescimento constante' },
      { nome: 'NPS', descricao: 'Satisfação do hóspede', formula: '% Promotores - % Detratores', meta_ideal: '> 70' }
    ],
    perguntas_anamnese: [
      { campo: 'tipo_estabelecimento', pergunta: 'Tipo de estabelecimento?', tipo: 'select', opcoes: ['Hotel', 'Pousada', 'Resort', 'Hostel'] },
      { campo: 'num_quartos', pergunta: 'Número de quartos?', tipo: 'number' },
      { campo: 'classificacao', pergunta: 'Classificação?', tipo: 'select', opcoes: ['3 estrelas', '4 estrelas', '5 estrelas'] }
    ],
    metodologias_recomendadas: ['Business Model Canvas', 'SIPOC', '5W2H'],
    problemas_comuns: ['Baixa taxa de ocupação', 'Sazonalidade alta', 'Dependência de OTAs', 'Custos operacionais altos'],
    entregaveis_tipicos: ['Estratégia de Revenue Management', 'Plano de Marketing Digital', 'Protocolo de Atendimento'],
    tags: ['hotel', 'turismo', 'hospedagem'],
    prioridade: 5
  }
];

(async () => {
  console.log('🚀 Iniciando carga em massa de Sector Adapters...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const sector of sectors) {
    try {
      const { data, error } = await supabase
        .from('sector_adapters')
        .insert({
          setor_nome: sector.setor_nome,
          setor_descricao: sector.setor_descricao,
          kpis: sector.kpis,
          perguntas_anamnese: sector.perguntas_anamnese,
          metodologias_recomendadas: sector.metodologias_recomendadas,
          problemas_comuns: sector.problemas_comuns,
          entregaveis_tipicos: sector.entregaveis_tipicos,
          tags: sector.tags,
          prioridade: sector.prioridade,
          ativo: true
        })
        .select();

      if (error) {
        if (error.code === '23505') {
          console.log(`⚠️  ${sector.setor_nome} - Já existe (pulando)`);
        } else {
          console.error(`❌ ${sector.setor_nome} - Erro:`, error.message);
          errorCount++;
        }
      } else {
        console.log(`✅ ${sector.setor_nome} - Inserido com sucesso!`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ ${sector.setor_nome} - Exceção:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Resumo da Carga:`);
  console.log(`   ✅ Sucesso: ${successCount}`);
  console.log(`   ❌ Erros: ${errorCount}`);
  console.log(`   📦 Total: ${sectors.length}`);

  // Verificar total no banco
  const { count } = await supabase
    .from('sector_adapters')
    .select('*', { count: 'exact', head: true })
    .eq('ativo', true);

  console.log(`\n🗄️  Total de adapters ativos no banco: ${count}`);

  // Listar todos
  const { data: allSectors } = await supabase
    .from('sector_adapters')
    .select('setor_nome, prioridade, tags')
    .eq('ativo', true)
    .order('prioridade', { ascending: false });

  console.log(`\n📋 Adapters disponíveis:`);
  allSectors?.forEach(s => {
    console.log(`   ${s.prioridade} - ${s.setor_nome} [${s.tags.join(', ')}]`);
  });

  console.log('\n✨ Carga concluída!');
})();
