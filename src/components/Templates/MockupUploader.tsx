import React, { useState, useRef } from 'react'
import {
  Upload, FileText, Table, Presentation, File, Save, X,
  Image, AlertTriangle, CheckCircle, ImagePlus
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { TagInput } from './TagInput'

interface MockupUploaderProps {
  onMockupSaved: (mockup: any) => void
  onClose: () => void
}

export function MockupUploader({ onMockupSaved, onClose }: MockupUploaderProps) {
  const [step, setStep] = useState<'upload' | 'metadata'>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedThumbnail, setUploadedThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  // IMPORTANTE: agora armazenamos o *path* no bucket (ex.: mockups/169999_nome.pptx),
  // e NÃO uma URL pública
  const [fileUrl, setFileUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')

  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    category: 'general',
    tags: [] as string[],
    preview_image_url: ''
  })

  const supportedTypes = [
    { ext: '.docx', type: 'docx', icon: FileText, label: 'Word Document', color: 'text-blue-400' },
    { ext: '.xlsx', type: 'xlsx', icon: Table, label: 'Excel Spreadsheet', color: 'text-green-400' },
    { ext: '.pptx', type: 'pptx', icon: Presentation, label: 'PowerPoint', color: 'text-red-400' },
    { ext: '.pdf', type: 'pdf', icon: File, label: 'PDF Document', color: 'text-purple-400' }
  ]

  const categories = [
    { value: 'general', label: 'Geral' },
    { value: 'contracts', label: 'Contratos' },
    { value: 'proposals', label: 'Propostas' },
    { value: 'reports', label: 'Relatórios' },
    { value: 'presentations', label: 'Apresentações' },
    { value: 'legal', label: 'Jurídico' },
    { value: 'financial', label: 'Financeiro' },
    { value: 'marketing', label: 'Marketing' }
  ]

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
    const isSupported = supportedTypes.some(type => type.ext === fileExt)

    if (!isSupported) {
      setError('Tipo de arquivo não suportado. Use DOCX, XLSX, PPTX ou PDF.')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Arquivo muito grande. Máximo 10MB.')
      return
    }

    setUploadedFile(file)
    setMetadata(prev => ({
      ...prev,
      name: file.name.replace(/\.[^/.]+$/, '')
    }))
    setError('')

    // Upload para Supabase Storage
    await uploadToStorage(file)
  }

  // >>> ALTERADO: salva o *path* no bucket e NÃO usa getPublicUrl
  const uploadToStorage = async (file: File) => {
    setUploading(true)
    try {
      const safeName = file.name.replace(/\s+/g, '_')
      const fileName = `mockups/${Date.now()}_${safeName}`

      const { error } = await supabase.storage
        .from('templates')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // O que vai para o banco é APENAS o path no bucket
      setFileUrl(fileName)
      setStep('metadata')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao fazer upload do arquivo')
    } finally {
      setUploading(false)
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

    setUploadedThumbnail(file)
    const reader = new FileReader()
    reader.onload = (e) => setThumbnailPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setUploadingThumbnail(true)
    try {
      const safeName = file.name.replace(/\s+/g, '_')
      const fileName = `thumbnails/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('templates')
        .getPublicUrl(fileName)

      setThumbnailUrl(fileName)
      setMetadata(prev => ({ ...prev, preview_image_url: publicUrl }))
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao fazer upload da thumbnail')
    } finally {
      setUploadingThumbnail(false)
    }
  }

  // >>> ALTERADO: normaliza tags e grava file_url como PATH (não URL)
  const saveMockup = async () => {
    if (!metadata.name.trim() || !fileUrl) {
      setError('Nome e arquivo são obrigatórios')
      return
    }

    setSaving(true)
    setError('')

    try {
      const ext = (uploadedFile?.name.split('.').pop() || '').toLowerCase()

      const mockupData = {
        name: metadata.name.trim(),
        description: metadata.description.trim(),
        category: metadata.category,
        file_type: ext || 'docx',
        file_url: fileUrl,
        template_content: null,
        tags_detectadas: null,
        tags: metadata.tags,
        preview_image_url: metadata.preview_image_url.trim() || null
      }

      const { data, error } = await supabase
        .from('models')
        .insert([mockupData])
        .select()

      if (error) throw error

      if (data && data[0]) {
        onMockupSaved(data[0])
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro ao salvar mockup')
    } finally {
      setSaving(false)
    }
  }

  const getFileIcon = (fileName: string) => {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase()
    const typeInfo = supportedTypes.find(t => t.ext === ext)
    return typeInfo?.icon || FileText
  }

  const getFileColor = (fileName: string) => {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase()
    const typeInfo = supportedTypes.find(t => t.ext === ext)
    return typeInfo?.color || 'text-gray-400'
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Upload de Template</h2>
              <p className="text-gray-400 text-sm">Envie um arquivo (DOCX, XLSX, PPTX, PDF) para o bucket de templates</p>
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
        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* File Types */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {supportedTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <div key={type.type} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-center">
                      <Icon className={`w-8 h-8 mx-auto mb-2 ${type.color}`} />
                      <h4 className="text-white font-medium text-sm">{type.label}</h4>
                      <p className="text-gray-400 text-xs">{type.ext}</p>
                    </div>
                  )
                })}
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-gray-500 transition-colors">
                <input
                  type="file"
                  accept=".docx,.xlsx,.pptx,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-white font-medium mb-2">Clique para fazer upload</p>
                  <p className="text-gray-400 text-sm">ou arraste e solte o arquivo aqui</p>
                  <p className="text-gray-500 text-xs mt-2">Máximo 10MB • DOCX, XLSX, PPTX, PDF</p>
                </label>
              </div>

              {uploading && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div>
                      <p className="text-blue-400 font-medium">Fazendo upload...</p>
                      <p className="text-blue-300 text-sm">Salvando arquivo no storage</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'metadata' && uploadedFile && (
            <div className="space-y-6">
              {/* File Info */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-700 rounded-lg">
                    {React.createElement(getFileIcon(uploadedFile.name), {
                      className: `w-5 h-5 ${getFileColor(uploadedFile.name)}`
                    })}
                  </div>
                  <div>
                    <p className="text-white font-medium">{uploadedFile.name}</p>
                    <p className="text-gray-400 text-sm">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <div className="ml-auto">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                </div>
              </div>

              {/* Metadata Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nome do Template *
                  </label>
                  <input
                    type="text"
                    value={metadata.name}
                    onChange={(e) => setMetadata(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Contrato Moderno, Relatório Financeiro"
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva quando e como usar este template"
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Categoria
                  </label>
                  <select
                    value={metadata.category}
                    onChange={(e) => setMetadata(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Imagem de Capa (Thumbnail)
                  </label>
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-500 transition-colors">
                      <input
                        ref={thumbnailInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleThumbnailUpload}
                        className="hidden"
                        id="thumbnail-upload"
                      />
                      <label htmlFor="thumbnail-upload" className="cursor-pointer">
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
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tags
                  </label>
                  <TagInput
                    tags={metadata.tags}
                    onChange={(newTags) => setMetadata(prev => ({ ...prev, tags: newTags }))}
                    placeholder="Adicionar tag (ex: financeiro, apresentação, HTML)"
                    suggestions={[
                      'financeiro', 'financial', 'juridico', 'legal', 'marketing',
                      'apresentacao', 'presentation', 'relatorio', 'report', 'HTML',
                      'contrato', 'contract', 'proposta', 'proposal'
                    ]}
                  />
                </div>

                {/* Preview da Thumbnail */}
                {(thumbnailPreview || metadata.preview_image_url) && (
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Preview da Thumbnail
                    </label>
                    <div className="w-full aspect-video bg-gray-800 rounded-lg overflow-hidden">
                      <img
                        src={thumbnailPreview || metadata.preview_image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none'
                          const fallback = (e.currentTarget.nextElementSibling as HTMLDivElement)
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                      <div
                        className="w-full h-full bg-gray-800 flex items-center justify-center"
                        style={{ display: 'none' }}
                      >
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6">
            {step === 'upload' ? (
              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
            ) : (
              <>
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={saveMockup}
                  disabled={saving || !metadata.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {saving ? 'Salvando...' : 'Salvar Template'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
