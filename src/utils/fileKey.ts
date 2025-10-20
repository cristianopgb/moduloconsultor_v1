// /src/utils/fileKey.ts
// Gera chaves seguras e compatíveis com as políticas do Storage (prefixo = <uid>/)

export function safeSlug(filename: string) {
  const [base, ext = ''] = splitNameExt(filename || 'arquivo')
  const slug =
    base
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'arquivo'
  return ext ? `${slug}.${ext.toLowerCase()}` : slug
}

export function splitNameExt(name: string): [string, string | undefined] {
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return [name, undefined]
  return [name.slice(0, idx), name.slice(idx + 1)]
}

/**
 * Monta caminho para o bucket "references" obedecendo as políticas:
 *   <uid>/<uuid>_<slug>
 * Ex.: "d0c4f.../9a17dc17-22a4-4375-b94b-4f740339a0f1_meu-arquivo.pdf"
 *
 * IMPORTANTE: exige estar autenticado (uid válido). Se não houver uid, lança erro.
 */
export function makeRefKey(uid: string | null | undefined, originalName: string) {
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    throw new Error('Precisa estar autenticado para anexar arquivos.')
  }
  const uuid = crypto.randomUUID()
  const slug = safeSlug(originalName || 'arquivo')
  // sem subpastas “anon/misc”: primeira pasta é SEMPRE o uid
  return `${uid}/${uuid}_${slug}`
}
