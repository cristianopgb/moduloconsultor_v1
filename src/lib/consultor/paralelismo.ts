import { supabase } from '../supabase';
import type { AreaTrabalho } from '../../types/consultor';
import { ETAPAS_AREA } from './constants';

export async function verificarDesbloqueio(jornadaId: string): Promise<void> {
  const { data: areas, error } = await supabase
    .from('areas_trabalho')
    .select('*')
    .eq('jornada_id', jornadaId)
    .order('posicao_prioridade', { ascending: true });

  if (error || !areas) {
    console.error('Erro ao buscar áreas:', error);
    return;
  }

  for (let i = 0; i < areas.length; i++) {
    const area = areas[i] as AreaTrabalho;
    const areAnterior = i > 0 ? areas[i - 1] as AreaTrabalho : null;

    const podeIniciar = calcularSeAreaPodeIniciar(area, areAnterior);

    if (area.pode_iniciar !== podeIniciar) {
      await supabase
        .from('areas_trabalho')
        .update({
          pode_iniciar: podeIniciar,
          bloqueada_por: areAnterior && !podeIniciar ? areAnterior.id : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', area.id);
    }
  }
}

function calcularSeAreaPodeIniciar(
  area: AreaTrabalho,
  areAnterior: AreaTrabalho | null
): boolean {
  if (area.posicao_prioridade === 1) {
    return true;
  }

  if (!areAnterior) {
    return false;
  }

  const etapasQuePermitemProxima = [
    ETAPAS_AREA.ANALISE,
    ETAPAS_AREA.PLANO,
    ETAPAS_AREA.EXECUCAO,
    ETAPAS_AREA.CONCLUIDA
  ];

  return etapasQuePermitemProxima.includes(areAnterior.etapa_area as any);
}

export async function avancarEtapaArea(
  areaId: string,
  novaEtapa: string
): Promise<void> {
  const { data: area, error: areaError } = await supabase
    .from('areas_trabalho')
    .select('jornada_id')
    .eq('id', areaId)
    .single();

  if (areaError || !area) {
    console.error('Erro ao buscar área:', areaError);
    return;
  }

  await supabase
    .from('areas_trabalho')
    .update({
      etapa_area: novaEtapa,
      updated_at: new Date().toISOString()
    })
    .eq('id', areaId);

  await verificarDesbloqueio(area.jornada_id);
}

export async function calcularProgressoArea(areaId: string): Promise<number> {
  const { data: area } = await supabase
    .from('areas_trabalho')
    .select('etapa_area')
    .eq('id', areaId)
    .single();

  if (!area) return 0;

  const progressoPorEtapa: Record<string, number> = {
    [ETAPAS_AREA.AGUARDANDO]: 0,
    [ETAPAS_AREA.AS_IS]: 25,
    [ETAPAS_AREA.ANALISE]: 50,
    [ETAPAS_AREA.PLANO]: 75,
    [ETAPAS_AREA.EXECUCAO]: 90,
    [ETAPAS_AREA.CONCLUIDA]: 100
  };

  return progressoPorEtapa[area.etapa_area] || 0;
}

export async function calcularProgressoGeral(jornadaId: string): Promise<number> {
  const { data: areas } = await supabase
    .from('areas_trabalho')
    .select('progresso_area')
    .eq('jornada_id', jornadaId);

  if (!areas || areas.length === 0) return 0;

  const somaProgressos = areas.reduce((sum, area) => sum + area.progresso_area, 0);
  return Math.round(somaProgressos / areas.length);
}

export async function obterProximaAreaDisponivel(jornadaId: string): Promise<AreaTrabalho | null> {
  const { data: area } = await supabase
    .from('areas_trabalho')
    .select('*')
    .eq('jornada_id', jornadaId)
    .eq('pode_iniciar', true)
    .eq('etapa_area', ETAPAS_AREA.AGUARDANDO)
    .order('posicao_prioridade', { ascending: true })
    .limit(1)
    .maybeSingle();

  return area as AreaTrabalho | null;
}
