// /src/components/Chat/TemplateSelector.tsx
// Correção: caminho de import do supabase estava "././lib/supabase" (inexistente).
// Agora: "../../lib/supabase". Nenhuma mudança na lógica/IA.
// Inclui [DEBUG] básicos.

import React, { useEffect, useMemo, useState } from 'react'
import { supabase, Model } from '../../lib/supabase' // <-- caminho corrigido
import { X, Search, Tag } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  selectedTemplate: Model | null
  onSelectTemplate: (m: Model | null) => void
}

type ModelRow = Model & {
  description?: string | null
  category?: string | null
  thumbnail_url?: string | null
}

const CATEGORIES_FALLBACK = ['Apresentações', 'Relatórios', 'Planejamento', 'Processos', 'Vendas', 'RH']

export function TemplateSelector({ isOpen, onClose, selectedTemplate, onSelectTemplate }: Props) {
  const [models, setModels] = useState<ModelRow[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('')

  useEffect(() => {
    if (!isOpen) return
    ;(async () => {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('template_type', 'presentation')
        .or('destination.is.null,destination.eq.presentation')
        .order('name', { ascending: true })

      console.log('[DEBUG] TemplateSelector carregado:', { count: data?.length, error: error?.message })
      console.log('[DEBUG] Templates filtrados (excluindo consultor_entregavel):', data?.map(t => ({ name: t.name, destination: (t as any).destination })))
      if (!error && data) setModels(data as any)
    })()
  }, [isOpen])

  const categories = useMemo(() => {
    const set = new Set<string>()
    models.forEach(m => { if ((m as any).category) set.add((m as any).category as string) })
    return Array.from(set.size ? set : new Set(CATEGORIES_FALLBACK))
  }, [models])

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    return models.filter(m => {
      const inCat = !cat || (m as any).category === cat
      const text = `${m.name} ${(m as any).description || ''}`.toLowerCase()
      return inCat && (!k || text.includes(k))
    })
  }, [models, q, cat])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-start justify-center overflow-auto p-6">
      <div className="w-full max-w-5xl bg-gray-900 rounded-2xl border border-gray-800 shadow-xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="text-white font-semibold">Selecionar Template</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        {/* Filtros */}
        <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Buscar por nome ou descrição…"
              className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400"/>
            <select
              value={cat}
              onChange={(e)=>setCat(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200"
            >
              <option value="">Todas categorias</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Cards */}
        <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => { onSelectTemplate(m); onClose() }}
              className={`group text-left rounded-xl border ${
                selectedTemplate?.id === m.id ? 'border-blue-600 ring-2 ring-blue-600/40' : 'border-gray-800 hover:border-gray-700'
              } bg-gray-900 overflow-hidden`}
            >
              <div className="aspect-video bg-gray-800 flex items-center justify-center overflow-hidden">
                { (m as any).thumbnail_url ? (
                  <img src={(m as any).thumbnail_url as string} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-500 text-sm">Sem miniatura</div>
                )}
              </div>
              <div className="p-3">
                <div className="text-white font-medium mb-1 truncate">{m.name}</div>
                <div className="text-xs text-gray-400 mb-2 line-clamp-2">{(m as any).description || 'Sem descrição'}</div>
                {(m as any).category && (
                  <span className="inline-block text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                    {(m as any).category}
                  </span>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-gray-400 text-sm">Nenhum template encontrado.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TemplateSelector
