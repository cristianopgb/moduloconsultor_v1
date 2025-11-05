import { useState, useEffect } from 'react';
import { X, Save, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { KanbanCard, StatusKanban, Prioridade } from '../../types/consultor';

interface KanbanCardModalProps {
  jornadaId: string;
  card?: KanbanCard | null;
  onClose: () => void;
}

export function KanbanCardModal({ jornadaId, card, onClose }: KanbanCardModalProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    responsavel: '',
    prazo: '',
    status: 'todo' as StatusKanban,
    prioridade: 'media' as Prioridade,
    progresso: 0,
    observacoes: '',
    tags: [] as string[],
    dados_5w2h: {
      o_que: '',
      por_que: '',
      quem: '',
      quando: '',
      onde: '',
      como: '',
      quanto: ''
    }
  });
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (card) {
      setFormData({
        titulo: card.titulo || '',
        descricao: card.descricao || '',
        responsavel: card.responsavel || '',
        prazo: card.prazo || '',
        status: card.status || 'todo',
        prioridade: card.prioridade || 'media',
        progresso: card.progresso || 0,
        observacoes: card.observacoes || '',
        tags: card.tags || [],
        dados_5w2h: card.dados_5w2h || {
          o_que: '',
          por_que: '',
          quem: '',
          quando: '',
          onde: '',
          como: '',
          quanto: ''
        }
      });
    }
  }, [card]);

  async function handleSave() {
    if (!formData.titulo.trim()) {
      alert('O título é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        jornada_id: jornadaId,
        titulo: formData.titulo,
        descricao: formData.descricao,
        responsavel: formData.responsavel,
        prazo: formData.prazo,
        status: formData.status,
        prioridade: formData.prioridade,
        progresso: formData.progresso,
        observacoes: formData.observacoes,
        tags: formData.tags,
        dados_5w2h: formData.dados_5w2h,
        updated_at: new Date().toISOString()
      };

      if (card) {
        const { error } = await supabase
          .from('kanban_cards')
          .update(dataToSave)
          .eq('id', card.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('kanban_cards')
          .insert([{
            ...dataToSave,
            ordem: 0
          }]);

        if (error) throw error;
      }

      onClose();
    } catch (err) {
      console.error('Erro ao salvar ação:', err);
      alert('Erro ao salvar ação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddTag() {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }));
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {card ? 'Editar Ação' : 'Nova Ação'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Título *
              </label>
              <input
                type="text"
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Implementar novo processo de atendimento"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descreva os detalhes da ação..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Responsável
              </label>
              <input
                type="text"
                value={formData.responsavel}
                onChange={(e) => setFormData(prev => ({ ...prev, responsavel: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome do responsável"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prazo
              </label>
              <input
                type="date"
                value={formData.prazo}
                onChange={(e) => setFormData(prev => ({ ...prev, prazo: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as StatusKanban }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todo">A Fazer</option>
                <option value="in_progress">Em Andamento</option>
                <option value="blocked">Bloqueado</option>
                <option value="done">Concluído</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prioridade
              </label>
              <select
                value={formData.prioridade}
                onChange={(e) => setFormData(prev => ({ ...prev, prioridade: e.target.value as Prioridade }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Progresso: {formData.progresso}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.progresso}
                onChange={(e) => setFormData(prev => ({ ...prev, progresso: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite uma tag e pressione Enter"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Adicionar
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Anotações adicionais sobre a ação..."
              />
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4">Framework 5W2H</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  O Quê?
                </label>
                <input
                  type="text"
                  value={formData.dados_5w2h.o_que}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dados_5w2h: { ...prev.dados_5w2h, o_que: e.target.value }
                  }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="O que será feito?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Por Quê?
                </label>
                <input
                  type="text"
                  value={formData.dados_5w2h.por_que}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dados_5w2h: { ...prev.dados_5w2h, por_que: e.target.value }
                  }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Por que será feito?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quem?
                </label>
                <input
                  type="text"
                  value={formData.dados_5w2h.quem}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dados_5w2h: { ...prev.dados_5w2h, quem: e.target.value }
                  }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Quem irá fazer?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quando?
                </label>
                <input
                  type="text"
                  value={formData.dados_5w2h.quando}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dados_5w2h: { ...prev.dados_5w2h, quando: e.target.value }
                  }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Quando será feito?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Onde?
                </label>
                <input
                  type="text"
                  value={formData.dados_5w2h.onde}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dados_5w2h: { ...prev.dados_5w2h, onde: e.target.value }
                  }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Onde será feito?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quanto?
                </label>
                <input
                  type="text"
                  value={formData.dados_5w2h.quanto}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dados_5w2h: { ...prev.dados_5w2h, quanto: e.target.value }
                  }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Quanto custará?"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Como?
                </label>
                <textarea
                  value={formData.dados_5w2h.como}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    dados_5w2h: { ...prev.dados_5w2h, como: e.target.value }
                  }))}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Como será feito?"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
