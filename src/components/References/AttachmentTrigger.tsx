import React, { useEffect, useRef, useState } from 'react'
import { Paperclip, Upload, Link as LinkIcon, Plus, X, Loader2 } from 'lucide-react'

type Props = {
  onPickLocal: (files: FileList) => void
  onInsertUrl: (url: string) => void
  isUploading?: boolean
}

export default function AttachmentTrigger({ onPickLocal, onInsertUrl, isUploading = false }: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return
      const t = e.target as Node
      if (wrapRef.current && !wrapRef.current.contains(t)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function handleInsertUrl() {
    const v = url.trim()
    if (!v) return
    try {
      new URL(v)
      onInsertUrl(v)
      setUrl('')
      setOpen(false)
    } catch {
      alert('URL inválida')
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-xl hover:bg-gray-700 text-gray-200 relative"
        title="Adicionar fontes"
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        ) : (
          <Paperclip className="w-5 h-5" />
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-11 right-0 z-[60] w-[320px] rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <div className="text-xs text-gray-400">Adicionar de…</div>
            <button
              className="p-1 rounded hover:bg-gray-700 text-gray-300"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3">
            {/* Arquivo local */}
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-700 border border-gray-700 text-gray-200 transition"
            >
              <Upload className="w-4 h-4 text-blue-300" />
              <span>Anexar arquivo (PDF, DOCX, PPTX, XLSX, CSV, TXT, HTML)</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.currentTarget.files && e.currentTarget.files.length) {
                  onPickLocal(e.currentTarget.files)
                  setOpen(false)
                }
                e.currentTarget.value = ''
              }}
            />

            {/* URL – estilo “imagem 5” */}
            <div className="rounded-2xl bg-gray-900 border border-gray-700 p-2">
              <div className="text-xs text-gray-400 mb-2">URL (página pública)</div>
              <div className="flex items-center gap-2">
                <div className="shrink-0">
                  <LinkIcon className="w-5 h-5 text-emerald-300" />
                </div>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Cole aqui o link do site…"
                  className="flex-1 rounded-xl bg-gray-800 border border-gray-700 focus:border-emerald-500 outline-none px-3 py-2 text-gray-100 placeholder-gray-500"
                />
                <button
                  onClick={handleInsertUrl}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  title="Adicionar URL"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-gray-500">
              Tudo que você anexar será analisado pelo assistente (chat e geração).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
