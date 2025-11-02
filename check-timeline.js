import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gljoasdvlaitplbmbtzg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsam9hc2R2bGFpdHBsYm1idHpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDAwOTE2NSwiZXhwIjoyMDY5NTg1MTY1fQ.TQOo5-Ri1jfHVZDQTxY-u3q5hFvGy1J7KQJhV7VWGp4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTimeline() {
  // Pegar sessão mais recente
  const { data: session } = await supabase
    .from('consultor_sessoes')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!session) {
    console.log('Nenhuma sessão encontrada');
    return;
  }

  console.log('Sessão ID:', session.id);
  console.log('Criada em:', session.created_at);

  // Verificar timeline
  const { data: timeline, count } = await supabase
    .from('timeline_consultor')
    .select('*', { count: 'exact' })
    .eq('sessao_id', session.id)
    .order('created_at', { ascending: true });

  console.log('\n=== TIMELINE ===');
  console.log('Total de eventos:', count);
  
  if (timeline && timeline.length > 0) {
    timeline.forEach((t, i) => {
      console.log(`\n[${i+1}] ${t.fase} - ${t.evento}`);
      console.log('   Metadata:', JSON.stringify(t.metadata));
    });
  } else {
    console.log('❌ TIMELINE VAZIA!');
  }

  // Verificar entregáveis
  const { data: entregaveis, count: countE } = await supabase
    .from('entregaveis_consultor')
    .select('nome, tipo, etapa_origem, created_at', { count: 'exact' })
    .eq('sessao_id', session.id)
    .order('created_at', { ascending: true });

  console.log('\n=== ENTREGÁVEIS ===');
  console.log('Total:', countE);
  
  if (entregaveis && entregaveis.length > 0) {
    entregaveis.forEach(e => {
      console.log(`- ${e.nome} (${e.tipo}) - ${e.etapa_origem}`);
    });
  }
}

checkTimeline().catch(console.error);
