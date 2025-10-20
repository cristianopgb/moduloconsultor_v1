import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Filter, CreditCard as Edit, Trash2, FileText, Tag, Image, Link, Save, X, AlertCircle, Brain, Upload, Download } from 'lucide-react'
import { supabase, Model } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { MockupUploader } from './MockupUploader'
import { MasterTemplateCreator } from './MasterTemplateCreator'
import { HtmlTemplateModal } from './HtmlTemplateModal'

interface TemplateFormData {
  name: string
  description: string
  category: string
  file_type: string
  file_url: string
  template_content: string
  tags_detectadas: string[]
  preview_image_url: string
  tags: string[]
  template_json?: any
  destination: 'presentation' | 'consultor_entregavel'
}

type AnyModel = Model & {
  render_engine?: 'pptx' | 'html'
  content_html?: string
  content_css?: string
  content_js?: string
  html_variables?: string[]
}

export function TemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<AnyModel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [destinationFilter, setDestinationFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<AnyModel | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [generatingWithAI, setGeneratingWithAI] = useState(false)
  const [aiError, setAiError] = useState('')
  const [showMockupUploader, setShowMockupUploader] = useState(false)
  const [showMasterCreator, setShowMasterCreator] = useState(false)

  // NOVO: modal de template HTML
  const [showHtmlEditor, setShowHtmlEditor] = useState(false)
  const [editingHtml, setEditingHtml] = useState<AnyModel | null>(null)

  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    category: 'general',
    file_type: 'docx',
    file_url: '',
    template_content: '',
    tags_detectadas: [],
    preview_image_url: '',
    tags: [],
    template_json: null,
    destination: 'presentation'
  })

  const generateWithAI = async () => {
    if (!aiInstruction.trim()) {
      setAiError('Digite uma instrução para o agente')
      return
    }

    setGeneratingWithAI(true)
    setAiError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Usuário não autenticado. Faça login novamente.')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/template-creator`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: aiInstruction, user_role: 'master' })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Erro ${response.status}`)
      }

      const aiResult = await response.json()

      setFormData(prev => ({
        ...prev,
        name: aiResult.name || prev.name,
        description: aiResult.description || prev.description,
        category: aiResult.category || prev.category,
        file_type: aiResult.file_type || prev.file_type,
        template_content: aiResult.template_content || prev.template_content,
        tags_detectadas: aiResult.tags_detectadas || prev.tags_detectadas,
        tags: aiResult.tags_detectadas || prev.tags,
        template_json: aiResult
      }))

      setAiInstruction('')
    } catch (err: any) {
      setAiError(err.message || 'Erro ao gerar template com IA')
    } finally {
      setGeneratingWithAI(false)
    }
  }

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('models')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setTemplates((data || []) as AnyModel[])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (user) loadTemplates()
  }, [user])

  const saveTemplate = async () => {
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setSaving(true)
    setError('')

    try {
      const templateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        file_type: formData.file_type,
        file_url: formData.file_url.trim(),
        template_content: formData.template_content.trim(),
        tags_detectadas: formData.tags_detectadas.filter(tag => tag.trim() !== ''),
        preview_image_url: formData.preview_image_url.trim(),
        tags: formData.tags.filter(tag => tag.trim() !== ''),
        template_json: formData.template_json,
        destination: formData.destination
      }

      console.log('💾 Salvando template estruturado:', editingTemplate ? 'UPDATE' : 'INSERT', templateData)

      if (editingTemplate) {
        console.log('🔄 Atualizando template:', editingTemplate.id)
        const { data, error } = await supabase
          .from('models')
          .update(templateData)
          .eq('id', editingTemplate.id)
          .select()

        if (error) {
          console.error('❌ Erro no UPDATE:', error)
          throw new Error(`Erro ao atualizar: ${error.message} (Código: ${error.code})`)
        }
        console.log('✅ Template atualizado:', data)
        if (data && data[0]) setTemplates(prev => prev.map(t => (t.id === editingTemplate.id ? (data[0] as AnyModel) : t)))
      } else {
        console.log('➕ Inserindo novo template')
        const { data, error } = await supabase.from('models').insert([templateData]).select()
        if (error) {
          console.error('❌ Erro no INSERT:', error)
          throw new Error(`Erro ao criar: ${error.message} (Código: ${error.code})`)
        }
        console.log('✅ Template criado:', data)
        if (data && data[0]) setTemplates(prev => [data[0] as AnyModel, ...prev])
      }

      setShowForm(false)
      setEditingTemplate(null)
      resetForm()
    } catch (err: any) {
      console.error('❌ Erro geral ao salvar:', err)
      setError(err.message || 'Erro desconhecido ao salvar o template')
    } finally {
      setSaving(false)
    }
  }

  const handleMockupSaved = (mockupData: any) => {
    setTemplates(prev => [mockupData, ...prev])
    setShowMockupUploader(false)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'general',
      file_type: 'docx',
      file_url: '',
      template_content: '',
      tags_detectadas: [],
      preview_image_url: '',
      tags: [],
      template_json: null,
      destination: 'presentation'
    })
  }

  const downloadPreview = async () => {
    if (!formData.template_json && !formData.template_content) {
      setError('Template JSON ou conteúdo estruturado é obrigatório para gerar preview')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Usuário não autenticado. Faça login novamente.')

      let previewData
      if (formData.template_json) {
        previewData = { template_json: formData.template_json }
      } else {
        previewData = {
          template_json: {
            template_name: formData.name,
            description: formData.description,
            type: formData.file_type,
            theme: { primary_color: '#0066CC', secondary_color: '#495057', text_color: '#333333' },
            structure: { sections: [{ title: 'Conteúdo Principal', placeholder: formData.template_content || 'Conteúdo...' }] }
          }
        }
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-template`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(previewData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Erro ${response.status}`)
      }

      const result = await response.json()

      const byteCharacters = atob(result.content)
      const byteNumbers = Array.from(byteCharacters).map(c => c.charCodeAt(0))
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: result.mimeType })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar preview')
    }
  }

  const filteredTemplates = useMemo(() => {
    return templates
      .filter(t => {
        const matchesSearch = (t.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchesDestination = destinationFilter === 'all' ||
          (destinationFilter === 'presentation' && ((t as any).destination === 'presentation' || !(t as any).destination)) ||
          (destinationFilter === 'consultor_entregavel' && (t as any).destination === 'consultor_entregavel')
        return matchesSearch && matchesDestination
      })
  }, [templates, searchTerm, destinationFilter])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Templates</h1>
      <p className="text-gray-400">Gerencie seus modelos personalizados</p>

      {/* FILTROS */}
      <div className="mt-4 mb-6 flex flex-wrap items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os Destinos</option>
            <option value="presentation">Seletor de Apresentação</option>
            <option value="consultor_entregavel">Entregáveis Consultor</option>
          </select>
        </div>
      </div>

      {/* BOTÕES DO TOPO */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Template Estruturado (Antigo)
        </button>

        <button
          onClick={() => setShowMasterCreator(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg transition-colors"
        >
          <Brain className="w-5 h-5" />
          Novo Template com IA
        </button>

        <button
          onClick={() => setShowMockupUploader(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Upload className="w-5 h-5" />
          Upload Mockup (Arquivo)
        </button>

        {/* NOVO: Template HTML */}
        <button
          onClick={() => { setEditingHtml(null); setShowHtmlEditor(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <FileText className="w-5 h-5" />
          Novo Template HTML (Preview ao vivo)
        </button>
      </div>

      {/* MODAL FORM (estruturado/antigo) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* HEADER */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {editingTemplate ? `Editar Template: ${formData.name}` : 'Novo Template'}
                  </h2>
                  <p className="text-gray-400 text-sm">Configure seu modelo personalizado</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingTemplate(null); resetForm() }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CONTENT */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* COLUNA ESQUERDA */}
                <div className="space-y-6">
                  {/* INFO BÁSICAS */}
                  <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5" /> Informações Básicas
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Template *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Contrato de Prestação de Serviços"
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                        <textarea
                          value={formData.description}
                          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Descreva o propósito e uso deste template"
                          rows={3}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
                          <select
                            value={formData.category}
                            onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                          >
                            <option value="general">Geral</option>
                            <option value="contracts">Contratos</option>
                            <option value="proposals">Propostas</option>
                            <option value="reports">Relatórios</option>
                            <option value="presentations">Apresentações</option>
                            <option value="legal">Jurídico</option>
                            <option value="financial">Financeiro</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Arquivo</label>
                          <select
                            value={formData.file_type}
                            onChange={e => setFormData(prev => ({ ...prev, file_type: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                          >
                            <option value="html">HTML</option>
                            <option value="docx">Word (DOCX)</option>
                            <option value="xlsx">Excel (XLSX)</option>
                            <option value="pptx">PowerPoint (PPTX)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Destino do Template</label>
                        <select
                          value={formData.destination}
                          onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value as 'presentation' | 'consultor_entregavel' }))}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
                        >
                          <option value="presentation">Seletor de Apresentação</option>
                          <option value="consultor_entregavel">Entregável Consultor (Automático)</option>
                        </select>
                        <p className="mt-2 text-xs text-gray-400">
                          {formData.destination === 'presentation'
                            ? 'Template ficará disponível no seletor do modo Apresentação'
                            : 'Template será usado automaticamente pelo sistema na fase específica do Consultor'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* TAGS MANUAIS */}
                  <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Tag className="w-5 h-5" /> Tags Manuais
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Tags (separadas por vírgula)</label>
                      <input
                        type="text"
                        value={formData.tags.join(', ')}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
                          }))
                        }
                        placeholder="contrato, serviços, legal"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* COLUNA DIREITA */}
                <div className="space-y-6">
                  {/* MÉTODO NOVO */}
                  <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                      ✅ Método Novo - Template Estruturado
                    </h3>

                    {/* Agente IA Creator */}
                    <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                      <h4 className="text-blue-400 font-medium mb-2">🤖 Agente IA Creator</h4>
                      <p className="text-blue-300 text-sm mb-3">Descreva o template e a IA cria automaticamente</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={aiInstruction}
                          onChange={(e) => setAiInstruction(e.target.value)}
                          placeholder="Ex: crie um modelo de contrato moderno com logotipo e seção de assinatura"
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm"
                        />
                        <button
                          type="button"
                          onClick={generateWithAI}
                          disabled={!aiInstruction.trim() || generatingWithAI}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                        >
                          {generatingWithAI
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <Brain className="w-4 h-4" />}
                          {generatingWithAI ? 'Gerando...' : 'Gerar com IA'}
                        </button>
                      </div>
                      {aiError && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs">
                          {aiError}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Conteúdo Estruturado</label>
                      <textarea
                        value={formData.template_content}
                        onChange={e => setFormData(prev => ({ ...prev, template_content: e.target.value }))}
                        placeholder="Olá {{nome}}, seu documento de {{tipo}} foi gerado em {{data}}."
                        rows={8}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 text-white placeholder-gray-400 resize-none font-mono text-sm"
                      />
                      {/* ↓↓↓ CORREÇÃO: usar strings para mostrar {{ }} no JSX ↓↓↓ */}
                      <p className="text-green-400 text-xs mt-2">
                        Exemplo: Relatório de {'{{projeto}}'} - Data: {'{{data}}'} - Status: {'{{status}}'}
                      </p>
                      {/* ↑↑↑ FIM DA CORREÇÃO ↑↑↑ */}
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Variáveis Detectadas</label>
                      <input
                        type="text"
                        value={formData.tags_detectadas.join(', ')}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            tags_detectadas: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
                          }))
                        }
                        placeholder="nome, data, valor, projeto, status"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 text-white placeholder-gray-400"
                      />
                      <p className="text-gray-400 text-xs mt-1">
                        Variáveis como "nome", "data", etc. serão substituídas por {'{{nome}}'}, {'{{data}}'}…
                      </p>
                    </div>
                  </div>

                  {/* MÉTODO ANTIGO */}
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" /> ⚠️ Método Antigo - URL do Arquivo
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">URL do Arquivo (Descontinuado)</label>
                      <input
                        type="url"
                        value={formData.file_url}
                        onChange={e => setFormData(prev => ({ ...prev, file_url: e.target.value }))}
                        placeholder="https://exemplo.com/template.docx"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 text-white placeholder-gray-400"
                      />
                      <p className="text-yellow-400 text-xs mt-2">Use preferencialmente o conteúdo estruturado acima.</p>
                    </div>
                  </div>

                  {/* PREVIEW IMAGE */}
                  <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Image className="w-5 h-5" /> Imagem de Preview (Opcional)
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">URL da Imagem</label>
                      <input
                        type="url"
                        value={formData.preview_image_url}
                        onChange={e => setFormData(prev => ({ ...prev, preview_image_url: e.target.value }))}
                        placeholder="https://exemplo.com/preview.jpg"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-4">
                <button
                  onClick={downloadPreview}
                  disabled={(!formData.template_json && !formData.template_content)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Gerar Preview
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                {formData.template_json
                  ? <span className="text-green-400">✅ Template IA (JSON)</span>
                  : formData.template_content
                  ? <span className="text-green-400">✅ Template Estruturado</span>
                  : formData.file_url
                  ? <span className="text-yellow-400">⚠️ Método Antigo</span>
                  : <span className="text-gray-400">⚪ Sem Conteúdo</span>}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingTemplate(null); resetForm() }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveTemplate}
                  disabled={saving || !formData.name.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {saving
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Save className="w-5 h-5" />}
                  {saving ? 'Salvando...' : editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LISTA */}
      <div className="mt-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum template encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => (
              <div key={template.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                    <p className="text-gray-400 text-sm mb-3">{template.description || 'Sem descrição'}</p>

                    {/* STATUS */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      {template.render_engine === 'html' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-900/20 border border-purple-500/30 text-purple-300 text-xs rounded-full">
                          🧩 Template HTML
                        </span>
                      ) : template.template_json ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-500/30 text-green-400 text-xs rounded-full">
                          🤖 Template IA (JSON)
                        </span>
                      ) : template.file_url && !template.template_content ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/20 border border-blue-500/30 text-blue-400 text-xs rounded-full">
                          📄 Mockup Upload
                        </span>
                      ) : template.template_content ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/20 border border-green-500/30 text-green-400 text-xs rounded-full">
                          ✅ Template Estruturado
                        </span>
                      ) : template.file_url ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900/20 border border-yellow-500/30 text-yellow-400 text-xs rounded-full">
                          ⚠️ Método Antigo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-900/20 border border-gray-500/30 text-gray-400 text-xs rounded-full">
                          ⚪ Sem Conteúdo
                        </span>
                      )}

                      {(template as any).destination === 'consultor_entregavel' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-900/20 border border-orange-500/30 text-orange-300 text-xs rounded-full">
                          🎯 Consultor
                        </span>
                      )}
                    </div>

                    {/* TAGS */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.tags_detectadas && template.tags_detectadas.length > 0 && (
                        <>
                          {template.tags_detectadas.slice(0, 3).map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded">
                              {`{{${tag}}}`}
                            </span>
                          ))}
                          {template.tags_detectadas.length > 3 && (
                            <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded">
                              +{template.tags_detectadas.length - 3}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* AÇÕES */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (template.render_engine === 'html') {
                        setEditingHtml(template)
                        setShowHtmlEditor(true)
                        return
                      }

                      setEditingTemplate(template)
                      if ((template as any).template_json) {
                        setShowMasterCreator(true)
                      } else {
                        setFormData({
                          name: template.name,
                          description: template.description || '',
                          category: template.category,
                          file_type: template.file_type,
                          file_url: template.file_url || '',
                          template_content: (template as any).template_content || '',
                          tags_detectadas: template.tags_detectadas || [],
                          preview_image_url: template.preview_image_url || '',
                          tags: template.tags || [],
                          template_json: (template as any).template_json || null,
                          destination: (template as any).destination || 'presentation'
                        })
                        setShowForm(true)
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('Tem certeza que deseja excluir este template?')) {
                        try {
                          const { error } = await supabase.from('models').delete().eq('id', template.id)
                          if (error) throw error
                          setTemplates(prev => prev.filter(t => t.id !== template.id))
                        } catch (err: any) {
                          setError(err.message)
                        }
                      }
                    }}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Upload de Mockup (arquivo) */}
      {showMockupUploader && (
        <MockupUploader
          onMockupSaved={handleMockupSaved}
          onClose={() => setShowMockupUploader(false)}
        />
      )}

      {/* Modal do Creator IA */}
      {showMasterCreator && (
        <MasterTemplateCreator
          onTemplateSaved={(template) => {
            setTemplates(prev =>
              editingTemplate
                ? prev.map(t => t.id === (editingTemplate as any).id ? (template as AnyModel) : t)
                : [template as AnyModel, ...prev]
            )
            setShowMasterCreator(false)
            setEditingTemplate(null)
          }}
          onClose={() => { setShowMasterCreator(false); setEditingTemplate(null) }}
          editingTemplate={editingTemplate as any}
        />
      )}

      {/* Modal de Template HTML */}
      {showHtmlEditor && (
        <HtmlTemplateModal
          isOpen={showHtmlEditor}
          onClose={() => { setShowHtmlEditor(false); setEditingHtml(null) }}
          editing={editingHtml}
          onSaved={(saved) => {
            setShowHtmlEditor(false)
            setEditingHtml(null)
            setTemplates(prev => {
              const idx = prev.findIndex(p => p.id === saved.id)
              if (idx >= 0) {
                const clone = [...prev]
                clone[idx] = saved
                return clone
              }
              return [saved, ...prev]
            })
          }}
        />
      )}
    </div>
  )
}



