const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env file manually
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyBackfill() {
  console.log('🔍 Checking sessões without jornada_id...');

  const { data: sessoes, error: checkError } = await supabase
    .from('consultor_sessoes')
    .select('id, user_id, conversation_id, empresa, estado_atual, contexto_negocio, progresso')
    .is('jornada_id', null);

  if (checkError) {
    console.error('❌ Error checking sessões:', checkError);
    return;
  }

  console.log(`📊 Found ${sessoes.length} sessões without jornada_id`);

  if (sessoes.length === 0) {
    console.log('✅ All sessões already have jornada_id!');
    return;
  }

  for (const sessao of sessoes) {
    console.log(`\n🔧 Processing sessão ${sessao.id}...`);

    // Create jornada
    const { data: jornada, error: jornadaError } = await supabase
      .from('jornadas_consultor')
      .insert({
        user_id: sessao.user_id,
        conversation_id: sessao.conversation_id,
        empresa_nome: sessao.empresa || 'Empresa',
        etapa_atual: sessao.estado_atual || 'anamnese',
        dados_anamnese: sessao.contexto_negocio || {},
        areas_priorizadas: [],
        progresso_geral: sessao.progresso || 0
      })
      .select('id')
      .single();

    if (jornadaError) {
      console.error(`❌ Error creating jornada for sessão ${sessao.id}:`, jornadaError);
      continue;
    }

    console.log(`✓ Created jornada ${jornada.id}`);

    // Link jornada to sessão
    const { error: updateError } = await supabase
      .from('consultor_sessoes')
      .update({ jornada_id: jornada.id })
      .eq('id', sessao.id);

    if (updateError) {
      console.error(`❌ Error linking jornada to sessão ${sessao.id}:`, updateError);
      continue;
    }

    console.log(`✓ Linked jornada to sessão ${sessao.id}`);
  }

  // Final check
  const { data: remaining, error: finalError } = await supabase
    .from('consultor_sessoes')
    .select('id', { count: 'exact', head: true })
    .is('jornada_id', null);

  if (finalError) {
    console.error('❌ Error in final check:', finalError);
    return;
  }

  console.log('\n✅ Backfill completed!');
  console.log(`📊 Sessões still without jornada_id: ${remaining?.length || 0}`);
}

applyBackfill().catch(console.error);
