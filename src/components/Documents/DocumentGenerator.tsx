import React, { useState } from 'react'
import {
  FileText,
  Download,
  Eye,
  Loader,
  CheckCircle,
  AlertCircle,
  File,
  Table,
  Presentation,
  Globe
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTokens } from '../../hooks/useTokens'

interface DocumentGeneratorProps {
  onGenerate?: (document: any, templateId?: string | null) => void
  selectedTemplate?: any
}

export function DocumentGenerator({ onGenerate, selectedTemplate }: DocumentGeneratorProps) {
  const { consumeTokens, hasTokens } = useTokens()
  const [loading, setLoading] = useState(false)
  const [generatedDoc, setGeneratedDoc] = useState<any>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    type: 'html' as 'docx' | 'xlsx' | 'html' | 'pptx',
    title: selectedTemplate?.name || '',
    content: selectedTemplate?.description || '',
    includeTable: false,
    includeSlides: false
  })

  const documentTypes = [
    { value: 'html', label: 'HTML', icon: Globe, color: 'text-orange-400' },
    { value: 'docx', label: 'Word (DOCX)', icon: FileText, color: 'text-blue-400' },
    { value: 'xlsx', label: 'Excel (XLSX)', icon: Table, color: 'text-green-400' },
    { value: 'pptx', label: 'PowerPoint (PPTX)', icon: Presentation, color: 'text-red-400' }
  ]

  const generateDocument = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Título e conteúdo são obrigatórios')
      return
    }

    if (!hasTokens) {
      setError('Tokens insuficientes')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Obter token da sessão autenticada
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('Usuário não autenticado. Faça login novamente.')
      }

      const canProceed = await consumeTokens(50)
      if (!canProceed) {
        setError('Tokens insuficientes')
        return
      }

      const requestData = {
        type: formData.type,
        title: formData.title,
        content: formData.content,
        template_content: selectedTemplate?.template_content || null,
        data: {
          ...(formData.includeTable && {
            table: {
              headers: ['Item', 'Descrição', 'Status'],
              rows: [
                ['1', 'Primeiro item', 'Concluído'],
                ['2', 'Segundo item', 'Em andamento'],
                ['3', 'Terceiro item', 'Pendente']
              ]
            }
          }),
          ...(formData.includeSlides && {
            slides: [
              { title: formData.title, content: formData.content },
              { title: 'Detalhes', content: 'Mais informações sobre o projeto' },
              { title: 'Conclusão', content: 'Resumo e próximos passos' }
            ]
          }),
          ...(selectedTemplate && {
            template_name: selectedTemplate.name,
            template_category: selectedTemplate.category,
            template_tags: selectedTemplate.tags,
            has_template_content: !!selectedTemplate.template_content
          })
        }
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) throw new Error('Erro ao gerar documento')

      const result = await response.json()
      setGeneratedDoc(result)
      onGenerate?.(result, selectedTemplate?.id || null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadDocument = () => {
    if (!generatedDoc) return

    try {
      const byteCharacters = atob(generatedDoc.content)
      const byteNumbers = Array.from(byteCharacters).map(c => c.charCodeAt(0))
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: generatedDoc.mimeType || 'application/octet-stream' })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = generatedDoc.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Erro no download:', error)
      alert('Erro ao fazer download do documento')
    }
  }

  const openPreview = () => {
    if (generatedDoc?.type === 'html') {
      // O campo `content` vem em Base64; precisamos decodificar para UTF‑8 antes de escrever no DOM
      try {
        // Decodifica Base64 para string binária e então para UTF‑8
        const decoded = decodeURIComponent(escape(atob(generatedDoc.content)))
        const newWindow = window.open()
        if (newWindow) {
          newWindow.document.write(decoded)
          newWindow.document.close()
        }
      } catch (e) {
        console.error('Erro ao abrir preview de HTML:', e)
        setPreviewOpen(true)
      }
    } else {
      setPreviewOpen(true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Gerar Documento</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-3">Tipo de Documento</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {documentTypes.map((type) => {
                const Icon = type.icon
                return (
                  <button
                    key={type.value}
                    onClick={() => setFormData(prev => ({ ...prev, type: type.value as any }))}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                      formData.type === type.value
                        ? 'border-blue-500 bg-blue-600/20 text-white'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${type.color}`} />
                    <span className="text-sm">{type.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Título</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título do documento"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Conteúdo</label>
            <textarea
              rows={6}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Digite o conteúdo do documento"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={formData.includeTable}
                onChange={(e) => setFormData(prev => ({ ...prev, includeTable: e.target.checked }))}
              />
              Incluir tabela de exemplo
            </label>

            {formData.type === 'pptx' && (
              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.includeSlides}
                  onChange={(e) => setFormData(prev => ({ ...prev, includeSlides: e.target.checked }))}
                />
                Gerar slides adicionais
              </label>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={generateDocument}
            disabled={loading || !hasTokens}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            {loading ? 'Gerando...' : 'Gerar Documento'}
          </button>
        </div>
      </div>

      {generatedDoc && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-600 rounded-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Documento Gerado</h3>
              <p className="text-gray-400 text-sm">{generatedDoc.filename}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openPreview}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={downloadDocument}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

