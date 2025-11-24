import React from 'react'
import { Download, FileText, Image as ImageIcon, Table, File, Sparkles } from 'lucide-react'
import { Message, GeniusAttachment } from '../../lib/supabase'
import { GeniusProgressIndicator } from './GeniusProgressIndicator'
import { formatFileSize } from '../../utils/geniusValidation'

interface GeniusMessageRendererProps {
  message: Message
  onOpenAttachment: (attachment: GeniusAttachment) => void
  compact?: boolean // Modo minimalista para Analytics
}

// Helper para ícone por tipo MIME
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return <Table className="w-5 h-5" />
  if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="w-5 h-5" />
  return <File className="w-5 h-5" />
}

export function GeniusMessageRenderer({ message, onOpenAttachment, compact = false }: GeniusMessageRendererProps) {
  const hasAttachments = message.genius_attachments && message.genius_attachments.length > 0

  // Modo compact: versão visível mas minimalista para Analytics
  if (compact) {
    return (
      <div className="bg-gray-800/50 border-l-4 border-purple-500 rounded-lg p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">Análise Genius</span>
        </div>
        {message.genius_status && (
          <GeniusProgressIndicator
            status={message.genius_status as 'pending' | 'running' | 'completed' | 'failed'}
            createdAt={message.created_at}
            hasFiles={hasAttachments}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-purple-900/20 border-l-4 border-purple-500 rounded-lg p-6 shadow-lg">
      {/* Header com ícone Genius */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <h4 className="font-semibold text-purple-300">Análise Genius</h4>
      </div>

      {/* Status Indicator */}
      {message.genius_status && (
        <div className="mb-4">
          <GeniusProgressIndicator
            status={message.genius_status as 'pending' | 'running' | 'completed' | 'failed'}
            createdAt={message.created_at}
            hasFiles={hasAttachments}
          />
        </div>
      )}

      {/* Content */}
      {message.content && (
        <div className="text-gray-200 leading-relaxed whitespace-pre-wrap mb-4">
          {message.content}
        </div>
      )}

      {/* Attachments Grid */}
      {hasAttachments && (
        <div className="mt-6">
          <h5 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Documentos Gerados ({message.genius_attachments!.length})
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {message.genius_attachments!.map((att, idx) => (
              <button
                key={idx}
                onClick={() => onOpenAttachment(att)}
                className="flex items-center gap-3 p-4 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 hover:border-purple-500/50 rounded-lg transition-all group"
              >
                <div className="text-purple-400 group-hover:text-purple-300 transition-colors">
                  {getFileIcon(att.mime_type)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-white truncate group-hover:text-purple-200 transition-colors">
                    {att.file_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(att.size_bytes)}
                  </p>
                </div>
                <Download className="w-4 h-4 text-gray-400 group-hover:text-purple-300 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Credits Used */}
      {message.genius_credit_usage && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <p className="text-xs text-purple-400/70 text-right flex items-center justify-end gap-1">
            <Sparkles className="w-3 h-3" />
            Créditos utilizados: <strong>{message.genius_credit_usage}</strong>
          </p>
        </div>
      )}

      {/* Failed State */}
      {message.genius_status === 'failed' && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
          <p className="text-sm text-red-300">
            A análise Genius falhou. Tente novamente ou entre em contato com o suporte.
          </p>
        </div>
      )}
    </div>
  )
}
