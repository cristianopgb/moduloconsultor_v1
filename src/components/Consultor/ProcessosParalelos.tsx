import React, { useState, useEffect } from 'react';
import { Lock, Unlock, CheckCircle, Clock, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AreaTrabalho } from '../../types/consultor';
import { obterProximaAreaDisponivel, calcularProgressoArea } from '../../lib/consultor/paralelismo';

interface ProcessosParalelosProps {
  jornadaId: string;
  onSelectArea: (areaId: string) => void;
}

export function ProcessosParalelos({ jornadaId, onSelectArea }: ProcessosParalelosProps) {
  const [areas, setAreas] = useState<AreaTrabalho[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaAtiva, setAreaAtiva] = useState<string | null>(null);

  useEffect(() => {
    if (jornadaId) {
      loadAreas();
      setupRealtimeSubscription();
    }
  }, [jornadaId]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`areas-${jornadaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'areas_trabalho',
          filter: `jornada_id=eq.${jornadaId}`
        },
        () => {
          loadAreas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadAreas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('areas_trabalho')
        .select('*')
        .eq('jornada_id', jornadaId)
        .order('posicao_prioridade', { ascending: true });

      if (error) throw error;

      const areasComProgresso = await Promise.all(
        (data || []).map(async (area) => {
          const progresso = await calcularProgressoArea(area.id);
          return { ...area, progresso_area: progresso };
        })
      );

      setAreas(areasComProgresso as AreaTrabalho[]);
    } catch (err) {
      console.error('Erro ao carregar �reas:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (area: AreaTrabalho) => {
    if (area.etapa_area === 'concluida') {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Conclu�do
        </span>
      );
    }

    if (!area.pode_iniciar) {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
          <Lock className="w-3 h-3" />
          Bloqueado
        </span>
      );
    }

    if (area.etapa_area === 'aguardando') {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full animate-pulse">
          <Unlock className="w-3 h-3" />
          Dispon�vel
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
        <Clock className="w-3 h-3" />
        Em andamento
      </span>
    );
  };

  const handleSelectArea = (area: AreaTrabalho) => {
    if (area.pode_iniciar || area.etapa_area !== 'aguardando') {
      setAreaAtiva(area.id);
      onSelectArea(area.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Processos Dispon�veis</h3>
        <span className="text-xs text-gray-500">
          {areas.filter(a => a.etapa_area === 'concluida').length} de {areas.length} conclu�dos
        </span>
      </div>

      {areas.map((area, index) => (
        <div
          key={area.id}
          className={`
            border rounded-lg p-4 transition-all cursor-pointer
            ${areaAtiva === area.id
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : area.pode_iniciar || area.etapa_area !== 'aguardando'
              ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
              : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
            }
          `}
          onClick={() => handleSelectArea(area)}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                <h4 className="font-medium text-gray-900">{area.nome_area}</h4>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Score: {area.score_priorizacao} | Etapa: {area.etapa_area}
              </p>
            </div>

            {getStatusBadge(area)}
          </div>

          {area.progresso_area > 0 && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    area.etapa_area === 'concluida' ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${area.progresso_area}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {area.progresso_area}% conclu�do
              </p>
            </div>
          )}

          {area.pode_iniciar && area.etapa_area === 'aguardando' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSelectArea(area);
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              Iniciar Processo
            </button>
          )}

          {!area.pode_iniciar && area.bloqueada_por && (
            <div className="mt-3 text-xs text-gray-500 bg-gray-100 p-2 rounded">
              Ser� desbloqueado quando o processo anterior atingir a fase de Plano de A��o
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
