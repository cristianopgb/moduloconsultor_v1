// /src/utils/exporters.ts
// Exportadores 100% browser-safe (sem dependência de Node core).
// DOCX com "docx", PPTX com ESM via CDN e HTML via Blob.

import { saveAs } from 'file-saver'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from 'docx'

// --------- loader ESM (CDN) para PPTX ---------
async function loadPptxGen() {
  // ESM oficial do pptxgenjs (evita jszip de node_modules)
  const mod: any = await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.es.min.js/+esm'
  )
  return mod?.default || mod
}

// ---------- Util: baixar Blob ----------
function downloadBlob(blob: Blob, fileName: string) {
  saveAs(blob, fileName)
}

// ---------- Exportar HTML (como arquivo .html) ----------
export function downloadHtml(fullHtml: string, fileName = 'Documento.html') {
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, fileName)
}

// ---------- Helpers de parsing de HTML ----------
function parseHtmlToBlocks(html: string) {
  const parser = new DOMParser()
  // Garantir um HTML “fechado” mínimo
  const doc = parser.parseFromString(
    /^<!doctype|<html/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`,
    'text/html'
  )

  // Preferir conteúdo do usuário se houver wrapper .preview-content
  const container =
    (doc.querySelector('.preview-content') as HTMLElement) ||
    (doc.body as HTMLElement)

  // Estratégia:
  // - Cada <h1..h6>, <p> e <li> vira um “bloco”
  // - Se houver <section>, tratamos como agrupador lógico (útil para PPT)
  const blocks: { type: 'heading' | 'paragraph' | 'bullet'; level?: number; text: string }[] = []

  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()

      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag[1])
        const text = (el.textContent || '').trim()
        if (text) blocks.push({ type: 'heading', level, text })
      } else if (tag === 'li') {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (text) blocks.push({ type: 'bullet', text })
      } else if (tag === 'p') {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (text) blocks.push({ type: 'paragraph', text })
      }
    }
  }

  // Fallback: se não encontrou nada, use o body como um parágrafo
  if (blocks.length === 0) {
    const text = (container.textContent || '').trim()
    if (text) blocks.push({ type: 'paragraph', text })
  }

  return blocks
}

function headingLevelToDocx(level?: number): HeadingLevel {
  switch (level) {
    case 1: return HeadingLevel.TITLE
    case 2: return HeadingLevel.HEADING_1
    case 3: return HeadingLevel.HEADING_2
    case 4: return HeadingLevel.HEADING_3
    case 5: return HeadingLevel.HEADING_4
    default: return HeadingLevel.HEADING_5
  }
}

// ---------- Exportar DOCX ----------
export async function downloadDocx(fullHtml: string, fileName = 'Documento.docx') {
  const blocks = parseHtmlToBlocks(fullHtml)

  const paragraphs: Paragraph[] = []
  for (const b of blocks) {
    if (b.type === 'heading') {
      paragraphs.push(
        new Paragraph({
          heading: headingLevelToDocx(b.level),
          children: [new TextRun({ text: b.text, bold: true })],
          spacing: { after: 240 },
        })
      )
    } else if (b.type === 'bullet') {
      paragraphs.push(
        new Paragraph({
          text: b.text,
          bullet: { level: 0 },
          spacing: { after: 120 },
        })
      )
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(b.text)],
          spacing: { after: 200 },
        })
      )
    }
  }

  // Documento
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: paragraphs.length
        ? paragraphs
        : [new Paragraph({ children: [new TextRun('')], alignment: AlignmentType.LEFT })],
    }],
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, fileName)
}

// ---------- Exportar PPTX ----------
export async function downloadPptx(fullHtml: string, fileName = 'Apresentacao.pptx') {
  const PptxGenJS: any = await loadPptxGen()
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    /^<!doctype|<html/i.test(fullHtml) ? fullHtml : `<!doctype html><html><body>${fullHtml}</body></html>`,
    'text/html'
  )
  const container =
    (doc.querySelector('.preview-content') as HTMLElement) ||
    (doc.body as HTMLElement)

  // Se existir <section>, cada uma vira um slide.
  // Senão, criamos slides por agrupamento simples: primeiro heading = título,
  // parágrafos/listas = conteúdo.
  const sections = Array.from(container.querySelectorAll('section'))

  const pptx = new PptxGenJS()
  pptx.layout = 'WIDE' // 16:9 (combina com seu preview 16:9)

  const createSlideFromElement = (el: HTMLElement, index: number) => {
    const slide = pptx.addSlide()
    const titleEl =
      (el.querySelector('h1,h2,h3') as HTMLElement) ||
      (container.querySelector('h1,h2,h3') as HTMLElement)

    const title = (titleEl?.textContent || `Slide ${index + 1}`).trim()

    // Título
    slide.addText(title, {
      x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 28, bold: true,
    })

    // Conteúdo (pega parágrafos e bullets)
    const bullets: string[] = []
    const paras: string[] = []

    el.querySelectorAll('li').forEach(li => {
      const t = (li.textContent || '').replace(/\s+/g, ' ').trim()
      if (t) bullets.push(t)
    })
    el.querySelectorAll('p').forEach(p => {
      const t = (p.textContent || '').replace(/\s+/g, ' ').trim()
      if (t) paras.push(t)
    })

    const content = bullets.length
      ? bullets.map(b => `• ${b}`).join('\n')
      : paras.join('\n\n')

    if (content) {
      slide.addText(content, {
        x: 0.5, y: 1.4, w: 9, h: 4.8, fontSize: 16,
      })
    }
  }

  if (sections.length > 0) {
    sections.forEach((sec, i) => createSlideFromElement(sec as HTMLElement, i))
  } else {
    // Sem <section>: cria 1~3 slides a partir dos headings/paragraphs
    const blocks = parseHtmlToBlocks(fullHtml)

    // Título do deck
    const firstHeading = blocks.find(b => b.type === 'heading')
    const firstSlide = pptx.addSlide()
    firstSlide.addText(firstHeading?.text || 'Apresentação', {
      x: 0.5, y: 0.4, w: 9, h: 1, fontSize: 32, bold: true,
    })

    // Conteúdo: até 2 slides com bullets (ou parágrafos)
    const bullets = blocks.filter(b => b.type === 'bullet').map(b => b.text)
    const paras   = blocks.filter(b => b.type === 'paragraph').map(b => b.text)

    if (bullets.length) {
      const slide = pptx.addSlide()
      slide.addText('Pontos principais', { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 24, bold: true })
      slide.addText(bullets.map(b => `• ${b}`).join('\n'), { x: 0.5, y: 1.4, w: 9, h: 4.8, fontSize: 16 })
    }
    if (paras.length) {
      const slide = pptx.addSlide()
      slide.addText('Conteúdo', { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 24, bold: true })
      slide.addText(paras.slice(0, 10).join('\n\n'), { x: 0.5, y: 1.4, w: 9, h: 4.8, fontSize: 16 })
    }
  }

  await pptx.writeFile({ fileName })
}
