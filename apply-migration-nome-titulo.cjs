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
const supabaseKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('📦 Aplicando migração: fix_nome_titulo_entregaveis...');

  const sql = fs.readFileSync('supabase/migrations/20251030150000_fix_nome_titulo_entregaveis.sql', 'utf8');

  // Remove comments
  const cleanSql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('/*'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: cleanSql });

  if (error) {
    console.error('❌ Erro ao aplicar migração:', error);
    process.exit(1);
  }

  console.log('✅ Migração aplicada com sucesso!');

  // Test insert
  const { data: testData, error: testError } = await supabase
    .from('entregaveis_consultor')
    .insert({
      sessao_id: '00000000-0000-0000-0000-000000000000',
      jornada_id: '00000000-0000-0000-0000-000000000000',
      tipo: 'teste',
      titulo: 'Teste Migração',
      slug: 'teste-' + Date.now(),
      etapa_origem: 'diagnostico'
    })
    .select('id, titulo')
    .single();

  if (testError) {
    console.error('❌ Teste falhou:', testError.message);
  } else {
    console.log('✅ Teste passou! ID:', testData.id, 'Titulo:', testData.titulo);
    // Cleanup
    await supabase.from('entregaveis_consultor').delete().eq('id', testData.id);
  }
}

main();
