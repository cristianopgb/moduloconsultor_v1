// supabase/functions/agente-execucao/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// ----------------------------------------
// PROMPT do Agente de Execução (sem crases quebradas)
// ----------------------------------------
const PROMPT_AGENTE_EXECUCAO = (contexto: any, acaoAtual: any) => `
Você é o AGENTE DE EXECUÇÃO do Proceda Consultor IA.

CONTEXTO COMPLETO DA JORNADA:
- Empresa: ${contexto.empresa_nome}
- Segmento: ${contexto.segmento}
- Porte: ${contexto.porte}
- Anamnese: ${JSON.stringify(contexto.anamnese || {})}
- Diagnóstico: ${JSON.stringify(contexto.diagnostico || {})}
- Ação Específica: ${acaoAtual.nome}
- Status Atual: ${acaoAtual.status}

CONHECIMENTO DOS MÓDULOS PROCEDA:
1. ANALYTICS: Templates para análise de dados, dashboards, relatórios
2. APRESENTAÇÃO: Templates para documentos, apresentações, procedimentos

REGRAS RÍGIDAS:
1. Foque APENAS na ação específica em execução
2. Não invente soluções fora do escopo
3. SEMPRE sugira módulos Proceda quando aplicável
4. Mantenha o contexto da jornada completa
5. Atualize status, cronograma e custos conforme o progresso

INTEGRAÇÕES INTELIGENTES:
- Se a ação envolver documento: “Use o módulo Apresentação com template X”
- Se a ação envolver análise: “Use o módulo Analytics com template Y”
- Se a ação envolver controle: “Crie planilha no Analytics para acompanhar Z”

EXEMPLO DE CONDUÇÃO:
Ação: “Criar checklist de qualidade por etapa”
Resposta: “Vamos criar seu checklist de qualidade. Baseado no diagnóstico da sua construtora, identifiquei 3 etapas críticas que precisam de controle:

1) Estrutural — verificar prumo, nível, resistência
2) Acabamentos — verificar alinhamento, acabamento, limpeza
3) Entrega — verificar funcionamento, limpeza final, documentação

Para implementar:
• Use o módulo Apresentação com o template ‘Checklist_Operacional’
• Crie um checklist para cada etapa com fotos obrigatórias
• Treine o mestre de obras para usar

Status: Em andamento
Próximo passo: Criar o primeiro checklist no Apresentação”

NUNCA saia do escopo da ação específica. Seja prático, direto e focado na execução.
`.trim();

// ----------------------------------------
// Helpers
// ----------------------------------------
function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function safeJson(r: Response) {
  try { return await r.json(); } catch { return null; }
}

// ----------------------------------------
// Edge Function
// ----------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey   = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
    }
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { acaoId, mensagem, jornadaId } = await req.json();

    if (!acaoId || !jornadaId) {
      return new Response(
        JSON.stringify({ error: 'acaoId e jornadaId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Jornada
    const { data: jornada, error: jErr } = await supabase
      .from('jornadas_consultor')
      .select('*, user_id')
      .eq('id', jornadaId)
      .single();

    if (jErr || !jornada) {
      return new Response(
        JSON.stringify({ error: 'Jornada não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Ação
    const { data: acao, error: aErr } = await supabase
      .from('acoes_plano')
      .select('*')
      .eq('id', acaoId)
      .single();

    if (aErr || !acao) {
      return new Response(
        JSON.stringify({ error: 'Ação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Contexto para o prompt
    const contexto = {
      empresa_nome: jornada.contexto_coleta?.empresa_nome || 'Empresa',
      segmento: jornada.contexto_coleta?.segmento || 'Não especificado',
      porte: jornada.contexto_coleta?.porte || 'Não especificado',
      anamnese: jornada.contexto_coleta || {},
      diagnostico: jornada.resumo_etapa || {},
    };

    const prompt = PROMPT_AGENTE_EXECUCAO(contexto, acao);

    // Chamada ao modelo
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: mensagem || `Qual o status atual e próximos passos para a ação: ${acao.nome}?` },
        ],
        temperature: 0.5,
        max_tokens: 1500,
      }),
    });

    if (!openaiResp.ok) {
      const detail = await safeJson(openaiResp);
      throw new Error(`Erro na API OpenAI: ${openaiResp.status} ${openaiResp.statusText} ${detail ? JSON.stringify(detail) : ''}`);
    }

    const openaiData = await openaiResp.json();
    const resposta: string = openaiData?.choices?.[0]?.message?.content || 'OK';

    // Atualiza observações da ação
    await supabase
      .from('acoes_plano')
      .update({
        observacoes: resposta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', acaoId);

    // Se detectar "concluído"/"finalizado" no texto → marcar concluído + XP
    const norm = normalize(resposta);
    if (norm.includes('concluido') || norm.includes('finalizado')) {
      await supabase
        .from('acoes_plano')
        .update({ status: 'concluido', updated_at: new Date().toISOString() })
        .eq('id', acaoId);

      // Gamificação simples: registra ganho
      await supabase
        .from('gamificacao_consultor')
        .insert({
          user_id: jornada.user_id,
          acao: 'acao_concluida',
          xp_ganho: 50,
          timestamp: new Date().toISOString(),
        });

      // Se todas as ações do processo estiverem concluídas, atualiza a área (quando houver vínculo)
      if (acao.processo_origem) {
        const { data: restantes } = await supabase
          .from('acoes_plano')
          .select('id')
          .eq('processo_origem', acao.processo_origem)
          .neq('status', 'concluido');

        if (!restantes || restantes.length === 0) {
          // Tenta atualizar por campo "status"
          await supabase
            .from('areas_trabalho')
            .update({ status: 'concluido', updated_at: new Date().toISOString() })
            .eq('id', acao.processo_origem);

          // E também tenta por "etapa_area" (caso seja esse o esquema utilizado)
          await supabase
            .from('areas_trabalho')
            .update({ etapa_area: 'concluida', updated_at: new Date().toISOString() })
            .eq('id', acao.processo_origem);
        }
      }
    }

    return new Response(
      JSON.stringify({
        resposta,
        acao_atualizada: acao.id,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[agente-execucao] Erro:', error);

    const fallbackResposta =
      'Entendi. Vou continuar monitorando o progresso desta ação.\n\n' +
      'Continue trabalhando na implementação e me avise quando houver novidades. ' +
      'Estou acompanhando tudo pelo Kanban.';

    // Mesmo em erro, respondemos 200 com fallback (comum para não travar UX)
    return new Response(
      JSON.stringify({
        resposta: fallbackResposta,
        fallback: true,
        error: error?.message || 'Erro desconhecido',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
