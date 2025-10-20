import React, { useEffect, useMemo, useState } from 'react'
import {
  Plus, Search, Filter, Trash2, FileText, Presentation, Table, Globe,
  Image as ImageIcon, Tag, CheckCircle, AlertTriangle
} from 'lucide-react'
import { supabase, Model } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { MockupUploader } from './MockupUploader'

export function TemplatesAdminPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<Model[]>([])
  const [showUploader, setShowUploader] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isMaster, setIsMaster] = useState(false)

  // mesmas categorias que usamos no uploader/selector
  const categories = [
    { value: 'all', label: 'Todos' },
    { value: 'general', label: 'Geral' },
    { value: 'contracts', label: 'Contratos' },
    { value: 'proposals', label: 'Propostas' },
    { value: 'reports', label: 'Relatórios' },
    { value: 'presentations', label: 'Apresentações' },
    { value: 'legal', label: 'Jurídico' },
    { value: 'financial', label: 'Financeiro' },
    { value: 'marketing', label: 'Marketing' },
  ]

  const fileTypeIcons: Record<string, any> = {
    html: Globe,
    docx: FileText,
    xlsx: Table,
    pptx: Presentation,
    pdf: FileText
  }

  // checa papel do usuário (para mostrar botão de upload)
  const loadRole = async () => {
    try {
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      setIsMaster((data?.role || 'user') === 'master')
    } catch {
      setIsMaster(false)
    }
  }

  const loadTemplates = async () => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      setTemplates(data || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRole()
  }, [user])

  useEffect(() => {
    loadTemplates()
  }, [])

  const filtered = useMemo(() => {
    return (templates || []).filter(t => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [templates, searchTerm, selectedCategory])

  const handleDelete = async (template: Model) => {
    if (!confirm(`Excluir o template "${template.name}"?`)) return
    try {
      // se tiver arquivo no storage, não apagamos automaticamente
      // (pra evitar apagar acidentalmente); mantém simples.
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', template.id)
      if (error) throw error
      setTemplates(prev => prev.filter(t => t.id !== template.id))
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir template')
    }
  }

  const getIconFor = (fileType?: string) => {
    const key = (fileType || '').toLowerCase()
    return fileTypeIcons[key] || FileText
  }

  const countFileTemplates = templates.filter(t => !!t.file_url && !!t.file_type && !t.template_json).length
  const countJsonTemplates = templates.filter(t => !!t.template_json).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Templates</h1>
          <p className="text-gray-400 text-sm">
            Cadastre e gerencie modelos prontos (DOCX, XLSX, PPTX, PDF) e templates JSON.
          </p>
        </div>

        {isMaster && (
          <button
            onClick={() => setShowUploader(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Template (arquivo)
          </button>
        )}
      </div>

      {/* Stats simples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Total</p>
          <p className="text-2xl text-white font-semibold">{templates.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Mockups de Arquivo</p>
          <p className="text-2xl text-white font-semibold">{countFileTemplates}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Templates JSON</p>
          <p className="text-2xl text-white font-semibold">{countJsonTemplates}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white text-sm min-w-[160px]"
            >
              {categories.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            Nenhum template encontrado.
          </div>
        ) : (
          filtered.map(t => {
            const Icon = getIconFor(t.file_type)
            const isFileMockup = !!t.file_url && !!t.file_type && !t.template_json

            return (
              <div
                key={t.id}
                className="p-4 bg-gray-800/60 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Preview (imagem) ou ícone */}
                  <div className="w-16 h-16 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                    {t.preview_image_url ? (
                      <img
                        src={t.preview_image_url}
                        alt={t.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling && (e.currentTarget.nextElementSibling as HTMLElement).style.setProperty('display','flex')
                        }}
                      />
                    ) : null}
                    <div
                      className="w-full h-full hidden bg-gray-700 items-center justify-center"
                      style={{ display: t.preview_image_url ? 'none' : 'flex' }}
                    >
                      <Icon className="w-8 h-8 text-gray-300" />
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium truncate">{t.name}</h3>
                      {isFileMockup ? (
                        <span className="px-2 py-0.5 text-xs rounded bg-green-600/20 text-green-400">
                          Mockup de Arquivo
                        </span>
                      ) : t.template_json ? (
                        <span className="px-2 py-0.5 text-xs rounded bg-purple-600/20 text-purple-400">
                          Template JSON
                        </span>
                      ) : null}
                      {t.file_type && (
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-600/20 text-blue-400">
                          {(t.file_type || '').toUpperCase()}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                      {t.description || 'Sem descrição'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {t.category && (
                        <span className="px-2 py-1 rounded bg-gray-700 text-gray-300">
                          {categories.find(c => c.value === t.category)?.label || t.category}
                        </span>
                      )}
                      {Array.isArray(t.tags) && t.tags.length > 0 && (
                        <>
                          {t.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-700 text-gray-300">
                              <Tag className="w-3 h-3" />
                              {String(tag)}
                            </span>
                          ))}
                          {t.tags.length > 3 && (
                            <span className="px-2 py-1 rounded bg-gray-700 text-gray-400">
                              +{t.tags.length - 3}
                            </span>
                          )}
                        </>
                      )}
                      {t.preview_image_url && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-700 text-gray-300">
                          <ImageIcon className="w-3 h-3" />
                          capa
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    {isFileMockup && (
                      <a
                        href={t.file_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white"
                      >
                        Ver arquivo
                      </a>
                    )}
                    {isMaster && (
                      <button
                        onClick={() => handleDelete(t)}
                        className="px-3 py-2 text-xs rounded bg-red-700/70 hover:bg-red-700 text-white inline-flex items-center gap-1"
                        title="Excluir"
                      >
                        <Trash2 className="w-3 h-3" />
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal: Uploader */}
      {showUploader && (
        <MockupModal onClose={() => setShowUploader(false)}>
          <MockupUploader
            onMockupSaved={(mockup) => {
              // adiciona na lista e fecha
              setTemplates(prev => [mockup, ...prev])
              setShowUploader(false)
            }}
            onClose={() => setShowUploader(false)}
          />
        </MockupModal>
      )}
    </div>
  )
}

/** Modal simples para embutir o Uploader */
function MockupModal({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-200 hover:bg-gray-700"
        >
          Fechar
        </button>
        {children}
      </div>
    </div>
  )
}
