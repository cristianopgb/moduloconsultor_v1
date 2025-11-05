import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Paperclip, MessageSquare, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { KanbanCardModal } from './KanbanCardModal';
import type { KanbanCard, StatusKanban } from '../../types/consultor';

interface KanbanBoardProps {
  jornadaId: string;
}

const COLUMNS: { status: StatusKanban; label: string; color: string }[] = [
  { status: 'todo', label: 'A Fazer', color: 'bg-gray-700' },
  { status: 'in_progress', label: 'Em Andamento', color: 'bg-blue-700' },
  { status: 'blocked', label: 'Bloqueado', color: 'bg-red-700' },
  { status: 'done', label: 'Concluído', color: 'bg-green-700' }
];

export function KanbanBoard({ jornadaId }: KanbanBoardProps) {
  const { user } = useAuth();
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null);

  useEffect(() => {
    if (!jornadaId) return;

    loadCards();

    const channel = supabase
      .channel(`kanban-board-${jornadaId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'kanban_cards',
        filter: `jornada_id=eq.${jornadaId}`
      }, () => {
        loadCards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jornadaId]);

  async function loadCards() {
    if (!jornadaId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('jornada_id', jornadaId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setCards(data || []);
    } catch (err) {
      console.error('Erro ao carregar cards:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(cardId: string, newStatus: StatusKanban) {
    try {
      const { error } = await supabase
        .from('kanban_cards')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', cardId);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!confirm('Tem certeza que deseja excluir esta ação?')) return;

    try {
      const { error } = await supabase
        .from('kanban_cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao excluir card:', err);
    }
  }

  function handleDragStart(card: KanbanCard) {
    setDraggedCard(card);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(newStatus: StatusKanban) {
    if (!draggedCard) return;
    handleStatusChange(draggedCard.id, newStatus);
    setDraggedCard(null);
  }

  function getCardsByStatus(status: StatusKanban) {
    return cards.filter(c => c.status === status);
  }

  function getPriorityColor(prioridade: string) {
    switch (prioridade) {
      case 'alta': return 'border-l-4 border-l-red-500';
      case 'media': return 'border-l-4 border-l-yellow-500';
      case 'baixa': return 'border-l-4 border-l-green-500';
      default: return '';
    }
  }

  function isOverdue(prazo: string) {
    if (!prazo) return false;
    return new Date(prazo) < new Date();
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
            <h2 className="text-lg font-semibold">Quadro Kanban</h2>
            <p className="text-sm text-gray-400">{cards.length} ações no total</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Ação
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map(column => {
            const columnCards = getCardsByStatus(column.status);

            return (
              <div
                key={column.status}
                className="flex flex-col w-80 bg-gray-800 rounded-lg"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.status)}
              >
                <div className={`${column.color} px-4 py-3 rounded-t-lg`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">{column.label}</h3>
                    <span className="bg-white/20 px-2 py-1 rounded-full text-xs font-bold">
                      {columnCards.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {columnCards.map(card => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => handleDragStart(card)}
                      className={`bg-gray-900 rounded-lg p-4 cursor-move hover:shadow-lg transition-shadow ${getPriorityColor(card.prioridade)}`}
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <GripVertical className="w-4 h-4 text-gray-500 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white line-clamp-2 mb-1">{card.titulo}</h4>
                          {card.descricao && (
                            <p className="text-sm text-gray-400 line-clamp-2">{card.descricao}</p>
                          )}
                        </div>
                      </div>

                      {card.tags && card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {card.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {card.tags.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">
                              +{card.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="space-y-2 mb-3">
                        {card.responsavel && (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="text-gray-500">👤</span>
                            <span className="truncate">{card.responsavel}</span>
                          </div>
                        )}
                        {card.prazo && (
                          <div className={`flex items-center gap-2 text-sm ${
                            isOverdue(card.prazo) && card.status !== 'done'
                              ? 'text-red-400 font-semibold'
                              : 'text-gray-400'
                          }`}>
                            <span>📅</span>
                            <span>{new Date(card.prazo).toLocaleDateString('pt-BR')}</span>
                            {isOverdue(card.prazo) && card.status !== 'done' && (
                              <span className="text-xs bg-red-900/50 px-1.5 py-0.5 rounded">ATRASADA</span>
                            )}
                          </div>
                        )}
                      </div>

                      {card.progresso > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                            <span>Progresso</span>
                            <span>{card.progresso}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${card.progresso}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                        <div className="flex items-center gap-2">
                          {card.observacoes && (
                            <MessageSquare className="w-4 h-4 text-gray-500" title="Tem observações" />
                          )}
                          <Paperclip className="w-4 h-4 text-gray-500" title="Sem anexos" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedCard(card)}
                            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            className="p-1.5 hover:bg-red-900/50 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {columnCards.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Nenhuma ação aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(selectedCard || isCreating) && (
        <KanbanCardModal
          jornadaId={jornadaId}
          card={selectedCard}
          onClose={() => {
            setSelectedCard(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}
