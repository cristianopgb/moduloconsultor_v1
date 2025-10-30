const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('consultor_sessoes')
    .select('id, estado_atual, contexto_coleta, empresa, setor')
    .eq('id', 'dffcc7c3-dd2b-4979-a124-63330cad49b5')
    .maybeSingle();
  
  console.log('Sessão no banco:', JSON.stringify(data, null, 2));
}

check();
