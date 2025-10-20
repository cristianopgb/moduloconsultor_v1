// /src/lib/exporters.ts
// Exporta funções de download em HTML, PDF, DOCX, PPTX, XLSX
// Sem imports estáticos — usamos imports dinâmicos via CDN (+esm) para evitar
// "Outdated Optimize Dep" do Vite e manter a UI carregando rápido.

type AnyFn = (...a: any[]) => any;

// Helpers básicos
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function htmlToElement(html: string): HTMLElement {
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.left = '-99999px'; // fora da tela
  div.style.top = '0';
  div.style.width = '800px';
  div.style.background = '#fff';
  div.innerHTML = html;
  document.body.appendChild(div);
  // Se veio documento completo, pega o body
  const body = div.querySelector('body');
  return (body as HTMLElement) || div;
}

// -------------- HTML --------------
export async function downloadAsHtml(html: string, fileBase: string) {
  const name = fileBase.endsWith('.html') ? fileBase : `${fileBase}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  saveBlob(blob, name);
}

// -------------- PDF --------------
export async function downloadAsPdf(html: string, fileBase: string) {
  // Usa html2pdf.js (bundla html2canvas + jspdf). Import dinâmico via CDN com wrapper ESM.
  const [{ default: html2pdf }] = await Promise.all([
    import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/+esm'),
  ]);

  const el = htmlToElement(html);
  try {
    // @ts-ignore html2pdf types
    await html2pdf()
      .set({
        margin:       [10, 10, 10, 10],
        filename:     fileBase.endsWith('.pdf') ? fileBase : `${fileBase}.pdf`,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] },
      })
      .from(el)
      .save();
  } finally {
    el.remove();
  }
}

// -------------- DOCX --------------
export async function downloadAsDocx(html: string, fileBase: string) {
  // html-docx-js é UMD; usamos +esm para virar ESM.
  // A lib exporta uma função window.htmlDocx — no wrapper ESM expõe default e nomeado.
  const mod: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/html-docx-js@0.4.1/dist/html-docx.min.js/+esm');
  const htmlDocx: AnyFn = mod?.default?.asBlob || mod?.asBlob || (mod?.default && mod.default) || mod;

  if (typeof htmlDocx !== 'function') {
    throw new Error('Falha ao carregar html-docx-js');
  }

  // Garante um HTML minimamente válido
  const content = /^\s*<!doctype|<html/i.test(html)
    ? html
    : `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>${html}</body></html>`;

  const blob: Blob = htmlDocx(content, { orientation: 'portrait', margins: { top: 720, right: 720, bottom: 720, left: 720 } });
  const name = fileBase.endsWith('.docx') ? fileBase : `${fileBase}.docx`;
  saveBlob(blob, name);
}

// -------------- PPTX --------------
export async function downloadAsPptx(html: string, fileBase: string) {
  // pptxgenjs tem build ESM no CDN
  const { default: PptxGenJS }: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm');

  const pptx = new PptxGenJS();
  pptx.author = 'Manus';
  pptx.company = 'Manus';
  pptx.layout = 'LAYOUT_16x9';

  // Estratégia simples: quebrar em slides por <h1>, <h2> ou <section>
  const container = document.createElement('div');
  container.innerHTML = html;
  const body = (container.querySelector('body') as HTMLElement) || container;

  // Coleta blocos
  const blocks: { title: string; body: string }[] = [];
  let current: { title: string; body: string } | null = null;

  const nodes = Array.from(body.querySelectorAll('h1,h2,section,p,li,div'));
  nodes.forEach((node) => {
    const tag = node.tagName.toLowerCase();
    const text = (node as HTMLElement).innerText?.trim() || '';
    if (!text) return;

    if (tag === 'h1' || tag === 'h2' || tag === 'section') {
      if (current) blocks.push(current);
      current = { title: text, body: '' };
    } else {
      if (!current) current = { title: 'Slide', body: '' };
      current.body += (current.body ? '\n' : '') + text;
    }
  });
  if (current) blocks.push(current);
  if (blocks.length === 0) blocks.push({ title: 'Documento', body: body.innerText || '' });

  // Monta slides
  const masterMargin = { x: 0.5, y: 0.6, w: 9, h: 5 };
  blocks.slice(0, 40).forEach((b) => {
    const slide = pptx.addSlide();
    slide.addText(b.title, { x: 0.5, y: 0.5, fontSize: 28, bold: true });
    slide.addText(b.body, { x: masterMargin.x, y: 1.2, w: masterMargin.w, h: masterMargin.h, fontSize: 16, lineSpacing: 18 });
  });

  const name = fileBase.endsWith('.pptx') ? fileBase : `${fileBase}.pptx`;
  await pptx.writeFile({ fileName: name });
}

// -------------- XLSX --------------
export async function downloadAsXlsx(html: string, fileBase: string) {
  // Usa SheetJS (xlsx) via CDN +esm
  const XLSX: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');

  // Estratégia:
  // 1) Se houver <table> no HTML, converte a primeira tabela.
  // 2) Senão, despeja o texto como A1.
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const table = tmp.querySelector('table') as HTMLTableElement | null;

  const wb = XLSX.utils.book_new();

  if (table) {
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  } else {
    const text = (tmp.textContent || '').trim();
    const ws = XLSX.utils.aoa_to_sheet([[text || '']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Documento');
  }

  const name = fileBase.endsWith('.xlsx') ? fileBase : `${fileBase}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveBlob(blob, name);
}
