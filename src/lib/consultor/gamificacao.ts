import { supabase } from '../supabase';
import type { GamificacaoConsultor, Conquista } from '../../types/consultor';
import { XP_VALORES, XP_POR_NIVEL, CONQUISTAS_DISPONIVEIS } from './constants';

/**
 * Inicializa gamificação para uma jornada específica
 * IMPORTANTE: Cada jornada inicia com gamificação ZERADA (nível 1, 0 XP, sem conquistas)
 * Isso garante isolamento completo entre diferentes conversas/jornadas
 */
export async function inicializarGamificacao(jornadaId: string, userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('gamificacao_consultor')
    .select('id')
    .eq('jornada_id', jornadaId)
    .maybeSingle();

  if (existing) return;

  await supabase
    .from('gamificacao_consultor')
    .insert({
      user_id: userId,
      jornada_id: jornadaId,
      xp_total: 0,
      nivel: 1,
      conquistas: [],
      dias_consecutivos: 1,
      areas_completadas: 0,
      ultimo_acesso: new Date().toISOString()
    });
}

/**
 * Adiciona XP à gamificação de uma jornada específica
 * Retorna informação se houve mudança de nível para exibir modal de comemoração
 */
export async function adicionarXP(
  jornadaId: string,
  quantidade: number,
  motivo: string
): Promise<{ xp_ganho: number; nivel_subiu: boolean; nivel_novo?: number; nivel_antigo?: number }> {
  const { data: gamificacao } = await supabase
    .from('gamificacao_consultor')
    .select('*')
    .eq('jornada_id', jornadaId)
    .maybeSingle();

  if (!gamificacao) {
    console.error(`[Gamificação] Jornada ${jornadaId} não tem gamificação inicializada`);
    return { xp_ganho: 0, nivel_subiu: false };
  }

  const xpNovo = gamificacao.xp_total + quantidade;
  const nivelAnterior = gamificacao.nivel;
  const nivelNovo = Math.floor(xpNovo / XP_POR_NIVEL) + 1;
  const nivelSubiu = nivelNovo > nivelAnterior;

  await supabase
    .from('gamificacao_consultor')
    .update({
      xp_total: xpNovo,
      nivel: nivelNovo,
      updated_at: new Date().toISOString()
    })
    .eq('jornada_id', jornadaId);

  console.log(`[Gamificação] +${quantidade} XP para jornada ${jornadaId} (${motivo})`);
  if (nivelSubiu) {
    console.log(`[Gamificação] 🎉 LEVEL UP! Nível ${nivelAnterior} → ${nivelNovo}`);
  }

  return {
    xp_ganho: quantidade,
    nivel_subiu: nivelSubiu,
    nivel_novo: nivelSubiu ? nivelNovo : undefined,
    nivel_antigo: nivelSubiu ? nivelAnterior : undefined
  };
}

/**
 * Desbloqueia conquista para uma jornada específica
 * Retorna a conquista desbloqueada para exibir modal de comemoração
 */
export async function desbloquearConquista(
  jornadaId: string,
  conquistaId: string
): Promise<Conquista | null> {
  const { data: gamificacao } = await supabase
    .from('gamificacao_consultor')
    .select('*')
    .eq('jornada_id', jornadaId)
    .maybeSingle();

  if (!gamificacao) {
    console.error(`[Gamificação] Jornada ${jornadaId} não tem gamificação inicializada`);
    return null;
  }

  const conquistasAtuais = gamificacao.conquistas as Conquista[];
  const jaDesbloqueada = conquistasAtuais.some(c => c.id === conquistaId);

  if (jaDesbloqueada) {
    console.log(`[Gamificação] Conquista ${conquistaId} já desbloqueada`);
    return null;
  }

  const conquistaTemplate = CONQUISTAS_DISPONIVEIS.find(c => c.id === conquistaId);
  if (!conquistaTemplate) {
    console.error(`[Gamificação] Conquista ${conquistaId} não encontrada no banco de dados`);
    return null;
  }

  const xpBonus = obterXPPorConquista(conquistaId);

  const novaConquista: Conquista = {
    ...conquistaTemplate,
    data_desbloqueio: new Date().toISOString(),
    xp_ganho: xpBonus
  };

  const conquistasNovas = [...conquistasAtuais, novaConquista];

  await supabase
    .from('gamificacao_consultor')
    .update({
      conquistas: conquistasNovas,
      xp_total: gamificacao.xp_total + xpBonus,
      updated_at: new Date().toISOString()
    })
    .eq('jornada_id', jornadaId);

  console.log(`[Gamificação] 🏆 CONQUISTA DESBLOQUEADA: ${novaConquista.nome} (+${xpBonus} XP)`);

  return novaConquista;
}

function obterXPPorConquista(conquistaId: string): number {
  const xpMap: Record<string, number> = {
    'primeiro_passo': 50,
    'visionario': 100,
    'estrategista': 75,
    'analista': 100,
    'executor': 150,
    'persistente': 75,
    'maestro': 300,
    'transformador': 1000,
    'dedicado_7dias': 200,
    'incansavel_30dias': 500
  };

  return xpMap[conquistaId] || 50;
}

/**
 * Atualiza streak de dias consecutivos
 * Baseado no último acesso da jornada específica
 */
export async function atualizarStreak(jornadaId: string): Promise<number> {
  const { data: gamificacao } = await supabase
    .from('gamificacao_consultor')
    .select('*')
    .eq('jornada_id', jornadaId)
    .maybeSingle();

  if (!gamificacao) {
    console.error(`[Gamificação] Jornada ${jornadaId} não tem gamificação inicializada`);
    return 1;
  }

  const agora = new Date();
  const ultimoAcesso = new Date(gamificacao.ultimo_acesso);
  const diferencaDias = Math.floor(
    (agora.getTime() - ultimoAcesso.getTime()) / (1000 * 60 * 60 * 24)
  );

  let novoStreak = gamificacao.dias_consecutivos;

  if (diferencaDias === 1) {
    novoStreak += 1;
  } else if (diferencaDias > 1) {
    novoStreak = 1;
  }

  await supabase
    .from('gamificacao_consultor')
    .update({
      dias_consecutivos: novoStreak,
      ultimo_acesso: agora.toISOString(),
      updated_at: agora.toISOString()
    })
    .eq('jornada_id', jornadaId);

  if (novoStreak === 7) {
    await desbloquearConquista(jornadaId, 'dedicado_7dias');
  } else if (novoStreak === 30) {
    await desbloquearConquista(jornadaId, 'incansavel_30dias');
  }

  return novoStreak;
}

/**
 * Incrementa contador de áreas completadas para uma jornada
 */
export async function incrementarAreasCompletadas(jornadaId: string): Promise<void> {
  const { data: gamificacao } = await supabase
    .from('gamificacao_consultor')
    .select('areas_completadas')
    .eq('jornada_id', jornadaId)
    .maybeSingle();

  if (!gamificacao) return;

  const novoTotal = gamificacao.areas_completadas + 1;

  await supabase
    .from('gamificacao_consultor')
    .update({
      areas_completadas: novoTotal,
      updated_at: new Date().toISOString()
    })
    .eq('jornada_id', jornadaId);

  if (novoTotal === 1) {
    await desbloquearConquista(jornadaId, 'maestro');
  }
}

/**
 * Verifica se todas áreas foram completadas para desbloquear conquista "Transformador"
 */
export async function verificarTransformadorCompleto(jornadaId: string): Promise<void> {
  const { data: areas } = await supabase
    .from('areas_trabalho')
    .select('etapa_area')
    .eq('jornada_id', jornadaId);

  if (!areas || areas.length === 0) return;

  const todasConcluidas = areas.every(area => area.etapa_area === 'concluida');

  if (todasConcluidas) {
    await desbloquearConquista(jornadaId, 'transformador');
  }
}

/**
 * Obtém gamificação de uma jornada específica
 */
export async function obterGamificacao(jornadaId: string): Promise<GamificacaoConsultor | null> {
  const { data } = await supabase
    .from('gamificacao_consultor')
    .select('*')
    .eq('jornada_id', jornadaId)
    .maybeSingle();

  return data as GamificacaoConsultor | null;
}

/**
 * Calcula XP necessário para próximo nível e progresso atual
 */
export function calcularXPParaProximoNivel(xpAtual: number): { xpNecessario: number; progresso: number } {
  const nivelAtual = Math.floor(xpAtual / XP_POR_NIVEL) + 1;
  const xpBaseNivel = (nivelAtual - 1) * XP_POR_NIVEL;
  const xpNoNivel = xpAtual - xpBaseNivel;
  const progresso = Math.round((xpNoNivel / XP_POR_NIVEL) * 100);

  return {
    xpNecessario: XP_POR_NIVEL - xpNoNivel,
    progresso
  };
}

/**
 * Gatilhos de gamificação para cada etapa da jornada
 * IMPORTANTE: Sempre passar jornadaId, não userId
 */
export const gatilhosGamificacao = {
  anamnese: async (jornadaId: string) => {
    const result = await adicionarXP(jornadaId, XP_VALORES.ANAMNESE_COMPLETA, 'Anamnese completa');
    const conquista = await desbloquearConquista(jornadaId, 'primeiro_passo');
    return { ...result, conquista };
  },

  mapeamento: async (jornadaId: string) => {
    const result = await adicionarXP(jornadaId, XP_VALORES.MAPEAMENTO_COMPLETO, 'Mapeamento completo');
    const conquista = await desbloquearConquista(jornadaId, 'visionario');
    return { ...result, conquista };
  },

  priorizacao: async (jornadaId: string) => {
    const result = await adicionarXP(jornadaId, XP_VALORES.PRIORIZACAO_DEFINIDA, 'Priorização definida');
    const conquista = await desbloquearConquista(jornadaId, 'estrategista');
    return { ...result, conquista };
  },

  asIs: async (jornadaId: string) => {
    const result = await adicionarXP(jornadaId, XP_VALORES.AS_IS_AREA, 'AS-IS de área completo');
    return { ...result, conquista: null };
  },

  diagnostico: async (jornadaId: string, ehPrimeiro: boolean) => {
    const result = await adicionarXP(jornadaId, XP_VALORES.DIAGNOSTICO_APROVADO, 'Diagnóstico aprovado');
    const conquista = ehPrimeiro ? await desbloquearConquista(jornadaId, 'analista') : null;
    return { ...result, conquista };
  },

  planoAcao: async (jornadaId: string, ehPrimeiro: boolean) => {
    const result = await adicionarXP(jornadaId, XP_VALORES.PLANO_ACAO_APROVADO, 'Plano de ação aprovado');
    const conquista = ehPrimeiro ? await desbloquearConquista(jornadaId, 'executor') : null;
    return { ...result, conquista };
  },

  acaoConcluida: async (jornadaId: string, ehPrimeira: boolean) => {
    const result = await adicionarXP(jornadaId, XP_VALORES.ACAO_CONCLUIDA, 'Ação concluída');
    const conquista = ehPrimeira ? await desbloquearConquista(jornadaId, 'persistente') : null;
    return { ...result, conquista };
  },

  areaCompletada: async (jornadaId: string) => {
    const result = await adicionarXP(jornadaId, XP_VALORES.AREA_COMPLETADA_BONUS, 'Área completada');
    await incrementarAreasCompletadas(jornadaId);
    return { ...result, conquista: null };
  }
};
