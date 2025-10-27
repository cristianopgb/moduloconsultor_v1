import React, { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Upload, FileText, Tag,
  Trash2, Edit, Save, X, Loader, AlertCircle,
  Download, Search, Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  aplicabilidade: {
    problemas?: string[];
    contextos?: string[];
    nivel_maturidade?: string[];
    tempo_aplicacao?: string;
  };
  metadados: {
    fonte?: string;
    complexidade?: string;
    prerequisitos?: string[];
  };
  ativo: boolean;
  versao: number;
  created_at: string;
}

export function KnowledgeManagementPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [bulkUpload, setBulkUpload] = useState(false);

  const [formData, setFormData] = useState<Partial<KnowledgeDocument>>({
    title: '',
    category: 'metodologia',
    content: '',
    tags: [],
    aplicabilidade: {
      problemas: [],
      contextos: [],
      nivel_maturidade: [],
      tempo_aplicacao: ''
    },
    metadados: {
      fonte: '',
      complexidade: 'media',
      prerequisitos: []
    },
    ativo: true
  });

  const categories = ['metodologia', 'framework', 'best_practice', 'template', 'exemplo'];
  const complexidades = ['baixa', 'media', 'alta'];
  const nivelMaturidade = ['iniciante', 'intermediario', 'avancado'];

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_base_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar documentos:', error);
      alert('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(doc?: KnowledgeDocument) {
    try {
      const dataToSave = doc || formData;

      if (!dataToSave.title || !dataToSave.content) {
        alert('Título e conteúdo são obrigatórios');
        return;
      }

      if (editing) {
        // Update
        const { error } = await supabase
          .from('knowledge_base_documents')
          .update({
            title: dataToSave.title,
            category: dataToSave.category,
            content: dataToSave.content,
            tags: dataToSave.tags,
            aplicabilidade: dataToSave.aplicabilidade,
            metadados: dataToSave.metadados,
            ativo: dataToSave.ativo,
            versao: (dataToSave.versao || 1) + 1
          })
          .eq('id', editing);

        if (error) throw error;
        alert('Documento atualizado com sucesso!');
      } else {
        // Insert
        const { error } = await supabase
          .from('knowledge_base_documents')
          .insert({
            ...dataToSave,
            versao: 1
          });

        if (error) throw error;
        alert('Documento criado com sucesso!');
      }

      setEditing(null);
      setShowAddForm(false);
      resetForm();
      loadDocuments();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar documento: ' + error.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;

    try {
      const { error } = await supabase
        .from('knowledge_base_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Documento excluído com sucesso!');
      loadDocuments();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir documento');
    }
  }

  function resetForm() {
    setFormData({
      title: '',
      category: 'metodologia',
      content: '',
      tags: [],
      aplicabilidade: {
        problemas: [],
        contextos: [],
        nivel_maturidade: [],
        tempo_aplicacao: ''
      },
      metadados: {
        fonte: '',
        complexidade: 'media',
        prerequisitos: []
      },
      ativo: true
    });
  }

  function startEdit(doc: KnowledgeDocument) {
    setEditing(doc.id);
    setFormData(doc);
    setShowAddForm(true);
  }

  function handleBulkUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        if (!Array.isArray(json)) {
          alert('O arquivo deve conter um array de documentos');
          return;
        }

        let success = 0;
        let errors = 0;

        for (const doc of json) {
          try {
            const { error } = await supabase
              .from('knowledge_base_documents')
              .insert({
                title: doc.title,
                category: doc.category || 'metodologia',
                content: doc.content,
                tags: doc.tags || [],
                aplicabilidade: doc.aplicabilidade || {},
                metadados: doc.metadados || {},
                ativo: doc.ativo !== false,
                versao: 1
              });

            if (error) throw error;
            success++;
          } catch (err) {
            console.error('Erro ao inserir documento:', doc.title, err);
            errors++;
          }
        }

        alert(`Upload concluído!\nSucesso: ${success}\nErros: ${errors}`);
        loadDocuments();
        setBulkUpload(false);
      } catch (error: any) {
        console.error('Erro ao processar arquivo:', error);
        alert('Erro ao processar arquivo JSON: ' + error.message);
      }
    };
    reader.readAsText(file);
  }

  function exportDocuments() {
    const dataStr = JSON.stringify(documents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge-base-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

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
            <BookOpen className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Base de Conhecimento</h1>
              <p className="text-sm text-gray-600">Gerenciar átomos de conhecimento</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportDocuments}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button
              onClick={() => setBulkUpload(!bulkUpload)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Upload className="w-4 h-4" />
              Upload em Massa
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditing(null);
                setShowAddForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Novo Documento
            </button>
          </div>
        </div>

        {bulkUpload && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload em Massa
            </h3>
            <p className="text-sm text-blue-800 mb-3">
              Faça upload de um arquivo JSON com array de documentos. Formato esperado:
            </p>
            <pre className="text-xs bg-white p-2 rounded border border-blue-200 mb-3 overflow-x-auto">
{`[
  {
    "title": "Nome do Documento",
    "category": "metodologia",
    "content": "Conteúdo em markdown...",
    "tags": ["tag1", "tag2"],
    "aplicabilidade": {...},
    "metadados": {...}
  }
]`}
            </pre>
            <input
              type="file"
              accept=".json"
              onChange={handleBulkUploadFile}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        )}

        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas Categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          {filteredDocuments.length} documento(s) encontrado(s)
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {editing ? 'Editar Documento' : 'Novo Documento'}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: SIPOC - Mapeamento de Processos"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Complexidade
              </label>
              <select
                value={formData.metadados?.complexidade}
                onChange={(e) => setFormData({
                  ...formData,
                  metadados: {...formData.metadados, complexidade: e.target.value}
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {complexidades.map(comp => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
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
                placeholder="Ex: bpm, processos, mapeamento"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conteúdo (Markdown) *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Escreva o conteúdo em Markdown..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tempo de Aplicação
              </label>
              <input
                type="text"
                value={formData.aplicabilidade?.tempo_aplicacao}
                onChange={(e) => setFormData({
                  ...formData,
                  aplicabilidade: {...formData.aplicabilidade, tempo_aplicacao: e.target.value}
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 30-60 minutos"
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
                Documento ativo
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => handleSave()}
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
        {filteredDocuments.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{doc.title}</h3>
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    {doc.category}
                  </span>
                  {!doc.ativo && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                      Inativo
                    </span>
                  )}
                  <span className="text-xs text-gray-500">v{doc.versao}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {doc.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{doc.content.substring(0, 200)}...</p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => startEdit(doc)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {doc.aplicabilidade && Object.keys(doc.aplicabilidade).length > 0 && (
              <div className="border-t pt-3 mt-3">
                <div className="text-xs text-gray-500 space-y-1">
                  {doc.aplicabilidade.tempo_aplicacao && (
                    <p><strong>Tempo:</strong> {doc.aplicabilidade.tempo_aplicacao}</p>
                  )}
                  {doc.metadados?.complexidade && (
                    <p><strong>Complexidade:</strong> {doc.metadados.complexidade}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredDocuments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Nenhum documento encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
