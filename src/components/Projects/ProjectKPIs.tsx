import { useEffect, useState } from 'react';
import { TrendingUp, CheckCircle, Clock, AlertCircle, Target, Users, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ProjectKPIs as ProjectKPIsType } from '../../types/consultor';

interface ProjectKPIsProps {
  jornadaId: string;
}

export function ProjectKPIs({ jornadaId }: ProjectKPIsProps) {
  const [kpis, setKpis] = useState<ProjectKPIsType>({
    total_acoes: 0,
    acoes_concluidas: 0,
    acoes_pendentes: 0,
    acoes_em_andamento: 0,
    acoes_bloqueadas: 0,
    acoes_por_responsavel: {},
    acoes_por_processo: {},
    taxa_conclusao: 0,
    acoes_atrasadas: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jornadaId) return;

    loadKPIs();

    const channel = supabase
      .channel(`project-kpis-${jornadaId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'kanban_cards',
        filter: `jornada_id=eq.${jornadaId}`
      }, () => {
        loadKPIs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jornadaId]);

  async function loadKPIs() {
    try {
      setLoading(true);

      const { data: cards, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('jornada_id', jornadaId);

      if (error) throw error;

      const total = cards?.length || 0;
      const concluidas = cards?.filter(c => c.status === 'done').length || 0;
      const pendentes = cards?.filter(c => c.status === 'todo').length || 0;
      const em_andamento = cards?.filter(c => c.status === 'in_progress').length || 0;
      const bloqueadas = cards?.filter(c => c.status === 'blocked').length || 0;

      const hoje = new Date();
      const atrasadas = cards?.filter(c => {
        if (c.status === 'done') return false;
        if (!c.prazo) return false;
        const prazo = new Date(c.prazo);
        return prazo < hoje;
      }).length || 0;

      const por_responsavel: Record<string, number> = {};
      const por_processo: Record<string, number> = {};

      cards?.forEach(card => {
        if (card.responsavel) {
          por_responsavel[card.responsavel] = (por_responsavel[card.responsavel] || 0) + 1;
        }
        if (card.area_id) {
          por_processo[card.area_id] = (por_processo[card.area_id] || 0) + 1;
        }
      });

      setKpis({
        total_acoes: total,
        acoes_concluidas: concluidas,
        acoes_pendentes: pendentes,
        acoes_em_andamento: em_andamento,
        acoes_bloqueadas: bloqueadas,
        acoes_por_responsavel: por_responsavel,
        acoes_por_processo: por_processo,
        taxa_conclusao: total > 0 ? Math.round((concluidas / total) * 100) : 0,
        acoes_atrasadas: atrasadas
      });
    } catch (err) {
      console.error('Erro ao carregar KPIs:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="border-b border-gray-700 pb-3">
        <h3 className="text-lg font-semibold">Métricas do Projeto</h3>
        <p className="text-xs text-gray-400 mt-1">Acompanhamento em tempo real</p>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-900/50 rounded-lg">
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total de Ações</p>
              <p className="text-2xl font-bold">{kpis.total_acoes}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Taxa de Conclusão</span>
            <span className="font-bold text-green-400">{kpis.taxa_conclusao}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${kpis.taxa_conclusao}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Concluídas</span>
            </div>
            <p className="text-xl font-bold text-green-400">{kpis.acoes_concluidas}</p>
          </div>

          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Em Andamento</span>
            </div>
            <p className="text-xl font-bold text-blue-400">{kpis.acoes_em_andamento}</p>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Pendentes</span>
            </div>
            <p className="text-xl font-bold text-yellow-400">{kpis.acoes_pendentes}</p>
          </div>

          <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-gray-400">Bloqueadas</span>
            </div>
            <p className="text-xl font-bold text-red-400">{kpis.acoes_bloqueadas}</p>
          </div>
        </div>

        {kpis.acoes_atrasadas > 0 && (
          <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              <div>
                <p className="font-semibold text-orange-400">Ações Atrasadas</p>
                <p className="text-xs text-gray-400">Requerem atenção imediata</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-orange-400">{kpis.acoes_atrasadas}</p>
          </div>
        )}
      </div>

      {Object.keys(kpis.acoes_por_responsavel).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
            <Users className="w-4 h-4 text-gray-400" />
            <h4 className="text-sm font-semibold">Por Responsável</h4>
          </div>

          <div className="space-y-2">
            {Object.entries(kpis.acoes_por_responsavel)
              .sort((a, b) => b[1] - a[1])
              .map(([responsavel, count]) => {
                const percentage = (count / kpis.total_acoes) * 100;
                return (
                  <div key={responsavel} className="bg-gray-900 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white truncate">{responsavel}</span>
                      <span className="text-sm font-bold text-blue-400">{count}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {Object.keys(kpis.acoes_por_processo).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
            <Layers className="w-4 h-4 text-gray-400" />
            <h4 className="text-sm font-semibold">Por Processo/Área</h4>
          </div>

          <div className="space-y-2">
            {Object.entries(kpis.acoes_por_processo)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([processo, count]) => {
                const percentage = (count / kpis.total_acoes) * 100;
                return (
                  <div key={processo} className="bg-gray-900 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Processo</span>
                      <span className="text-sm font-bold text-cyan-400">{count}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-cyan-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-700/50 rounded-lg p-4">
        <p className="text-xs text-gray-400 mb-2">💡 Dica</p>
        <p className="text-sm text-gray-300">
          Use o Agente Executor para atualizar o status das ações através de conversa natural.
        </p>
      </div>
    </div>
  );
}
