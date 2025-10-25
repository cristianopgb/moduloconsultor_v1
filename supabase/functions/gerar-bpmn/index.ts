// supabase/functions/gerar-bpmn/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Gera BPMN AS-IS (XML) para uma área (ou processo específico) e cria/atualiza o entregável.
 * Requer envs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey  = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
    }
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { area_id, processo_id } = await req.json();
    if (!area_id) throw new Error('Campo obrigatório: area_id');

    // --- Área ---
    const { data: area, error: areaError } = await supabase
      .from('areas_trabalho')
      .select('*')
      .eq('id', area_id)
      .single();

    if (areaError || !area) throw new Error('Área não encontrada');

    // --- Processos mapeados (da área OU 1 específico) ---
    let processosQuery = supabase
      .from('processos_mapeados')
      .select('*')
      .eq('area_id', area_id);

    if (processo_id) {
      processosQuery = processosQuery.eq('id', processo_id);
    }

    const { data: processos, error: processosError } = await processosQuery;
    if (processosError) throw processosError;
    if (!processos || processos.length === 0) {
      throw new Error('Nenhum processo mapeado encontrado para gerar BPMN');
    }

    // --- Monta prompt com dados reais do(s) processo(s) ---
    const processosTexto = processos.map((p) => `
**Processo: ${p.nome_processo}**
- Input: ${p.input || 'N/A'}
- Output: ${p.output || 'N/A'}
- Ferramentas/Sistemas: ${p.ferramentas || 'N/A'}
- Métricas/Metas: ${p.metricas || 'N/A'}
- Regras de Negócio: ${p.regras_negocio || 'N/A'}
- Passo a Passo (AS-IS): ${p.fluxo_detalhado || 'N/A'}
- Pessoas/Times: ${p.pessoas_envolvidas || 'N/A'}
`).join('\n');

    const prompt = `Você é um especialista em BPMN 2.0. Gere apenas o XML (sem markdown) para o AS-IS da(s) rotina(s) abaixo.

Área: ${area.nome_area}

${processosTexto}

INSTRUÇÕES:
1) XML BPMN 2.0 válido (namespaces, process, startEvent, tasks, exclusiveGateway quando aplicável, endEvent)
2) IDs únicos, labels claros em português
3) Conexões completas (sequenceFlow) e fluxo coerente
4) Se existirem múltiplos processos, crie lanes ou agrupamento lógico mantendo um único <process> coerente
5) Responder apenas com o XML (sem comentários e sem markdown)`;

    // --- Chamada ao LLM ---
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um gerador rigoroso de BPMN 2.0. Retorne somente XML válido (sem markdown).',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!openaiResp.ok) {
      const detail = await safeJson(openaiResp);
      throw new Error(`OpenAI API error: ${openaiResp.status} ${openaiResp.statusText} ${detail ? JSON.stringify(detail) : ''}`);
    }

    const openaiData = await openaiResp.json();
    let bpmnXml: string = (openaiData?.choices?.[0]?.message?.content || '').trim();

    // Limpa cercas de código caso venham
    bpmnXml = bpmnXml.replace(/```xml\s*/gi, '').replace(/```\s*$/gi, '').trim();

    // Garante cabeçalho mínimo
    if (!bpmnXml.startsWith('<?xml')) {
      bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>\n${bpmnXml}`;
    }

    // Validação básica
    if (!bpmnXml.includes('<definitions') || !bpmnXml.includes('<process')) {
      throw new Error('A resposta do modelo não parece ser um XML BPMN 2.0 válido.');
    }

    // --- Persiste XML nos processos da área (ou no único) ---
    for (const p of processos) {
      await supabase
        .from('processos_mapeados')
        .update({ fluxo_bpmn_xml: bpmnXml })
        .eq('id', p.id);
    }

    // --- Entregável (atualiza o último da mesma etapa/área para evitar duplicação) ---
    const htmlConteudo = gerarHtmlComBpmn(area, bpmnXml);

    // Busca o último "bpmn" desta área e etapa 'as_is'
    const { data: ultimo } = await supabase
      .from('entregaveis_consultor')
      .select('id, etapa_origem')
      .eq('jornada_id', area.jornada_id)
      .eq('area_id', area.id)
      .eq('tipo', 'bpmn')
      .order('created_at', { ascending: false })
      .limit(1);

    let entregavelId: string;

    if (ultimo && ultimo.length > 0 && (ultimo[0].etapa_origem === 'as_is' || !ultimo[0].etapa_origem)) {
      const { error: upErr } = await supabase
        .from('entregaveis_consultor')
        .update({
          nome: `BPMN AS-IS - ${area.nome_area}`,
          html_conteudo: htmlConteudo,
          etapa_origem: 'as_is',
          data_geracao: new Date().toISOString(),
          visualizado: false,
        })
        .eq('id', ultimo[0].id);

      if (upErr) throw upErr;
      entregavelId = ultimo[0].id;
    } else {
      const { data: novo, error: insErr } = await supabase
        .from('entregaveis_consultor')
        .insert({
          jornada_id: area.jornada_id,
          area_id: area.id,
          nome: `BPMN AS-IS - ${area.nome_area}`,
          tipo: 'bpmn',
          html_conteudo: htmlConteudo,
          etapa_origem: 'as_is',
          data_geracao: new Date().toISOString(),
          visualizado: false,
        })
        .select()
        .single();

      if (insErr) throw insErr;
      entregavelId = novo.id;
    }

    // --- Resposta ---
    return new Response(
      JSON.stringify({ success: true, bpmn_xml: bpmnXml, entregavel_id: entregavelId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[gerar-bpmn] Erro:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao gerar BPMN' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// ---------- Helpers ----------
function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function gerarHtmlComBpmn(area: any, bpmnXml: string) {
  const bpmnEscaped = escapeHtml(bpmnXml);
  const hoje = new Date().toLocaleDateString('pt-BR');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>BPMN AS-IS - ${area.nome_area}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --bg:#0b1020; --panel:#0f1426; --muted:#94a3b8; --text:#e2e8f0; --brand:#3b82f6;
    }
    body { background: var(--bg); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system; margin:0; padding:24px; }
    .card { background: var(--panel); border:1px solid #1f2937; border-radius:12px; padding:20px; max-width: 1100px; margin: 0 auto; }
    h1 { margin:0 0 12px; font-size: 20px; }
    .meta { color: var(--muted); font-size: 12px; margin-bottom: 16px; }
    .section { margin-top: 20px; }
    .badge { display:inline-block; background: #1e293b; padding:4px 8px; border-radius: 999px; font-size: 11px; border:1px solid #334155; color:#93c5fd }
    pre { background:#0b1220; color:#e2e8f0; padding:14px; border-radius:8px; overflow:auto; border:1px solid #1f2937; font-size:12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>BPMN AS-IS</h1>
    <div class="meta">Área: <strong>${area.nome_area}</strong> · Gerado em ${hoje}</div>
    <div class="section"><span class="badge">XML BPMN 2.0</span></div>
    <pre><code>${bpmnEscaped}</code></pre>
  </div>
</body>
</html>`;
}

async function safeJson(r: Response) {
  try { return await r.json(); } catch { return null; }
}
