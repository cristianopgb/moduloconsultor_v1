const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gljoasdvlaitplbmbtzg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsam9hc2R2bGFpdHBsYm1idHpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDAwOTE2NSwiZXhwIjoyMDY5NTg1MTY1fQ.wgMtl5FYxRrRfq2Qs-uLHTQRv8s0yvkh1bVb3LwF8aY'
);

async function auditCompleteSystem() {
  console.log('='.repeat(80));
  console.log('AUDITORIA COMPLETA DO SISTEMA CONSULTOR');
  console.log('='.repeat(80));
  console.log();

  // 1. TABELAS E COLUNAS
  console.log('1. TABELAS PRINCIPAIS:');
  console.log('-'.repeat(80));
  
  const tables = [
    'consultor_sessoes',
    'consultor_mensagens',
    'entregaveis_consultor',
    'timeline_consultor',
    'acoes_plano',
    'kanban_cards',
    'gamificacao_consultor'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ ${table}: ERRO - ${error.message}`);
    } else {
      const columns = data && data[0] ? Object.keys(data[0]) : [];
      console.log(`✅ ${table}: ${columns.length} colunas`);
      console.log(`   Colunas: ${columns.join(', ')}`);
    }
  }

  console.log();
  console.log('2. SESSÃO DE TESTE:');
  console.log('-'.repeat(80));
  
  const { data: sessao } = await supabase
    .from('consultor_sessoes')
    .select('*')
    .eq('id', 'f9982abe-3b9d-41b1-a3d5-27593291e7f4')
    .single();

  if (sessao) {
    console.log('Estado atual:', sessao.estado_atual);
    console.log('Aguardando validação:', sessao.aguardando_validacao);
    console.log('Progresso:', sessao.progresso);
    console.log('Contexto keys:', Object.keys(sessao.contexto_coleta || {}).join(', '));
    
    if (sessao.contexto_coleta) {
      console.log('Fase no contexto:', sessao.contexto_coleta.fase_atual);
      console.log('Tem anamnese nested?', !!sessao.contexto_coleta.anamnese);
      if (sessao.contexto_coleta.anamnese) {
        console.log('Campos anamnese:', Object.keys(sessao.contexto_coleta.anamnese).join(', '));
      }
    }
  }

  console.log();
  console.log('3. MENSAGENS:');
  console.log('-'.repeat(80));
  
  const { data: messages, error: msgError } = await supabase
    .from('consultor_mensagens')
    .select('id, role, created_at')
    .eq('sessao_id', 'f9982abe-3b9d-41b1-a3d5-27593291e7f4')
    .order('created_at', { ascending: true });

  console.log(`Total mensagens: ${messages?.length || 0}`);
  if (msgError) console.log('Erro:', msgError.message);

  console.log();
  console.log('4. ENTREGÁVEIS:');
  console.log('-'.repeat(80));
  
  const { data: entregaveis } = await supabase
    .from('entregaveis_consultor')
    .select('id, nome, titulo, tipo, etapa_origem, created_at')
    .eq('sessao_id', 'f9982abe-3b9d-41b1-a3d5-27593291e7f4')
    .order('created_at', { ascending: true });

  console.log(`Total entregáveis: ${entregaveis?.length || 0}`);
  if (entregaveis && entregaveis.length > 0) {
    entregaveis.forEach(e => {
      console.log(`  - ${e.nome} (${e.etapa_origem}) - ${e.created_at}`);
    });
  }

  console.log();
  console.log('5. TIMELINE:');
  console.log('-'.repeat(80));
  
  const { data: timeline } = await supabase
    .from('timeline_consultor')
    .select('id, fase, evento, created_at')
    .eq('sessao_id', 'f9982abe-3b9d-41b1-a3d5-27593291e7f4')
    .order('created_at', { ascending: true });

  console.log(`Total eventos timeline: ${timeline?.length || 0}`);
  if (timeline && timeline.length > 0) {
    timeline.forEach(t => {
      console.log(`  - ${t.fase}: ${t.evento} - ${t.created_at}`);
    });
  }

  console.log();
  console.log('6. AÇÕES E KANBAN:');
  console.log('-'.repeat(80));
  
  const { data: acoes } = await supabase
    .from('acoes_plano')
    .select('id, nome, status')
    .eq('sessao_id', 'f9982abe-3b9d-41b1-a3d5-27593291e7f4');

  console.log(`Total ações: ${acoes?.length || 0}`);

  const { data: cards } = await supabase
    .from('kanban_cards')
    .select('id, titulo, status')
    .eq('sessao_id', 'f9982abe-3b9d-41b1-a3d5-27593291e7f4');

  console.log(`Total cards kanban: ${cards?.length || 0}`);

  console.log();
  console.log('7. GAMIFICAÇÃO:');
  console.log('-'.repeat(80));
  
  const { data: gamif } = await supabase
    .from('gamificacao_consultor')
    .select('*')
    .eq('sessao_id', 'f9982abe-3b9d-41b1-a3d5-27593291e7f4')
    .maybeSingle();

  if (gamif) {
    console.log(`XP Total: ${gamif.xp_total}`);
    console.log(`Nível: ${gamif.nivel}`);
    console.log(`Última fase concluída: ${gamif.ultima_fase_concluida}`);
  } else {
    console.log('Sem dados de gamificação');
  }

  console.log();
  console.log('='.repeat(80));
  console.log('DIAGNÓSTICO:');
  console.log('='.repeat(80));
  
  const issues = [];
  
  if (!sessao) {
    issues.push('❌ Sessão não encontrada');
  } else {
    if (sessao.estado_atual === 'coleta') {
      issues.push('⚠️  Estado ainda em "coleta" (deveria ser "mapeamento")');
    }
    if (!entregaveis || entregaveis.length === 0) {
      issues.push('❌ Nenhum entregável gerado (deveria ter anamnese)');
    }
    if (!timeline || timeline.length === 0) {
      issues.push('❌ Timeline vazia (deveria ter transição de fase)');
    }
    if (messages && messages.length > 16 && sessao.estado_atual === 'coleta') {
      issues.push('⚠️  Muitas mensagens mas ainda em coleta (loop confirmado)');
    }
  }

  if (issues.length === 0) {
    console.log('✅ Sistema funcionando corretamente!');
  } else {
    console.log('PROBLEMAS ENCONTRADOS:');
    issues.forEach(issue => console.log(issue));
  }
  
  console.log('='.repeat(80));
}

auditCompleteSystem().catch(console.error);
