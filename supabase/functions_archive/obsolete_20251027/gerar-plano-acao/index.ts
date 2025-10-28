import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GerarPlanoAcaoRequest {
  diagnostico_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { diagnostico_id }: GerarPlanoAcaoRequest = await req.json();

    if (!diagnostico_id) {
      throw new Error('Campo obrigatório: diagnostico_id');
    }

    const { data: diagnostico, error: diagnosticoError } = await supabase
      .from('diagnosticos_area')
      .select('*, areas_trabalho(*)')
      .eq('id', diagnostico_id)
      .single();

    if (diagnosticoError || !diagnostico) {
      throw new Error('Diagnóstico não encontrado');
    }

    if (diagnostico.status !== 'aprovado') {
      throw new Error('Diagnóstico precisa estar aprovado para gerar plano de ação');
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');

    const diagnosticoTexto = `
**Gaps Críticos:**
${diagnostico.gaps_criticos.map((g: string) => `- ${g}`).join('\n')}

**Oportunidades:**
${diagnostico.oportunidades.map((o: string) => `- ${o}`).join('\n')}

**Recomendações:**
${diagnostico.recomendacoes.map((r: string) => `- ${r}`).join('\n')}
`;

    const prompt = `Você é um consultor especialista em planos de ação. Com base no diagnóstico abaixo da área **${diagnostico.areas_trabalho.nome_area}**, gere um plano de ação 5W2H detalhado.

**Diagnóstico:**${diagnosticoTexto}

**Gere 5-8 ações** usando a metodologia 5W2H:

1. **What** (O quê) - Descrição clara da ação
2. **Why** (Por quê) - Justificativa e benefício esperado
3. **Where** (Onde) - Local/área onde será executada
4. **When** (Quando) - Prazo/cronograma
5. **Who** (Quem) - Responsável pela execução
6. **How** (Como) - Metodologia/passos de execução
7. **How Much** (Quanto) - Estimativa de custo/recursos

**Prioridade:** Alta, Média ou Baixa
**Status:** A Fazer

Retorne JSON no formato:
[
  {
    "what": "Ação 1",
    "why": "Justificativa",
    "where": "Local",
    "when": "Prazo",
    "who": "Responsável",
    "how": "Como executar",
    "how_much": "Custo estimado",
    "prioridade": "Alta"
  }
]

Gere o plano agora:`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é um consultor especialista. Retorne APENAS JSON válido com array de ações.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3500
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    let acoesTexto = openaiData.choices[0].message.content.trim();

    acoesTexto = acoesTexto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const acoes = JSON.parse(acoesTexto);

    const acoesInseridas = [];

    for (const acao of acoes) {
      const { data: acaoDb, error: acaoError } = await supabase
        .from('acoes_plano')
        .insert({
          diagnostico_id: diagnostico.id,
          what: acao.what,
          why: acao.why,
          where: acao.where || diagnostico.areas_trabalho.nome_area,
          when: acao.when,
          who: acao.who,
          how: acao.how,
          how_much: acao.how_much,
          prioridade: acao.prioridade || 'media',
          status: 'a_fazer'
        })
        .select()
        .single();

      if (acaoError) {
        console.error('Erro ao inserir ação:', acaoError);
        continue;
      }

      acoesInseridas.push(acaoDb);
    }

    const htmlConteudo = gerarHtmlPlanoAcao(diagnostico.areas_trabalho, acoesInseridas);

    const { data: entregavel, error: entregavelError } = await supabase
      .from('entregaveis_consultor')
      .insert({
        jornada_id: diagnostico.areas_trabalho.jornada_id,
        area_id: diagnostico.area_id,
        nome: `Plano de Ação 5W2H - ${diagnostico.areas_trabalho.nome_area}`,
        tipo: 'plano_acao',
        html_conteudo: htmlConteudo,
        etapa_origem: 'plano',
        data_geracao: new Date().toISOString()
      })
      .select()
      .single();

    if (entregavelError) throw entregavelError;

    await supabase
      .from('areas_trabalho')
      .update({ etapa_atual: 'implementacao' })
      .eq('id', diagnostico.area_id);

    return new Response(
      JSON.stringify({
        success: true,
        acoes_criadas: acoesInseridas.length,
        entregavel_id: entregavel.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao gerar plano de ação:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao gerar plano de ação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function gerarHtmlPlanoAcao(area: any, acoes: any[]): string {
  const acoesHtml = acoes.map((acao, idx) => `
    <tr>
      <td style="background: #f9fafb; font-weight: bold;">${idx + 1}</td>
      <td>${acao.what}</td>
      <td>${acao.why}</td>
      <td>${acao.where}</td>
      <td>${acao.when}</td>
      <td>${acao.who}</td>
      <td>${acao.how}</td>
      <td>${acao.how_much}</td>
      <td>
        <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; 
        background: ${acao.prioridade === 'alta' ? '#fef2f2' : acao.prioridade === 'media' ? '#fff7ed' : '#f0fdf4'};
        color: ${acao.prioridade === 'alta' ? '#dc2626' : acao.prioridade === 'media' ? '#ea580c' : '#16a34a'};">
          ${acao.prioridade.toUpperCase()}
        </span>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Plano de Ação 5W2H - ${area.nome_area}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; padding: 20px; }
    h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    th { background: #1e40af; color: white; padding: 12px; text-align: left; font-size: 13px; }
    td { padding: 10px; border: 1px solid #e5e7eb; font-size: 12px; }
    tr:nth-child(even) { background: #f9fafb; }
    tr:hover { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>Plano de Ação 5W2H</h1>
  <p><strong>Área:</strong> ${area.nome_area}</p>
  <p><em>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</em></p>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>O QUÊ (What)</th>
        <th>POR QUÊ (Why)</th>
        <th>ONDE (Where)</th>
        <th>QUANDO (When)</th>
        <th>QUEM (Who)</th>
        <th>COMO (How)</th>
        <th>QUANTO (How Much)</th>
        <th>Prioridade</th>
      </tr>
    </thead>
    <tbody>
      ${acoesHtml}
    </tbody>
  </table>

  <div style="margin-top: 40px; padding: 20px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px;">
    <h3 style="color: #1e40af; margin-top: 0;">Próximos Passos</h3>
    <ol style="color: #1e40af;">
      <li>Revisar e validar todas as ações com os stakeholders</li>
      <li>Definir datas específicas para cada ação</li>
      <li>Alocar recursos necessários</li>
      <li>Iniciar execução pelas ações de alta prioridade</li>
      <li>Acompanhar progresso semanalmente</li>
    </ol>
  </div>
</body>
</html>`;
}
