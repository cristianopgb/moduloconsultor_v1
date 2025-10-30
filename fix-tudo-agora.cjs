const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const vars = {};
env.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) vars[k.trim()] = v.join('=').trim();
});

const supabase = createClient(vars.VITE_SUPABASE_URL, vars.VITE_SUPABASE_ANON_KEY);

async function main() {
  console.log('DELETANDO TUDO...\n');

  const { data: user } = await supabase.auth.getUser();
  if (!user || !user.user) {
    console.log('Usuario nao autenticado');
    return;
  }

  const userId = user.user.id;
  console.log('User ID:', userId, '\n');

  const { data: s, error: e1 } = await supabase
    .from('consultor_sessoes')
    .delete()
    .eq('user_id', userId)
    .select('id');

  console.log('Sessoes deletadas:', (s || []).length);

  const { data: j, error: e2 } = await supabase
    .from('jornadas_consultor')
    .delete()
    .eq('user_id', userId)
    .select('id');

  console.log('Jornadas deletadas:', (j || []).length);
  console.log('\nCOMPLETO!\n');
}

main();
