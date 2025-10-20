// /src/components/Chat/AdvancedPreview.tsx
// Mantém seu modal, mas agora confia que toPreviewUrl() gera BLOB URL sem CSP.
// Resultado: abrir em nova aba e o iframe do modal passam a rodar JS do template.
// Logs [DEBUG] mantidos.

import { useEffect, useMemo, useState } from 'react';
import { copyHtmlToClipboard, toPreviewUrl } from '../../utils/html';
import { Download, Copy, Eye, Maximize2, RotateCcw } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  documentTitle: string;
};

export function AdvancedPreview({ isOpen, onClose, htmlContent, documentTitle }: Props) {
  const [zoom, setZoom] = useState(1);
  const [localHtml, setLocalHtml] = useState(htmlContent);

  useEffect(() => { if (isOpen) setLocalHtml(htmlContent); }, [isOpen, htmlContent]);

  // >>> Agora toPreviewUrl SEMPRE devolve BLOB URL e SEM CSP.
  const url = useMemo(() => {
    if (!localHtml) return '';
    const { url } = toPreviewUrl(localHtml, `${documentTitle}.html`);
    console.log('[DEBUG] AdvancedPreview URL:', url?.slice(0, 60) + '...');
    return url;
  }, [localHtml, documentTitle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex flex-col">
      <div className="bg-gray-900 text-gray-200 p-3 border-b border-gray-800 flex items-center gap-2">
        <div className="font-semibold flex-1">{documentTitle}</div>

        <button
          onClick={() => window.open(url, '_blank')}
          className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded flex items-center gap-2"
          title="Abrir em nova aba"
        >
          <Eye className="w-4 h-4" /> Preview
        </button>

        <button
          onClick={() => copyHtmlToClipboard(localHtml)}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2"
          title="Copiar HTML"
        >
          <Copy className="w-4 h-4" /> Copiar
        </button>

        <a
          href={url || '#'}
          download={`${documentTitle}.html`}
          className="px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded flex items-center gap-2"
          title="Baixar HTML"
        >
          <Download className="w-4 h-4" /> Baixar
        </a>

        <div className="ml-2 flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="px-2 py-1 bg-gray-800 rounded">-</button>
          <span className="w-16 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="px-2 py-1 bg-gray-800 rounded">+</button>
          <button onClick={() => setZoom(1)} className="px-2 py-1 bg-gray-800 rounded flex items-center gap-1">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>

        <button onClick={onClose} className="ml-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded">Fechar</button>
      </div>

      {/* Iframe do modal: agora recebe BLOB URL sem CSP; aqui NÃO há sandbox, então os scripts do template rodam */}
      <div className="flex-1 bg-white overflow-hidden">
        {url ? (
          <iframe
            src={url}
            className="w-full h-full border-0 origin-top-left"
            style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">Sem conteúdo.</div>
        )}
      </div>
    </div>
  );
}

export default AdvancedPreview;
