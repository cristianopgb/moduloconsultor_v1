import React from 'react'
import { BarChart3, Presentation, Briefcase, Wand2 } from 'lucide-react'
import type { ChatMode } from '../../lib/supabase'

interface ChatModeToggleProps {
  currentMode: ChatMode
  onModeChange: (mode: ChatMode) => void
  disabled?: boolean
}

export function ChatModeToggle({ currentMode, onModeChange, disabled = false }: ChatModeToggleProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg border border-gray-700">
      <button
        onClick={() => onModeChange('analytics')}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
          ${currentMode === 'analytics'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Analytics</span>
      </button>

      <button
        onClick={() => onModeChange('presentation')}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
          ${currentMode === 'presentation'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Presentation className="w-4 h-4" />
        <span>Apresentação</span>
      </button>

      <button
        onClick={() => onModeChange('consultor')}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
          ${currentMode === 'consultor'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Briefcase className="w-4 h-4" />
        <span>Consultor</span>
      </button>

      <button
        onClick={() => onModeChange('genius')}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
          ${currentMode === 'genius'
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Wand2 className="w-4 h-4" />
        <span>Genius</span>
      </button>
    </div>
  )
}
