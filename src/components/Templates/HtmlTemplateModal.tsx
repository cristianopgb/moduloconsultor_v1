import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X, Save, Eye, Wand2, RefreshCw, ImagePlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { TagInput } from './TagInput'

type HtmlModel = {
  id?: string
  name: string
  description?: string
  category?: string
  file_type?: string
  render_engine?: 'html'
  content_html: string
  content_css: string
  content_js: string
  html_variables?: string[]
  tags?: string[]
  tags_detectadas?: string[]
  preview_image_url?: string
  destination?: 'presentation' | 'consultor_entregavel'
}

interface HtmlTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  editing?: HtmlModel | null
  onSaved: (saved: HtmlModel) => void
}

const DEFAULT_HTML = `<!-- Use variáveis como {{titulo}}, {{subtitulo}} e {{autor}} -->
<section class="wrap">
  <h1>{{titulo}}</h1>
  <p class="subtitle">{{subtitulo}}</p>
  <div class="box">
    <p>Autor: <strong>{{autor}}</strong></p>
    <p>Data: <strong>{{data}}</strong></p>
  </div>
</section>`

const DEFAULT_CSS = `:root {
  --primary: #2563eb;
  --text: #0f172a;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"; color: var(--text); }
.wrap { padding: 40px; max-width: 960px; margin: 0 auto; }
h1 { font-size: 40px; margin: 0 0 6px; color: var(--primary); }
.subtitle { margin: 0 0 24px; color: #475569; }
.box { border: 1px dashed #cbd5e1; padding: 16px; border-radius: 12px; background: #f8fafc; }`

const DEFAULT_JS = `// JS opcional para componentes dinâmicos
console.log('Preview do template HTML carregado')`

// Detecta {{variavel}} (sem quebrar quando houver espaços)
function detectVariables(html: string): string[] {
  const re = /{{\s*([a-zA-Z0-9_./-]+)\s*}}/g
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const key = m[1]
    if (!key.startsWith('#') && !key.startsWith('/')) found.add(key)
  }
  return Array.from(found)
}

// Gera valores fictícios para as variáveis
function buildFakeData(keys: string[]): Record<string, string> {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`

  const presets: Record<string, string> = {
    titulo: 'Título de Exemplo',
    subtitulo: 'Subtítulo/Descrição resumida',
    autor: 'Usuário Demo',
    data: today,
    empresa: 'Empresa XYZ',
    projeto: 'Projeto Alpha',
    status: 'Em Progresso',
    nome_apresentador: 'João Silva',
    cargo: 'Gerente de Vendas',
    telefone: '(11) 99999-9999',
    email: 'joao@empresa.com',
    logo_empresa: 'https://via.placeholder.com/150x50/2563eb/ffffff?text=LOGO',
    endereco: 'Rua das Flores, 123 - São Paulo/SP',
    website: 'www.empresa.com'
  }

  const out: Record<string, string> = {}
  keys.forEach((k) => {
    out[k] = presets[k] || k.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase())
  })
  return out
}

// Aplica variáveis simples {{chave}} (sem loops)
function applyVars(html: string, vars: Record<string, string>) {
  return html.replace(/{{\s*([a-zA-Z0-9_./-]+)\s*}}/g, (_m, key: string) => {
    if (key.startsWith('#') || key.startsWith('/')) return _m // ignorar sintaxe de loop por enquanto
    return vars[key] ?? _m
  })
}

export function HtmlTemplateModal({ isOpen, onClose, editing, onSaved }: HtmlTemplateModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(editing?.preview_image_url || '')
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<HtmlModel>(() => ({
    id: editing?.id,
    name: editing?.name || '',
    description: editing?.description || '',
    category: editing?.category || 'general',
    file_type: 'html',
    render_engine: 'html',
    content_html: editing?.content_html || DEFAULT_HTML,
    content_css: editing?.content_css || DEFAULT_CSS,
    content_js: editing?.content_js || DEFAULT_JS,
    html_variables: editing?.html_variables || [],
    tags: editing?.tags || [],
    tags_detectadas: editing?.tags_detectadas || [],
    preview_image_url: editing?.preview_image_url || '',
    destination: editing?.destination || 'presentation',
  }))

  // Recalcula variáveis quando o HTML muda
  const detected = useMemo(() => detectVariables(form.content_html), [form.content_html])
  const sampleData = useMemo(() => buildFakeData(detected), [detected])

  // Debug logs
  useEffect(() => {
    console.log('🔍 Variáveis detectadas:', detected)
    console.log('📝 Dados de exemplo:', sampleData)
  }, [detected, sampleData])

  // Preview em iframe
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const renderPreview = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    
    // Usar dados de exemplo mais realistas
    const enhancedSampleData = {
      ...sampleData,
      titulo: 'Apresentação Comercial 2025',
      subtitulo: 'Estratégias e Resultados',
      autor: 'João Silva',
      empresa: 'Empresa XYZ Ltda',
      projeto: 'Projeto Alpha',
      data: new Date().toLocaleDateString('pt-BR'),
      versao: '1.0',
      status: 'Rascunho'
    }
    
    const htmlWithVars = applyVars(form.content_html, enhancedSampleData)
    const full = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Preview - ${form.name || 'Template'}</title>
<style>${form.content_css || ''}</style>
</head>
<body>
${htmlWithVars}
<script>${form.content_js || ''}<\/script>
</body>
</html>`
    doc.open()
    doc.write(full)
    doc.close()
  }

  useEffect(() => {
    if (!isOpen) return
    renderPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, form.content_html, form.content_css, form.content_js, detected.join(',')])

  const syncDetectedToForm = () => {
    console.log('🔍 Detectando variáveis...', detected)
    setForm((prev) => ({
      ...prev,
      html_variables: detected,
      tags_detectadas: detected
      // NÃO adiciona variáveis nas tags - tags são apenas palavras-chave
    }))
    console.log('✅ Variáveis sincronizadas:', detected)
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

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')

      let thumbnailUrl = form.preview_image_url
      if (thumbnailFile) {
        const uploadedUrl = await uploadThumbnailToStorage()
        if (uploadedUrl) thumbnailUrl = uploadedUrl
      }

      const payload: HtmlModel = {
        ...form,
        render_engine: 'html',
        file_type: 'html',
        html_variables: detected,
        tags_detectadas: detected,
        preview_image_url: thumbnailUrl || null,
      }

      if (payload.name.trim() === '') {
        throw new Error('Digite um nome para o template.')
      }

      console.log('💾 Salvando template HTML:', payload.id ? 'UPDATE' : 'INSERT', payload)

      let dataRow: any

      if (payload.id) {
        console.log('🔄 Atualizando template existente:', payload.id)
        const { data, error } = await supabase
          .from('models')
          .update({
            name: payload.name,
            description: payload.description,
            category: payload.category,
            file_type: 'html',
            render_engine: 'html',
            content_html: payload.content_html,
            content_css: payload.content_css,
            content_js: payload.content_js,
            html_variables: payload.html_variables,
            tags: payload.tags,
            tags_detectadas: payload.tags_detectadas,
            preview_image_url: payload.preview_image_url,
            destination: payload.destination || 'presentation',
          })
          .eq('id', payload.id)
          .select()
          .single()

        if (error) {
          console.error('❌ Erro no UPDATE:', error)
          throw new Error(`Erro ao atualizar: ${error.message} (Código: ${error.code})`)
        }
        console.log('✅ Template atualizado com sucesso:', data)
        dataRow = data
      } else {
        console.log('➕ Inserindo novo template')
        const { data, error } = await supabase
          .from('models')
          .insert([{
            name: payload.name,
            description: payload.description,
            category: payload.category,
            file_type: 'html',
            render_engine: 'html',
            content_html: payload.content_html,
            content_css: payload.content_css,
            content_js: payload.content_js,
            html_variables: payload.html_variables,
            tags: payload.tags,
            tags_detectadas: payload.tags_detectadas,
            preview_image_url: payload.preview_image_url,
            destination: payload.destination || 'presentation',
          }])
          .select()
          .single()

        if (error) {
          console.error('❌ Erro no INSERT:', error)
          throw new Error(`Erro ao criar: ${error.message} (Código: ${error.code})`)
        }
        console.log('✅ Template criado com sucesso:', data)
        dataRow = data
      }

      console.log('🎉 Chamando onSaved com:', dataRow)
      onSaved({
        ...(dataRow as HtmlModel),
        render_engine: 'html',
      })
    } catch (e: any) {
      console.error('❌ Erro geral ao salvar template:', e)
      const errorMessage = e?.message || 'Erro desconhecido ao salvar o template.'
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {form.id ? `Editar Template HTML: ${form.name}` : 'Novo Template HTML'}
            </h2>
            {/* IMPORTANTE: mostrar {{ }} como texto literal */}
            <p className="text-gray-400 text-sm">
              Placeholders {'{{chave}}'} e loops como texto {'{{#lista}} ... {{/lista}}'} (loops serão suportados em breve)
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-0">
          {/* Editor */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(92vh-140px)]">
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex.: POP – Procedimento Operacional Padrão"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Categoria</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    <option value="general">Geral</option>
                    <option value="presentations">Apresentações</option>
                    <option value="reports">Relatórios</option>
                    <option value="contracts">Contratos</option>
                    <option value="financial">Financeiro</option>
                    <option value="operations">Operações</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Destino do Template</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    value={form.destination}
                    onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value as 'presentation' | 'consultor_entregavel' }))}
                  >
                    <option value="presentation">Seletor de Apresentação</option>
                    <option value="consultor_entregavel">Entregável Consultor (Automático)</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  {form.destination === 'presentation'
                    ? '📊 Template ficará disponível no seletor do modo Apresentação'
                    : '🎯 Template será usado automaticamente pelo sistema na fase específica do Consultor'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Descrição</label>
              <textarea
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white resize-none"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descreva o propósito deste template"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Tags</label>
              <TagInput
                tags={form.tags || []}
                onChange={(newTags) => setForm((p) => ({ ...p, tags: newTags }))}
                placeholder="Adicionar tag (ex: financeiro, marketing)"
                suggestions={[
                  'financeiro', 'financial', 'juridico', 'legal', 'marketing',
                  'apresentacao', 'presentation', 'relatorio', 'report', 'HTML',
                  'contrato', 'contract', 'proposta', 'proposal'
                ]}
              />
            </div>

            {/* Thumbnail Upload */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Thumbnail do Template</label>
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-500 transition-colors">
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleThumbnailUpload}
                    className="hidden"
                    id="thumbnail-upload-html"
                  />
                  <label htmlFor="thumbnail-upload-html" className="cursor-pointer">
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

            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-gray-300 mb-1">HTML</label>
                  <button
                    type="button"
                    onClick={syncDetectedToForm}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  >
                    <Wand2 className="w-3 h-3" /> Detectar variáveis
                  </button>
                </div>
                <textarea
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm min-h-[180px]"
                  value={form.content_html}
                  onChange={(e) => setForm((p) => ({ ...p, content_html: e.target.value }))}
                  placeholder={`Use variáveis como ${'{{titulo}}'}, ${'{{subtitulo}}'}, ${'{{autor}}'}...`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">CSS</label>
                  <textarea
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm min-h-[140px]"
                    value={form.content_css}
                    onChange={(e) => setForm((p) => ({ ...p, content_css: e.target.value }))}
                    placeholder="Cole estilos CSS (opcional)"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">JS (opcional)</label>
                  <textarea
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm min-h-[140px]"
                    value={form.content_js}
                    onChange={(e) => setForm((p) => ({ ...p, content_js: e.target.value }))}
                    placeholder="Scripts opcionais para interatividade"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-300">Variáveis detectadas ({detected.length})</div>
                <button
                  type="button"
                  onClick={() => {
                    console.log('🔄 Forçando re-detecção...')
                    const newDetected = detectVariables(form.content_html)
                    console.log('🔍 Novas variáveis:', newDetected)
                    setForm(prev => ({
                      ...prev,
                      html_variables: newDetected,
                      tags_detectadas: newDetected
                    }))
                  }}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  Redetectar
                </button>
              </div>
              {detected.length === 0 ? (
                <div className="text-gray-500 text-sm">Nenhuma variável encontrada</div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                  {detected.map((v) => (
                    <span key={v} className="px-2 py-1 rounded bg-gray-700 text-gray-100 text-xs">
                      {`{{${v}}}`}
                    </span>
                  ))}
                  </div>
                  <div className="text-xs text-gray-400">
                    {detected.length} variável(is) detectada(s). Use "Redetectar" se fez mudanças no HTML.
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="border-l border-gray-700 flex flex-col">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2 text-gray-300">
                <Eye className="w-4 h-4" />
                <span className="text-sm">Preview</span>
              </div>
              <button
                onClick={renderPreview}
                className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
                title="Recarregar preview"
              >
                <RefreshCw className="w-3 h-3" />
                Recarregar
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-white">
              <iframe ref={iframeRef} className="w-full h-full bg-white" title="Preview do Template" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white"
          >
            Fechar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Salvando...' : 'Salvar Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default HtmlTemplateModal
