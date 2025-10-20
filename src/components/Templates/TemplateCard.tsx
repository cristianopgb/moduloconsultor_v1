import React from 'react'
import { FileText, Table, Presentation, Globe, CheckCircle } from 'lucide-react'
import { Model } from '../../lib/supabase'

interface TemplateCardProps {
  template: Model
  isSelected?: boolean
  onClick: () => void
}

const TAG_COLORS: Record<string, string> = {
  financeiro: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  financial: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  juridico: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  legal: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  marketing: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  apresentacao: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  apresentação: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  presentation: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  relatorio: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  relatório: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  report: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  html: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  contrato: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  contract: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  proposta: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  proposal: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
}

const FILE_TYPE_CONFIG: Record<string, { icon: any; color: string; gradient: string }> = {
  html: { icon: Globe, color: 'text-orange-400', gradient: 'from-orange-600 to-amber-600' },
  docx: { icon: FileText, color: 'text-blue-400', gradient: 'from-blue-600 to-indigo-600' },
  xlsx: { icon: Table, color: 'text-green-400', gradient: 'from-green-600 to-emerald-600' },
  pptx: { icon: Presentation, color: 'text-red-400', gradient: 'from-red-600 to-rose-600' },
}

export function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
  const fileTypeConfig = FILE_TYPE_CONFIG[template.file_type] || FILE_TYPE_CONFIG.html
  const Icon = fileTypeConfig.icon

  const tags = Array.isArray(template.tags) ? template.tags : []
  const visibleTags = tags.slice(0, 3)
  const remainingCount = tags.length - visibleTags.length

  const getTagColor = (tag: string): string => {
    const normalizedTag = tag.toLowerCase().trim()
    return TAG_COLORS[normalizedTag] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  }

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 border ${
        isSelected
          ? 'border-blue-500 shadow-lg shadow-blue-500/20 scale-[1.02]'
          : 'border-gray-700 hover:border-gray-600 hover:shadow-xl hover:scale-[1.02]'
      }`}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-video bg-gray-900 overflow-hidden">
        {template.preview_image_url ? (
          <>
            <img
              src={template.preview_image_url}
              alt={template.name}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const fallback = target.nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
            {/* Fallback placeholder (hidden unless image fails) */}
            <div
              className={`hidden absolute inset-0 bg-gradient-to-br ${fileTypeConfig.gradient} items-center justify-center`}
            >
              <Icon className={`w-16 h-16 ${fileTypeConfig.color} opacity-60`} />
            </div>
          </>
        ) : (
          /* Default placeholder when no image */
          <div
            className={`absolute inset-0 bg-gradient-to-br ${fileTypeConfig.gradient} flex items-center justify-center`}
          >
            <Icon className={`w-16 h-16 ${fileTypeConfig.color} opacity-60`} />
          </div>
        )}

        {/* Selected Badge */}
        {isSelected && (
          <div className="absolute top-3 right-3 bg-blue-600 rounded-full p-1.5 shadow-lg">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
        )}

        {/* Hover Overlay with "Usar" button */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg transform scale-95 group-hover:scale-100 transition-transform"
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          >
            Usar Template
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 bg-gray-800/70 backdrop-blur-sm">
        {/* Title */}
        <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2 mb-2 min-h-[2.5rem]">
          {template.name}
        </h3>

        {/* Description */}
        {template.description && (
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3 min-h-[2rem]">
            {template.description}
          </p>
        )}

        {/* Tags and Category */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {/* Category Badge */}
          {template.category && (
            <span className="px-2 py-1 bg-gray-700/70 text-gray-300 text-[10px] rounded-md border border-gray-600/50">
              {template.category}
            </span>
          )}

          {/* File Type Badge */}
          {template.file_type && (
            <span
              className={`px-2 py-1 bg-gray-700/70 text-[10px] rounded-md border border-gray-600/50 ${fileTypeConfig.color}`}
            >
              {template.file_type.toUpperCase()}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleTags.map((tag, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 text-[10px] rounded-full border ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] text-gray-400 bg-gray-700/50 rounded-full border border-gray-600/50">
                +{remainingCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
