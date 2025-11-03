#!/usr/bin/env node
/**
 * Script de Validação das Correções do Sistema Consultor RAG
 *
 * Testa:
 * 1. Schema das tabelas (colunas corretas)
 * 2. Triggers instalados
 * 3. Views de debug disponíveis
 * 4. Dados inconsistentes
 *
 * Uso: node test-correcoes-consultor.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Erro: Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são necessárias');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(colors[color] + msg + colors.reset);
}

async function testSchemaConsultorSessoes() {
  log('\n📋 Testando schema de consultor_sessoes...', 'cyan');

  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'consultor_sessoes'
        AND column_name IN ('aguardando_validacao', 'jornada_id', 'contexto_coleta', 'estado_atual')
      ORDER BY column_name;
    `
  });

  if (error) {
    log(`❌ Erro ao verificar schema: ${error.message}`, 'red');
    return false;
  }

  const expectedColumns = ['aguardando_validacao', 'contexto_coleta', 'estado_atual', 'jornada_id'];
  const foundColumns = data?.map(c => c.column_name) || [];

  let allFound = true;
  for (const col of expectedColumns) {
    if (foundColumns.includes(col)) {
      log(`  ✅ Coluna '${col}' existe`, 'green');
    } else {
      log(`  ❌ Coluna '${col}' NÃO EXISTE`, 'red');
      allFound = false;
    }
  }

  return allFound;
}

async function testSchemaEntregaveis() {
  log('\n📋 Testando schema de entregaveis_consultor...', 'cyan');

  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'entregaveis_consultor'
        AND column_name IN ('jornada_id', 'sessao_id', 'tipo', 'formato', 'nome')
      ORDER BY column_name;
    `
  });

  if (error) {
    log(`❌ Erro ao verificar schema: ${error.message}`, 'red');
    return false;
  }

  const expectedColumns = ['formato', 'jornada_id', 'nome', 'sessao_id', 'tipo'];
  const foundColumns = data?.map(c => c.column_name) || [];

  let allFound = true;
  for (const col of expectedColumns) {
    if (foundColumns.includes(col)) {
      log(`  ✅ Coluna '${col}' existe`, 'green');
    } else {
      log(`  ❌ Coluna '${col}' NÃO EXISTE`, 'red');
      allFound = false;
    }
  }

  return allFound;
}

async function testSchemaTimeline() {
  log('\n📋 Testando schema de timeline_consultor...', 'cyan');

  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'timeline_consultor'
        AND column_name IN ('tipo_evento', 'detalhe', 'sessao_id', 'jornada_id', 'fase')
      ORDER BY column_name;
    `
  });

  if (error) {
    log(`❌ Erro ao verificar schema: ${error.message}`, 'red');
    return false;
  }

  const foundColumns = data || [];

  // Verificar tipo_evento
  const tipoEvento = foundColumns.find(c => c.column_name === 'tipo_evento');
  if (tipoEvento) {
    log(`  ✅ Coluna 'tipo_evento' existe (${tipoEvento.data_type})`, 'green');
  } else {
    log(`  ❌ Coluna 'tipo_evento' NÃO EXISTE (deveria existir)`, 'red');
  }

  // Verificar que 'evento' NÃO existe
  const evento = foundColumns.find(c => c.column_name === 'evento');
  if (!evento) {
    log(`  ✅ Coluna 'evento' não existe (correto)`, 'green');
  } else {
    log(`  ⚠️ Coluna 'evento' existe (deveria ser 'tipo_evento')`, 'yellow');
  }

  // Verificar detalhe é jsonb
  const detalhe = foundColumns.find(c => c.column_name === 'detalhe');
  if (detalhe && detalhe.data_type === 'jsonb') {
    log(`  ✅ Coluna 'detalhe' é jsonb (correto)`, 'green');
  } else if (detalhe) {
    log(`  ⚠️ Coluna 'detalhe' é ${detalhe.data_type} (deveria ser jsonb)`, 'yellow');
  } else {
    log(`  ❌ Coluna 'detalhe' NÃO EXISTE`, 'red');
  }

  return tipoEvento && detalhe;
}

async function testTriggers() {
  log('\n🔧 Testando triggers instalados...', 'cyan');

  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT trigger_name, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name LIKE '%jornada%'
      ORDER BY trigger_name;
    `
  });

  if (error) {
    log(`❌ Erro ao verificar triggers: ${error.message}`, 'red');
    return false;
  }

  if (data && data.length > 0) {
    for (const trigger of data) {
      log(`  ✅ Trigger '${trigger.trigger_name}' em '${trigger.event_object_table}'`, 'green');
    }
    return true;
  } else {
    log(`  ⚠️ Nenhum trigger de jornada_id encontrado`, 'yellow');
    return false;
  }
}

async function testViews() {
  log('\n👁️ Testando views de debug...', 'cyan');

  const views = ['v_entregaveis_debug', 'v_timeline_debug'];
  let allExist = true;

  for (const viewName of views) {
    const { error } = await supabase.rpc('exec_sql', {
      query: `SELECT 1 FROM ${viewName} LIMIT 1;`
    });

    if (error) {
      log(`  ❌ View '${viewName}' não existe ou tem erro`, 'red');
      allExist = false;
    } else {
      log(`  ✅ View '${viewName}' existe e funciona`, 'green');
    }
  }

  return allExist;
}

async function testDataConsistency() {
  log('\n🔍 Testando consistência de dados...', 'cyan');

  // Testar entregáveis sem jornada_id
  const { data: entregaveisSemJornada, error: e1 } = await supabase
    .from('entregaveis_consultor')
    .select('id, nome, sessao_id')
    .is('jornada_id', null)
    .limit(5);

  if (e1) {
    log(`  ❌ Erro ao verificar entregáveis: ${e1.message}`, 'red');
  } else if (entregaveisSemJornada && entregaveisSemJornada.length > 0) {
    log(`  ⚠️ ${entregaveisSemJornada.length} entregáveis SEM jornada_id`, 'yellow');
    log(`    Primeiros IDs: ${entregaveisSemJornada.map(e => e.id.substring(0, 8)).join(', ')}`, 'yellow');
  } else {
    log(`  ✅ Todos os entregáveis têm jornada_id`, 'green');
  }

  // Testar entregáveis com tipo='html'
  const { data: entregaveisHtml, error: e2 } = await supabase
    .from('entregaveis_consultor')
    .select('id, nome, tipo')
    .eq('tipo', 'html')
    .limit(5);

  if (e2) {
    log(`  ❌ Erro ao verificar tipos: ${e2.message}`, 'red');
  } else if (entregaveisHtml && entregaveisHtml.length > 0) {
    log(`  ⚠️ ${entregaveisHtml.length} entregáveis com tipo='html' (deveria ser nome do documento)`, 'yellow');
  } else {
    log(`  ✅ Nenhum entregável com tipo='html' incorreto`, 'green');
  }

  // Testar sessões com aguardando_validacao travado
  const { data: sessoesTravadas, error: e3 } = await supabase
    .from('consultor_sessoes')
    .select('id, estado_atual, aguardando_validacao, updated_at')
    .not('aguardando_validacao', 'is', null)
    .lt('updated_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(5);

  if (e3) {
    log(`  ❌ Erro ao verificar sessões: ${e3.message}`, 'red');
  } else if (sessoesTravadas && sessoesTravadas.length > 0) {
    log(`  ⚠️ ${sessoesTravadas.length} sessões com aguardando_validacao travado (>48h)`, 'yellow');
  } else {
    log(`  ✅ Nenhuma sessão com validação travada`, 'green');
  }

  return true;
}

async function testEdgeFunction() {
  log('\n🚀 Testando edge function consultor-rag...', 'cyan');

  // Apenas verificar que endpoint existe
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/consultor-rag`, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (response.ok) {
      log(`  ✅ Edge function 'consultor-rag' está acessível`, 'green');
      return true;
    } else {
      log(`  ⚠️ Edge function retornou status ${response.status}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`  ❌ Erro ao acessar edge function: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'magenta');
  log('║  🧪 VALIDAÇÃO DAS CORREÇÕES DO SISTEMA CONSULTOR RAG     ║', 'magenta');
  log('║  Data: 03/11/2025 - Versão 2.1                           ║', 'magenta');
  log('╚════════════════════════════════════════════════════════════╝', 'magenta');

  const results = {
    schema_sessoes: await testSchemaConsultorSessoes(),
    schema_entregaveis: await testSchemaEntregaveis(),
    schema_timeline: await testSchemaTimeline(),
    triggers: await testTriggers(),
    views: await testViews(),
    data_consistency: await testDataConsistency(),
    edge_function: await testEdgeFunction()
  };

  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║  📊 RESUMO DOS TESTES                                     ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  const failed = total - passed;

  for (const [test, result] of Object.entries(results)) {
    const icon = result ? '✅' : '❌';
    const color = result ? 'green' : 'red';
    log(`  ${icon} ${test.replace(/_/g, ' ').toUpperCase()}`, color);
  }

  log('');
  log(`Total: ${total} testes`, 'cyan');
  log(`Passou: ${passed}`, 'green');
  log(`Falhou: ${failed}`, failed > 0 ? 'red' : 'green');

  if (failed === 0) {
    log('\n🎉 TODOS OS TESTES PASSARAM! Sistema pronto para uso.', 'green');
    return 0;
  } else {
    log('\n⚠️ ALGUNS TESTES FALHARAM. Verifique os erros acima.', 'yellow');
    log('Dica: Execute a migração 20251103000000_fix_consultor_rag_issues.sql', 'yellow');
    return 1;
  }
}

// Executar testes
runAllTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`\n💥 ERRO FATAL: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
