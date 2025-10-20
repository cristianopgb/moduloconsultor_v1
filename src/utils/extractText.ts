// /src/utils/extractText.ts
// Extração de texto 100% browser (sem Node core).
// PDF, DOCX, PPTX, XLSX/CSV, HTML, TXT.
// Tudo carregado por import dinâmico (CDN +esm) para evitar problemas do Vite/esbuild.

type PdfJsType = any

// --------- Imports dinâmicos (CDN) ---------
async function loadXLSX() {
  // SheetJS ESM
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm')
  return mod as any
}

async function loadPDFJS(): Promise<PdfJsType> {
  // pdfjs-dist ESM (sem worker) – usaremos "fake worker"
  const pdfjsLib: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/+esm')
  if (pdfjsLib?.GlobalWorkerOptions) {
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = undefined } catch {}
  }
  return pdfjsLib
}

async function loadMammoth() {
  // Mammoth ESM (browser build)
  const mammoth: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js/+esm')
  return mammoth?.default || mammoth
}

async function loadJSZip() {
  // JSZip via CDN ESM. Atenção: não use 'jszip' do node_modules aqui.
  const mod: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')
  return mod?.default || mod
}

// --------- Helpers de FileReader ---------
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as ArrayBuffer)
    fr.onerror = reject
    fr.readAsArrayBuffer(file)
  })
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = reject
    fr.readAsText(file)
  })
}

function getExt(name?: string) {
  const n = (name || '').toLowerCase()
  const m = n.match(/\.([a-z0-9]+)$/i)
  return m ? m[1] : ''
}

// --------- Extratores específicos ---------
async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjs = await loadPDFJS()
  const buf = await readAsArrayBuffer(file)

  const loadingTask = pdfjs.getDocument({ data: buf })
  const pdf = await loadingTask.promise
  let text = ''

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const strings = content.items.map((it: any) => it.str).filter(Boolean)
    text += strings.join(' ') + '\n\n'
  }
  return text.trim()
}

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await loadMammoth()
  const buf = await readAsArrayBuffer(file)

  if (mammoth.extractRawText) {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
    return String(value || '').trim()
  }
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf })
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return (div.textContent || '').trim()
}

async function extractTextFromPptx(file: File): Promise<string> {
  // PPTX = zip (ppt/slides/slideN.xml). Abrimos com JSZip e limpamos as tags.
  const JSZip = await loadJSZip()
  const buf = await readAsArrayBuffer(file)
  const zip = await JSZip.loadAsync(buf)
  const slideFiles = Object.keys(zip.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
  slideFiles.sort((a, b) => {
    const na = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10)
    const nb = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10)
    return na - nb
  })

  let all = ''
  for (const path of slideFiles) {
    const xml = await zip.files[path].async('string')
    const plain = xml
      .replace(/<a:t[^>]*>/g, '')
      .replace(/<\/a:t>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (plain) all += plain + '\n\n'
  }
  return all.trim()
}

async function extractTextFromXlsxOrCsv(file: File): Promise<string> {
  const XLSX = await loadXLSX()
  const buf = await readAsArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const sheets = wb.SheetNames || []
  let out = ''
  sheets.slice(0, 5).forEach((name: string) => {
    const ws = wb.Sheets[name]
    if (!ws) return
    const csv = XLSX.utils.sheet_to_csv(ws)
    out += `# ${name}\n${csv}\n`
  })
  return out.trim()
}

async function extractTextFromHtml(file: File): Promise<string> {
  const txt = await readAsText(file)
  const div = document.createElement('div')
  div.innerHTML = txt
  return (div.textContent || '').trim()
}

async function extractTextFromGenericText(file: File): Promise<string> {
  const txt = await readAsText(file)
  return txt.trim()
}

// --------- API pública ---------
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = getExt(file.name)

  try {
    switch (ext) {
      case 'pdf':
        return await extractTextFromPDF(file)
      case 'docx':
        return await extractTextFromDocx(file)
      case 'pptx':
        return await extractTextFromPptx(file)
      case 'xlsx':
      case 'xls':
      case 'csv':
        return await extractTextFromXlsxOrCsv(file)
      case 'html':
      case 'htm':
        return await extractTextFromHtml(file)
      case 'txt':
        return await extractTextFromGenericText(file)
      default:
        // Fallback: tentar como texto simples
        return await extractTextFromGenericText(file)
    }
  } catch (e: any) {
    console.warn('[extractTextFromFile] falha na extração; usando fallback texto:', e?.message || e)
    return await extractTextFromGenericText(file)
  }
}
