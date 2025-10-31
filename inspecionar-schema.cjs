const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspecionarSchema() {
  console.log('\n=== INSPECAO DO SCHEMA REAL ===\n');

  const tabelas = [
    'consultor_sessoes',
    'jornadas_consultor',
    'consultor_mensagens',
    'entregaveis_consultor',
    'timeline_consultor'
  ];

  for (const tabela of tabelas) {
    console.log(`\n--- TABELA: ${tabela} ---`);

    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`ERRO: ${error.message}\n`);
      continue;
    }

    if (!data || data.length === 0) {
      console.log('Tabela vazia, vendo estrutura da migration...\n');
      continue;
    }

    const colunas = Object.keys(data[0]);
    console.log('COLUNAS:', colunas.join(', '));
    console.log('');
  }

  console.log('\n=== CHECANDO COLUNAS ESPECIFICAS ===\n');

  const checkColunas = [
    ['consultor_sessoes', 'aguardando_validacao'],
    ['consultor_sessoes', 'setor'],
    ['consultor_sessoes', 'contexto_coleta'],
    ['jornadas_consultor', 'aguardando_validacao'],
    ['jornadas_consultor', 'setor'],
    ['jornadas_consultor', 'contexto']
  ];

  for (const [tabela, coluna] of checkColunas) {
    try {
      const { error } = await supabase
        .from(tabela)
        .select(coluna)
        .limit(1);

      if (error) {
        console.log(`AUSENTE: ${tabela}.${coluna} - ${error.message}`);
      } else {
        console.log(`OK: ${tabela}.${coluna} existe`);
      }
    } catch (e) {
      console.log(`ERRO: ${tabela}.${coluna} - ${e.message}`);
    }
  }

  console.log('\n=== RECOMENDACAO ===\n');
  console.log('Baseado no resultado acima, vou decidir qual correcao aplicar.\n');
}

inspecionarSchema().catch(console.error);
