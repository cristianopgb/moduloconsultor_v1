// /src/components/Chat/PreviewActions.tsx
// Botões prontos para usar com o HTML final retornado da função do Supabase.
// Mostra "Abrir em nova aba" (preview real) e botões de download (HTML, PDF, DOCX, PPTX, XLSX).

import { useMemo } from 'react';
import { openHtmlPreview } from '../../lib/openHtmlPreview'; // <- corrigido: caminho relativo
import {
  downloadAsDocx,
  downloadAsPptx,
  downloadAsXlsx,
  downloadAsPdf,
  downloadAsHtml,
} from '../../lib/exporters'; // <- já estava relativo

type Props = {
  html: string;          // HTML COMPLETO que você já recebe no [DONE]
  fileName?: string;     // nome base do arquivo (sem extensão)
  disabled?: boolean;    // opcional: desabilitar enquanto gera
};

export default function PreviewActions({ html, fileName = 'documento', disabled }: Props) {
  const sizeInfo = useMemo(() => {
    const len = (html ?? '').length;
    const hasBody = /<body[\s\S]*?>/i.test(html || '');
    const hasHtml = /<html[\s\S]*?>/i.test(html || '');
    return { len, hasBody, hasHtml };
  }, [html]);

  async function handlePreview() {
    openHtmlPreview(html, `${fileName}.html`);
  }

  async function handleDownloadHtml() {
    await downloadAsHtml(html, fileName);
  }

  async function handleDownloadPdf() {
    await downloadAsPdf(html, fileName);
  }

  async function handleDownloadDocx() {
    await downloadAsDocx(html, fileName);
  }

  async function handleDownloadPptx() {
    await downloadAsPptx(html, fileName);
  }

  async function handleDownloadXlsx() {
    await downloadAsXlsx(html, fileName);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg bg-gray-900/50">
      <button
        onClick={handlePreview}
        disabled={disabled || !html}
        className="px-3 py-2 rounded-lg border hover:bg-gray-100/10 disabled:opacity-50 text-white"
        title="Abrir prévia em nova aba"
      >
        👁️ Abrir prévia
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      <button
        onClick={handleDownloadHtml}
        disabled={disabled || !html}
        className="px-3 py-2 rounded-lg border hover:bg-gray-100/10 disabled:opacity-50 text-white"
        title="Baixar em HTML"
      >
        📥 HTML
      </button>
      <button
        onClick={handleDownloadPdf}
        disabled={disabled || !html}
        className="px-3 py-2 rounded-lg border hover:bg-gray-100/10 disabled:opacity-50 text-white"
        title="Baixar em PDF"
      >
        📄 PDF
      </button>
      <button
        onClick={handleDownloadDocx}
        disabled={disabled || !html}
        className="px-3 py-2 rounded-lg border hover:bg-gray-100/10 disabled:opacity-50 text-white"
        title="Baixar em Word (.docx)"
      >
        📝 Word
      </button>
      <button
        onClick={handleDownloadPptx}
        disabled={disabled || !html}
        className="px-3 py-2 rounded-lg border hover:bg-gray-100/10 disabled:opacity-50 text-white"
        title="Baixar em PowerPoint (.pptx)"
      >
        📊 PPT
      </button>
      <button
        onClick={handleDownloadXlsx}
        disabled={disabled || !html}
        className="px-3 py-2 rounded-lg border hover:bg-gray-100/10 disabled:opacity-50 text-white"
        title="Baixar em Excel (.xlsx)"
      >
        📈 Excel
      </button>

      <div className="text-xs text-gray-400 ml-2">
        len: {sizeInfo.len} • html: {String(sizeInfo.hasHtml)} • body: {String(sizeInfo.hasBody)}
      </div>
    </div>
  );
}
