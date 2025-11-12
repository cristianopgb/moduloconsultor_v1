// src/components/Genius/GeniusAttachmentModal.tsx
import React from 'react';
import { X, Download, Copy, ExternalLink, FileText, Image as ImageIcon, Table, File } from 'lucide-react';
import { GeniusAttachment } from '../../lib/supabase';
import { formatFileSize, daysUntilExpiry } from '../../utils/geniusValidation';

interface Props {
  attachment: GeniusAttachment;
  taskUrl?: string;
  onClose: () => void;
}

export function GeniusAttachmentModal({ attachment, taskUrl, onClose }: Props) {
  const [previewError, setPreviewError] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const canPreview = attachment.mime_type.startsWith('image/') || attachment.mime_type === 'application/pdf';
  const daysLeft = daysUntilExpiry(attachment.expires_at);
  const isExpiringSoon = daysLeft < 2;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(attachment.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIcon = () => {
    if (attachment.mime_type === 'application/pdf') return <FileText className="w-6 h-6" />;
    if (attachment.mime_type.startsWith('image/')) return <ImageIcon className="w-6 h-6" />;
    if (attachment.mime_type.includes('spreadsheet') || attachment.mime_type === 'text/csv')
      return <Table className="w-6 h-6" />;
    return <File className="w-6 h-6" />;
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-blue-400">{getIcon()}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{attachment.file_name}</h3>
              <p className="text-sm text-gray-400">
                {formatFileSize(attachment.size_bytes)}
                {attachment.expires_at && (
                  <span className={`ml-2 ${isExpiringSoon ? 'text-orange-400' : 'text-gray-500'}`}>
                    • Expira em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {canPreview && !previewError ? (
            attachment.mime_type.startsWith('image/') ? (
              <img
                src={attachment.url}
                alt={attachment.file_name}
                onError={() => setPreviewError(true)}
                className="max-w-full h-auto rounded-lg"
              />
            ) : (
              <iframe
                src={attachment.url}
                onError={() => setPreviewError(true)}
                className="w-full h-full min-h-[500px] rounded-lg border border-gray-700"
                title={attachment.file_name}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <File className="w-16 h-16 mb-4 text-gray-600" />
              <p>Preview não disponível para este formato</p>
              <p className="text-sm mt-1">Use o botão Baixar para obter o arquivo</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700 bg-gray-900/50">
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copiado!' : 'Copiar Link'}
          </button>

          {taskUrl && (
            <button
              onClick={() => window.open(taskUrl, '_blank')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir no Manus
            </button>
          )}

          <a
            href={attachment.url}
            download={attachment.file_name}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Baixar
          </a>
        </div>
      </div>
    </div>
  );
}
