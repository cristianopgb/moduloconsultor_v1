import React, { useState, useEffect } from 'react';
import {
  Briefcase, Plus, Save, Trash2, Edit, X,
  Loader, AlertCircle, TrendingUp, HelpCircle, Target
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface KPI {
  nome: string;
  descricao: string;
  formula: string;
  meta_ideal: string;
}

interface Pergunta {
  campo: string;
  pergunta: string;
  tipo: string;
  opcoes?: string[];
}

interface SectorAdapter {
  id: string;
  setor_nome: string;
  setor_descricao: string;
  kpis: KPI[];
  perguntas_anamnese: Pergunta[];
  metodologias_recomendadas: string[];
  problemas_comuns: string[];
  entregaveis_tipicos: string[];
  tags: string[];
  prioridade: number;
  ativo: boolean;
  created_at: string;
}

export function SectorAdaptersPage() {
  const [adapters, setAdapters] = useState<SectorAdapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formData, setFormData] = useState<Partial<SectorAdapter>>({
    setor_nome: '',
    setor_descricao: '',
    kpis: [],
    perguntas_anamnese: [],
    metodologias_recomendadas: [],
    problemas_comuns: [],
    entregaveis_tipicos: [],
    tags: [],
    prioridade: 5,
    ativo: true
  });

  const [newKPI, setNewKPI] = useState<KPI>({
    nome: '',
    descricao: '',
    formula: '',
    meta_ideal: ''
  });

  const [newPergunta, setNewPergunta] = useState<Pergunta>({
    campo: '',
    pergunta: '',
    tipo: 'text',
    opcoes: []
  });

  useEffect(() => {
    loadAdapters();
  }, []);

  async function loadAdapters() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sector_adapters')
        .select('*')
        .order('prioridade', { ascending: false });

      if (error) throw error;
      setAdapters(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar adapters:', error);
      alert('Erro ao carregar adapters');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      if (!formData.setor_nome) {
        alert('Nome do setor é obrigatório');
        return;
      }

      if (editing) {
        const { error } = await supabase
          .from('sector_adapters')
          .update(formData)
          .eq('id', editing);

        if (error) throw error;
        alert('Adapter atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('sector_adapters')
          .insert(formData);

        if (error) throw error;
        alert('Adapter criado com sucesso!');
      }

      setEditing(null);
      setShowAddForm(false);
      resetForm();
      loadAdapters();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar adapter: ' + error.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este adapter?')) return;

    try {
      const { error } = await supabase
        .from('sector_adapters')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Adapter excluído com sucesso!');
      loadAdapters();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir adapter');
    }
  }

  function resetForm() {
    setFormData({
      setor_nome: '',
      setor_descricao: '',
      kpis: [],
      perguntas_anamnese: [],
      metodologias_recomendadas: [],
      problemas_comuns: [],
      entregaveis_tipicos: [],
      tags: [],
      prioridade: 5,
      ativo: true
    });
  }

  function startEdit(adapter: SectorAdapter) {
    setEditing(adapter.id);
    setFormData(adapter);
    setShowAddForm(true);
  }

  function addKPI() {
    if (!newKPI.nome || !newKPI.descricao) {
      alert('Nome e descrição do KPI são obrigatórios');
      return;
    }

    setFormData({
      ...formData,
      kpis: [...(formData.kpis || []), newKPI]
    });

    setNewKPI({ nome: '', descricao: '', formula: '', meta_ideal: '' });
  }

  function removeKPI(index: number) {
    const kpis = [...(formData.kpis || [])];
    kpis.splice(index, 1);
    setFormData({ ...formData, kpis });
  }

  function addPergunta() {
    if (!newPergunta.campo || !newPergunta.pergunta) {
      alert('Campo e pergunta são obrigatórios');
      return;
    }

    setFormData({
      ...formData,
      perguntas_anamnese: [...(formData.perguntas_anamnese || []), newPergunta]
    });

    setNewPergunta({ campo: '', pergunta: '', tipo: 'text', opcoes: [] });
  }

  function removePergunta(index: number) {
    const perguntas = [...(formData.perguntas_anamnese || [])];
    perguntas.splice(index, 1);
    setFormData({ ...formData, perguntas_anamnese: perguntas });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Adapters por Setor</h1>
              <p className="text-sm text-gray-600">KPIs e perguntas específicas por segmento</p>
            </div>
          </div>

          <button
            onClick={() => {
              resetForm();
              setEditing(null);
              setShowAddForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Novo Adapter
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {adapters.length} adapter(s) configurado(s)
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {editing ? 'Editar Adapter' : 'Novo Adapter'}
            </h2>
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditing(null);
                resetForm();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Setor *
                </label>
                <input
                  type="text"
                  value={formData.setor_nome}
                  onChange={(e) => setFormData({...formData, setor_nome: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Tecnologia"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade
                </label>
                <input
                  type="number"
                  value={formData.prioridade}
                  onChange={(e) => setFormData({...formData, prioridade: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="10"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.setor_descricao}
                  onChange={(e) => setFormData({...formData, setor_descricao: e.target.value})}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Breve descrição do setor"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={formData.tags?.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: tecnologia, software, ti"
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">KPIs do Setor</h3>
              </div>

              <div className="space-y-3 mb-4">
                {formData.kpis?.map((kpi, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{kpi.nome}</p>
                        <p className="text-sm text-gray-600">{kpi.descricao}</p>
                        {kpi.formula && (
                          <p className="text-xs text-gray-500 mt-1">Fórmula: {kpi.formula}</p>
                        )}
                        {kpi.meta_ideal && (
                          <p className="text-xs text-green-600 mt-1">Meta: {kpi.meta_ideal}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeKPI(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900 mb-3">Adicionar KPI</p>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nome do KPI *"
                    value={newKPI.nome}
                    onChange={(e) => setNewKPI({...newKPI, nome: e.target.value})}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Descrição *"
                    value={newKPI.descricao}
                    onChange={(e) => setNewKPI({...newKPI, descricao: e.target.value})}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Fórmula de cálculo"
                    value={newKPI.formula}
                    onChange={(e) => setNewKPI({...newKPI, formula: e.target.value})}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Meta ideal"
                    value={newKPI.meta_ideal}
                    onChange={(e) => setNewKPI({...newKPI, meta_ideal: e.target.value})}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <button
                  onClick={addKPI}
                  className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Adicionar KPI
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Perguntas de Anamnese</h3>
              </div>

              <div className="space-y-3 mb-4">
                {formData.perguntas_anamnese?.map((pergunta, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{pergunta.pergunta}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {pergunta.campo}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                            {pergunta.tipo}
                          </span>
                        </div>
                        {pergunta.opcoes && pergunta.opcoes.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Opções: {pergunta.opcoes.join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removePergunta(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900 mb-3">Adicionar Pergunta</p>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Campo (ex: stack_tecnologico) *"
                    value={newPergunta.campo}
                    onChange={(e) => setNewPergunta({...newPergunta, campo: e.target.value})}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <select
                    value={newPergunta.tipo}
                    onChange={(e) => setNewPergunta({...newPergunta, tipo: e.target.value})}
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="select">Select</option>
                    <option value="multiselect">Multi-select</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Pergunta *"
                    value={newPergunta.pergunta}
                    onChange={(e) => setNewPergunta({...newPergunta, pergunta: e.target.value})}
                    className="col-span-2 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  {(newPergunta.tipo === 'select' || newPergunta.tipo === 'multiselect') && (
                    <input
                      type="text"
                      placeholder="Opções (separadas por vírgula)"
                      value={newPergunta.opcoes?.join(', ') || ''}
                      onChange={(e) => setNewPergunta({
                        ...newPergunta,
                        opcoes: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                      })}
                      className="col-span-2 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  )}
                </div>
                <button
                  onClick={addPergunta}
                  className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Adicionar Pergunta
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Informações Adicionais</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Metodologias Recomendadas (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={formData.metodologias_recomendadas?.join(', ')}
                    onChange={(e) => setFormData({
                      ...formData,
                      metodologias_recomendadas: e.target.value.split(',').map(m => m.trim()).filter(Boolean)
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: SIPOC, Canvas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Problemas Comuns (separados por vírgula)
                  </label>
                  <input
                    type="text"
                    value={formData.problemas_comuns?.join(', ')}
                    onChange={(e) => setFormData({
                      ...formData,
                      problemas_comuns: e.target.value.split(',').map(p => p.trim()).filter(Boolean)
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Baixa retenção, Alto churn"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entregáveis Típicos (separados por vírgula)
                  </label>
                  <input
                    type="text"
                    value={formData.entregaveis_tipicos?.join(', ')}
                    onChange={(e) => setFormData({
                      ...formData,
                      entregaveis_tipicos: e.target.value.split(',').map(e => e.trim()).filter(Boolean)
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Roadmap, Arquitetura"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="ativo" className="text-sm text-gray-700">
                    Adapter ativo
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6 pt-6 border-t">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditing(null);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {adapters.map((adapter) => (
          <div
            key={adapter.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{adapter.setor_nome}</h3>
                  {!adapter.ativo && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                      Inativo
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    Prioridade: {adapter.prioridade}
                  </span>
                </div>
                {adapter.setor_descricao && (
                  <p className="text-sm text-gray-600 mb-3">{adapter.setor_descricao}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {adapter.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => startEdit(adapter)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(adapter.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t pt-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">KPIs</p>
                <p className="text-2xl font-bold text-blue-600">{adapter.kpis.length}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Perguntas</p>
                <p className="text-2xl font-bold text-green-600">{adapter.perguntas_anamnese.length}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Metodologias</p>
                <p className="text-2xl font-bold text-purple-600">{adapter.metodologias_recomendadas.length}</p>
              </div>
            </div>
          </div>
        ))}

        {adapters.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Nenhum adapter configurado</p>
          </div>
        )}
      </div>
    </div>
  );
}
