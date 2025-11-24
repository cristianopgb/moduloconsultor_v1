// web/src/components/Consultor/BpmnViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import Viewer from 'bpmn-js/lib/Viewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { ProgressIndicator } from '../Chat/ProgressIndicator';

interface BpmnViewerProps {
  xml: string;
  highlights?: string[];   // IDs de elementos para destacar
  title?: string;
}

export function BpmnViewer({
  xml,
  highlights = [],
  title = 'Fluxo BPMN - AS-IS'
}: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cria o viewer UMA vez
  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return;
    if (!containerRef.current) return;

    viewerRef.current = new Viewer({
      container: containerRef.current
    });

    // Ajuste de viewport em redimensionamento do container
    if ('ResizeObserver' in window) {
      resizeObsRef.current = new ResizeObserver(() => {
        try {
          const canvas = viewerRef.current?.get('canvas');
          canvas?.zoom('fit-viewport');
        } catch { /* noop */ }
      });
      resizeObsRef.current.observe(containerRef.current);
    } else {
      // Fallback: ouve resize global
      const onWinResize = () => {
        try {
          const canvas = viewerRef.current?.get('canvas');
          canvas?.zoom('fit-viewport');
        } catch { /* noop */ }
      };
      window.addEventListener('resize', onWinResize);
      // cleanup para o fallback
      (resizeObsRef as any).current = {
        disconnect: () => window.removeEventListener('resize', onWinResize)
      };
    }

    return () => {
      try {
        resizeObsRef.current?.disconnect();
      } catch { /* noop */ }
      resizeObsRef.current = null;

      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch { /* noop */ }
        viewerRef.current = null;
      }
    };
  }, []);

  // Importa o XML sempre que mudar
  useEffect(() => {
    const doImport = async () => {
      if (!viewerRef.current) return;

      setIsLoading(true);
      setError(null);

      try {
        const xmlClean = (xml || '').trim();
        if (!xmlClean || xmlClean.length < 20) {
          setError('Nenhum XML BPMN válido para exibir.');
          setIsLoading(false);
          return;
        }

        await viewerRef.current.importXML(xmlClean);

        const canvas = viewerRef.current.get('canvas');

        // limpa marcadores anteriores
        try {
          const elementRegistry = viewerRef.current.get('elementRegistry');
          elementRegistry.getAll().forEach((el: any) => {
            canvas.removeMarker(el.id, 'highlight-gap');
          });
        } catch { /* noop */ }

        // aplica novos highlights (se houver)
        if (highlights && highlights.length > 0) {
          try {
            const elementRegistry = viewerRef.current.get('elementRegistry');
            highlights.forEach((elementId) => {
              const el = elementRegistry.get(elementId);
              if (el) canvas.addMarker(elementId, 'highlight-gap');
            });
          } catch (e) {
            console.warn('[BPMN] não foi possível aplicar highlights', e);
          }
        }

        // Ajuste de viewport
        try {
          canvas.zoom('fit-viewport');
        } catch { /* noop */ }

        setIsLoading(false);
      } catch (e) {
        console.error('[BPMN] erro ao importar XML', e);
        setError('Erro ao carregar diagrama BPMN');
        setIsLoading(false);
      }
    };

    // Debounce pequeno evita jitter em atualizações rápidas
    const t = setTimeout(doImport, 50);
    return () => clearTimeout(t);
  }, [xml, highlights]);

  const getCanvas = () => viewerRef.current?.get('canvas');

  const handleZoomIn = () => {
    const canvas: any = getCanvas();
    if (!canvas) return;
    const current = canvas.zoom();
    const base = typeof current === 'number' ? current : 1;
    canvas.zoom(Math.min(base + 0.1, 2));
  };

  const handleZoomOut = () => {
    const canvas: any = getCanvas();
    if (!canvas) return;
    const current = canvas.zoom();
    const base = typeof current === 'number' ? current : 1;
    canvas.zoom(Math.max(base - 0.1, 0.2));
  };

  const handleZoomFit = () => {
    try {
      getCanvas()?.zoom('fit-viewport');
    } catch { /* noop */ }
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-[#0b1020]">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between bg-[#0f1426]">
        <h4 className="font-medium text-gray-100">{title}</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-gray-800 rounded transition-colors"
            title="Diminuir zoom"
          >
            <ZoomOut className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={handleZoomFit}
            className="p-1.5 hover:bg-gray-800 rounded transition-colors"
            title="Ajustar à tela"
          >
            <Maximize2 className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-gray-800 rounded transition-colors"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-96">
          <ProgressIndicator
            messages={['Carregando diagrama...']}
            icon="spinner"
            size="md"
          />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-96">
          <div className="text-center text-red-400">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '600px',
          display: isLoading || error ? 'none' : 'block'
        }}
      />

      <style>{`
        /* destaque de elementos marcados */
        .highlight-gap .djs-visual > :nth-child(1) {
          stroke: #ef4444 !important;
          stroke-width: 3px !important;
          fill: #fef2f2 !important;
        }
        /* fundo escuro agradável */
        .djs-container { background-color: #0b1020; }
      `}</style>
    </div>
  );
}
