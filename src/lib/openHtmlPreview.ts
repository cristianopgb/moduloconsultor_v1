// /src/lib/openHtmlPreview.ts
import { supabase } from './supabase'

export type OpenHtmlPreviewOptions = {
  html: string
  title?: string
  conversationId?: string | null
  userId?: string | null
  persist?: boolean // default: true (salva em temp_previews e abre /preview/:id)
}

/**
 * Abre a prévia do HTML.
 * - persist=true (default): salva em temp_previews e abre /preview/:id
 * - persist=false: abre uma aba com Blob local (sem usar o banco)
 */
export async function openHtmlPreview(opts: OpenHtmlPreviewOptions) {
  const {
    html,
    title = 'Documento',
    conversationId = null, // mantido para futura auditoria se quiser
    userId = null,
    persist = true
  } = opts

  const fullHtml = ensureFullHtml(html, title)

  if (persist && userId) {
    const id = await saveTempPreview(fullHtml)
    if (!id) {
      // se falhar persistência, cai pro fallback
      openBlobPreview(fullHtml, title)
      return
    }
    window.open(`/preview/${id}`, '_blank', 'noopener,noreferrer')
    return
  }

  // fallback: abre direto com Blob
  openBlobPreview(fullHtml, title)
}

/** Garante <!DOCTYPE html> + <html> completo */
function ensureFullHtml(input: string, pageTitle = 'Documento'): string {
  const t = (input || '').trim()
  const hasHtml = /<html[\s\S]*?>/i.test(t)
  const hasBody = /<body[\s\S]*?>/i.test(t)
  const endsHtml = /<\/html>\s*$/i.test(t)

  if (hasHtml && hasBody && endsHtml) return t

  // CSS mínimo para ficar legível em qualquer preview
  const baseCss = `
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Ubuntu,Cantarell,Inter,system-ui,Arial,sans-serif;line-height:1.6;color:#111}
    .preview-content{max-width:940px;margin:0 auto;padding:32px}
  `.trim()

  // tenta extrair um <title> do fragmento; senão usa pageTitle
  const inferredTitle = titleFrom(t) || pageTitle

  // se vier só um fragmento, embrulha
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(inferredTitle)}</title>
  <style>${baseCss}</style>
</head>
<body>
  <div class="preview-content">
    ${t}
  </div>
</body>
</html>`
}

/** Extrai um possível <title> do conteúdo */
function titleFrom(s: string): string | null {
  const m = (s || '').match(/<title>([\s\S]*?)<\/title>/i)
  return m ? m[1].trim() : null
}

/** Escapa caracteres básicos para uso em <title> */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Salva na tabela temp_previews (coluna html_content) e retorna o id */
async function saveTempPreview(html: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('temp_previews')
      .insert([{ html_content: html }])
      .select('id')
      .single()

    if (error) {
      console.error('[openHtmlPreview] erro ao salvar preview:', error.message)
      return null
    }
    return data?.id ?? null
  } catch (e: any) {
    console.error('[openHtmlPreview] exceção ao salvar preview:', e?.message || e)
    return null
  }
}

/** Abre uma nova aba com o HTML via Blob (sem persistir) */
function openBlobPreview(html: string, _title = 'documento') {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    // Libera após um tempinho
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (e: any) {
    console.error('[openHtmlPreview] erro no Blob preview:', e?.message || e)
  }
}
