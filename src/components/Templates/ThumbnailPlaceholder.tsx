import React from 'react'
import { FileText, Table, Presentation, Globe, Video as LucideIcon } from 'lucide-react'

interface ThumbnailPlaceholderProps {
  fileType?: string
  category?: string
  size?: 'sm' | 'md' | 'lg'
}

const FILE_TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; gradient: string }> = {
  html: {
    icon: Globe,
    color: 'text-orange-400',
    gradient: 'from-orange-600 via-amber-600 to-orange-700'
  },
  docx: {
    icon: FileText,
    color: 'text-blue-400',
    gradient: 'from-blue-600 via-indigo-600 to-blue-700'
  },
  xlsx: {
    icon: Table,
    color: 'text-green-400',
    gradient: 'from-green-600 via-emerald-600 to-green-700'
  },
  pptx: {
    icon: Presentation,
    color: 'text-red-400',
    gradient: 'from-red-600 via-rose-600 to-red-700'
  },
}

const CATEGORY_PATTERN: Record<string, string> = {
  financial: 'bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(5,150,105,0.15)_0%,transparent_50%)]',
  legal: 'bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.15)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(109,40,217,0.15)_0%,transparent_50%)]',
  marketing: 'bg-[radial-gradient(circle_at_30%_20%,rgba(236,72,153,0.15)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.15)_0%,transparent_50%)]',
  presentations: 'bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(37,99,235,0.15)_0%,transparent_50%)]',
  reports: 'bg-[radial-gradient(circle_at_30%_20%,rgba(100,116,139,0.15)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(71,85,105,0.15)_0%,transparent_50%)]',
  default: 'bg-[radial-gradient(circle_at_30%_20%,rgba(75,85,99,0.15)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(55,65,81,0.15)_0%,transparent_50%)]',
}

const SIZE_CONFIG = {
  sm: { icon: 'w-8 h-8', text: 'text-xs' },
  md: { icon: 'w-16 h-16', text: 'text-sm' },
  lg: { icon: 'w-24 h-24', text: 'text-base' },
}

export function ThumbnailPlaceholder({ fileType = 'html', category, size = 'md' }: ThumbnailPlaceholderProps) {
  const config = FILE_TYPE_CONFIG[fileType] || FILE_TYPE_CONFIG.html
  const Icon = config.icon
  const sizeConfig = SIZE_CONFIG[size]
  const pattern = CATEGORY_PATTERN[category || 'default'] || CATEGORY_PATTERN.default

  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${config.gradient} ${pattern} flex flex-col items-center justify-center overflow-hidden`}>
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Icon */}
      <div className="relative z-10">
        <Icon className={`${sizeConfig.icon} ${config.color} opacity-70 drop-shadow-lg`} strokeWidth={1.5} />
      </div>

      {/* "Sem Preview" Text */}
      <div className={`relative z-10 mt-3 ${sizeConfig.text} text-white/50 font-medium tracking-wide`}>
        Sem Preview
      </div>

      {/* Subtle Corner Decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
        <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-bl ${config.gradient} blur-3xl`} />
      </div>
      <div className="absolute bottom-0 left-0 w-32 h-32 opacity-20">
        <div className={`absolute bottom-0 left-0 w-full h-full bg-gradient-to-tr ${config.gradient} blur-3xl`} />
      </div>
    </div>
  )
}
