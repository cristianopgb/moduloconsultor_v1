const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  // Testar insert
  const { data, error } = await supabase
    .from('entregaveis_consultor')
    .insert({
      sessao_id: '00000000-0000-0000-0000-000000000000',
      jornada_id: '00000000-0000-0000-0000-000000000000',
      tipo: 'teste',
      titulo: 'Teste',
      slug: 'teste-123',
      etapa_origem: 'diagnostico'
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Erro:', error.message);
  } else {
    console.log('✅ Insert funcionou! ID:', data.id);
    // Deletar teste
    await supabase.from('entregaveis_consultor').delete().eq('id', data.id);
  }
}

main();
