import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ValidarPriorizacaoRequest {
  conversation_id: string;
  user_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { conversation_id, user_id }: ValidarPriorizacaoRequest = await req.json();

    if (!conversation_id || !user_id) {
      throw new Error('conversation_id e user_id são obrigatórios');
    }

    console.log('[VALIDAR-PRIORIZACAO] Request received:', { conversation_id, user_id });

    // 1. Buscar jornada
    const { data: jornada, error: jornadaError } = await supabase
      .from('jornadas_consultor')
      .select('*')
      .eq('conversation_id', conversation_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (jornadaError || !jornada) {
      throw new Error('Jornada não encontrada');
    }

    if (jornada.aguardando_validacao !== 'priorizacao') {
      throw new Error(`Jornada não está aguardando validação de priorização (estado atual: ${jornada.aguardando_validacao})`);
    }

    // 2. Buscar framework_checklist
    const { data: checklist } = await supabase
      .from('framework_checklist')
      .select('*')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    if (!checklist) {
      throw new Error('Framework checklist não encontrado');
    }

    // 3. Extrair processos priorizados
    const ctx = jornada.contexto_coleta || {};
    const processos = ctx?.matriz_priorizacao?.processos || ctx?.priorizacao?.processos || ctx?.escopo?.processos || [];

    if (!Array.isArray(processos) || processos.length === 0) {
      throw new Error('Nenhum processo priorizado encontrado no contexto');
    }

    const processosNomes = processos.map((p: any) => p.nome || p.processo || String(p)).filter(Boolean);

    console.log('[VALIDAR-PRIORIZACAO] Processos priorizados:', processosNomes);

    // 4. Atualizar jornada: avançar para execução
    const { error: updateJornadaError } = await supabase
      .from('jornadas_consultor')
      .update({
        etapa_atual: 'execucao',
        aguardando_validacao: null,
        ultima_interacao: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jornada.id);

    if (updateJornadaError) {
      throw updateJornadaError;
    }

    console.log('[VALIDAR-PRIORIZACAO] ✅ Jornada avançada para execução');

    // 5. Atualizar framework_checklist
    const { error: updateChecklistError } = await supabase
      .from('framework_checklist')
      .update({
        escopo_validado_pelo_usuario: true,
        escopo_priorizacao_definido: true,
        escopo_validacao_ts: new Date().toISOString(),
        aguardando_validacao_escopo: false,
        escopo_quantidade_processos: processosNomes.length,
        escopo_processos_nomes: processosNomes,
        escopo_ts: new Date().toISOString(),
        fase_atual: 'execucao',
        ultima_interacao: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', checklist.id);

    if (updateChecklistError) {
      throw updateChecklistError;
    }

    console.log('[VALIDAR-PRIORIZACAO] ✅ Framework checklist atualizado');

    // 6. Criar processo_checklist para cada processo do escopo
    try {
      // Verificar se já existem processos criados
      const { data: existingProcessos } = await supabase
        .from('processo_checklist')
        .select('processo_nome')
        .eq('framework_checklist_id', checklist.id);

      const existingNomes = new Set((existingProcessos || []).map(p => p.processo_nome));

      // Criar apenas os que não existem
      const novosProcessos = processosNomes
        .filter(nome => !existingNomes.has(nome))
        .map((nome, idx) => ({
          framework_checklist_id: checklist.id,
          conversation_id: conversation_id,
          processo_nome: nome,
          processo_ordem: idx + 1,
          atributos_preenchidos: false,
          bpmn_as_is_mapeado: false,
          diagnostico_preenchido: false,
          processo_completo: false,
          xp_atributos_concedido: false,
          xp_bpmn_concedido: false,
          xp_diagnostico_concedido: false
        }));

      if (novosProcessos.length > 0) {
        const { error: insertProcessosError } = await supabase
          .from('processo_checklist')
          .insert(novosProcessos);

        if (insertProcessosError) {
          console.warn('[VALIDAR-PRIORIZACAO] Erro ao criar processo_checklist:', insertProcessosError);
        } else {
          console.log(`[VALIDAR-PRIORIZACAO] ✅ Criados ${novosProcessos.length} processo_checklist`);
        }
      } else {
        console.log('[VALIDAR-PRIORIZACAO] Processos já existem, pulando criação');
      }
    } catch (e) {
      console.warn('[VALIDAR-PRIORIZACAO] Erro ao criar processo_checklist (não-fatal):', e);
    }

    // 7. Registrar evento na timeline
    try {
      await supabase.from('timeline_consultor').insert({
        jornada_id: jornada.id,
        fase: 'execucao',
        evento: 'Escopo validado e fase avançada para execução'
      });
      console.log('[VALIDAR-PRIORIZACAO] ✅ Evento registrado na timeline');
    } catch (e) {
      console.warn('[VALIDAR-PRIORIZACAO] Erro ao registrar na timeline (não-fatal):', e);
    }

    // 8. Adicionar XP pela validação
    try {
      await supabase.rpc('add_xp_to_conversation', {
        p_conversation_id: conversation_id,
        p_xp_amount: 100,
        p_conquista_nome: 'Escopo validado'
      });
      console.log('[VALIDAR-PRIORIZACAO] ✅ XP concedido');
    } catch (e) {
      console.warn('[VALIDAR-PRIORIZACAO] Erro ao conceder XP (não-fatal):', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Priorização validada com sucesso',
        jornada_id: jornada.id,
        processos_no_escopo: processosNomes.length,
        proximo_passo: `Coleta de atributos do processo: ${processosNomes[0]}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[VALIDAR-PRIORIZACAO] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao validar priorização' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});