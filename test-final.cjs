const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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
const supabase = createClient(supabaseUrl, supabaseKey);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testar() {
  console.log('\n=== TESTE COMPLETO DO SISTEMA ===\n');

  console.log('1. Criando sessao...');
  const { data: sessao, error: sessaoError } = await supabase
    .from('consultor_sessoes')
    .insert({
      titulo_problema: 'Teste de Consultoria',
      setor: 'Tecnologia',
      estado_atual: 'coleta',
      contexto_coleta: {},
      aguardando_validacao: null
    })
    .select()
    .single();

  if (sessaoError) {
    console.error('ERRO:', sessaoError.message);
    process.exit(1);
  }

  console.log('OK Sessao criada:', sessao.id, '\n');

  console.log('2. Testando consultor-rag (primeira mensagem)...');

  const response = await fetch(supabaseUrl + '/functions/v1/consultor-rag', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessao_id: sessao.id,
      message: 'Joao Silva, Diretor de TI'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ERRO Edge Function:', response.status);
    console.error(errorText);
    process.exit(1);
  }

  const data = await response.json();
  console.log('OK Resposta recebida');
  console.log('Fase:', data.fase);
  console.log('Progresso:', data.progresso + '%');
  console.log('Resposta:', data.reply.substring(0, 150) + '...\n');

  await sleep(1000);

  console.log('3. Enviando mais mensagens (completar anamnese)...');
  const respostas = [
    '45 anos, formacao em Engenharia',
    'TechFlow Sistemas Ltda',
    'Desenvolvimento de software customizado',
    'Faturamento mensal de R$ 200 mil',
    'Dificuldade em escalar sem perder qualidade',
    'Aumentar capacidade de entrega mantendo qualidade'
  ];

  for (let i = 0; i < respostas.length; i++) {
    console.log('Enviando turno', i + 2 + '/7...');

    const resp = await fetch(supabaseUrl + '/functions/v1/consultor-rag', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessao_id: sessao.id,
        message: respostas[i]
      })
    });

    if (!resp.ok) {
      console.error('ERRO no turno', i + 2);
      break;
    }

    const turnData = await resp.json();
    console.log('OK', turnData.fase, '-', turnData.progresso + '%');

    await sleep(1000);
  }

  console.log('\n4. Verificando resultados...');

  const { data: sessaoFinal } = await supabase
    .from('consultor_sessoes')
    .select('*')
    .eq('id', sessao.id)
    .single();

  const { data: mensagens } = await supabase
    .from('consultor_mensagens')
    .select('role')
    .eq('sessao_id', sessao.id);

  const { data: entregaveis } = await supabase
    .from('entregaveis_consultor')
    .select('nome, tipo, etapa_origem')
    .eq('sessao_id', sessao.id);

  const { data: timeline } = await supabase
    .from('timeline_consultor')
    .select('fase, evento')
    .eq('sessao_id', sessao.id);

  console.log('\n=== RESULTADOS ===\n');
  console.log('Fase atual:', sessaoFinal.estado_atual);
  console.log('Aguardando validacao:', sessaoFinal.aguardando_validacao || 'Nao');
  console.log('Mensagens:', mensagens?.length || 0);
  console.log('Entregaveis:', entregaveis?.length || 0);
  console.log('Timeline:', timeline?.length || 0);

  if (sessaoFinal.contexto_coleta?.anamnese) {
    console.log('\nContexto estruturado: SIM');
    console.log('Dados anamnese:', Object.keys(sessaoFinal.contexto_coleta.anamnese).length, 'campos');
  } else {
    console.log('\nContexto estruturado: NAO');
  }

  if (entregaveis && entregaveis.length > 0) {
    console.log('\nEntregaveis gerados:');
    entregaveis.forEach((e, i) => {
      console.log(i + 1 + '.', e.nome, '(' + e.tipo + ') - Fase:', e.etapa_origem);
    });
  }

  console.log('\n=== STATUS FINAL ===\n');

  let score = 0;
  if (mensagens && mensagens.length >= 14) {
    console.log('OK Historico completo (' + mensagens.length + ' mensagens)');
    score++;
  } else {
    console.log('PARCIAL Historico (' + (mensagens?.length || 0) + ' mensagens)');
  }

  if (sessaoFinal.contexto_coleta?.anamnese) {
    console.log('OK Contexto estruturado por fase');
    score++;
  } else {
    console.log('FALHA Contexto nao estruturado');
  }

  if (entregaveis && entregaveis.length > 0) {
    console.log('OK ' + entregaveis.length + ' entregavel(is) gerado(s)');
    score++;
  } else {
    console.log('FALHA Nenhum entregavel gerado');
  }

  if (timeline && timeline.length > 0) {
    console.log('OK Timeline registrada (' + timeline.length + ' eventos)');
    score++;
  } else {
    console.log('FALHA Timeline vazia');
  }

  console.log('\nSCORE:', score + '/4 verificacoes OK\n');

  if (score === 4) {
    console.log('SISTEMA FUNCIONANDO 100%!\n');
  } else if (score >= 2) {
    console.log('Sistema funcionando parcialmente.\n');
  } else {
    console.log('Sistema precisa de ajustes.\n');
  }
}

testar().catch(console.error);
