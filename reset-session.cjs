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

async function main() {
  // Deletar sessão problemática
  const { error: deleteError } = await supabase
    .from('consultor_sessoes')
    .delete()
    .eq('id', '24a2175b-5805-4a18-8939-a23204dd775b');

  if (deleteError) {
    console.error('Error deleting session:', deleteError);
  } else {
    console.log('✅ Sessão antiga deletada com sucesso!');
  }

  // Verificar se ainda existem sessões
  const { data, error } = await supabase
    .from('consultor_sessoes')
    .select('id, estado_atual, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📊 Sessões restantes:');
  console.log(JSON.stringify(data, null, 2));
}

main();
