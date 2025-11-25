#!/usr/bin/env node

/**
 * Script para verificar sincronização entre jornadas_consultor e consultor_sessoes
 *
 * Uso: node verify-timeline-sync.cjs [conversation_id]
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySync(conversationId) {
  console.log('🔍 Verificando sincronização da timeline...\n');

  // Buscar jornada pelo conversation_id
  const { data: jornada, error: jornadaError } = await supabase
    .from('jornadas_consultor')
    .select('id, etapa_atual, progresso_geral, updated_at, conversation_id')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (jornadaError) {
    console.error('❌ Erro ao buscar jornada:', jornadaError.message);
    return;
  }

  if (!jornada) {
    console.log('⚠️  Nenhuma jornada encontrada para conversation_id:', conversationId);
    console.log('\n📋 Listando últimas 5 jornadas:');

    const { data: jornadas } = await supabase
      .from('jornadas_consultor')
      .select('id, conversation_id, etapa_atual, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (jornadas && jornadas.length > 0) {
      console.table(jornadas);
      console.log('\n💡 Use: node verify-timeline-sync.cjs <conversation_id>');
    } else {
      console.log('Nenhuma jornada encontrada no sistema.');
    }
    return;
  }

  console.log('📍 JORNADA ENCONTRADA:');
  console.log('  ID:', jornada.id);
  console.log('  Conversation ID:', jornada.conversation_id);
  console.log('  Etapa Atual:', jornada.etapa_atual);
  console.log('  Progresso:', jornada.progresso_geral);
  console.log('  Última Atualização:', new Date(jornada.updated_at).toLocaleString());
  console.log();

  // Buscar sessões relacionadas
  const { data: sessoes, error: sessoesError } = await supabase
    .from('consultor_sessoes')
    .select('id, estado_atual, progresso, updated_at')
    .eq('jornada_id', jornada.id)
    .order('updated_at', { ascending: false });

  if (sessoesError) {
    console.error('❌ Erro ao buscar sessões:', sessoesError.message);
    return;
  }

  if (!sessoes || sessoes.length === 0) {
    console.log('⚠️  Nenhuma sessão encontrada para esta jornada');
    return;
  }

  console.log(`📋 SESSÕES RELACIONADAS (${sessoes.length}):\n`);

  let allInSync = true;
  const sessoesTable = sessoes.map((sessao, idx) => {
    const inSync = sessao.estado_atual === jornada.etapa_atual;
    if (!inSync) allInSync = false;

    return {
      '#': idx + 1,
      'ID Sessão': sessao.id.substring(0, 8) + '...',
      'Estado Sessão': sessao.estado_atual,
      'Etapa Jornada': jornada.etapa_atual,
      'Sincronizado': inSync ? '✅' : '❌',
      'Atualizado': new Date(sessao.updated_at).toLocaleTimeString()
    };
  });

  console.table(sessoesTable);

  // Status final
  console.log('\n' + '='.repeat(60));
  if (allInSync) {
    console.log('✅ STATUS: TODAS AS SESSÕES SINCRONIZADAS');
    console.log('   A timeline deve estar funcionando corretamente.');
  } else {
    console.log('❌ STATUS: DESSINCRONIZAÇÃO DETECTADA');
    console.log('   Algumas sessões têm estado_atual diferente da etapa_atual da jornada.');
    console.log('\n   Possíveis causas:');
    console.log('   1. Edge Function consultor-rag não foi deployada');
    console.log('   2. Sessões antigas criadas antes do fix');
    console.log('   3. Erro durante atualização da fase');
  }
  console.log('='.repeat(60));

  // Timeline
  console.log('\n📅 TIMELINE (últimos 5 eventos):');
  const { data: timeline } = await supabase
    .from('timeline_consultor')
    .select('fase, tipo_evento, created_at')
    .eq('jornada_id', jornada.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (timeline && timeline.length > 0) {
    const timelineTable = timeline.map((evento, idx) => ({
      '#': idx + 1,
      'Fase': evento.fase,
      'Evento': evento.tipo_evento,
      'Data/Hora': new Date(evento.created_at).toLocaleString()
    }));
    console.table(timelineTable);
  } else {
    console.log('  Nenhum evento registrado na timeline.');
  }

  // Recomendações
  console.log('\n💡 PRÓXIMOS PASSOS:');
  if (!allInSync) {
    console.log('  1. Verifique se a Edge Function foi deployada:');
    console.log('     npx supabase functions deploy consultor-rag');
    console.log('  2. Interaja com o Consultor para criar nova mudança de fase');
    console.log('  3. Execute este script novamente para verificar');
  } else {
    console.log('  1. Teste a timeline no frontend');
    console.log('  2. Abra console do browser (F12)');
    console.log('  3. Procure por logs:');
    console.log('     [LateralConsultor] Jornada updated via realtime');
    console.log('     [JornadaTimeline] Etapa atual changed to');
  }
}

// Executar
const conversationId = process.argv[2];

if (!conversationId) {
  console.log('❌ Uso: node verify-timeline-sync.cjs <conversation_id>');
  console.log('\nListando últimas 5 jornadas...\n');

  (async () => {
    const { data: jornadas } = await supabase
      .from('jornadas_consultor')
      .select('id, conversation_id, etapa_atual, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (jornadas && jornadas.length > 0) {
      console.table(jornadas);
      console.log('\n💡 Escolha um conversation_id da lista acima e execute:');
      console.log('   node verify-timeline-sync.cjs <conversation_id>');
    } else {
      console.log('Nenhuma jornada encontrada no sistema.');
    }
  })();
} else {
  verifySync(conversationId).catch(console.error);
}
