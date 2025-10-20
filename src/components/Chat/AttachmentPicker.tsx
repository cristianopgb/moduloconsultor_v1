import React, { useEffect, useRef, useState } from 'react'
import { Paperclip, Link2, Upload, X, Check } from 'lucide-react'

type Props = {
  onUploadFiles: (files: File[]) => void
  onAddUrl: (url: string) => void
  accept?: string
}

export function AttachmentPicker({ onUploadFiles, onAddUrl, accept = '.pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt,.html,.htm' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'menu' | 'url'>('menu')

  const [url, setUrl] = useState('')
  const [urlErr, setUrlErr] = useState<string>('')

  // Fechar no clique fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!open) return
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setMode('menu')
        setUrl('')
        setUrlErr('')
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') {
        setOpen(false)
        setMode('menu')
        setUrl('')
        setUrlErr('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  // Foco no input de URL quando entrar no modo URL
  useEffect(() => {
    if (open && mode === 'url') {
      setTimeout(() => urlInputRef.current?.focus(), 0)
    }
  }, [open, mode])

  function toggleOpen() {
    setOpen(v => !v)
    setMode('menu')
    setUrl('')
    setUrlErr('')
  }

  function handleFilesSelected(list: FileList | null) {
    const files = Array.from(list || [])
    if (files.length) onUploadFiles(files)
    // fecha o popover após selecionar
    setOpen(false)
    setMode('menu')
  }

  function validateUrl(u: string): string | null {
    if (!u.trim()) return 'Informe uma URL'
    try {
      const parsed = new URL(u.trim())
      if (!/^https?:$/i.test(parsed.protocol)) {
        return 'Use http(s)://'
      }
      return null
    } catch {
      return 'URL inválida'
    }
  }

  async function confirmUrl() {
    const err = validateUrl(url)
    if (err) { setUrlErr(err); return }
    onAddUrl(url.trim())
    setOpen(false)
    setMode('menu')
    setUrl('')
    setUrlErr('')
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Botão ícone (estilo GPT) */}
      <button
        type="button"
        onClick={toggleOpen}
        className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition"
        title="Anexar"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute bottom-11 right-0 z-50 w-72 rounded-2xl border bg-white dark:bg-neutral-900 dark:border-neutral-800 shadow-xl overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Cabeçalho / Fechar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200/70 dark:border-neutral-800">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {mode === 'menu' ? 'Adicionar' : 'Adicionar URL'}
            </div>
            <button
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => { setOpen(false); setMode('menu'); }}
              aria-label="Fechar"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          {/* Corpo */}
          {mode === 'menu' ? (
            <div className="p-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
              >
                <Upload className="w-4 h-4" />
                <span>Adicionar arquivo</span>
              </button>

              <button
                onClick={() => setMode('url')}
                className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
              >
                <Link2 className="w-4 h-4" />
                <span>Adicionar URL</span>
              </button>

              {/* input invisível de arquivos */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={accept}
                className="hidden"
                onChange={(e) => handleFilesSelected(e.currentTarget.files)}
              />
            </div>
          ) : (
            <div className="p-3">
              <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Cole a URL da sua base de conhecimento
              </label>
              <input
                ref={urlInputRef}
                type="url"
                placeholder="https://exemplo.com/artigo"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (urlErr) setUrlErr('')
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmUrl() } }}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              {urlErr && (
                <div className="mt-1 text-xs text-red-500">{urlErr}</div>
              )}

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => { setMode('menu'); setUrl(''); setUrlErr('') }}
                  className="px-3 py-2 text-sm rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmUrl}
                  className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AttachmentPicker
