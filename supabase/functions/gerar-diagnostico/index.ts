import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GerarDiagnosticoRequest {
  area_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { area_id }: GerarDiagnosticoRequest = await req.json();

    if (!area_id) {
      throw new Error('Campo obrigatório: area_id');
    }

    const { data: area, error: areaError } = await supabase
      .from('areas_trabalho')
      .select('*')
      .eq('id', area_id)
      .single();

    if (areaError || !area) {
      throw new Error('Área não encontrada');
    }

    const { data: processos, error: processosError } = await supabase
      .from('processos_mapeados')
      .select('*')
      .eq('area_id', area_id);

    if (processosError) throw processosError;

    if (!processos || processos.length === 0) {
      throw new Error('Nenhum processo mapeado para esta área');
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');

    const processosTexto = processos.map(p => `
**${p.nome_processo}**
- Input: ${p.input || 'N/A'}
- Output: ${p.output || 'N/A'}
- Ferramentas: ${p.ferramentas || 'N/A'}
- Métricas: ${p.metricas || 'N/A'}
- Regras: ${p.regras_negocio || 'N/A'}
- Fluxo: ${p.fluxo_detalhado || 'N/A'}
- Pessoas: ${p.pessoas_envolvidas || 'N/A'}
`).join('\n');

    const prompt = `Você é um consultor especialista em transformação organizacional. Analise os processos da área **${area.nome_area}** e gere um diagnóstico completo.

**Processos Mapeados:**${processosTexto}

**Estrutura do Diagnóstico:**

1. **Pontos Fortes** (3-5 itens)
   - Identifique o que está funcionando bem

2. **Gaps Críticos** (3-5 itens)
   - Identifique lacunas graves que precisam de atenção imediata

3. **Riscos Identificados** (3-5 itens)
   - Identifique riscos operacionais, de compliance, ou estratégicos

4. **Oportunidades de Melhoria** (5-8 itens)
   - Sugira melhorias específicas e acionáveis

5. **Recomendações Prioritárias** (3 itens)
   - Liste as 3 ações mais importantes a serem tomadas

**IMPORTANTE:**
- Seja específico e prático
- Use linguagem clara e objetiva
- Baseie-se nos dados fornecidos
- Formate em JSON com a seguinte estrutura:
{
  "pontos_fortes": ["item1", "item2", ...],
  "gaps_criticos": ["item1", "item2", ...],
  "riscos": ["item1", "item2", ...],
  "oportunidades": ["item1", "item2", ...],
  "recomendacoes": ["item1", "item2", "item3"]
}

Gere o diagnóstico agora:`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um consultor especialista. Retorne APENAS JSON válido, sem markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2500
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    let diagnosticoTexto = openaiData.choices[0].message.content.trim();

    diagnosticoTexto = diagnosticoTexto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const diagnostico = JSON.parse(diagnosticoTexto);

    const { data: diagnosticoDb, error: diagnosticoError } = await supabase
      .from('diagnosticos_area')
      .insert({
        area_id: area.id,
        pontos_fortes: diagnostico.pontos_fortes || [],
        gaps_criticos: diagnostico.gaps_criticos || [],
        riscos: diagnostico.riscos || [],
        oportunidades: diagnostico.oportunidades || [],
        recomendacoes: diagnostico.recomendacoes || [],
        status: 'pendente'
      })
      .select()
      .single();

    if (diagnosticoError) throw diagnosticoError;

    const htmlConteudo = gerarHtmlDiagnostico(area, diagnostico);

    const { data: entregavel, error: entregavelError } = await supabase
      .from('entregaveis_consultor')
      .insert({
        jornada_id: area.jornada_id,
        area_id: area.id,
        nome: `Diagnóstico - ${area.nome_area}`,
        tipo: 'diagnostico',
        html_conteudo: htmlConteudo,
        etapa_origem: 'analise',
        data_geracao: new Date().toISOString()
      })
      .select()
      .single();

    if (entregavelError) throw entregavelError;

    return new Response(
      JSON.stringify({
        success: true,
        diagnostico_id: diagnosticoDb.id,
        entregavel_id: entregavel.id,
        diagnostico
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao gerar diagnóstico:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao gerar diagnóstico' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function gerarHtmlDiagnostico(area: any, diagnostico: any): string {
  const pontosHtml = diagnostico.pontos_fortes.map((p: string) => `<li class="sucesso">✅ ${p}</li>`).join('');
  const gapsHtml = diagnostico.gaps_criticos.map((g: string) => `<li class="critico">⚠️ ${g}</li>`).join('');
  const riscosHtml = diagnostico.riscos.map((r: string) => `<li class="risco">🚨 ${r}</li>`).join('');
  const oportunidadesHtml = diagnostico.oportunidades.map((o: string) => `<li class="oportunidade">💡 ${o}</li>`).join('');
  const recomendacoesHtml = diagnostico.recomendacoes.map((r: string, idx: number) => `<li class="recomendacao"><strong>${idx + 1}.</strong> ${r}</li>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Diagnóstico - ${area.nome_area}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; }
    h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; }
    .section { margin: 25px 0; padding: 20px; border-radius: 8px; }
    .sucesso-section { background: #f0fdf4; border-left: 4px solid #22c55e; }
    .critico-section { background: #fef2f2; border-left: 4px solid #ef4444; }
    .risco-section { background: #fff7ed; border-left: 4px solid #f97316; }
    .oportunidade-section { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .recomendacao-section { background: #faf5ff; border-left: 4px solid #a855f7; }
    ul { list-style: none; padding: 0; }
    li { padding: 12px; margin: 8px 0; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .sucesso { border-left: 3px solid #22c55e; }
    .critico { border-left: 3px solid #ef4444; }
    .risco { border-left: 3px solid #f97316; }
    .oportunidade { border-left: 3px solid #3b82f6; }
    .recomendacao { border-left: 3px solid #a855f7; }
  </style>
</head>
<body>
  <h1>Diagnóstico da Área</h1>
  <p><strong>Área:</strong> ${area.nome_area}</p>
  <p><em>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</em></p>

  <div class="section sucesso-section">
    <h2>Pontos Fortes</h2>
    <ul>${pontosHtml}</ul>
  </div>

  <div class="section critico-section">
    <h2>Gaps Críticos</h2>
    <ul>${gapsHtml}</ul>
  </div>

  <div class="section risco-section">
    <h2>Riscos Identificados</h2>
    <ul>${riscosHtml}</ul>
  </div>

  <div class="section oportunidade-section">
    <h2>Oportunidades de Melhoria</h2>
    <ul>${oportunidadesHtml}</ul>
  </div>

  <div class="section recomendacao-section">
    <h2>Recomendações Prioritárias</h2>
    <ul>${recomendacoesHtml}</ul>
  </div>
</body>
</html>`;
}
