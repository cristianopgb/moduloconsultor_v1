import React, { useEffect, useMemo, useRef, useState } from 'react'

type PageFormat = 'auto' | 'a4' | 'widescreen'

export interface HtmlTemplateModalProps {
  isOpen: boolean
  title?: string
  template: {
    name?: string
    html?: string
    css?: string
    js?: string
  }
  fontFamily?: string
  pageFormat?: PageFormat
  onClose: () => void
}

const stripUnwantedScripts = (html: string) =>
  (html || '').replace(/<script[^>]*cdn-cgi\/challenge-platform[^>]*>[\s\S]*?<\/script>/gi, '')

const detectVariables = (text: string): string[] => {
  const set = new Set<string>()
  const re = /{{\s*([a-zA-Z0-9_\.\-\[\]]+)\s*}}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) set.add(m[1])
  return Array.from(set)
}

const makeExampleData = (vars: string[]) => {
  const obj: Record<string, string> = {}
  vars.forEach((k, i) => { obj[k] = `Exemplo ${i + 1}` })
  return obj
}

const applyData = (html: string, data: Record<string, any>): string => {
  return (html || '').replace(/{{\s*([a-zA-Z0-9_\.\-\[\]]+)\s*}}/g, (_, k) => {
    const v = data?.[k]
    return (v === undefined || v === null) ? '' : String(v)
  })
}

function buildDocument(opts: {
  name?: string
  html?: string
  css?: string
  js?: string
  fontFamily: string
  pageFormat: PageFormat
}) {
  const pageStyle =
    opts.pageFormat === 'a4'
      ? `@page{size:A4;margin:12mm;} body{margin:0 auto;max-width:794px;}`
      : opts.pageFormat === 'widescreen'
        ? `body{margin:0 auto;max-width:1280px;} .wide-canvas{aspect-ratio:16/9;width:100%;}`
        : `body{margin:0 auto;max-width:1200px;}`

  const safeHtml = stripUnwantedScripts(opts.html || '')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.name || 'Preview do Template'}</title>
<style>
  /* Mantemos visual do template. Só forçamos família tipográfica e largura da página. */
  html,body{font-family:${opts.fontFamily};}
  ${pageStyle}
  ${opts.css || ''}
</style>
</head>
<body>
${safeHtml}
<script>
try { ${opts.js || ''} } catch(e){ console.error('[TEMPLATE JS ERROR]', e) }
</script>
</body>
</html>`
}

export const HtmlTemplateModal: React.FC<HtmlTemplateModalProps> = ({
  isOpen,
  title,
  template,
  fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial',
  pageFormat = 'auto',
  onClose
}) => {
  const [url, setUrl] = useState<string>('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const rawHtml = template?.html || ''
  const rawCss  = template?.css  || ''
  const rawJs   = template?.js   || ''

  const variables = useMemo(() => {
    const inAll = [rawHtml, rawCss, rawJs].join('\n')
    return detectVariables(inAll)
  }, [rawHtml, rawCss, rawJs])

  const exampleData = useMemo(() => makeExampleData(variables), [variables])

  const hydratedHtml = useMemo(() => applyData(rawHtml, exampleData), [rawHtml, exampleData])

  useEffect(() => {
    if (!isOpen) {
      if (url) URL.revokeObjectURL(url)
      setUrl('')
      return
    }

    // Logs compatíveis com os prints que você viu
    try {
      // eslint-disable-next-line no-console
      console.debug('🔍 Variáveis detectadas:', variables)
      // eslint-disable-next-line no-console
      console.debug('📝 Dados de exemplo:', exampleData)
    } catch {}

    const htmlDoc = buildDocument({
      name: template?.name || title,
      html: hydratedHtml,
      css: rawCss,
      js: rawJs,
      fontFamily,
      pageFormat
    })

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' })
    const objUrl = URL.createObjectURL(blob)
    setUrl(objUrl)

    return () => {
      URL.revokeObjectURL(objUrl)
    }
  }, [isOpen, hydratedHtml, rawCss, rawJs, fontFamily, pageFormat, title, template?.name])

  useEffect(() => {
    if (!isOpen) return
    // eslint-disable-next-line no-console
    console.debug('Preview do template HTML carregado')
  }, [isOpen, url])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* modal */}
      <div className="relative bg-[#0b1020] border border-[#202849] rounded-xl w-[95vw] h-[90vh] shadow-2xl overflow-hidden">
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#202849] text-white">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{title || template?.name || 'Preview do Template'}</span>
            {template?.name && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300">
                {template.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              className="bg-[#121833] text-white text-xs rounded px-2 py-1 border border-[#202849]"
              value={fontFamily}
              onChange={() => {}}
              disabled
              title="Fonte fixa no preview (ajuste no chamador se precisar)"
            >
              <option>Inter/System</option>
            </select>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#121833] hover:bg-[#182045] text-white border border-[#202849]"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="w-full h-[calc(90vh-48px)] bg-white">
          {url ? (
            <iframe
              ref={iframeRef}
              src={url}
              title="Preview Template"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Carregando preview…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HtmlTemplateModal
