// src/components/Documents/DocumentsPage.tsx
import React, { useEffect, useState } from 'react'
import {
  Plus, Search, Filter, FileText, Download, Eye, Trash2, Calendar, Presentation
} from 'lucide-react'
import { supabase, Document } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { DocumentGenerator } from './DocumentGenerator'

type ExportKind = 'pptx' | 'docx'

export function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showGenerator, setShowGenerator] = useState(false)
  const [error, setError] = useState('')

  const [loadingExport, setLoadingExport] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string>('')

  async function loadDocuments() {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (err: any) {
      console.error('Erro ao carregar documentos:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [user])

  async function handleDocumentGenerated(doc: any, templateId: string | null) {
    if (!user) return
    try {
      // Compatível com seu schema (document|presentation)
      const dbType: 'document' | 'presentation' =
        doc.type === 'pptx' || doc.type === 'presentation' ? 'presentation' : 'document'

      const { data, error } = await supabase
        .from('documents')
        .insert([{
          user_id: user.id,
          title: (doc.filename || 'arquivo').replace(/\.[^/.]+$/, ''),
          type: dbType,
          file_url: `data:${doc.mimeType};base64,${doc.content}`,
          template_id: templateId,
          last_export_file_url: null,
          last_export_file_type: null
        }])
        .select()

      if (error) throw error
      if (data && data[0]) {
        setDocuments(prev => [data[0], ...prev])
        setShowGenerator(false)
      }
    } catch (err: any) {
      console.error('Erro ao salvar documento:', err)
      setError(err.message)
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
      setDocuments(prev => prev.filter(doc => doc.id !== id))
    } catch (err: any) {
      console.error('Erro ao excluir documento:', err)
      setError(err.message)
    }
  }

  // Utilitários
  function inferExportType(doc: any): ExportKind {
    // seu banco usa 'document' | 'presentation'
    if (doc.last_export_file_type === 'pptx') return 'pptx'
    if (doc.last_export_file_type === 'docx') return 'docx'
    return doc.type === 'presentation' ? 'pptx' : 'docx'
  }

  function prettyType(doc: any) {
    const t = doc.type
    if (t === 'presentation') return 'PRESENTATION (PPTX)'
    if (t === 'document') return 'DOCUMENT (DOCX)'
    return String(t || '').toUpperCase()
  }

  function downloadBase64(content: string, filename: string, mimeType: string) {
    const byteCharacters = atob(content)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function openStorageOrExport(doc: any) {
    setExportError('')
    try {
      // 1) SE JÁ TEM LINK NO STORAGE (gerado pelo mockup), ABRE ELE
      if (doc.last_export_file_url) {
        window.open(doc.last_export_file_url, '_blank')
        return
      }

      // 2) SE TEM BASE64 NA TABELA, BAIXA DIRETO
      if (doc.file_url && typeof doc.file_url === 'string' && doc.file_url.startsWith('data:')) {
        const [meta, base64Data] = doc.file_url.split(',')
        if (!base64Data) throw new Error('Dados corrompidos no file_url')
        // tenta deduzir o mime/filename
        const kind = inferExportType(doc)
        const filename = `${(doc.title || 'arquivo').replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_')}.${kind}`
        const mime = kind === 'pptx'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        downloadBase64(base64Data, filename, mime)
        return
      }

      // 3) ÚLTIMO RECURSO: exporta agora e abre a URL
      const kind = inferExportType(doc)
      const { data, error } = await supabase.functions.invoke(`export-${kind}`, {
        body: { document_id: doc.id, upload_to_storage: true }
      })
      if (error) throw new Error(error.message || `Erro ao exportar ${kind.toUpperCase()}`)

      if (data?.file_url) {
        // atualiza a lista local p/ refletir o novo link
        setDocuments(prev => prev.map(d => d.id === doc.id
          ? { ...d, last_export_file_url: data.file_url, last_export_file_type: kind }
          : d))
        window.open(data.file_url, '_blank')
        return
      }

      if (data?.content && data?.filename && data?.mimeType) {
        downloadBase64(data.content, data.filename, data.mimeType)
        return
      }

      throw new Error('Resposta inesperada da função de exportação.')
    } catch (e: any) {
      console.error(e)
      setExportError(e.message || 'Falha ao baixar o arquivo.')
    }
  }

  function previewDocument(doc: any) {
    try {
      if (doc.type === 'html' && doc.file_url?.startsWith('data:')) {
        const [, base64Data] = doc.file_url.split(',')
        if (!base64Data) {
          alert('Dados HTML corrompidos')
          return
        }
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i)
        const byteArray = new Uint8Array(byteNumbers)
        const html = new TextDecoder('utf-8').decode(byteArray)
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(html)
          newWindow.document.close()
        } else {
          alert('Não foi possível abrir nova janela. Verifique se pop-ups estão bloqueados.')
        }
      } else {
        alert(`Preview não disponível para ${prettyType(doc)}. Use o botão Download.`)
      }
    } catch (err: any) {
      console.error('Erro no preview:', err)
      alert(`Erro ao abrir preview: ${err.message}`)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('pt-BR')

  const filteredDocuments = documents.filter((doc: any) =>
    (doc.title || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Documentos</h1>
          <p className="text-gray-400">Seus documentos gerados</p>
        </div>
        <button
          onClick={() => setShowGenerator(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          {showGenerator ? 'Fechar Gerador' : 'Novo Documento'}
        </button>
      </div>

      {showGenerator && (
        <DocumentGenerator onGenerate={handleDocumentGenerated} />
      )}

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg">
          <Filter className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-800/20 border border-red-500/30 text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {exportError && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-600/30 text-yellow-200 rounded-lg">
          {exportError}
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum documento encontrado</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc: any) => (
            <div key={doc.id} className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-semibold text-lg">{doc.title}</h3>
                  <p className="text-gray-400 text-sm">{prettyType(doc)}</p>
                  {doc.last_export_file_url && (
                    <p className="text-green-400 text-xs mt-1">✓ Arquivo no Storage pronto para download</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => previewDocument(doc)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>

                <button
                  onClick={() => openStorageOrExport(doc)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>

                <button
                  onClick={async () => {
                    setLoadingExport(doc.id)
                    await openStorageOrExport(doc)
                    setLoadingExport(null)
                  }}
                  disabled={loadingExport === doc.id}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingExport === doc.id
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Presentation className="w-4 h-4" />}
                  Exportar/Atualizar PPTX
                </button>

                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                {formatDate(doc.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


