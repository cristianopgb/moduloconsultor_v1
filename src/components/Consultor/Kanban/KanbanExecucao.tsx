import React, { useEffect, useState } from 'react';
import { ChevronRight, GripVertical, Clock, User, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface KanbanCard {
  id: string;
  jornada_id: string;
  area_id: string | null;
  titulo: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  ordem: number;
  dados_5w2h: {
    o_que?: string;
    por_que?: string;
    quem?: string;
    quando?: string;
    onde?: string;
    como?: string;
    quanto?: string;
  };
  created_at: string;
}

interface KanbanExecucaoProps {
  jornadaId: string;
}

const STATUS_CONFIG = {
  todo: { label: 'A Fazer', color: 'bg-gray-100 border-gray-300' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-50 border-blue-300' },
  blocked: { label: 'Bloqueado', color: 'bg-red-50 border-red-300' },
  done: { label: 'Concluído', color: 'bg-green-50 border-green-300' }
};

export function KanbanExecucao({ jornadaId }: KanbanExecucaoProps) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);

  useEffect(() => {
    if (!jornadaId) return;

    loadCards();

    // Realtime subscription
    const channel = supabase
      .channel(`kanban-${jornadaId}`)
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
    setLoading(true);
    try {
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

  async function handleMoveCard(cardId: string, newStatus: KanbanCard['status']) {
    try {
      await supabase
        .from('kanban_cards')
        .update({ status: newStatus })
        .eq('id', cardId);

      loadCards();
    } catch (err) {
      console.error('Erro ao mover card:', err);
    }
  }

  function getCardsByStatus(status: KanbanCard['status']) {
    return cards.filter(c => c.status === status);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
        <AlertCircle className="w-12 h-12" />
        <p className="text-sm">Nenhum card de ação ainda</p>
        <p className="text-xs">Ações aparecerão aqui quando o plano for gerado</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="font-semibold text-sm">Kanban de Execução</h3>
        <p className="text-xs text-gray-400 mt-1">{cards.length} ações mapeadas</p>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 grid grid-cols-4 gap-3 p-3 overflow-auto">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const statusCards = getCardsByStatus(status as KanbanCard['status']);

          return (
            <div key={status} className="flex flex-col min-h-0">
              {/* Column Header */}
              <div className="mb-2 pb-2 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">{config.label}</h4>
                  <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded-full">
                    {statusCards.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {statusCards.map(card => (
                  <div
                    key={card.id}
                    className={`${config.color} border rounded-lg p-2 cursor-pointer hover:shadow-md transition-shadow`}
                    onClick={() => setSelectedCard(card)}
                  >
                    {/* Card Header */}
                    <div className="flex items-start gap-2 mb-2">
                      <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-medium line-clamp-2">
                          {card.titulo}
                        </h5>
                      </div>
                    </div>

                    {/* Card Meta */}
                    <div className="space-y-1">
                      {card.responsavel && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-600">
                          <User className="w-3 h-3" />
                          <span className="truncate">{card.responsavel}</span>
                        </div>
                      )}
                      {card.prazo && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span className="truncate">{card.prazo}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    {status !== 'done' && (
                      <div className="mt-2 pt-2 border-t border-gray-200 flex gap-1">
                        {status === 'todo' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveCard(card.id, 'in_progress');
                            }}
                            className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                          >
                            <ChevronRight className="w-3 h-3" />
                            Iniciar
                          </button>
                        )}
                        {status === 'in_progress' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveCard(card.id, 'blocked');
                              }}
                              className="text-[10px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              Bloquear
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveCard(card.id, 'done');
                              }}
                              className="text-[10px] px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              Concluir
                            </button>
                          </>
                        )}
                        {status === 'blocked' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveCard(card.id, 'in_progress');
                            }}
                            className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
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
          );
        })}
      </div>

      {/* Modal de Detalhes */}
      {selectedCard && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold mb-2">{selectedCard.titulo}</h3>
                <p className="text-sm text-gray-600">{selectedCard.descricao}</p>
              </div>

              {/* Framework 5W2H */}
              {selectedCard.dados_5w2h && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2">Framework 5W2H</h4>

                  {selectedCard.dados_5w2h.o_que && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">O QUÊ</span>
                      <p className="text-sm mt-1">{selectedCard.dados_5w2h.o_que}</p>
                    </div>
                  )}

                  {selectedCard.dados_5w2h.por_que && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">POR QUÊ</span>
                      <p className="text-sm mt-1">{selectedCard.dados_5w2h.por_que}</p>
                    </div>
                  )}

                  {selectedCard.dados_5w2h.quem && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">QUEM</span>
                      <p className="text-sm mt-1">{selectedCard.dados_5w2h.quem}</p>
                    </div>
                  )}

                  {selectedCard.dados_5w2h.quando && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">QUANDO</span>
                      <p className="text-sm mt-1">{selectedCard.dados_5w2h.quando}</p>
                    </div>
                  )}

                  {selectedCard.dados_5w2h.onde && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">ONDE</span>
                      <p className="text-sm mt-1">{selectedCard.dados_5w2h.onde}</p>
                    </div>
                  )}

                  {selectedCard.dados_5w2h.como && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">COMO</span>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{selectedCard.dados_5w2h.como}</p>
                    </div>
                  )}

                  {selectedCard.dados_5w2h.quanto && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500">QUANTO</span>
                      <p className="text-sm mt-1">{selectedCard.dados_5w2h.quanto}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setSelectedCard(null)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
