// /src/pages/PreviewPage.tsx
import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Download, CreditCard as Edit3, Save, ArrowLeft,
  Printer, Copy, CheckCircle, AlertTriangle, Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { stripUnwantedScripts } from '../utils/html-sanitizer'
import { downloadDocx, downloadPptx, downloadHtml } from '../utils/exporters'

export function PreviewPage() {
  const { previewId } = useParams<{ previewId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [htmlContent, setHtmlContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pageFormat, setPageFormat] = useState<'a4' | 'widescreen'>('a4')
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const contentRef = useRef<HTMLDivElement>(null)

  // Carregar HTML do preview
  useEffect(() => {
    const loadPreview = async () => {
      if (!previewId) {
        setError('ID do preview não fornecido')
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('temp_previews')
          .select('html_content')
          .eq('id', previewId)
          .single()

        if (error) throw error

        if (data?.html_content) {
          const sanitizedHtml = stripUnwantedScripts(data.html_content)
          setHtmlContent(sanitizedHtml)
        } else {
          setError('Preview não encontrado')
        }
      } catch (err: any) {
        console.error('Erro ao carregar preview:', err)
        setError(err.message || 'Erro ao carregar preview')
      } finally {
        setLoading(false)
      }
    }

    loadPreview()
  }, [previewId])

  // CSS do formato da página
  const getPageFormatCSS = () => {
    if (pageFormat === 'a4') {
      return `
        .preview-wrapper {
          display: flex; justify-content: center; padding: 24px;
          background: #f3f4f6;
        }
        .preview-content {
          width: 210mm; min-height: 297mm; background: white;
          margin: 0 auto; padding: 20mm; box-shadow: 0 0 10px rgba(0,0,0,0.1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6; color: #333;
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .preview-wrapper { padding: 0; background: white; }
          .preview-content { margin: 0; box-shadow: none; }
          .no-print { display: none !important; }
        }
      `
    } else {
      return `
        .preview-wrapper {
          display: flex; justify-content: center; padding: 24px;
          background: #f3f4f6;
        }
        .preview-content {
          width: 1280px; min-height: 720px; background: white;
          margin: 0 auto; padding: 40px; box-shadow: 0 0 10px rgba(0,0,0,0.1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6; color: #333;
        }
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .preview-wrapper { padding: 0; background: white; }
          .preview-content { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 0; }
          .no-print { display: none !important; }
        }
      `
    }
  }

  // Salvar em "Meus Documentos"
  const saveToMyDocuments = async () => {
    if (!user || !contentRef.current) return

    setSaving(true)
    setError('')

    try {
      const currentHtml = contentRef.current.innerHTML
      const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Documento</title><style>${getPageFormatCSS()}</style></head>
<body><div class="preview-content">${currentHtml}</div></body></html>`

      const dataUrl = `data:text/html;base64,${btoa(unescape(encodeURIComponent(fullHtml)))}`
      
      const { error } = await supabase
        .from('documents')
        .insert([{
          user_id: user.id,
          title: `Documento - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
          type: 'document',
          file_url: dataUrl,
          status: 'draft'
        }])

      if (error) throw error

      setSuccess('Documento salvo em "Meus Documentos"!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Erro ao salvar documento:', err)
      setError(err.message || 'Erro ao salvar documento')
    } finally {
      setSaving(false)
    }
  }

  // Download HTML “puro”
  const downloadAsHtml = () => {
    if (!contentRef.current) return
    const currentHtml = contentRef.current.innerHTML
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Documento</title><style>${getPageFormatCSS()}</style></head>
<body><div class="preview-content">${currentHtml}</div></body></html>`
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `documento_${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const printDocument = () => window.print()

  const copyHtml = async () => {
    if (!contentRef.current) return
    try {
      await navigator.clipboard.writeText(contentRef.current.innerHTML)
      setSuccess('HTML copiado para área de transferência!')
      setTimeout(() => setSuccess(''), 2000)
    } catch {
      setError('Erro ao copiar HTML')
    }
  }

  const handleDownloadSelect = async (value: string) => {
    if (!contentRef.current) return
    const currentHtml = contentRef.current.innerHTML
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Documento</title><style>${getPageFormatCSS()}</style></head>
<body><div class="preview-content">${currentHtml}</div></body></html>`

    if (value === 'docx') await downloadDocx(fullHtml, 'Documento.docx')
    if (value === 'pptx') await downloadPptx(fullHtml, 'Apresentacao.pptx')
    if (value === 'html') downloadHtml(fullHtml, 'Documento.html')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando preview...</p>
        </div>
      </div>
    )
  }

  if (error && !htmlContent) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar preview</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Voltar ao Chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <style>{getPageFormatCSS()}</style>

      {/* Toolbar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm no-print">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao Chat</span>
            </button>

            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-lg font-semibold text-gray-900">Preview do Documento</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Formato da página */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPageFormat('a4')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  pageFormat === 'a4'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                A4
              </button>
              <button
                onClick={() => setPageFormat('widescreen')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  pageFormat === 'widescreen'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                16:9
              </button>
            </div>

            {/* Edição */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isEditing
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">{isEditing ? 'Parar Edição' : 'Editar'}</span>
            </button>

            {/* Copiar */}
            <button
              onClick={copyHtml}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              title="Copiar HTML"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Copiar</span>
            </button>

            {/* Download (select) */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2">
              <Download className="w-4 h-4 text-gray-600" />
              <select
                defaultValue="download"
                className="bg-transparent px-1 py-2 text-gray-700 focus:outline-none"
                onChange={async (e) => {
                  const v = e.target.value
                  if (v === 'download') return
                  await handleDownloadSelect(v)
                  e.currentTarget.value = 'download'
                }}
              >
                <option value="download">Baixar</option>
                <option value="docx">Word (.docx)</option>
                <option value="pptx">PowerPoint (.pptx)</option>
                <option value="html">HTML (.html)</option>
              </select>
            </div>

            {/* PDF (print) */}
            <button
              onClick={printDocument}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
              title="Imprimir/PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Salvar */}
            <button
              onClick={saveToMyDocuments}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">{saving ? 'Salvando...' : 'Salvar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="no-print mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="no-print mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Conteúdo do Preview */}
      <div className="preview-wrapper">
        <div
          ref={contentRef}
          className="preview-content"
          contentEditable={isEditing}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          style={{ outline: isEditing ? '2px dashed #3b82f6' : 'none', cursor: isEditing ? 'text' : 'default' }}
        />
      </div>

      {/* Dica de edição */}
      {isEditing && (
        <div className="no-print fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <Edit3 className="w-4 h-4" />
            <span className="font-medium">Modo de Edição Ativo</span>
          </div>
          <p className="text-sm text-blue-100">
            Clique no documento para editar o conteúdo diretamente. Use "Salvar" para preservar as alterações.
          </p>
        </div>
      )}
    </div>
  )
}

export default PreviewPage
