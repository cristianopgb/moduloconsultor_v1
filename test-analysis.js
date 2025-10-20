#!/usr/bin/env node
// Script de teste para o sistema de análise inteligente

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Erro: Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env');
  process.exit(1);
}

async function testAnalysis() {
  console.log('🧪 Testando Sistema de Análise Inteligente\n');

  // Passo 1: Obter token de autenticação
  console.log('1️⃣ Obtendo token de autenticação...');

  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('❌ Uso: node test-analysis.js <email> <password> [dataset_id]');
    console.log('\nExemplo:');
    console.log('  node test-analysis.js user@example.com senha123');
    console.log('\nOu para usar dataset específico:');
    console.log('  node test-analysis.js user@example.com senha123 abc-123-def');
    process.exit(1);
  }

  try {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!authResponse.ok) {
      throw new Error('Falha na autenticação');
    }

    const authData = await authResponse.json();
    const token = authData.access_token;
    console.log('✅ Autenticado com sucesso\n');

    // Passo 2: Listar ou usar dataset específico
    let datasetId = process.argv[4];

    if (!datasetId) {
      console.log('2️⃣ Buscando datasets disponíveis...');

      const datasetsResponse = await fetch(`${SUPABASE_URL}/rest/v1/datasets?select=id,original_filename,row_count,processing_status&processing_status=eq.completed&order=created_at.desc&limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      });

      const datasets = await datasetsResponse.json();

      if (!datasets || datasets.length === 0) {
        console.log('❌ Nenhum dataset encontrado. Faça upload de um arquivo primeiro.');
        process.exit(1);
      }

      console.log('\n📊 Datasets disponíveis:');
      datasets.forEach((ds, i) => {
        console.log(`  ${i + 1}. ${ds.original_filename} (${ds.row_count} linhas) - ID: ${ds.id}`);
      });

      datasetId = datasets[0].id;
      console.log(`\n✅ Usando dataset: ${datasets[0].original_filename}\n`);
    }

    // Passo 3: Executar análise
    console.log('3️⃣ Executando análise inteligente...');
    console.log('   Pergunta: "Faça uma análise geral dos dados"\n');

    const analysisResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataset_id: datasetId,
        analysis_request: 'Faça uma análise geral dos dados, mostrando principais métricas e tendências',
      }),
    });

    if (!analysisResponse.ok) {
      const error = await analysisResponse.text();
      throw new Error(`Análise falhou: ${error}`);
    }

    const result = await analysisResponse.json();

    // Passo 4: Mostrar resultados
    console.log('✅ Análise concluída!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DETALHES DA EXECUÇÃO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (result.result?.execution_details) {
      const details = result.result.execution_details;
      console.log(`📈 Linhas Analisadas: ${details.total_rows_analyzed?.toLocaleString()}`);
      console.log(`🔍 Queries Executadas: ${details.queries_executed}`);
      console.log(`📋 Colunas Disponíveis: ${details.columns_available}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 INSIGHTS IDENTIFICADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (result.result?.insights && result.result.insights.length > 0) {
      result.result.insights.forEach((insight, i) => {
        console.log(`${i + 1}. ${insight.title}`);
        console.log(`   ${insight.description}`);
        console.log(`   Tipo: ${insight.type} | Confiança: ${insight.confidence}%\n`);
      });
    } else {
      console.log('Nenhum insight identificado.\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📐 MÉTRICAS CALCULADAS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (result.result?.calculations && result.result.calculations.length > 0) {
      result.result.calculations.forEach(calc => {
        console.log(`• ${calc.metric}: ${calc.formatted || calc.value}`);
        if (calc.interpretation) {
          console.log(`  → ${calc.interpretation}`);
        }
      });
      console.log('');
    } else {
      console.log('Nenhuma métrica calculada.\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 GRÁFICOS GERADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (result.result?.charts && result.result.charts.length > 0) {
      result.result.charts.forEach((chart, i) => {
        console.log(`${i + 1}. ${chart.title} (${chart.type})`);
        console.log(`   Labels: ${chart.data.labels.join(', ')}`);
        console.log(`   Dados: ${chart.data.datasets[0].data.join(', ')}\n`);
      });
    } else {
      console.log('Nenhum gráfico gerado.\n');
    }

    if (result.result?.recommendations && result.result.recommendations.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ RECOMENDAÇÕES');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      result.result.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Teste concluído com sucesso!');
    console.log(`📝 Analysis ID: ${result.analysis_id}`);

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

testAnalysis();
