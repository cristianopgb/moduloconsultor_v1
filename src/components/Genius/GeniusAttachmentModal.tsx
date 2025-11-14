import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Table,
  File,
  Edit3,
  Save,
  Eye,
  Code,
  FileDown,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GeniusAttachment } from '../../lib/supabase';
import { formatFileSize, daysUntilExpiry } from '../../utils/geniusValidation';
import {
  exportToWord,
  exportToPowerPoint,
  openInNewTab,
  downloadFile,
  isMarkdownFile,
  isTextFile
} from '../../utils/fileExporters';
import { ExcelPreview } from './ExcelPreview';
import '../../styles/markdown.css';

interface Props {
  attachment: GeniusAttachment;
  taskUrl?: string;
  onClose: () => void;
}

type ViewMode = 'preview' | 'edit' | 'raw';

export function GeniusAttachmentModal({ attachment, taskUrl, onClose }: Props) {
  const [previewError, setPreviewError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [fileContent, setFileContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(100);

  const canPreview = attachment.mime_type.startsWith('image/') || attachment.mime_type === 'application/pdf';
  const isMarkdown = isMarkdownFile(attachment.mime_type, attachment.file_name);
  const isText = isTextFile(attachment.mime_type, attachment.file_name);
  const isExcel = attachment.mime_type.includes('spreadsheet') ||
                  attachment.mime_type === 'text/csv' ||
                  attachment.file_name.endsWith('.csv') ||
                  attachment.file_name.endsWith('.xlsx') ||
                  attachment.file_name.endsWith('.xls');
  const canEdit = isMarkdown || isText;
  const daysLeft = daysUntilExpiry(attachment.expires_at);
  const isExpiringSoon = daysLeft < 2;

  useEffect(() => {
    if (isMarkdown || isText) {
      loadTextContent();
    }
  }, [attachment.url]);

  const loadTextContent = async () => {
    setLoading(true);
    try {
      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error('Failed to fetch content');
      const text = await response.text();
      setFileContent(text);
      setEditedContent(text);
    } catch (error) {
      console.error('Error loading file content:', error);
      setPreviewError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(attachment.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyContent = async () => {
    await navigator.clipboard.writeText(viewMode === 'edit' ? editedContent : fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportToWord = async () => {
    setExporting(true);
    try {
      const content = viewMode === 'edit' ? editedContent : fileContent;
      await exportToWord(content, attachment.file_name);
    } catch (error: any) {
      alert(error.message || 'Erro ao exportar para Word');
    } finally {
      setExporting(false);
    }
  };

  const handleExportToPowerPoint = async () => {
    setExporting(true);
    try {
      const content = viewMode === 'edit' ? editedContent : fileContent;
      await exportToPowerPoint(content, attachment.file_name);
    } catch (error: any) {
      alert(error.message || 'Erro ao exportar para PowerPoint');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenInNewTab = () => {
    try {
      openInNewTab(attachment.url, attachment.file_name);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      await downloadFile(attachment.url, attachment.file_name);
    } catch (error: any) {
      alert(error.message || 'Erro ao fazer download');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveEdit = () => {
    setFileContent(editedContent);
    setViewMode('preview');
  };

  const getIcon = () => {
    if (attachment.mime_type === 'application/pdf') return <FileText className="w-6 h-6" />;
    if (attachment.mime_type.startsWith('image/')) return <ImageIcon className="w-6 h-6" />;
    if (attachment.mime_type.includes('spreadsheet') || attachment.mime_type === 'text/csv')
      return <Table className="w-6 h-6" />;
    return <File className="w-6 h-6" />;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      );
    }

    if (viewMode === 'edit' && canEdit) {
      return (
        <div className="h-full">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-full min-h-[500px] p-4 bg-gray-900 text-gray-100 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
            placeholder="Edite o conteúdo aqui..."
          />
        </div>
      );
    }

    if (viewMode === 'raw' && (isMarkdown || isText)) {
      return (
        <pre className="w-full h-full min-h-[500px] p-4 bg-gray-900 text-gray-100 rounded-lg border border-gray-700 overflow-auto font-mono text-sm whitespace-pre-wrap">
          {fileContent}
        </pre>
      );
    }

    if (isMarkdown && fileContent) {
      return (
        <div className="markdown-content p-6 bg-gray-900 rounded-lg">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fileContent}
          </ReactMarkdown>
        </div>
      );
    }

    if (isText && fileContent) {
      return (
        <pre className="w-full p-4 bg-gray-900 text-gray-100 rounded-lg border border-gray-700 overflow-auto font-mono text-sm whitespace-pre-wrap">
          {fileContent}
        </pre>
      );
    }

    if (isExcel) {
      return <ExcelPreview fileUrl={attachment.url} fileName={attachment.file_name} />;
    }

    if (canPreview && !previewError) {
      if (attachment.mime_type.startsWith('image/')) {
        return (
          <div className="flex flex-col items-center justify-center space-y-4">
            <img
              src={attachment.url}
              alt={attachment.file_name}
              onError={() => setPreviewError(true)}
              className="max-w-full h-auto rounded-lg"
              style={{ transform: `scale(${zoom / 100})`, transition: 'transform 0.2s' }}
            />
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
              <button
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                className="p-2 hover:bg-gray-700 rounded transition"
                title="Diminuir zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm px-3">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className="p-2 hover:bg-gray-700 rounded transition"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(100)}
                className="p-2 hover:bg-gray-700 rounded transition"
                title="Resetar zoom"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      }

      return (
        <iframe
          src={attachment.url}
          onError={() => setPreviewError(true)}
          className="w-full h-full min-h-[500px] rounded-lg border border-gray-700"
          title={attachment.file_name}
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <File className="w-16 h-16 mb-4 text-gray-600" />
        <p>Preview não disponível para este formato</p>
        <p className="text-sm mt-1">Use o botão Baixar para obter o arquivo</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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

          {canEdit && (
            <div className="flex items-center gap-1 mr-3">
              <button
                onClick={() => setViewMode('preview')}
                className={`p-2 rounded transition ${
                  viewMode === 'preview' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'
                }`}
                title="Visualizar"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`p-2 rounded transition ${
                  viewMode === 'raw' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'
                }`}
                title="Código fonte"
              >
                <Code className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('edit')}
                className={`p-2 rounded transition ${
                  viewMode === 'edit' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400'
                }`}
                title="Editar"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">{renderContent()}</div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-gray-700 bg-gray-900/50">
          <div className="flex items-center gap-2">
            {viewMode === 'edit' && (
              <button
                onClick={handleSaveEdit}
                disabled={editedContent === fileContent}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Alterações
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(isMarkdown || isText) && (
              <button
                onClick={handleCopyContent}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copiado!' : 'Copiar Texto'}
              </button>
            )}

            {isMarkdown && (
              <>
                <button
                  onClick={handleExportToWord}
                  disabled={exporting}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Word
                </button>
                <button
                  onClick={handleExportToPowerPoint}
                  disabled={exporting}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  PPT
                </button>
              </>
            )}

            <button
              onClick={handleOpenInNewTab}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Nova Aba
            </button>

            {taskUrl && (
              <button
                onClick={() => window.open(taskUrl, '_blank')}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Manus
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={exporting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center gap-2"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Baixar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
