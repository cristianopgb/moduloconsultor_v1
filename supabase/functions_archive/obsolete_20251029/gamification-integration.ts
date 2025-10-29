/**
 * Gamification Integration - Sistema de Integração com Gatilhos de Gamificação
 *
 * Chama os gatilhos corretos ao completar cada etapa do framework
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class GamificationIntegration {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Dispara gatilho de gamificação ao completar uma etapa
   */
  async triggerStageCompletion(
    jornadaId: string,
    stage: string,
    userId: string
  ): Promise<{ xp_ganho: number; nivel_subiu: boolean; conquista?: any }> {
    console.log(`[Gamification] Disparando gatilho para etapa: ${stage}`);

    try {
      switch (stage) {
        case 'anamnese':
          return await this.triggerAnamnese(jornadaId);

        case 'mapeamento':
          return await this.triggerMapeamento(jornadaId);

        case 'priorizacao':
          return await this.triggerPriorizacao(jornadaId);

        case 'asIs':
          return await this.triggerAsIs(jornadaId);

        case 'diagnostico':
          return await this.triggerDiagnostico(jornadaId, userId);

        case 'planoAcao':
          return await this.triggerPlanoAcao(jornadaId, userId);

        case 'acaoConcluida':
          return await this.triggerAcaoConcluida(jornadaId, userId);

        case 'areaCompletada':
          return await this.triggerAreaCompletada(jornadaId);

        default:
          console.warn(`[Gamification] Gatilho não implementado para: ${stage}`);
          return { xp_ganho: 0, nivel_subiu: false };
      }
    } catch (error) {
      console.error('[Gamification] Erro ao disparar gatilho:', error);
      return { xp_ganho: 0, nivel_subiu: false };
    }
  }

  /**
   * Gatilho: Anamnese Completa
   * XP: 100 | Conquista: "Primeiro Passo"
   */
  private async triggerAnamnese(jornadaId: string) {
    const XP_ANAMNESE = 100;

    // Adicionar XP
    const { data: xpResult } = await this.supabase.rpc('adicionar_xp_jornada', {
      p_jornada_id: jornadaId,
      p_quantidade: XP_ANAMNESE,
      p_motivo: 'Anamnese completa'
    });

    // Desbloquear conquista
    const { data: conquista } = await this.supabase.rpc('desbloquear_conquista_jornada', {
      p_jornada_id: jornadaId,
      p_conquista_id: 'primeiro_passo'
    });

    console.log(`[Gamification] ✅ Anamnese: +${XP_ANAMNESE} XP`);

    return {
      xp_ganho: XP_ANAMNESE,
      nivel_subiu: xpResult?.nivel_subiu || false,
      nivel_novo: xpResult?.nivel_novo,
      nivel_antigo: xpResult?.nivel_antigo,
      conquista
    };
  }

  /**
   * Gatilho: Mapeamento Completo
   * XP: 250 | Conquista: "Visionário"
   */
  private async triggerMapeamento(jornadaId: string) {
    const XP_MAPEAMENTO = 250;

    const { data: xpResult } = await this.supabase.rpc('adicionar_xp_jornada', {
      p_jornada_id: jornadaId,
      p_quantidade: XP_MAPEAMENTO,
      p_motivo: 'Mapeamento completo'
    });

    const { data: conquista } = await this.supabase.rpc('desbloquear_conquista_jornada', {
      p_jornada_id: jornadaId,
      p_conquista_id: 'visionario'
    });

    console.log(`[Gamification] ✅ Mapeamento: +${XP_MAPEAMENTO} XP`);

    return {
      xp_ganho: XP_MAPEAMENTO,
      nivel_subiu: xpResult?.nivel_subiu || false,
      nivel_novo: xpResult?.nivel_novo,
      nivel_antigo: xpResult?.nivel_antigo,
      conquista
    };
  }

  /**
   * Gatilho: Priorização Definida
   * XP: 50 | Conquista: "Estrategista"
   */
  private async triggerPriorizacao(jornadaId: string) {
    const XP_PRIORIZACAO = 50;

    const { data: xpResult } = await this.supabase.rpc('adicionar_xp_jornada', {
      p_jornada_id: jornadaId,
      p_quantidade: XP_PRIORIZACAO,
      p_motivo: 'Priorização definida'
    });

    const { data: conquista } = await this.supabase.rpc('desbloquear_conquista_jornada', {
      p_jornada_id: jornadaId,
      p_conquista_id: 'estrategista'
    });

    console.log(`[Gamification] ✅ Priorização: +${XP_PRIORIZACAO} XP`);

    return {
      xp_ganho: XP_PRIORIZACAO,
      nivel_subiu: xpResult?.nivel_subiu || false,
      nivel_novo: xpResult?.nivel_novo,
      nivel_antigo: xpResult?.nivel_antigo,
      conquista
    };
  }

  /**
   * Gatilho: AS-IS de Área Completo
   * XP: 200
   */
  private async triggerAsIs(jornadaId: string) {
    const XP_AS_IS = 200;

    const { data: xpResult } = await this.supabase.rpc('adicionar_xp_jornada', {
      p_jornada_id: jornadaId,
      p_quantidade: XP_AS_IS,
      p_motivo: 'AS-IS de área completo'
    });

    console.log(`[Gamification] ✅ AS-IS: +${XP_AS_IS} XP`);

    return {
      xp_ganho: XP_AS_IS,
      nivel_subiu: xpResult?.nivel_subiu || false,
      nivel_novo: xpResult?.nivel_novo,
      nivel_antigo: xpResult?.nivel_antigo
    };
  }

  /**
   * Gatilho: Diagnóstico Aprovado
   * XP: 150 | Conquista: "Analista" (se primeiro)
   */
  private async triggerDiagnostico(jornadaId: string, userId: string) {
    const XP_DIAGNOSTICO = 150;

    const { data: xpResult } = await this.supabase.rpc('adicionar_xp_jornada', {
      p_jornada_id: jornadaId,
      p_quantidade: XP_DIAGNOSTICO,
      p_motivo: 'Diagnóstico aprovado'
    });

    // Verificar se é o primeiro diagnóstico (desbloqueia conquista)
    const { count } = await this.supabase
      .from('diagnosticos_area')
      .select('id', { count: 'exact', head: true })
      .eq('jornada_id', jornadaId);

    let conquista = null;
    if (count === 1) {
      const { data } = await this.supabase.rpc('desbloquear_conquista_jornada', {
        p_jornada_id: jornadaId,
        p_conquista_id: 'analista'
      });
      conquista = data;
    }

    console.log(`[Gamification] ✅ Diagnóstico: +${XP_DIAGNOSTICO} XP`);

    return {
      xp_ganho: XP_DIAGNOSTICO,
      nivel_subiu: xpResult?.nivel_subiu || false,
      nivel_novo: xpResult?.nivel_novo,
      nivel_antigo: xpResult?.nivel_antigo,
      conquista
    };
  }

  /**
   * Gatilho: Plano de Ação Aprovado
   * XP: 300 | Conquista: "Executor" (se primeiro)
   */
  private async triggerPlanoAcao(jornadaId: string, userId: string) {
    const XP_PLANO = 300;

    const { data: xpResult } = await this.supabase.rpc('adicionar_xp_jornada', {
      p_jornada_id: jornadaId,
      p_quantidade: XP_PLANO,
      p_motivo: 'Plano de ação aprovado'
    });

    // Verificar se é o primeiro plano (desbloqueia conquista)
    const { count } = await this.supabase
      .from('planos_acao')
      .select('id', { count: 'exact', head: true })
      .eq('jornada_id', jornadaId);

    let conquista = null;
    if (count === 1) {
      const { data } = await this.supabase.rpc('desbloquear_conquista_jornada', {
        p_jornada_id: jornadaId,
        p_conquista_id: 'executor'
      });
      conquista = data;
    }

    console.log(`[Gamification] ✅ Plano de Ação: +${XP_PLANO} XP`);

    return {
      xp_ganho: XP_PLANO,
      nivel_subiu: xpResult?.nivel_subiu || false,
      nivel_novo: xpResult?.nivel_novo,
      nivel_antigo: xpResult?.nivel_antigo,
      conquista
    };
  }

  /**
   * Gatilho: Ação Concluída no Kanban
   * XP: 50 | Conquista: "Persistente" (se primeira)
   */
  private async triggerAcaoConcluida(jornadaId: string, userId: string) {
    const XP_ACAO = 50;

    const { data: xpResult } = await this.supabase.rpc('adicionar_xp_jornada', {
      p_jornada_id: jornadaId,
      p_quantidade: XP_ACAO,
      p_motivo: 'Ação concluída'
    });

    // Verificar se é a primeira ação concluída
    const { count } = await this.supabase
      .from('acoes_kanban')
      .select('id', { count: 'exact', head: true })
      .eq('jornada_id', jornadaId)
      .eq('status', 'concluido');

    let conquista = null;
    if (count === 1) {
      const { data } = await this.supabase.rpc('desbloquear_conquista_jornada', {
        p_jornada_id: jornadaId,
        p_conquista_id: 'persistente'
      });
      conquista = data;
    }

    console.log(`[Gamification] ✅ Ação Concluída: +${XP_ACAO} XP`);

    return {
      xp_ganho: XP_ACAO,
      nivel_subiu: xpResult?.nivel_subiu || false,
      nivel_novo: xpResult?.nivel_novo,
      nivel_antigo: xpResult?.nivel_antigo,
      conquista
    };
  }

  /**
   * Gatilho: Área Completada
   * XP: 500 | Conquista: "Maestro" (se primeira) | "Transformador" (se todas)
   */
  private async triggerAreaCompletada(jornadaId: string) {
    const XP_AREA = 500;

    const { data: xpResult } = await this.supabase.rpc('adicionar_xp_jornada', {
      p_jornada_id: jornadaId,
      p_quantidade: XP_AREA,
      p_motivo: 'Área completada'
    });

    // Contar áreas completadas
    const { data: areas } = await this.supabase
      .from('areas_trabalho')
      .select('id, etapa_area')
      .eq('jornada_id', jornadaId);

    const totalAreas = areas?.length || 0;
    const areasConcluidas = areas?.filter((a: any) => a.etapa_area === 'concluida').length || 0;

    let conquista = null;

    // Primeira área: Conquista "Maestro"
    if (areasConcluidas === 1) {
      const { data } = await this.supabase.rpc('desbloquear_conquista_jornada', {
        p_jornada_id: jornadaId,
        p_conquista_id: 'maestro'
      });
      conquista = data;
    }

    // Todas as áreas: Conquista "Transformador" + XP BÔNUS
    if (areasConcluidas === totalAreas) {
      const { data } = await this.supabase.rpc('desbloquear_conquista_jornada', {
        p_jornada_id: jornadaId,
        p_conquista_id: 'transformador'
      });
      conquista = data;

      // Bônus de 1000 XP por completar tudo
      await this.supabase.rpc('adicionar_xp_jornada', {
        p_jornada_id: jornadaId,
        p_quantidade: 1000,
        p_motivo: 'BÔNUS: Transformação completa!'
      });
    }

    console.log(`[Gamification] ✅ Área Completada: +${XP_AREA} XP (${areasConcluidas}/${totalAreas})`);

    return {
      xp_ganho: XP_AREA,
      nivel_subiu: xpResult?.nivel_subiu || false,
      nivel_novo: xpResult?.nivel_novo,
      nivel_antigo: xpResult?.nivel_antigo,
      conquista
    };
  }
}
