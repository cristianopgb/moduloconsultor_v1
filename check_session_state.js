import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gljoasdvlaitplbmbtzg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSession() {
  // Get most recent session
  const { data: session, error } = await supabase
    .from('consultor_sessoes')
    .select('id, estado_atual, progresso, contexto_coleta, aguardando_validacao')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Erro:', error);
    return;
  }

  console.log('\n=== ESTADO DA SESSÃO ===');
  console.log('ID:', session.id);
  console.log('Estado Atual:', session.estado_atual);
  console.log('Progresso:', session.progresso);
  console.log('Aguardando Validação:', session.aguardando_validacao);
  console.log('\nContexto Coleta (keys):', Object.keys(session.contexto_coleta || {}));
  console.log('\n=== ESTRUTURA DO CONTEXTO ===');
  console.log(JSON.stringify(session.contexto_coleta, null, 2));

  // Check deliverables
  const { data: entregaveis } = await supabase
    .from('entregaveis_consultor')
    .select('nome, tipo, etapa_origem, created_at')
    .eq('sessao_id', session.id)
    .order('created_at', { ascending: true });

  console.log('\n=== ENTREGÁVEIS GERADOS ===');
  if (entregaveis && entregaveis.length > 0) {
    entregaveis.forEach(e => {
      console.log(`- ${e.nome} (${e.tipo}) - ${e.etapa_origem} - ${e.created_at}`);
    });
  } else {
    console.log('Nenhum entregável encontrado!');
  }

  // Check timeline
  const { data: timeline } = await supabase
    .from('timeline_consultor')
    .select('fase, evento, created_at')
    .eq('sessao_id', session.id)
    .order('created_at', { ascending: true });

  console.log('\n=== TIMELINE ===');
  if (timeline && timeline.length > 0) {
    timeline.forEach(t => {
      console.log(`- [${t.fase}] ${t.evento} - ${t.created_at}`);
    });
  } else {
    console.log('Timeline vazia!');
  }

  // Check messages count
  const { count } = await supabase
    .from('consultor_mensagens')
    .select('*', { count: 'exact', head: true })
    .eq('sessao_id', session.id);

  console.log('\n=== MENSAGENS ===');
  console.log('Total de mensagens:', count);
}

checkSession().catch(console.error);
