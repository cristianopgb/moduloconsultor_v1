// src/components/AgentInlineCard.tsx
import React from 'react'
import { X, Loader2, Check, AlertCircle, Bot } from 'lucide-react'

type Status = { step: string; label: string; progress: number } | null
type Done = { html?: string; fileUrl?: string } | undefined

type Props = {
  open: boolean
  status: Status
  log: string[]
  error?: string | null
  done?: Done
  onCancel: () => void
  onClose: () => void
}

export const AgentInlineCard: React.FC<Props> = ({
  open, status, log, error, done, onCancel, onClose
}) => {
  if (!open) return null
  const headerIcon = error
    ? <AlertCircle className="w-4 h-4 text-red-400" />
    : done?.html
      ? <Check className="w-4 h-4 text-emerald-400" />
      : <Bot className="w-4 h-4 text-blue-300" />
  const headerText = error ? 'Agente com erro' : done?.html ? 'Agente concluído' : 'Agente processando...'

  return (
    // ⬇️ mais alto: bottom-24 para não cobrir o botão de enviar
    <div className="fixed right-4 bottom-24 z-50 w-[340px] rounded-xl border border-gray-700 bg-gray-800 shadow-xl pointer-events-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-200">{headerIcon}<span>{headerText}</span></div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-300" title="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {status && !done?.html && !error && (
          <div>
            <div className="text-xs text-gray-300 mb-1">{status.label || 'Processando…'}</div>
            <div className="w-full h-2 bg-gray-700 rounded">
              <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, status.progress || 0))}%` }} />
            </div>
          </div>
        )}
        {log?.length > 0 && (
          <div className="max-h-28 overflow-y-auto text-xs bg-gray-900/60 border border-gray-700 rounded p-2 text-gray-300">
            {log.map((t, i) => <span key={i}>{t}</span>)}
          </div>
        )}
        {error && <div className="text-sm text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
        {done?.html && <div className="text-sm text-emerald-400 flex items-center gap-2"><Check className="w-4 h-4" /><span>Documento pronto no preview.</span></div>}
      </div>

      <div className="px-3 py-2 border-t border-gray-700 flex items-center justify-end gap-2">
        {!done?.html && !error && (
          <button onClick={onCancel} className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Cancelar
          </button>
        )}
        <button onClick={onClose} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">OK</button>
      </div>
    </div>
  )
}


