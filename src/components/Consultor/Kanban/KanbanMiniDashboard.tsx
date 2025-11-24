import { useEffect, useState } from 'react';
import { ArrowRight, TrendingUp, CheckCircle, Clock, AlertCircle, Target } from 'lucide-react';
import { ProgressIndicator } from '../../Chat/ProgressIndicator';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { ProjectKPIs } from '../../../types/consultor';

interface KanbanMiniDashboardProps {
  jornadaId: string;
}

export function KanbanMiniDashboard({ jornadaId }: KanbanMiniDashboardProps) {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<ProjectKPIs>({
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
      .channel(`kanban-kpis-${jornadaId}`)
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
        <ProgressIndicator
          messages={['Carregando kanban...']}
          icon="spinner"
          size="md"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="text-center pb-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold mb-1">Gestão de Ações</h3>
        <p className="text-xs text-gray-400">Acompanhe o progresso do seu projeto</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Total</span>
          </div>
          <div className="text-2xl font-bold text-white">{kpis.total_acoes}</div>
          <div className="text-xs text-gray-500 mt-1">ações criadas</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 border border-green-700">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Concluídas</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{kpis.acoes_concluidas}</div>
          <div className="text-xs text-gray-500 mt-1">{kpis.taxa_conclusao}% completo</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 border border-blue-700">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Em Andamento</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{kpis.acoes_em_andamento}</div>
          <div className="text-xs text-gray-500 mt-1">em execução</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 border border-yellow-700">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Pendentes</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{kpis.acoes_pendentes}</div>
          <div className="text-xs text-gray-500 mt-1">aguardando início</div>
        </div>
      </div>

      {kpis.acoes_bloqueadas > 0 && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-400">Atenção</span>
          </div>
          <p className="text-xs text-gray-300">
            {kpis.acoes_bloqueadas} {kpis.acoes_bloqueadas === 1 ? 'ação bloqueada' : 'ações bloqueadas'}
          </p>
        </div>
      )}

      {kpis.acoes_atrasadas > 0 && (
        <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">Prazos</span>
          </div>
          <p className="text-xs text-gray-300">
            {kpis.acoes_atrasadas} {kpis.acoes_atrasadas === 1 ? 'ação atrasada' : 'ações atrasadas'}
          </p>
        </div>
      )}

      {Object.keys(kpis.acoes_por_responsavel).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">Por Responsável</h4>
          <div className="space-y-1.5">
            {Object.entries(kpis.acoes_por_responsavel)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([responsavel, count]) => (
                <div key={responsavel} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5">
                  <span className="text-xs text-gray-300 truncate">{responsavel}</span>
                  <span className="text-xs font-bold text-blue-400">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-gray-700">
        <button
          onClick={() => navigate(`/projetos/${jornadaId}`)}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg py-3 px-4 flex items-center justify-center gap-2 font-semibold transition-all transform hover:scale-105 shadow-lg"
        >
          <span>Abrir Gestão de Projetos</span>
          <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Visualize o Kanban completo, chat executor, calendário e muito mais
        </p>
      </div>
    </div>
  );
}
