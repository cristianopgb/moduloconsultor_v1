import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { KanbanCard } from '../../types/consultor';

interface ProjectCalendarProps {
  jornadaId: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  actions: KanbanCard[];
}

export function ProjectCalendar({ jornadaId }: ProjectCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [allActions, setAllActions] = useState<KanbanCard[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  useEffect(() => {
    if (!jornadaId) return;

    loadActions();

    const channel = supabase
      .channel(`calendar-${jornadaId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'kanban_cards',
        filter: `jornada_id=eq.${jornadaId}`
      }, () => {
        loadActions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jornadaId]);

  useEffect(() => {
    generateCalendar();
  }, [currentDate, allActions]);

  async function loadActions() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('jornada_id', jornadaId);

      if (error) throw error;
      setAllActions(data || []);
    } catch (err) {
      console.error('Erro ao carregar ações:', err);
    } finally {
      setLoading(false);
    }
  }

  function generateCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const days: CalendarDay[] = [];
    const currentDay = new Date(startDate);

    while (currentDay <= endDate) {
      const dayActions = allActions.filter(action => {
        if (!action.prazo) return false;
        const actionDate = new Date(action.prazo);
        return actionDate.toDateString() === currentDay.toDateString();
      });

      days.push({
        date: new Date(currentDay),
        isCurrentMonth: currentDay.getMonth() === month,
        actions: dayActions
      });

      currentDay.setDate(currentDay.getDate() + 1);
    }

    setCalendarDays(days);
  }

  function getDayColor(day: CalendarDay) {
    if (day.actions.length === 0) return 'bg-gray-800';

    const hasOverdue = day.actions.some(a =>
      a.status !== 'done' && new Date(a.prazo) < new Date()
    );
    const allDone = day.actions.every(a => a.status === 'done');
    const hasPending = day.actions.some(a => a.status !== 'done');

    if (hasOverdue) return 'bg-red-900/50 border-red-700';
    if (allDone) return 'bg-green-900/50 border-green-700';
    if (hasPending) return 'bg-blue-900/50 border-blue-700';

    return 'bg-gray-800';
  }

  function previousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  }

  async function updateActionStatus(actionId: string, newStatus: 'todo' | 'in_progress' | 'blocked' | 'done') {
    try {
      const { error } = await supabase
        .from('kanban_cards')
        .update({ status: newStatus })
        .eq('id', actionId);

      if (error) throw error;
      loadActions();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Calendário de Ações</h2>
            <p className="text-sm text-gray-400">Visualize prazos e status das ações</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-semibold min-w-[180px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(name => (
            <div key={name} className="text-center text-sm font-semibold text-gray-400 py-2">
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, idx) => {
            const isToday = day.date.toDateString() === new Date().toDateString();

            return (
              <div
                key={idx}
                onClick={() => day.actions.length > 0 && setSelectedDay(day)}
                className={`
                  aspect-square p-2 rounded-lg border transition-all
                  ${day.isCurrentMonth ? 'opacity-100' : 'opacity-40'}
                  ${isToday ? 'ring-2 ring-blue-400' : ''}
                  ${getDayColor(day)}
                  ${day.actions.length > 0 ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'cursor-default'}
                `}
              >
                <div className="flex flex-col h-full">
                  <span className={`text-sm font-semibold ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                    {day.date.getDate()}
                  </span>
                  {day.actions.length > 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xl font-bold text-white">{day.actions.length}</div>
                        <div className="text-xs text-gray-400">
                          {day.actions.length === 1 ? 'ação' : 'ações'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-900/50 border border-red-700 rounded"></div>
            <span className="text-gray-400">Atrasadas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-900/50 border border-green-700 rounded"></div>
            <span className="text-gray-400">Concluídas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-900/50 border border-blue-700 rounded"></div>
            <span className="text-gray-400">Pendentes</span>
          </div>
        </div>
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {selectedDay.date.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                <p className="text-sm text-gray-400">{selectedDay.actions.length} ações neste dia</p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {selectedDay.actions.map(action => (
                <div
                  key={action.id}
                  className={`bg-gray-900 rounded-lg p-4 border ${
                    action.status === 'done'
                      ? 'border-green-700'
                      : new Date(action.prazo) < new Date()
                      ? 'border-red-700'
                      : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{action.titulo}</h4>
                      {action.descricao && (
                        <p className="text-sm text-gray-400">{action.descricao}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      action.status === 'done'
                        ? 'bg-green-900/50 text-green-400'
                        : action.status === 'in_progress'
                        ? 'bg-blue-900/50 text-blue-400'
                        : action.status === 'blocked'
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {action.status === 'done' && 'Concluída'}
                      {action.status === 'in_progress' && 'Em Andamento'}
                      {action.status === 'blocked' && 'Bloqueada'}
                      {action.status === 'todo' && 'A Fazer'}
                    </span>
                  </div>

                  {action.responsavel && (
                    <p className="text-sm text-gray-400 mb-3">
                      👤 {action.responsavel}
                    </p>
                  )}

                  {action.status !== 'done' && (
                    <div className="flex gap-2">
                      {action.status === 'todo' && (
                        <button
                          onClick={() => updateActionStatus(action.id, 'in_progress')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                        >
                          Iniciar
                        </button>
                      )}
                      {action.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => updateActionStatus(action.id, 'done')}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                          >
                            Concluir
                          </button>
                          <button
                            onClick={() => updateActionStatus(action.id, 'blocked')}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                          >
                            Bloquear
                          </button>
                        </>
                      )}
                      {action.status === 'blocked' && (
                        <button
                          onClick={() => updateActionStatus(action.id, 'in_progress')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                        >
                          Desbloquear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
