// /src/components/References/ReferenceUploader.tsx
// Uploader de referências (arquivos locais). Extrai texto de PDF/DOCX/PPTX/XLSX/CSV/TXT/HTML,
// envia o arquivo para o Storage e cria registro em "references" com o schema do seu banco.
//
// Importante:
// - Usa chaves seguras no Storage: user-<uid>/<ts>-<uuid>-<slug.ext> (ver fileKey.ts)
// - Faz insert com user_id para passar nas policies RLS
// - Imports dinâmicos por CDN evitam conflito com Vite/esbuild

import React, { useRef, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { makeRefKey } from '../../utils/fileKey'
import { detectAndParseCSV, getDelimiterName } from '../../utils/csvDetector'

// ---- Tipos ----
export type CreatedRef = {
  id: string
  title: string
  type: string
  storage_bucket?: string | null
  storage_path?: string | null
  source_url?: string | null
  extracted_text?: string | null
  metadata?: Record<string, any> | null
  file?: File | null
}

type Props = {
  userId: string
  conversationId: string
  onUploaded?: (ref: CreatedRef) => void
  className?: string
  accept?: string
}

// ---- Helpers de import dinâmico (CDN) ----
async function loadXLSX() {
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm')
  return mod as any
}
async function loadPDFJS() {
  const pdfjsLib: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/+esm')
  // Evita erro de worker em ambientes sem bundler de worker
  try { if (pdfjsLib?.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = undefined } catch {}
  return pdfjsLib
}
async function loadMammoth() {
  const mammoth: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js/+esm')
  return mammoth?.default || mammoth
}
async function loadJSZip() {
  const JSZip: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')
  return JSZip?.default || JSZip
}

// ---- Helpers de leitura ----
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

// ---- Extrações ----
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

async function extractTextFromXlsx(file: File): Promise<string> {
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

async function extractTextFromCsv(file: File): Promise<string> {
  try {
    const { text, delimiter, confidence, encoding, headers } = await detectAndParseCSV(file)
    console.log(`[CSV Detection] Delimiter: ${getDelimiterName(delimiter)}, Confidence: ${confidence}%, Encoding: ${encoding}`)

    if (confidence < 50) {
      console.warn('[CSV Detection] Low confidence, using XLSX fallback')
      const XLSX = await loadXLSX()
      const buf = await readAsArrayBuffer(file)
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      return XLSX.utils.sheet_to_csv(ws)
    }

    return text
  } catch (error) {
    console.error('[CSV Detection] Error:', error)
    const XLSX = await loadXLSX()
    const buf = await readAsArrayBuffer(file)
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_csv(ws)
  }
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

function getExt(name?: string) {
  const n = (name || '').toLowerCase()
  const m = n.match(/\.([a-z0-9]+)$/i)
  return m ? m[1] : ''
}

async function extractTextByType(file: File): Promise<{ text: string; type: string }> {
  const ext = getExt(file.name)
  switch (ext) {
    case 'pdf':   return { text: await extractTextFromPDF(file),   type: 'pdf' }
    case 'docx':  return { text: await extractTextFromDocx(file),  type: 'docx' }
    case 'pptx':  return { text: await extractTextFromPptx(file),  type: 'pptx' }
    case 'xlsx':
    case 'xls':
      // Para Excel, tentar análise avançada primeiro
      if (ext === 'xlsx') {
        try {
          const { text, analysis } = await processExcelWithAnalysis(file)
          return { text, type: 'xlsx_analyzed' }
        } catch (e) {
          console.warn('[DEBUG] Análise avançada falhou, usando extração simples:', e)
          return { text: await extractTextFromXlsx(file), type: ext }
        }
      }
      return { text: await extractTextFromXlsx(file), type: ext }
    case 'csv':
      return { text: await extractTextFromCsv(file), type: 'csv' }
    case 'html':
    case 'htm':   return { text: await extractTextFromHtml(file),  type: 'html' }
    case 'txt':   return { text: await extractTextFromGenericText(file), type: 'txt' }
    default:      return { text: await extractTextFromGenericText(file), type: ext || 'file' }
  }
}

// Nova função para análise avançada de Excel
async function processExcelWithAnalysis(file: File): Promise<{ text: string; analysis: any }> {
  const XLSX = await loadXLSX()
  const buf = await readAsArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  
  if (!sheetName) {
    throw new Error("Nenhuma planilha encontrada no arquivo")
  }

  const worksheet = wb.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
  
  if (!Array.isArray(jsonData) || jsonData.length === 0) {
    throw new Error("Planilha vazia ou formato inválido")
  }

  // Primeira linha como cabeçalhos
  const headers = jsonData[0] as string[]
  const dataRows = jsonData.slice(1)
  
  console.log('[DEBUG] Processando Excel:', {
    filename: file.name,
    sheets: wb.SheetNames,
    rows: dataRows.length,
    columns: headers.length
  })
  
  // Análise estatística detalhada
  const analysis = {
    filename: file.name,
    sheets: wb.SheetNames,
    total_rows: dataRows.length,
    total_columns: headers.length,
    columns: headers.map((header, index) => {
      const columnValues = dataRows.map(row => (row as any[])[index]).filter(v => v != null && v !== '')
      const allValues = dataRows.map(row => (row as any[])[index])
      const nullCount = allValues.length - columnValues.length
      
      // Detectar tipo de dados
      const isNumeric = columnValues.length > 0 && columnValues.every(v => !isNaN(Number(v)) && isFinite(Number(v)))
      const isDate = columnValues.length > 0 && columnValues.every(v => !isNaN(Date.parse(String(v))))
      
      let type = 'text'
      if (isNumeric) type = 'numeric'
      else if (isDate) type = 'date'
      
      let stats: any = {
        null_count: nullCount,
        unique_count: new Set(columnValues.map(v => String(v))).size
      }
      
      if (type === 'numeric' && columnValues.length > 0) {
        const numbers = columnValues.map(v => Number(v))
        const sorted = numbers.sort((a, b) => a - b)
        stats = {
          ...stats,
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          mean: numbers.reduce((sum, n) => sum + n, 0) / numbers.length,
          median: sorted[Math.floor(sorted.length / 2)],
          std_dev: Math.sqrt(numbers.reduce((sum, n) => sum + Math.pow(n - stats.mean, 2), 0) / numbers.length),
          sum: numbers.reduce((sum, n) => sum + n, 0)
        }
      }
      
      // Top valores para colunas categóricas
      const topValues = type !== 'numeric' ? getTopValues(columnValues, 5) : []
      
      return {
        name: header || `Coluna_${index + 1}`,
        type,
        sample_values: columnValues.slice(0, 5),
        stats,
        top_values: topValues
      }
    }),
    data_quality_score: calculateDataQualityScore(headers, dataRows)
  }
  
  console.log('[DEBUG] Análise estatística concluída:', {
    columns: analysis.columns.length,
    numeric_columns: analysis.columns.filter(c => c.type === 'numeric').length,
    quality_score: analysis.data_quality_score
  })
  
  // Texto estruturado para a IA
  const summaryText = `
📊 ANÁLISE ESTATÍSTICA DA PLANILHA: ${file.name}

📈 ESTRUTURA GERAL:
• ${analysis.total_rows} linhas de dados
• ${analysis.total_columns} colunas
• Score de qualidade: ${analysis.data_quality_score}%
• Planilhas: ${analysis.sheets.join(', ')}

📋 COLUNAS E ESTATÍSTICAS DETALHADAS:
${analysis.columns.map(col => {
  let colInfo = `\n🔹 ${col.name} (${col.type.toUpperCase()})`
  
  if (col.type === 'numeric' && col.stats) {
    colInfo += `
   • Mínimo: ${col.stats.min}
   • Máximo: ${col.stats.max}  
   • Média: ${col.stats.mean?.toFixed(2)}
   • Mediana: ${col.stats.median}
   • Desvio Padrão: ${col.stats.std_dev?.toFixed(2)}
   • Soma Total: ${col.stats.sum}
   • Valores únicos: ${col.stats.unique_count}`
  } else {
    colInfo += `
   • Valores únicos: ${col.stats.unique_count}
   • Valores nulos: ${col.stats.null_count}
   • Top valores: ${col.top_values?.map(tv => `${tv.value} (${tv.count}x)`).join(', ') || 'N/A'}`
  }
  
  colInfo += `\n   • Amostra: ${col.sample_values.join(', ')}`
  return colInfo
}).join('\n')}

📊 DADOS BRUTOS (primeiras 5 linhas para contexto):
${headers.join(' | ')}
${dataRows.slice(0, 5).map(row => (row as any[]).join(' | ')).join('\n')}

💡 INSIGHTS AUTOMÁTICOS:
• Colunas numéricas disponíveis para cálculos: ${analysis.columns.filter(c => c.type === 'numeric').map(c => c.name).join(', ')}
• Colunas categóricas para agrupamento: ${analysis.columns.filter(c => c.type === 'text').map(c => c.name).join(', ')}
• Qualidade dos dados: ${analysis.data_quality_score >= 80 ? 'Excelente' : analysis.data_quality_score >= 60 ? 'Boa' : 'Requer atenção'}
  `.trim()

  return { text: summaryText, analysis }
}

// Função auxiliar para calcular top valores
function getTopValues(values: any[], limit = 5) {
  const counts = new Map<string, number>()
  
  values.forEach(value => {
    const str = String(value || '').trim()
    if (str) {
      counts.set(str, (counts.get(str) || 0) + 1)
    }
  })

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }))
}

// Função auxiliar para calcular score de qualidade
function calculateDataQualityScore(headers: string[], dataRows: any[][]): number {
  let score = 100
  
  // Penalizar por colunas sem nome
  const unnamedColumns = headers.filter(h => !h || h.trim() === '').length
  score -= unnamedColumns * 10
  
  // Penalizar por muitas células vazias
  const totalCells = headers.length * dataRows.length
  const emptyCells = dataRows.reduce((sum, row) => {
    return sum + row.filter(cell => cell == null || cell === '').length
  }, 0)
  const emptyPercentage = (emptyCells / totalCells) * 100
  score -= emptyPercentage * 0.5
  
  // Penalizar por linhas muito curtas
  const shortRows = dataRows.filter(row => row.length < headers.length * 0.5).length
  score -= (shortRows / dataRows.length) * 20
  
  return Math.max(0, Math.min(100, Math.round(score)))
}

// ---- Upload no Storage + insert na tabela "references" ----
async function uploadToStorageAndInsertRef(
  userId: string,
  conversationId: string,
  file: File,
  extracted_text: string,
  fileType: string
): Promise<CreatedRef> {
  const bucket = 'references' // certifique-se que esse bucket existe

  // Verificar autenticação e sessão antes do upload
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log('[DEBUG] Session:', session)
  console.log('[DEBUG] Session error:', sessionError)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('[DEBUG] Antes do upload - userId passado:', userId)
  console.log('[DEBUG] Antes do upload - auth.uid():', user?.id)
  console.log('[DEBUG] Antes do upload - user object:', user)
  console.log('[DEBUG] Access token presente?', !!session?.access_token)

  if (authError) {
    console.error('[DEBUG] Erro ao verificar autenticação:', authError)
    throw new Error(`Erro de autenticação: ${authError.message}`)
  }

  if (!user) {
    throw new Error('Usuário não está autenticado')
  }

  if (!session?.access_token) {
    throw new Error('Token de acesso não encontrado. Faça login novamente.')
  }

  if (userId !== user.id) {
    throw new Error(`userId (${userId}) não corresponde ao auth.uid() (${user.id})`)
  }

  const path = makeRefKey(userId, file.name) // -> user-<uid>/<ts>-<uuid>-<slug.ext>
  console.log('[DEBUG] Path do upload:', path)

  // 1) upload do arquivo original
  const { data: up, error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
  if (upErr) {
    console.error('[DEBUG] Erro no upload:', upErr)
    throw new Error(upErr.message)
  }

  // 2) Insert na tabela "references"
  const title = file.name
  const meta: Record<string, any> = {
    file_size: file.size,
    mime: file.type,
    ext: getExt(file.name),
  }

  const { data, error } = await supabase
    .from('references')
    .insert([
      {
        user_id: userId,            // 🔴 necessário para passar nas policies
        conversation_id: conversationId,
        title,
        type: fileType || 'file',
        storage_bucket: bucket,
        storage_path: path,
        source_url: null,
        extracted_text,
        metadata: meta,
      },
    ])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CreatedRef
}

// ---- Componente ----
export default function ReferenceUploader({
  userId,
  conversationId,
  onUploaded,
  className,
  accept = '.pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt,.html,.htm',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>('')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setErr('')
    setBusy(true)
    try {
      console.log('[DEBUG] handleFiles - userId:', userId)
      console.log('[DEBUG] handleFiles - conversationId:', conversationId)

      for (const file of Array.from(files)) {
        console.log('[DEBUG] Processando arquivo:', file.name)
        const { text, type } = await extractTextByType(file)
        console.log('[DEBUG] Texto extraído, chamando uploadToStorageAndInsertRef')
        const created = await uploadToStorageAndInsertRef(
          userId,
          conversationId,
          file,
          text,
          type
        )
        console.log('[DEBUG] Upload concluído:', created)
        onUploaded?.(created)
      }
    } catch (e: any) {
      console.error('[ReferenceUploader] erro:', e?.message || e)
      setErr(e?.message || 'Falha ao anexar arquivo')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <label
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
          ${busy ? 'opacity-60 pointer-events-none' : 'hover:bg-gray-800'}
          border-gray-700 text-gray-200`}
      >
        <Upload className="w-4 h-4" />
        <span>{busy ? 'Processando…' : 'Anexar arquivos'}</span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={accept}
          onChange={(e) => handleFiles(e.currentTarget.files)}
        />
      </label>

      {err && (
        <div className="mt-2 text-sm text-red-400">
          {err}
        </div>
      )}
      {busy && !err && (
        <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Extraindo e salvando…</span>
        </div>
      )}
      <div className="mt-1 text-[11px] text-gray-500">
        Suporta: PDF, DOCX, PPTX, XLSX, CSV (detecção automática de delimitador), TXT, HTML
      </div>
    </div>
  )
}
