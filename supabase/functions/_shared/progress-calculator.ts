import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno';

/**
 * Calcula progresso de uma sessao baseado em:
 * - Estado atual (peso 30%)
 * - Entregaveis gerados (peso 40%)
 * - Kanban cards concluidos (peso 30%)
 */
export async function calculateSessionProgress(
  supabase: SupabaseClient,
  sessaoId: string
): Promise<number> {
  try {
    console.log('[PROGRESS] Calculating progress for sessao:', sessaoId);

    const { data: sessao, error: sessaoError } = await supabase
      .from('consultor_sessoes')
      .select('estado_atual, entregaveis_gerados')
      .eq('id', sessaoId)
      .single();

    if (sessaoError || !sessao) {
      console.error('[PROGRESS] Error fetching sessao:', sessaoError);
      return 0;
    }

    // 1. Calcular peso por estado (30%)
    const stateWeights: Record<string, number> = {
      'coleta': 10,
      'analise': 25,
      'diagnostico': 50,
      'recomendacao': 70,
      'execucao': 85,
      'concluido': 100
    };
    const stateProgress = stateWeights[sessao.estado_atual] || 0;

    // 2. Calcular peso por entregaveis (40%)
    const numEntregaveis = (sessao.entregaveis_gerados || []).length;
    const maxEntregaveis = 8;
    const deliverablesProgress = Math.min(100, (numEntregaveis / maxEntregaveis) * 100);

    // 3. Calcular peso por kanban (30%)
    const { data: cards } = await supabase
      .from('kanban_cards')
      .select('status')
      .eq('sessao_id', sessaoId)
      .eq('deprecated', false);

    let kanbanProgress = 0;
    if (cards && cards.length > 0) {
      const completedCards = cards.filter((c: any) =>
        c.status === 'concluido' || c.status === 'done'
      ).length;
      kanbanProgress = (completedCards / cards.length) * 100;
    }

    // 4. Calcular progresso total (media ponderada)
    const totalProgress = Math.round(
      (stateProgress * 0.3) +
      (deliverablesProgress * 0.4) +
      (kanbanProgress * 0.3)
    );

    console.log('[PROGRESS] Calculated:', {
      state: stateProgress,
      deliverables: deliverablesProgress,
      kanban: kanbanProgress,
      total: totalProgress
    });

    return Math.max(0, Math.min(100, totalProgress));

  } catch (error: any) {
    console.error('[PROGRESS] Exception calculating progress:', error);
    return 0;
  }
}

/**
 * Atualiza progresso de uma sessao no banco
 */
export async function updateSessionProgress(
  supabase: SupabaseClient,
  sessaoId: string
): Promise<boolean> {
  try {
    const progresso = await calculateSessionProgress(supabase, sessaoId);

    const { error } = await supabase
      .from('consultor_sessoes')
      .update({
        progresso,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessaoId);

    if (error) {
      console.error('[PROGRESS] Error updating progress:', error);
      return false;
    }

    console.log('[PROGRESS] Updated progress to:', progresso);
    return true;

  } catch (error: any) {
    console.error('[PROGRESS] Exception updating progress:', error);
    return false;
  }
}
