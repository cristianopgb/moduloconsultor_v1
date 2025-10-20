// src/utils/html-sanitizer.ts
// Sanitização robusta + remoção de fences ```markdown + desembrulho de <template>

const SAFE_URL_SCHEMES = ["http:", "https:", "data:", "blob:"];
const SAFE_DATA_MIME_PREFIXES = ["data:image/", "data:font/"];

function isSafeUrl(url: string): boolean {
  if (!url) return true;
  try {
    if (
      url.startsWith("#") ||
      url.startsWith("/") ||
      url.startsWith("./") ||
      url.startsWith("../")
    )
      return true;
    const u = new URL(url, "https://example.com");
    const scheme = (u.protocol || "").toLowerCase();
    if (!SAFE_URL_SCHEMES.includes(scheme)) return false;
    if (scheme === "data:") {
      const lower = url.toLowerCase();
      return SAFE_DATA_MIME_PREFIXES.some((p) => lower.startsWith(p));
    }
    return true;
  } catch {
    return false;
  }
}

function sanitizeStyleElement(styleEl: HTMLStyleElement) {
  const css = styleEl.textContent || "";
  const blocked = /(javascript\s*:|data\s*:\s*text\/html)/gi;
  if (blocked.test(css)) {
    styleEl.textContent = css.replace(blocked, "/* blocked */");
  }
}

function stripMarkdownFences(s: string): string {
  // remove ```html ... ``` ou ``` ... ``` no início/fim
  return String(s)
    .replace(/^\s*```(?:html|xml)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
}

/** Desembrulha todos os <template>: substitui o <template> por seus nós internos */
function unwrapTemplates(doc: Document) {
  const templates = Array.from(doc.querySelectorAll("template")) as HTMLTemplateElement[];
  for (const t of templates) {
    const parent = t.parentNode;
    if (!parent) {
      t.remove();
      continue;
    }
    const nodes = Array.from(t.content.childNodes);
    for (const n of nodes) parent.insertBefore(n, t);
    t.remove();
  }
}

export function stripUnwantedScripts(inputHtml: string): string {
  if (!inputHtml) return "";

  // 0) tira fences markdown (causando ```html) e parseia
  const preclean = stripMarkdownFences(inputHtml);

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(String(preclean), "text/html");
  } catch {
    // fallback básico (string ops)
    return String(preclean)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<\/?(iframe|embed|object|noscript|foreignObject)\b[^>]*>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
      .replace(/\s(?:href|src)\s*=\s*(?:'|")?\s*javascript:[^'"]*(?:'|")?/gi, "")
      .replace(/\s(?:href|src)\s*=\s*(?:'|")?\s*data:\s*text\/html[^'"]*(?:'|")?/gi, "");
  }

  // 1) Desembrulha templates ANTES de remover coisas
  unwrapTemplates(doc);

  // 2) Remove elementos potencialmente executáveis
  const removeTags = ["script", "noscript", "iframe", "embed", "object", "foreignObject"];
  removeTags.forEach((tag) => doc.querySelectorAll(tag).forEach((el) => el.remove()));

  // remove preloads de script
  doc
    .querySelectorAll('link[rel="preload"][as="script"], link[as="script"]')
    .forEach((el) => el.remove());

  // remove meta refresh
  doc.querySelectorAll("meta[http-equiv]").forEach((el) => {
    const v = (el.getAttribute("http-equiv") || "").toLowerCase();
    if (v.includes("refresh")) el.remove();
  });

  // 3) Limpa atributos perigosos e URLs
  const treeWalker = doc.createTreeWalker(
    doc.documentElement || doc.body,
    NodeFilter.SHOW_ELEMENT
  );
  const toClean: Element[] = [];
  while (treeWalker.nextNode()) toClean.push(treeWalker.currentNode as Element);

  for (const el of toClean) {
    const attrs = Array.from(el.attributes);
    for (const a of attrs) {
      const name = a.name.toLowerCase();
      const val = (a.value || "").trim();

      if (name.startsWith("on")) {
        el.removeAttribute(a.name);
        continue;
      }

      if (name === "href" || name === "src" || name === "xlink:href") {
        const lower = val.toLowerCase().replace(/\s+/g, "");
        const isJs = lower.startsWith("javascript:");
        const isDataHtml = lower.startsWith("data:text/html");
        if (isJs || isDataHtml || !isSafeUrl(val)) el.removeAttribute(a.name);
      }

      if (name === "srcdoc") el.removeAttribute(a.name);
    }

    if (el.tagName.toLowerCase() === "style")
      sanitizeStyleElement(el as HTMLStyleElement);
  }

  // 4) Serializa
  const hasHtml = !!doc.documentElement?.outerHTML;
  if (hasHtml) return "<!doctype html>\n" + doc.documentElement.outerHTML;
  return doc.body?.innerHTML || "";
}

export default { stripUnwantedScripts };
