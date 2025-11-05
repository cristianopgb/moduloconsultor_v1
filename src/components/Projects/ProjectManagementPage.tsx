import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../LoadingSpinner';
import { ChatExecutor } from './ChatExecutor';
import { KanbanBoard } from './KanbanBoard';
import { ProjectKPIs } from './ProjectKPIs';
import { ProjectCalendar } from './ProjectCalendar';
import type { JornadaConsultor } from '../../types/consultor';

export function ProjectManagementPage() {
  const { jornadaId } = useParams<{ jornadaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jornada, setJornada] = useState<JornadaConsultor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'kanban' | 'calendar'>('kanban');

  useEffect(() => {
    if (!jornadaId || !user?.id) return;

    loadJornada();
  }, [jornadaId, user?.id]);

  async function loadJornada() {
    if (!jornadaId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jornadas_consultor')
        .select('*')
        .eq('id', jornadaId)
        .single();

      if (error) throw error;

      if (data.user_id !== user?.id) {
        navigate('/chat');
        return;
      }

      setJornada(data);
    } catch (err) {
      console.error('Erro ao carregar jornada:', err);
      navigate('/chat');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!jornada) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Jornada não encontrada</p>
          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Voltar ao Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/chat')}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Voltar ao Chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-blue-400" />
                <h1 className="text-xl font-bold">Gestão de Projetos</h1>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                {jornada.empresa_nome || 'Projeto de Consultoria'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('kanban')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'calendar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Calendário
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-gray-700 flex flex-col bg-gray-800">
          <ChatExecutor jornadaId={jornadaId!} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'kanban' ? (
            <KanbanBoard jornadaId={jornadaId!} />
          ) : (
            <ProjectCalendar jornadaId={jornadaId!} />
          )}
        </div>

        <div className="w-80 border-l border-gray-700 bg-gray-800 overflow-y-auto">
          <ProjectKPIs jornadaId={jornadaId!} />
        </div>
      </div>
    </div>
  );
}
