import { useMemo, useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Model } from '../../lib/supabase'
import { TemplateCard } from '../Templates/TemplateCard'

type Props = {
  templates?: Model[] | null
  onSelect: (tpl: Model) => void
  selectedTemplateId?: string | null
  className?: string
}

export function TemplateSelectorPanel({
  templates,
  onSelect,
  selectedTemplateId,
  className,
}: Props) {
  const items: Model[] = Array.isArray(templates) ? templates : []

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [showTagFilter, setShowTagFilter] = useState(false)

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const t of items) if (t?.category) set.add(t.category)
    return ['all', ...Array.from(set).sort()]
  }, [items])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of items) {
      if (Array.isArray(t.tags)) {
        t.tags.forEach(tag => set.add(tag))
      }
    }
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    return items.filter((t) => {
      const matchesCategory = categoryFilter === 'all' || (t.category ?? '') === categoryFilter

      const matchesSearch =
        !term ||
        t.name?.toLowerCase().includes(term) ||
        (t.description ?? '').toLowerCase().includes(term) ||
        (Array.isArray(t.tags) && t.tags.some(tag => tag.toLowerCase().includes(term)))

      const matchesTags =
        tagFilters.length === 0 ||
        (Array.isArray(t.tags) && tagFilters.some(filter => t.tags?.includes(filter)))

      return matchesCategory && matchesSearch && matchesTags
    })
  }, [items, searchQuery, categoryFilter, tagFilters])

  const toggleTagFilter = (tag: string) => {
    setTagFilters(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setTagFilters([])
  }

  const noData = templates == null
  const emptyList = !noData && items.length === 0
  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || tagFilters.length > 0

  return (
    <div className={`h-full w-full flex flex-col bg-gray-800/70 ${className ?? ''}`}>
      {/* Header com Filtros */}
      <div className="p-4 border-b border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-lg">Templates</h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              title="Limpar filtros"
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar templates..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Categoria */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'Todas as categorias' : c}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro de Tags */}
        {allTags.length > 0 && (
          <div>
            <button
              onClick={() => setShowTagFilter(!showTagFilter)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Filter className="w-3 h-3" />
              Filtrar por tags {tagFilters.length > 0 && `(${tagFilters.length})`}
            </button>
            {showTagFilter && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-gray-900/50 rounded-lg border border-gray-700">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTagFilter(tag)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      tagFilters.includes(tag)
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                        : 'bg-gray-700/50 text-gray-300 border-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contador de Resultados */}
        {hasActiveFilters && (
          <div className="text-xs text-gray-400">
            {filtered.length} template{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Grid de Templates */}
      <div className="flex-1 overflow-y-auto p-4">
        {noData ? (
          <div className="text-center py-12 text-gray-400">
            <div className="font-medium mb-1">Carregando templates…</div>
            <div className="text-sm text-gray-500">
              A lista de templates ainda não foi carregada.
            </div>
          </div>
        ) : emptyList ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">Nenhum template disponível.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="font-medium mb-1">Nenhum resultado encontrado</div>
            <div className="text-sm">Tente ajustar os filtros de busca</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedTemplateId === template.id}
                onClick={() => onSelect(template)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TemplateSelectorPanel
