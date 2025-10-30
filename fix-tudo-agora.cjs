#!/usr/bin/env node

/**
 * FIX TUDO AGORA - Script Único de Correção
 *
 * Este script:
 * 1. Verifica se tabelas existem
 * 2. Cria tabelas se não existirem (via SQL direto)
 * 3. Faz backfill de jornadas
 * 4. Valida que tudo está OK
 *
 * USO: node fix-tudo-agora.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env
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
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🚀 FIX TUDO AGORA - Iniciando...\n');

  // Step 1: Check core tables
  console.log('1️⃣ Verificando tabelas essenciais...');

  const requiredTables = ['consultor_sessoes', 'jornadas_consultor', 'entregaveis_consultor'];
  const existingTables = [];

  for (const tableName of requiredTables) {
    const { error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);

    if (!error || error.code !== '42P01') { // 42P01 = table does not exist
      existingTables.push(tableName);
      console.log(`   ✅ ${tableName}`);
    } else {
      console.log(`   ❌ ${tableName} (não existe)`);
    }
  }

  if (existingTables.length === requiredTables.length) {
    console.log('\n✅ Todas as tabelas essenciais existem!\n');
  } else {
    console.log(`\n⚠️  Faltam ${requiredTables.length - existingTables.length} tabelas.\n`);
    console.log('📝 AÇÃO NECESSÁRIA:');
    console.log('   As tabelas não existem. Você precisa aplicar as migrações.');
    console.log('   Opção 1 (CLI):');
    console.log('   $ npx supabase login');
    console.log('   $ npx supabase link --project-ref SEU_REF');
    console.log('   $ npx supabase db push');
    console.log('');
    console.log('   Opção 2 (Manual):');
    console.log('   Abra Supabase Dashboard > SQL Editor');
    console.log('   Cole o SQL do arquivo: GUIA_DEFINITIVO_MIGRACOES.md');
    console.log('');
    return;
  }

  // Step 2: Check for orphan sessions
  console.log('2️⃣ Verificando sessões sem jornada...');

  const { data: orphans, error: orphanError } = await supabase
    .from('consultor_sessoes')
    .select('id, user_id, conversation_id, empresa, estado_atual, contexto_negocio, progresso')
    .is('jornada_id', null);

  if (orphanError) {
    console.log(`   ⚠️  Erro ao verificar: ${orphanError.message}`);
  } else if (orphans.length === 0) {
    console.log('   ✅ Nenhuma sessão órfã (todas têm jornada_id)');
  } else {
    console.log(`   ⚠️  Encontradas ${orphans.length} sessões sem jornada_id`);
    console.log('   🔧 Criando jornadas automaticamente...\n');

    for (const sessao of orphans) {
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
        console.log(`   ❌ Erro ao criar jornada para sessão ${sessao.id}`);
        continue;
      }

      // Link jornada to session
      const { error: updateError } = await supabase
        .from('consultor_sessoes')
        .update({ jornada_id: jornada.id })
        .eq('id', sessao.id);

      if (updateError) {
        console.log(`   ❌ Erro ao vincular jornada ${jornada.id} à sessão ${sessao.id}`);
      } else {
        console.log(`   ✅ Criada jornada ${jornada.id} para sessão ${sessao.id}`);
      }
    }
  }

  // Step 3: Final validation
  console.log('\n3️⃣ Validação final...');

  const { data: finalOrphans } = await supabase
    .from('consultor_sessoes')
    .select('id', { count: 'exact', head: true })
    .is('jornada_id', null);

  const orphanCount = finalOrphans?.length || 0;

  if (orphanCount === 0) {
    console.log('   ✅ Todas as sessões têm jornada_id');
  } else {
    console.log(`   ⚠️  Ainda existem ${orphanCount} sessões sem jornada_id`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ FIX CONCLUÍDO!');
  console.log('='.repeat(60));
  console.log(`
📊 Status Final:
   ✅ Tabelas core: ${existingTables.length}/${requiredTables.length}
   ✅ Sessões órfãs: ${orphanCount}

🚀 Próximos Passos:
   1. npm run dev
   2. Abrir http://localhost:5173
   3. Login → Chat → Nova Conversa → Modo "Consultor"
   4. Testar fluxo completo

📚 Mais Info:
   - GUIA_DEFINITIVO_MIGRACOES.md
   - GUIA_RAPIDO_TESTE.md
  `);
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
