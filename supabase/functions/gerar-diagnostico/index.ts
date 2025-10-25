import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GerarDiagnosticoRequest {
  jornada_id: string;
  processo_nome: string;
  conversation_id?: string;
}

/**
 * Geração AUTOMÁTICA de Diagnóstico (SEM FORMULÁRIO)
 *
 * Chamado automaticamente após BPMN ser gerado
 * Usa dados de: atributos_processo + entregável BPMN
 * Salva com UPSERT idempotente (por jornada_id + slug)
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jornada_id, processo_nome, conversation_id }: GerarDiagnosticoRequest = await req.json();

    if (!jornada_id || !processo_nome) {
      throw new Error('Campos obrigatórios: jornada_id, processo_nome');
    }

    console.log('[GERAR-DIAGNOSTICO] Request:', { jornada_id, processo_nome });

    // 1. Buscar jornada e contexto
    const { data: jornada } = await supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('id', jornada_id)
      .single();

    if (!jornada) {
      throw new Error('Jornada não encontrada');
    }

    // 2. Buscar atributos do processo no contexto_coleta
    const contexto = jornada.contexto_coleta || {};
    const atributos = contexto.atributos_processo?.[processo_nome];

    if (!atributos) {
      throw new Error(`Atributos do processo "${processo_nome}" não encontrados no contexto`);
    }

    console.log('[GERAR-DIAGNOSTICO] Atributos encontrados:', Object.keys(atributos));

    // 3. Buscar entregável BPMN (se existir)
    const { data: bpmnEntregavel } = await supabase
      .from('entregaveis_consultor')
      .select('html_conteudo')
      .eq('jornada_id', jornada_id)
      .eq('tipo', 'bpmn')
      .maybeSingle();

    console.log('[GERAR-DIAGNOSTICO] BPMN encontrado:', !!bpmnEntregavel);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');

    // 4. Preparar dados para IA
    const dadosProcesso = `
**Processo: ${processo_nome}**

**Atributos:**
- Objetivo: ${atributos.objetivo || '—'}
- Responsável: ${atributos.responsavel || '—'}
- Input: ${atributos.input || '—'}
- Output: ${atributos.output || '—'}
- Ferramentas: ${atributos.ferramentas || '—'}
- Frequência: ${atributos.frequencia || '—'}
- Tempo Médio: ${atributos.tempo_medio || '—'}
- Pessoas Envolvidas: ${atributos.pessoas_envolvidas || '—'}
- Documentação: ${atributos.documentacao || 'Não'}
- Sistemas: ${atributos.sistemas || '—'}
- Métricas: ${atributos.metricas || '—'}
- Problemas: ${atributos.problemas || '—'}
- Gargalos: ${atributos.gargalos || '—'}

${bpmnEntregavel ? '**Nota:** Modelagem BPMN AS-IS também foi realizada para este processo.' : ''}
`;

    const prompt = `Você é um consultor especialista em transformação organizacional. Analise o processo **${processo_nome}** e gere um diagnóstico completo baseado nos atributos coletados.

**Dados do Processo:**${dadosProcesso}

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

    console.log('[GERAR-DIAGNOSTICO] Diagnóstico gerado pela IA');

    // 6. Gerar HTML do diagnóstico
    const htmlConteudo = gerarHtmlDiagnostico(processo_nome, diagnostico);

    // 7. Salvar entregável com UPSERT idempotente
    const slug = `diagnostico-${processo_nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const titulo = `Diagnóstico: ${processo_nome}`;

    const { data: entregavel, error: entregavelError } = await supabase
      .from('entregaveis_consultor')
      .upsert({
        jornada_id: jornada_id,
        slug: slug,
        tipo: 'diagnostico',
        nome: titulo,
        titulo: titulo,
        html_conteudo: htmlConteudo,
        etapa_origem: 'execucao',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'jornada_id,slug',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (entregavelError) {
      console.error('[GERAR-DIAGNOSTICO] Error saving deliverable:', entregavelError);
      throw entregavelError;
    }

    console.log('[GERAR-DIAGNOSTICO] ✅ Diagnóstico salvo (UPSERT):', slug);

    // 8. Atualizar processo_checklist (marcar diagnóstico gerado)
    if (conversation_id) {
      try {
        await supabase
          .from('processo_checklist')
          .update({
            diagnostico_preenchido: true,
            diagnostico_ts: new Date().toISOString()
          })
          .eq('conversation_id', conversation_id)
          .eq('processo_nome', processo_nome);

        console.log('[GERAR-DIAGNOSTICO] ✅ processo_checklist atualizado');
      } catch (e) {
        console.warn('[GERAR-DIAGNOSTICO] Warning updating processo_checklist:', e);
      }
    }

    // 9. Registrar evento na timeline
    try {
      await supabase.from('timeline_consultor').insert({
        jornada_id: jornada_id,
        fase: 'execucao',
        evento: `Diagnóstico gerado automaticamente: ${processo_nome}`
      });
    } catch (e) {
      console.warn('[GERAR-DIAGNOSTICO] Timeline insert failed (non-critical):', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        entregavel_id: entregavel.id,
        slug: slug,
        diagnostico: diagnostico
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[GERAR-DIAGNOSTICO] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao gerar diagnóstico' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function gerarHtmlDiagnostico(processoNome: string, diagnostico: any): string {
  const pontosHtml = (diagnostico.pontos_fortes || []).map((p: string) => `<li class="sucesso">✅ ${p}</li>`).join('');
  const gapsHtml = (diagnostico.gaps_criticos || []).map((g: string) => `<li class="critico">⚠️ ${g}</li>`).join('');
  const riscosHtml = (diagnostico.riscos || []).map((r: string) => `<li class="risco">🚨 ${r}</li>`).join('');
  const oportunidadesHtml = (diagnostico.oportunidades || []).map((o: string) => `<li class="oportunidade">💡 ${o}</li>`).join('');
  const recomendacoesHtml = (diagnostico.recomendacoes || []).map((r: string, idx: number) => `<li class="recomendacao"><strong>${idx + 1}.</strong> ${r}</li>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Diagnóstico - ${processoNome}</title>
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
  <h1>Diagnóstico do Processo</h1>
  <p><strong>Processo:</strong> ${processoNome}</p>
  <p><em>Gerado automaticamente em: ${new Date().toLocaleDateString('pt-BR')}</em></p>

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
