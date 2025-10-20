// /src/utils/remixText.ts
// DESCONTINUADO: A remixagem agora é feita pela LLM na chat-assistant
// Mantido apenas para compatibilidade, mas não é mais usado no fluxo principal

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type BriefPack = {
  raw: string
  company?: string
  project?: string
  goal?: string
  audience?: string
  bullets: string[]
  sentences: string[]
  kv: Record<string, string>
}

// NOTA: Esta função não é mais usada no fluxo principal
// A remixagem é feita pela LLM na chat-assistant
const CLEAN_MULTI_SPACES = /\s{2,}/g
const BROKEN_WORD_NL = /([A-Za-zÀ-ÿ0-9])[\r\n]+([A-Za-zÀ-ÿ0-9])/g
const LIST_ITEM = /(?:^\s*[\-•*]\s+|^\s*\d{1,2}[.)]\s+)(.+)$/gm

function normalize(text: string): string {
  return String(text || '')
    .replace(BROKEN_WORD_NL, '$1 $2')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(CLEAN_MULTI_SPACES, ' ')
    .replace(/[ \u00A0]+(\n)/g, '$1')
    .trim()
}

function splitSentencesPT(text: string): string[] {
  const t = normalize(text)
  const parts = t
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9])/g)
    .map(s => s.trim())
  return parts.filter(s => s.replace(/<[^>]+>/g, '').length >= 30)
}

function extractBullets(text: string): string[] {
  const items: string[] = []
  const clone = normalize(text)
  for (const m of clone.matchAll(LIST_ITEM)) {
    const item = (m[1] || '').trim()
    if (!item || item.length < 4) continue
    items.push(item)
  }
  return Array.from(new Set(items)).slice(0, 40)
}

function extractKV(text: string): Record<string, string> {
  const kv: Record<string, string> = {}
  const lines = normalize(text).split('\n')
  lines.forEach(line => {
    const m = line.match(/^\s*([A-Za-zÀ-ÿ0-9 _\-\/()]+?)\s*[:：]\s*(.+)$/)
    if (m) {
      const k = m[1].toLowerCase().trim()
      const v = m[2].trim()
      if (k && v) kv[k] = v
    }
  })
  return kv
}

function extractEntitiesPT(text: string): {
  company?: string
  project?: string
  goal?: string
  audience?: string
} {
  const t = normalize(text)
  const company =
    t.match(/(?:empresa|companhia|organiza(?:ção|cao)|negócio|nome\s+(?:da\s+)?empresa|chama(?:-se)?|nome\s+é)\s*[:：]?\s*([^.,\n]+)/i)?.[1]?.trim()
  const project =
    t.match(/(?:projeto|produto|serviço|solução|sistema|plataforma|aplicativo|app)\s*[:：]?\s*([^.,\n]+)/i)?.[1]?.trim()
  const goal =
    t.match(/(?:objetivo|meta|finalidade|prop(?:ó|o)sito|queremos|precisamos|buscamos)\s*[:：]?\s*([^.!?\n]+)/i)?.[1]?.trim()
  const audience =
    t.match(/(?:público(?:-alvo)?|clientes?|usuários?|audiência|para\s+quem|direcionado\s+a)\s*[:：]?\s*([^.!?\n]+)/i)?.[1]?.trim()
  return { company, project, goal, audience }
}

export function buildBrief(messages: ChatMessage[]): BriefPack {
  console.log('[DEPRECATED][remixText] buildBrief - LLM remixing is now preferred');
  const userText = normalize(
    messages.filter(m => m.role === 'user').map(m => String(m.content || '')).join('\n\n')
  )
  const bullets = extractBullets(userText)
  const sentences = splitSentencesPT(userText)
  const ents = extractEntitiesPT(userText)
  const kv = extractKV(userText)

  const safe = (s?: string) => (s && s.length >= 3 ? s : undefined)

  return {
    raw: userText,
    company: safe(ents.company) || safe(kv['empresa']),
    project: safe(ents.project) || safe(kv['projeto']),
    goal: safe(ents.goal) || safe(kv['objetivo']),
    audience: safe(ents.audience) || safe(kv['público']) || safe(kv['publico']),
    bullets,
    sentences,
    kv,
  }
}

function takeText(pool: string[], idx: number, fallback: string): string {
  const t = pool[idx]
  if (t && t.length >= 8) return t
  return fallback
}

function fillHeading(el: Element, text: string) { if (text) el.textContent = text }
function fillParagraph(el: Element, text: string) {
  if (!text) return
  const s = text.length > 600 ? text.slice(0, 600) + '…' : text
  el.textContent = s
}

function fillList(ul: Element, bullets: string[], startIdx: number): number {
  let i = startIdx
  const lis = Array.from(ul.querySelectorAll('li'))
  if (lis.length === 0 && bullets.length > 0) {
    const doc = ul.ownerDocument!
    const add = Math.min(6, bullets.length)
    for (let k = 0; k < add; k++) ul.appendChild(doc.createElement('li'))
  }
  Array.from(ul.querySelectorAll('li')).forEach(li => {
    const t = bullets[i]
    if (t) { li.textContent = t; i++ }
  })
  return i
}

// DESCONTINUADO: usar LLM remixing na chat-assistant
export function remixTemplateWithBrief(templateHtml: string, templateName: string, brief: BriefPack): string {
  console.log('[DEPRECATED][remixText] remixTemplateWithBrief - use LLM remixing instead');
  const parser = new DOMParser()
  const doc = parser.parseFromString(templateHtml, 'text/html')

  const titlePool: string[] = []
  const h2Pool: string[] = []
  const pPool: string[] = []

  const mainTitle =
    (templateName.toLowerCase().includes('proposta') && brief.company ? `Proposta - ${brief.company}` :
     templateName.toLowerCase().includes('apresenta') && (brief.project || brief.company) ? (brief.project || brief.company)! :
     [brief.company, brief.project].filter(Boolean).join(' - ') || 'Documento')
  titlePool.push(mainTitle)

  if (brief.company) h2Pool.push(`Sobre ${brief.company}`)
  if (brief.project) h2Pool.push(`${brief.project} — Visão Geral`)
  if (brief.goal) h2Pool.push('Objetivos e Metas')
  if (brief.audience) h2Pool.push(`Benefícios para ${brief.audience}`)
  ;['Metodologia', 'Resultados Esperados', 'Próximos Passos', 'Investimento'].forEach(s => h2Pool.push(s))

  const baseParas = [...brief.sentences]
  if (baseParas.length < 6 && brief.bullets.length) baseParas.push(...brief.bullets.map(b => String(b)))
  pPool.push(...baseParas.filter(s => s && s.replace(/<[^>]+>/g, '').length >= 20))

  const headTitle = doc.querySelector('title')
  if (headTitle && !headTitle.textContent?.trim()) headTitle.textContent = mainTitle

  const h1s = Array.from(doc.querySelectorAll('h1'))
  if (h1s.length) fillHeading(h1s[0], titlePool[0])

  const h2s = Array.from(doc.querySelectorAll('h2'))
  h2s.forEach((h2, idx) => fillHeading(h2, takeText(h2Pool, idx, `Seção ${idx + 1}`)))

  const ps = Array.from(doc.querySelectorAll('p'))
  ps.forEach((p, idx) => {
    const current = p.textContent?.trim() || ''
    const hasPlaceholder = /{{[^}]+}}/.test(current) || current.length < 15
    if (hasPlaceholder) fillParagraph(p, takeText(pPool, idx, brief.goal || brief.raw.slice(0, 220)))
  })

  const uls = Array.from(doc.querySelectorAll('ul'))
  let bulletIdx = 0
  uls.forEach(ul => {
    const hasPlaceholder = ul.innerHTML.includes('{{') || ul.querySelectorAll('li').length <= 1
    if (hasPlaceholder) bulletIdx = fillList(ul, brief.bullets, bulletIdx)
  })

  const bodyHTML = doc.body.innerHTML
    .replace(/\{\{empresa\}\}/gi, brief.company || 'Empresa')
    .replace(/\{\{projeto\}\}/gi, brief.project || 'Projeto')
    .replace(/\{\{objetivo\}\}/gi, brief.goal || 'Objetivo')
    .replace(/\{\{publico\}\}|\{\{cliente\}\}/gi, brief.audience || 'Público-alvo')
    .replace(/\{\{data\}\}/gi, new Date().toLocaleDateString('pt-BR'))
    .replace(/\{\{[^}]+\}\}/g, '')

  doc.body.innerHTML = bodyHTML
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML
}
