/**
 * VALIDAR ESCOPO - Sistema de validação do escopo definido pelo consultor
 *
 * Permite que o usuário:
 * 1. Valide o escopo proposto (avança para mapeamento de processos)
 * 2. OU continue conversando para ajustar o escopo (mantém em priorização)
 *
 * Este é o ÚNICO checkpoint de validação obrigatório no fluxo.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ValidarEscopoRequest {
  sessao_id: string;
  aprovado: boolean; // true = validar e avançar, false = recusar e voltar para ajustes
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sessao_id, aprovado }: ValidarEscopoRequest = await req.json();

    if (!sessao_id) {
      throw new Error('sessao_id é obrigatório');
    }

    console.log('[VALIDAR-ESCOPO] Request received:', { sessao_id, aprovado });

    // 1. Buscar sessão
    const { data: sessao, error: sessaoError } = await supabase
      .from('consultor_sessoes')
      .select('*')
      .eq('id', sessao_id)
      .maybeSingle();

    if (sessaoError || !sessao) {
      throw new Error('Sessão não encontrada');
    }

    if (sessao.aguardando_validacao !== 'escopo') {
      throw new Error(`Sessão não está aguardando validação de escopo (estado atual: ${sessao.aguardando_validacao})`);
    }

    if (aprovado) {
      // VALIDAÇÃO POSITIVA: Avançar para mapeamento de processos
      console.log('[VALIDAR-ESCOPO] Scope approved, advancing to process mapping');

      // 2. Extrair processos priorizados do contexto
      const ctx = sessao.contexto_coleta || {};
      const processos = ctx?.escopo?.processos || ctx?.processos_priorizados || [];

      if (!Array.isArray(processos) || processos.length === 0) {
        throw new Error('Nenhum processo encontrado no escopo');
      }

      const processosNomes = processos.map((p: any) => p.nome || p.processo || String(p)).filter(Boolean);

      console.log('[VALIDAR-ESCOPO] Approved processes:', processosNomes);

      // 3. Atualizar sessão: avançar para mapeamento_processos
      const { error: updateSessaoError } = await supabase
        .from('consultor_sessoes')
        .update({
          estado_atual: 'mapeamento_processos',
          aguardando_validacao: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessao_id);

      if (updateSessaoError) {
        throw updateSessaoError;
      }

      console.log('[VALIDAR-ESCOPO] ✅ Session advanced to process mapping');

      // 4. Registrar evento na timeline
      try {
        await supabase.from('timeline_consultor').insert({
          sessao_id: sessao_id,
          fase: 'mapeamento_processos',
          evento: 'Escopo validado e aprovado pelo usuário',
          created_at: new Date().toISOString()
        });
        console.log('[VALIDAR-ESCOPO] ✅ Event logged to timeline');
      } catch (e) {
        console.warn('[VALIDAR-ESCOPO] Error logging to timeline (non-fatal):', e);
      }

      // 5. Adicionar XP pela validação
      try {
        await supabase
          .from('gamificacao_consultor')
          .upsert({
            sessao_id: sessao_id,
            xp_total: 100,
            nivel: 1,
            conquistas: ['escopo_validado']
          }, {
            onConflict: 'sessao_id',
            ignoreDuplicates: false
          });
        console.log('[VALIDAR-ESCOPO] ✅ XP awarded');
      } catch (e) {
        console.warn('[VALIDAR-ESCOPO] Error awarding XP (non-fatal):', e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Escopo validado com sucesso! Iniciando mapeamento detalhado dos processos.',
          sessao_id: sessao_id,
          proxima_fase: 'mapeamento_processos',
          processos_no_escopo: processosNomes.length,
          processos: processosNomes
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // VALIDAÇÃO NEGATIVA: Manter em priorização para ajustes
      console.log('[VALIDAR-ESCOPO] Scope rejected, staying in prioritization for adjustments');

      // Apenas limpar o flag de aguardando validação
      // Usuário pode continuar conversando para ajustar o escopo
      const { error: updateSessaoError } = await supabase
        .from('consultor_sessoes')
        .update({
          aguardando_validacao: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessao_id);

      if (updateSessaoError) {
        throw updateSessaoError;
      }

      console.log('[VALIDAR-ESCOPO] ✅ Validation flag cleared, user can continue adjustments');

      // Registrar na timeline
      try {
        await supabase.from('timeline_consultor').insert({
          sessao_id: sessao_id,
          fase: 'priorizacao',
          evento: 'Escopo recusado - ajustes solicitados',
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('[VALIDAR-ESCOPO] Error logging to timeline (non-fatal):', e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Entendido! Vamos ajustar o escopo. Continue conversando para propor mudanças.',
          sessao_id: sessao_id,
          proxima_fase: 'priorizacao',
          pode_continuar_ajustando: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('[VALIDAR-ESCOPO] ERROR:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erro ao validar escopo',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
