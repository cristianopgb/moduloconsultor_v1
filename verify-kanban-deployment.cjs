#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.error('Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('🔍 Verificando deployment do Sistema Kanban Avançado...\n');

  let allOk = true;

  // 1. Verificar novas colunas em kanban_cards
  console.log('1️⃣  Verificando colunas da tabela kanban_cards...');
  try {
    const { data, error } = await supabase
      .from('kanban_cards')
      .select('id, observacoes, tags, prioridade, progresso, responsavel_id, sessao_id')
      .limit(1);

    if (error) {
      console.error('   ❌ Erro:', error.message);
      console.error('   📋 Ação: Execute a migração 20251105000000_expand_kanban_system.sql');
      allOk = false;
    } else {
      console.log('   ✅ Colunas adicionadas com sucesso!');
    }
  } catch (err) {
    console.error('   ❌ Erro ao verificar colunas:', err.message);
    allOk = false;
  }

  // 2. Verificar tabela acao_anexos
  console.log('\n2️⃣  Verificando tabela acao_anexos...');
  try {
    const { data, error } = await supabase
      .from('acao_anexos')
      .select('id')
      .limit(1);

    if (error) {
      console.error('   ❌ Tabela não encontrada:', error.message);
      console.error('   📋 Ação: Execute a migração 20251105000000_expand_kanban_system.sql');
      allOk = false;
    } else {
      console.log('   ✅ Tabela acao_anexos criada!');
    }
  } catch (err) {
    console.error('   ❌ Erro ao verificar tabela:', err.message);
    allOk = false;
  }

  // 3. Verificar tabela project_files
  console.log('\n3️⃣  Verificando tabela project_files...');
  try {
    const { data, error } = await supabase
      .from('project_files')
      .select('id')
      .limit(1);

    if (error) {
      console.error('   ❌ Tabela não encontrada:', error.message);
      console.error('   📋 Ação: Execute a migração 20251105000000_expand_kanban_system.sql');
      allOk = false;
    } else {
      console.log('   ✅ Tabela project_files criada!');
    }
  } catch (err) {
    console.error('   ❌ Erro ao verificar tabela:', err.message);
    allOk = false;
  }

  // 4. Verificar tabela acao_historico
  console.log('\n4️⃣  Verificando tabela acao_historico...');
  try {
    const { data, error } = await supabase
      .from('acao_historico')
      .select('id')
      .limit(1);

    if (error) {
      console.error('   ❌ Tabela não encontrada:', error.message);
      console.error('   📋 Ação: Execute a migração 20251105000000_expand_kanban_system.sql');
      allOk = false;
    } else {
      console.log('   ✅ Tabela acao_historico criada!');
    }
  } catch (err) {
    console.error('   ❌ Erro ao verificar tabela:', err.message);
    allOk = false;
  }

  // 5. Verificar storage bucket
  console.log('\n5️⃣  Verificando bucket de storage...');
  try {
    const { data: buckets, error } = await supabase
      .storage
      .listBuckets();

    if (error) {
      console.error('   ❌ Erro ao listar buckets:', error.message);
      allOk = false;
    } else {
      const projectAttachmentsBucket = buckets.find(b => b.id === 'project-attachments');
      if (projectAttachmentsBucket) {
        console.log('   ✅ Bucket project-attachments criado!');
      } else {
        console.error('   ❌ Bucket project-attachments não encontrado');
        console.error('   📋 Ação: Execute a migração ou crie manualmente no Dashboard');
        allOk = false;
      }
    }
  } catch (err) {
    console.error('   ❌ Erro ao verificar storage:', err.message);
    allOk = false;
  }

  // 6. Verificar edge function
  console.log('\n6️⃣  Verificando edge function agente-execucao...');
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/agente-execucao`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          jornada_id: 'test',
          message: 'test'
        })
      }
    );

    // Esperamos erro 400 ou 500, mas não 404
    if (response.status === 404) {
      console.error('   ❌ Edge function não encontrada (404)');
      console.error('   📋 Ação: Deploy a função com: npx supabase functions deploy agente-execucao');
      allOk = false;
    } else {
      console.log('   ✅ Edge function agente-execucao deployada!');
      if (response.status === 500) {
        const data = await response.json();
        if (data.error?.includes('OPENAI_API_KEY')) {
          console.warn('   ⚠️  OPENAI_API_KEY não configurada');
          console.warn('   📋 Ação: Configure com: npx supabase secrets set OPENAI_API_KEY=sua-chave');
        }
      }
    }
  } catch (err) {
    console.error('   ❌ Erro ao verificar função:', err.message);
    allOk = false;
  }

  // Resultado final
  console.log('\n' + '='.repeat(60));
  if (allOk) {
    console.log('✅ TUDO PRONTO! Sistema Kanban Avançado está funcionando!');
    console.log('\n📖 Próximos passos:');
    console.log('   1. Acesse o chat do consultor');
    console.log('   2. Clique na aba "Kanban"');
    console.log('   3. Clique em "Abrir Gestão de Projetos"');
    console.log('   4. Explore todas as funcionalidades!');
  } else {
    console.log('❌ ATENÇÃO! Algumas verificações falharam.');
    console.log('\n📋 Consulte DEPLOY_KANBAN_SYSTEM.md para instruções detalhadas.');
    console.log('   Execute as ações recomendadas acima e rode este script novamente.');
  }
  console.log('='.repeat(60) + '\n');

  process.exit(allOk ? 0 : 1);
}

verify().catch(err => {
  console.error('\n💥 Erro fatal:', err.message);
  process.exit(1);
});
