// /src/components/References/AttachmentBar.tsx
// Barra unificada e elegante para anexos (Arquivos locais + URL)
// - Dropdown com ícones (estilo “Adicionar de…”)
// - Chips dos anexos adicionados (com remover)
// - Usa ReferenceUploader (onUploaded) e cria URL direto no Supabase
// - Fecha ao clicar fora / ESC

import React, { useEffect, useRef, useState } from 'react'
import { Plus, Link as LinkIcon, FileUp, X, Check } from 'lucide-react'
import ReferenceUploader, { type CreatedRef } from './ReferenceUploader'
import { supabase } from '../../lib/supabase'

type Props = {
  userId: string
  conversationId: string
  attached: CreatedRef[]
  onChange: (next: CreatedRef[]) => void
}

export default function AttachmentBar({ userId, conversationId, attached, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'files' | 'url' | null>(null)
  const [url, setUrl] = useState('')
  const [urlErr, setUrlErr] = useState('')
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha no clique fora / ESC
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setMode(null)
        setUrl(''); setUrlErr('')
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') {
        setOpen(false)
        setMode(null)
        setUrl(''); setUrlErr('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function toggle() {
    setOpen((s) => !s)
    if (open) {
      setMode(null)
      setUrl(''); setUrlErr('')
    }
  }

  function addRefOne(ref: CreatedRef) {
    onChange([...(attached || []), ref])
  }
  function removeRef(id?: string) {
    if (!id) return
    onChange((attached || []).filter((r) => r.id !== id))
  }

  function validateUrl(u: string): string | null {
    if (!u.trim()) return 'Informe uma URL'
    try {
      const parsed = new URL(u.trim())
      if (!/^https?:$/i.test(parsed.protocol)) return 'Use http(s)://'
      return null
    } catch {
      return 'URL inválida'
    }
  }

  async function createUrlReference() {
    const err = validateUrl(url)
    if (err) { setUrlErr(err); return }
    setBusy(true); setUrlErr('')
    try {
      // cria linha em "references"
      const { data, error } = await supabase
        .from('references')
        .insert([{
          user_id: userId,
          conversation_id: conversationId,
          title: url.trim(),
          type: 'url',
          source_url: url.trim(),
          extracted_text: '',
          storage_bucket: null,
          storage_path: null,
          metadata: { created_from: 'AttachmentBar' }
        }])
        .select('id')
        .single()

      if (error) throw error

      // adiciona chip local
      addRefOne({ id: data.id, title: url.trim(), type: 'url', source_url: url.trim() })

      // dispara edge function (assíncrono)
      try {
        await supabase.functions.invoke('extract-reference-text', { body: { reference_id: data.id } })
      } catch (e: any) {
        console.warn('[AttachmentBar] extract-reference-text falhou (segue):', e?.message)
      }

      // reset UI
      setOpen(false)
      setMode(null)
      setUrl('')
    } catch (e: any) {
      console.error('[AttachmentBar] falha ao anexar URL:', e?.message)
      setUrlErr(e?.message || 'Falha ao anexar URL')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-white text-sm font-medium">Fontes (opcional)</div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={toggle}
            className="px-3 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 flex items-center gap-2"
            title="Adicionar fontes"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-700 bg-gray-800 shadow-xl z-20 overflow-hidden">
              <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
                Adicionar a partir de:
              </div>

              {/* Opção: Arquivos locais */}
              <button
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 text-gray-200"
                onClick={() => setMode((m) => (m === 'files' ? null : 'files'))}
              >
                <FileUp className="w-4 h-4 text-blue-300" />
                <span>Arquivos (PDF, DOCX, PPTX, XLSX, CSV, TXT, HTML)</span>
              </button>

              {mode === 'files' && (
                <div className="px-3 py-2 border-t border-gray-700 bg-gray-900">
                  <ReferenceUploader
                    userId={userId}
                    conversationId={conversationId}
                    onUploaded={(ref) => addRefOne(ref)}
                  />
                </div>
              )}

              {/* Opção: URL */}
              <button
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 text-gray-200 border-t border-gray-700"
                onClick={() => setMode((m) => (m === 'url' ? null : 'url'))}
              >
                <LinkIcon className="w-4 h-4 text-emerald-300" />
                <span>URL (artigo, página pública)</span>
              </button>

              {mode === 'url' && (
                <div className="px-3 py-3 border-t border-gray-700 bg-gray-900">
                  <label className="block text-xs text-gray-400 mb-1">
                    Cole a URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/artigo"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); if (urlErr) setUrlErr('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createUrlReference() } }}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  {urlErr && <div className="mt-1 text-xs text-red-400">{urlErr}</div>}
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setMode(null); setUrl(''); setUrlErr('') }}
                      className="px-3 py-2 text-sm rounded-lg hover:bg-gray-800 text-gray-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={createUrlReference}
                      disabled={busy}
                      className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{busy ? 'Adicionando…' : 'Adicionar'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chips */}
      {attached?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attached.map((r) => (
            <span
              key={r.id}
              className="px-2.5 py-1 text-xs rounded-full bg-blue-600/20 text-blue-300 border border-blue-600/30 flex items-center gap-2"
              title={r.title}
            >
              <span className="truncate max-w-[220px]">{r.title}</span>
              <button
                className="hover:text-white"
                onClick={() => removeRef(r.id)}
                title="Remover"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-500 mt-2">
        Tudo que você anexar aqui será analisado automaticamente pelo assistente (chat e geração).
      </p>
    </div>
  )
}
