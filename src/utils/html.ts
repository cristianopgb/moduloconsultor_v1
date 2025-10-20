// /src/utils/html.ts
// >>> Correção FATAL: remover CSP que bloqueava scripts e padronizar preview como BLOB URL.
// Mantém API compatível com seu código existente (wrapHtmlForPreview, toPreviewUrl, getLastDoc, copyHtmlToClipboard, downloadFromWindow).
// Logs [DEBUG] mantidos.

let lastDoc: { fileName: string; content: string } | null = null;

/** CSS por formato (A4 / 16:9) — sem injetar CSP. */
function sizeCssFor(mode: "a4" | "widescreen") {
  return mode === "a4"
    ? `.page{width:210mm;min-height:297mm;margin:0 auto;box-sizing:border-box;}
html,body{height:100%;min-height:100vh;margin:0;padding:0;}
*{box-sizing:border-box;}
@page{size:A4;margin:12mm;}`
    : `.page{width:1280px;min-height:720px;margin:0 auto;box-sizing:border-box;}
html,body{height:100%;min-height:100vh;margin:0;padding:0;}
*{box-sizing:border-box;}`;
}

/** Elementos adicionais no <head>: apenas o <style> com o tamanho da página. (SEM CSP) */
function buildHeadExtras(sizeCss: string) {
  return `<style id="preview-size">${sizeCss}</style>`;
}

/** Remove meta CSP (se vier no HTML original). */
function stripCsp(html: string) {
  return (html || "").replace(
    /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>\s*/gi,
    ""
  );
}

/** Remove `href="javascript:..."` por segurança básica, sem tocar em <script> do template. */
function stripHrefJavascript(html: string) {
  return (html || "").replace(
    /href\s*=\s*["']\s*javascript:[^"']*["']/gi,
    'href="#"'
  );
}

/** Extrai innerHTML do <body> se existir; caso contrário devolve todo HTML. */
function extractBodyOrAll(input: string) {
  const cleaned = input || "";
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1] || "";
  return cleaned
    .replace(/^\s*<!doctype[^>]*>/i, "")
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .trim();
}

/** Constrói um HTML mínimo envolvendo o conteúdo do body e aplicando o CSS do formato. */
function minimalDoc(sizeCss: string, bodyContent: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Preview</title>
  ${buildHeadExtras(sizeCss)}
</head>
<body class="page">
${bodyContent || "<div/>"}
</body>
</html>`;
}

/** Empacota o HTML para preview, aplicando CSS de tamanho e SEM inserir CSP. */
export function wrapHtmlForPreview(
  input: string,
  mode: "a4" | "widescreen" = "a4"
): string {
  try {
    const sizeCss = sizeCssFor(mode);
    let html = stripCsp(stripHrefJavascript(input || ""));

    // Se já tiver <head> e <body>, só injeta o <style> e adiciona class="page" no body.
    if (/<html[^>]*>/i.test(html) && /<body[^>]*>/i.test(html)) {
      if (html.match(/<\/head>/i)) {
        html = html.replace(/<\/head>/i, `${buildHeadExtras(sizeCss)}</head>`);
      } else {
        html = html.replace(
          /<html[^>]*>/i,
          (m) => `${m}<head>${buildHeadExtras(sizeCss)}</head>`
        );
      }
      html = html.replace(/<body([^>]*)>/i, (m, attrs) => {
        const hasClass = /\bclass\s*=\s*(['"])(.*?)\1/i.test(attrs);
        if (hasClass) {
          return `<body${attrs.replace(
            /\bclass\s*=\s*(['"])(.*?)\1/i,
            (_mm, q, val) => ` class=${q}${val} page${q}`
          )}>`;
        }
        return `<body${attrs} class="page">`;
      });

      // Se o body estiver vazio, trata como fragmento
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const inside = bodyMatch?.[1] ?? "";
      if (!inside || inside.replace(/\s+/g, "").length === 0) {
        const frag = extractBodyOrAll(input || "");
        return minimalDoc(sizeCss, frag);
      }
      return html;
    }

    // Caso não tenha estrutura completa, monta uma doc mínima
    const frag = extractBodyOrAll(input || "");
    return minimalDoc(sizeCss, frag);
  } catch (e) {
    console.error("[utils/html] wrapHtmlForPreview erro:", (e as Error)?.message);
    // fallback — documento mínimo neutro
    return minimalDoc(sizeCssFor(mode), extractBodyOrAll(input || ""));
  }
}

/** Gera SEMPRE Blob URL (sem DATA URL) e guarda lastDoc para downloads. */
export function toPreviewUrl(
  fullHtml: string,
  fileName = "documento.html"
): { url: string; size: number } {
  try {
    const html = stripCsp(stripHrefJavascript(fullHtml || ""));
    lastDoc = { fileName, content: html };
    const size = html.length;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    console.debug("[DEBUG] toPreviewUrl gerado (blob)", { fileName, size, urlKind: "blob" });
    return { url, size };
  } catch (e) {
    console.error("[utils/html] toPreviewUrl erro:", (e as Error)?.message);
    return { url: "", size: 0 };
  }
}

export function getLastDoc() {
  return lastDoc;
}

/** Copia HTML (text/html) para a área de transferência quando suportado. */
export async function copyHtmlToClipboard(data: string) {
  if (!data) return;
  try {
    if (
      "clipboard" in navigator &&
      "write" in navigator.clipboard &&
      typeof (window as any).ClipboardItem !== "undefined"
    ) {
      const blob = new Blob([data], { type: "text/html" });
      const item = new (window as any).ClipboardItem({ "text/html": blob });
      await (navigator.clipboard as any).write([item]);
      return;
    }
  } catch {}
  const ta = document.createElement("textarea");
  ta.value = data;
  ta.style.position = "fixed";
  ta.style.left = "-10000px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/** Faz download do que estiver no `window.generatedDocument` (fallback para lastDoc). */
export function downloadFromWindow(
  win?: Window | null,
  fallbackName = "documento.html"
) {
  try {
    const ctx = (win || window) as any;
    const gd = ctx?.generatedDocument;
    if (!gd || !gd.content) {
      if (lastDoc?.content) {
        const blob = new Blob([lastDoc.content], {
          type: "text/html;charset=utf-8",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = lastDoc.fileName || fallbackName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
      } else {
        console.warn("[downloadFromWindow] Nada para baixar.");
      }
      return;
    }
    const fileName =
      (typeof gd.filename === "string" && gd.filename) || fallbackName;
    const mime =
      (typeof gd.mime === "string" && gd.mime) || "text/html;charset=utf-8";
    const content = String(gd.content || "");
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  } catch (e) {
    console.error("[downloadFromWindow] erro:", e);
  }
}

export default {
  wrapHtmlForPreview,
  toPreviewUrl,
  getLastDoc,
  copyHtmlToClipboard,
  downloadFromWindow,
};
