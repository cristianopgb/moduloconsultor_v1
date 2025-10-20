import React, { useState, useRef } from 'react'
import { Upload, Brain, Download, Save, X, Image, FileText, Table, Presentation, Send, Trash2, AlertTriangle, CheckCircle, MessageSquare, CreditCard as Edit, Copy, ImagePlus, BarChart3 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { TagInput } from './TagInput'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface MasterTemplateCreatorProps {
  onTemplateSaved: (template: any) => void
  onClose: () => void
  editingTemplate?: any
}

export function MasterTemplateCreator({ onTemplateSaved, onClose, editingTemplate }: MasterTemplateCreatorProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [templateName, setTemplateName] = useState(editingTemplate?.name || '')
  const [templateDescription, setTemplateDescription] = useState(editingTemplate?.description || '')
  const [templateKind, setTemplateKind] = useState<'presentation' | 'analytics'>(editingTemplate?.template_type || 'presentation')
  const [templateType, setTemplateType] = useState<'pptx' | 'docx' | 'xlsx'>(editingTemplate?.file_type || 'pptx')
  const [templateTags, setTemplateTags] = useState<string[]>(editingTemplate?.tags || [])
  const [sqlTemplate, setSqlTemplate] = useState(editingTemplate?.sql_template || '')
  const [requiredColumns, setRequiredColumns] = useState(editingTemplate?.required_columns ? JSON.stringify(editingTemplate.required_columns, null, 2) : '{}')
  const [semanticTags, setSemanticTags] = useState<string[]>(editingTemplate?.semantic_tags || [])
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(editingTemplate?.preview_image_url || '')
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File, base64: string, preview: string }>>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [templateJson, setTemplateJson] = useState(
    editingTemplate?.template_json ? JSON.stringify(editingTemplate.template_json, null, 2) : ''
  )

  const [generatingJson, setGeneratingJson] = useState(false)
  const [downloadingPreview, setDownloadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const documentTypes = [
    { value: 'pptx', label: 'PowerPoint', icon: Presentation, color: 'text-red-400' },
    { value: 'docx', label: 'Word', icon: FileText, color: 'text-blue-400' },
    { value: 'xlsx', label: 'Excel', icon: Table, color: 'text-green-400' }
  ]

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    files.forEach(file => {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setError('Apenas imagens (JPEG, PNG) ou PDF são aceitos')
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('Arquivo muito grande. Máximo 10MB.')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        const base64Data = base64.split(',')[1] // remove o prefixo data:...
        setUploadedImages(prev => [...prev, { file, base64: base64Data, preview: base64 }])
      }
      reader.readAsDataURL(file)
    })

    event.target.value = ''
  }

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setGeneratingJson(true)
    setError('')

    try {
      const requestData = {
        instruction: userMessage.content,
        image_data: uploadedImages.length > 0 ? uploadedImages[0].base64 : undefined,
        conversation_history: chatMessages.slice(-4)
      }

      // token da sessão autenticada (sem duplicar a declaração)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Usuário não autenticado. Faça login novamente.')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/template-creator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Erro ${response.status}`)
      }

      const aiResponse = await response.json()
      console.log('✅ Resposta do Template Creator:', aiResponse)

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.chat_response || 'JSON gerado com sucesso! Verifique o editor abaixo.',
        timestamp: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, assistantMessage])

      // atualiza o editor com o JSON retornado
      setTemplateJson(JSON.stringify(aiResponse, null, 2))

      if (!templateName && (aiResponse.template_name || aiResponse.name)) {
        setTemplateName(aiResponse.template_name || aiResponse.name)
      }
      if (!templateDescription && aiResponse.description) {
        setTemplateDescription(aiResponse.description)
      }
      if (aiResponse.type && ['pptx', 'docx', 'xlsx'].includes(aiResponse.type)) {
        setTemplateType(aiResponse.type)
      }

    } catch (err: any) {
      console.error('❌ Erro no Template Creator:', err)
      setError(err.message || 'Erro ao gerar JSON')

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erro: ${err.message}. Tente reformular sua instrução.`,
        timestamp: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setGeneratingJson(false)
    }
  }

  const downloadPreview = async () => {
    if (!templateJson.trim()) {
      setError('JSON do template é obrigatório para gerar preview')
      return
    }

    setDownloadingPreview(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Usuário não autenticado. Faça login novamente.')

      const parsedJson = JSON.parse(templateJson)

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_json: parsedJson })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Erro ${response.status}`)
      }

      const result = await response.json()

      // baixa o arquivo
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

      setSuccess('Preview baixado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)

    } catch (err: any) {
      console.error('❌ Erro no download preview:', err)
      setError(err.message || 'Erro ao gerar preview')
    } finally {
      setDownloadingPreview(false)
    }
  }

  const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Apenas imagens são aceitas para thumbnail (PNG, JPG, WebP)')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo 2MB para thumbnail.')
      return
    }

    setThumbnailFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setThumbnailPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const uploadThumbnailToStorage = async (): Promise<string | null> => {
    if (!thumbnailFile) return null

    setUploadingThumbnail(true)
    try {
      const safeName = thumbnailFile.name.replace(/\s+/g, '_')
      const fileName = `thumbnails/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(fileName, thumbnailFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: thumbnailFile.type
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('templates')
        .getPublicUrl(fileName)

      return publicUrl
    } catch (err: any) {
      console.error('Erro ao fazer upload da thumbnail:', err)
      setError('Erro ao fazer upload da thumbnail: ' + err.message)
      return null
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      setError('Nome do template é obrigatório')
      return
    }

    // Validação específica por tipo
    if (templateKind === 'analytics') {
      if (!sqlTemplate.trim()) {
        setError('SQL Template é obrigatório para templates Analytics')
        return
      }
      if (semanticTags.length === 0) {
        setError('Adicione pelo menos 1 semantic tag para templates Analytics')
        return
      }
      try {
        JSON.parse(requiredColumns)
      } catch {
        setError('Required Columns deve ser um JSON válido')
        return
      }
    } else {
      if (!templateJson.trim()) {
        setError('JSON do template é obrigatório para templates de Apresentação')
        return
      }
    }

    setSaving(true)
    setError('')

    try {
      let thumbnailUrl = thumbnailPreview
      if (thumbnailFile) {
        const uploadedUrl = await uploadThumbnailToStorage()
        if (uploadedUrl) thumbnailUrl = uploadedUrl
      }

      const templateData: any = {
        name: templateName.trim(),
        description: templateDescription.trim(),
        category: 'general',
        template_type: templateKind,
        tags: templateTags.filter(tag => tag.trim() !== ''),
        preview_image_url: thumbnailUrl || null
      }

      if (templateKind === 'analytics') {
        // Template Analytics
        templateData.sql_template = sqlTemplate.trim()
        templateData.required_columns = JSON.parse(requiredColumns)
        templateData.semantic_tags = semanticTags.filter(tag => tag.trim() !== '')
        templateData.file_type = null
        templateData.file_url = null
        templateData.template_content = null
        templateData.template_json = null
      } else {
        // Template Presentation
        const parsedJson = JSON.parse(templateJson)
        templateData.file_type = templateType
        templateData.file_url = null
        templateData.template_content = null
        templateData.template_json = parsedJson
        templateData.sql_template = null
        templateData.required_columns = null
        templateData.semantic_tags = null
      }

      console.log('💾 Salvando template com IA:', editingTemplate ? 'UPDATE' : 'INSERT', templateData)

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
        if (data && data[0]) onTemplateSaved(data[0])
      } else {
        console.log('➕ Inserindo novo template')
        const { data, error } = await supabase
          .from('models')
          .insert([templateData])
          .select()

        if (error) {
          console.error('❌ Erro no INSERT:', error)
          throw new Error(`Erro ao criar: ${error.message} (Código: ${error.code})`)
        }
        console.log('✅ Template criado:', data)
        if (data && data[0]) onTemplateSaved(data[0])
      }

      setSuccess('Template salvo com sucesso!')
      setTimeout(() => {
        setSuccess('')
        onClose()
      }, 2000)

    } catch (err: any) {
      console.error('❌ Erro ao salvar template:', err)
      if (err.message?.includes('JSON')) {
        setError('JSON inválido. Verifique a sintaxe.')
      } else {
        setError(err.message || 'Erro desconhecido ao salvar template')
      }
    } finally {
      setSaving(false)
    }
  }

  const clearChat = () => {
    setChatMessages([])
    setUploadedImages([])
    setTemplateJson('')
    setError('')
    setSuccess('')
  }

  const copyJsonToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(templateJson)
      setSuccess('JSON copiado para área de transferência!')
      setTimeout(() => setSuccess(''), 2000)
    } catch {
      setError('Erro ao copiar JSON')
    }
  }

  const formatJson = () => {
    try {
      const parsed = JSON.parse(templateJson)
      setTemplateJson(JSON.stringify(parsed, null, 2))
    } catch {
      setError('JSON inválido - não foi possível formatar')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {editingTemplate ? 'Editar Template' : 'Criar Novo Template'}
              </h2>
              <p className="text-gray-400 text-sm">Agente Creator - Análise de Mockup com IA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Tipo de Template */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Tipo de Template</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTemplateKind('presentation')}
                    className={`p-4 border rounded-xl transition-all text-left ${
                      templateKind === 'presentation'
                        ? 'border-blue-500 bg-blue-600/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <Presentation className={`w-6 h-6 mb-2 ${templateKind === 'presentation' ? 'text-blue-400' : 'text-gray-400'}`} />
                    <div className="font-semibold text-white">Apresentação</div>
                    <div className="text-xs text-gray-400 mt-1">Templates HTML visuais com seleção manual</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateKind('analytics')}
                    className={`p-4 border rounded-xl transition-all text-left ${
                      templateKind === 'analytics'
                        ? 'border-blue-500 bg-blue-600/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <BarChart3 className={`w-6 h-6 mb-2 ${templateKind === 'analytics' ? 'text-blue-400' : 'text-gray-400'}`} />
                    <div className="font-semibold text-white">Analytics</div>
                    <div className="text-xs text-gray-400 mt-1">Templates SQL automáticos invisíveis</div>
                  </button>
                </div>
              </div>

              {/* Informações Básicas */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Informações Básicas</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome do Template *
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Ex: Apresentação Comercial Azul"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Descrição
                    </label>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Descreva o uso e propósito deste template"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tipo de Documento
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {documentTypes.map((type) => {
                        const Icon = type.icon
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setTemplateType(type.value as any)}
                            className={`p-3 border rounded-lg transition-all ${
                              templateType === type.value
                                ? 'border-blue-500 bg-blue-600/10'
                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                            }`}
                          >
                            <Icon className={`w-5 h-5 mx-auto mb-1 ${type.color}`} />
                            <span className="text-xs text-white">{type.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tags
                    </label>
                    <TagInput
                      tags={templateTags}
                      onChange={setTemplateTags}
                      placeholder="Adicionar tag (ex: financeiro, marketing)"
                      suggestions={[
                        'financeiro', 'financial', 'juridico', 'legal', 'marketing',
                        'apresentacao', 'presentation', 'relatorio', 'report',
                        'contrato', 'contract', 'proposta', 'proposal'
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Thumbnail do Template
                    </label>
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-500 transition-colors">
                        <input
                          ref={thumbnailInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={handleThumbnailUpload}
                          className="hidden"
                          id="thumbnail-upload-master"
                        />
                        <label htmlFor="thumbnail-upload-master" className="cursor-pointer">
                          <ImagePlus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-white text-sm font-medium mb-1">Upload de Thumbnail</p>
                          <p className="text-gray-400 text-xs">PNG, JPG ou WebP • Máx. 2MB</p>
                          <p className="text-gray-500 text-xs mt-1">Recomendado: 400x300px (16:9)</p>
                        </label>
                      </div>
                      {uploadingThumbnail && (
                        <div className="text-blue-400 text-sm flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          Fazendo upload da thumbnail...
                        </div>
                      )}
                      {thumbnailPreview && (
                        <div className="bg-gray-800 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-2">Preview:</p>
                          <img
                            src={thumbnailPreview}
                            alt="Thumbnail preview"
                            className="w-full aspect-video object-cover rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Campos Específicos de Analytics */}
              {templateKind === 'analytics' && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">SQL Template *</h3>
                  <textarea
                    value={sqlTemplate}
                    onChange={(e) => setSqlTemplate(e.target.value)}
                    placeholder="SELECT {{group_col}} as categoria, AVG({{value_col}}) as media FROM temp_data GROUP BY {{group_col}} ORDER BY media DESC"
                    rows={6}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 font-mono text-sm resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-2">Use placeholders como {'{{'}value_col{'}}'}, {'{{'}group_col{'}}'}. Substitua temp_data pelo nome da tabela temporária.</p>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Required Columns (JSON) *
                    </label>
                    <textarea
                      value={requiredColumns}
                      onChange={(e) => setRequiredColumns(e.target.value)}
                      placeholder='{"value_col": {"type": "numeric", "description": "Coluna com valores"}, "group_col": {"type": "text", "description": "Coluna de agrupamento"}}'
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 font-mono text-sm resize-none"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Semantic Tags *
                    </label>
                    <TagInput
                      tags={semanticTags}
                      onChange={setSemanticTags}
                      placeholder="Ex: ticket, média, vendas, ranking"
                      suggestions={['ticket', 'média', 'vendas', 'ranking', 'top', 'soma', 'contagem', 'distribuição']}
                    />
                    <p className="text-xs text-gray-400 mt-1">Tags que a IA usa para escolher este template automaticamente</p>
                  </div>
                </div>
              )}

              {/* Upload de Imagens - APENAS para Presentation */}
              {templateKind === 'presentation' && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Mockups</h3>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {uploadedImages.length === 0 ? (
                  <div
                    className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-500 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Clique para fazer upload do mockup</p>
                    <p className="text-gray-500 text-xs mt-1">JPEG, PNG, PDF • Máx 10MB</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative bg-gray-800 rounded-lg overflow-hidden">
                        <img
                          src={img.preview}
                          alt={`Mockup ${index + 1}`}
                          className="w-full h-24 object-cover"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {img.file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* Chat com Agente - APENAS para Presentation */}
              {templateKind === 'presentation' && (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Chat com Agente Creator
                  </h3>
                  <button
                    onClick={clearChat}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpar
                  </button>
                </div>

                {/* Mensagens do Chat */}
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 h-48 overflow-y-auto mb-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Faça upload de um mockup e converse com a IA</p>
                      <p className="text-xs mt-1">Ex: "Analise este mockup para apresentações comerciais"</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-100'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-xs opacity-75 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input do Chat */}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendChatMessage()
                        }
                      }}
                      placeholder="Ex: Analise este mockup para criar um template de apresentação comercial moderna"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none"
                      rows={2}
                      disabled={generatingJson}
                    />
                  </div>
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || generatingJson || uploadedImages.length === 0}
                    className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {generatingJson ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              )}
            </div>

            {/* Right Column - Editor JSON (Presentation) ou Preview (Analytics) */}
            <div className="space-y-6">
              {templateKind === 'analytics' ? (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Preview do Template SQL</h3>
                  <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm text-gray-300 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                    {sqlTemplate || 'Escreva o SQL template no campo à esquerda...'}
                  </div>
                  {semanticTags.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm text-gray-400 mb-2">Semantic Tags:</div>
                      <div className="flex flex-wrap gap-2">
                        {semanticTags.map((tag, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Editor JSON</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={formatJson}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <Edit className="w-3 h-3" />
                      Formatar
                    </button>
                    <button
                      onClick={copyJsonToClipboard}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar
                    </button>
                  </div>
                </div>

                <textarea
                  value={templateJson}
                  onChange={(e) => setTemplateJson(e.target.value)}
                  placeholder="O JSON do template aparecerá aqui após a análise da IA..."
                  className="w-full h-96 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 font-mono text-sm resize-none"
                />

                {templateJson && (
                  <div className="mt-3 text-xs text-gray-400">
                    {templateJson.split('\n').length} linhas • {templateJson.length} caracteres
                  </div>
                )}
              </div>
              )}

              {/* Ações */}
              <div className="space-y-3">
                {templateKind === 'presentation' && (
                  <button
                    onClick={downloadPreview}
                    disabled={!templateJson.trim() || downloadingPreview}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    {downloadingPreview ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    {downloadingPreview ? 'Gerando Preview...' : 'Download Preview'}
                  </button>
                )}

                <button
                  onClick={saveTemplate}
                  disabled={
                    !templateName.trim() ||
                    (templateKind === 'presentation' && !templateJson.trim()) ||
                    (templateKind === 'analytics' && (!sqlTemplate.trim() || semanticTags.length === 0)) ||
                    saving
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {saving ? 'Salvando...' : editingTemplate ? 'Salvar Alterações' : 'Salvar Template'}
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg text-green-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
