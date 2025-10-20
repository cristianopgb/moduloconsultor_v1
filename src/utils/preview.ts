// /src/utils/preview.ts
// Utilitário para abrir HTML REAL (gerado pela LLM) em nova aba via Blob URL, sem CSP bloqueando scripts.
// Inclui "wrap" de formato (A4/16:9) via CSS simples e sanitização mínima do href.
// Logs [DEBUG] incluídos.

export type PageFormat = 'A4' | '16:9';

function sanitizeHref(html: string): string {
  // Evita javascript: em links (proteção básica sem quebrar seu JS interno do template)
  return html.replace(/href\s*=\s*["']\s*javascript:[^"']+["']/gi, 'href="#"');
}

function injectFormatCss(html: string, format: PageFormat): string {
  // Aplica CSS de página conforme formato, sem impedir seu <script> interno.
  // Não adiciona CSP; apenas estilos.
  const pageCss =
    format === 'A4'
      ? `
      /* A4 retrato */
      @media print { @page { size: A4; margin: 12mm; } }
      .doc-page { width: 210mm; min-height: 297mm; margin: 0 auto; }
      .doc-container { display: flex; justify-content: center; }
      body { background: #f4f4f5; }
    `
      : `
      /* 16:9 tela */
      .doc-page { width: 1280px; min-height: 720px; margin: 0 auto; }
      .doc-container { display: flex; justify-content: center; }
      body { background: #0b0b0c; }
    `;

  // Envelopa o body do HTML existente sem mexer nos scripts do template.
  // Se o documento já tiver body, inserimos uma "doc-container/doc-page".
  const hasBody = /<body[^>]*>/i.test(html);
  const styleTag = `<style id="__formatStyle">${pageCss}</style>`;

  if (hasBody) {
    const htmlSan = sanitizeHref(html);
    const result = htmlSan
      .replace(/<head[^>]*>/i, (m) => `${m}\n${styleTag}`)
      .replace(
        /<body([^>]*)>/i,
        (_m, attrs) => `<body$1><div class="doc-container"><div class="doc-page">`
      )
      .replace(/<\/body>\s*$/i, `</div></div></body>`);
    return result;
  }

  // Se não tiver <body>, criamos uma estrutura mínima respeitando seu HTML original dentro da doc-page
  const safe = sanitizeHref(html);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
${styleTag}
</head>
<body>
<div class="doc-container"><div class="doc-page">
${safe}
</div></div>
</body>
</html>`;
}

export function openInNewTabWithBlob(html: string, format: PageFormat = 'A4') {
  try {
    console.log('[DEBUG] openInNewTabWithBlob: início', { length: html?.length, format });
    if (!html || typeof html !== 'string') {
      alert('Nenhum HTML gerado para pré-visualizar.');
      console.error('[DEBUG] HTML inválido/indefinido.');
      return;
    }
    const wrapped = injectFormatCss(html, format);
    const blob = new Blob([wrapped], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    console.log('[DEBUG] Blob URL gerada:', url);
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      alert('Não foi possível abrir nova aba. Permita popups para este site.');
      console.warn('[DEBUG] window.open retornou null (popup bloqueado?)');
    }
    // Revoga após alguns segundos (a aba já terá carregado o conteúdo).
    setTimeout(() => {
      URL.revokeObjectURL(url);
      console.log('[DEBUG] Blob URL revogada');
    }, 15000);
  } catch (e) {
    console.error('[DEBUG] Erro ao abrir preview em nova aba:', e);
    alert('Erro ao abrir o preview em nova aba.');
  }
}

export function downloadAsHtml(html: string, filename = 'documento.html', format: PageFormat = 'A4') {
  console.log('[DEBUG] downloadAsHtml', { filename, format });
  const wrapped = injectFormatCss(html, format);
  const blob = new Blob([wrapped], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
