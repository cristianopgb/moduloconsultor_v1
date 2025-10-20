import React, { useEffect, useMemo, useState } from 'react'
import { X, Save, RotateCcw, Eye, FileText } from 'lucide-react'
import { supabase, Model } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal }

interface HtmlComposerProps {
  template: Model // precisa ter file_type === 'html' e template_content (HTML com {{placeholders}})
  onClose: () => void
  onSaved?: (doc: any) => void
}

/* ---------------------------------------------
   Utilidades
---------------------------------------------- */

// Base64 de string UTF-8
function toBase64Utf8(str: string) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  // deno-lint-ignore no-deprecated-members
  return btoa(bin)
}

// resolve "a.b.c" dentro de um objeto
function resolvePath(path: string, ctx: any, root: any) {
  const parts = path.split('.')
  let cur = ctx ?? {}
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as any)[p]
    else if (root && typeof root === 'object' && p in root) cur = (root as any)[p]
    else return ''
  }
  return cur == null ? '' : String(cur)
}

// Render simples tipo Mustache: {{chave}}, {{a.b}}, loops {{#lista}}...{{/lista}}
function renderTemplate(tpl: string, data: any) {
  // 1) Loops
  const loopRe = /{{\s*#(\w+)\s*}}([\s\S]*?){{\s*\/\1\s*}}/g
  let out = tpl
  let loopMatch: RegExpExecArray | null

  while ((loopMatch = loopRe.exec(tpl)) !== null) {
    const [full, loopName, inner] = loopMatch
    const arr = (data && Array.isArray(data[loopName]) ? data[loopName] : []) as any[]

    const rendered = arr
      .map((item) => {
        // dentro do loop renderizamos variáveis com contexto item,
        // mas permitindo também acessar raiz usando a notação normal.
        return inner.replace(/{{\s*([^{}#\/][^}]*)\s*}}/g, (_m, keyRaw) => {
          const key = String(keyRaw || '').trim()
          return resolvePath(key, item, data)
        })
      })
      .join('')

    out = out.replace(full, rendered)
  }

  // 2) Variáveis simples fora de loops
  out = out.replace(/{{\s*([^{}#\/][^}]*)\s*}}/g, (_m, keyRaw) => {
    const key = String(keyRaw || '').trim()
    return resolvePath(key, null, data)
  })

  return out
}

// Detecta placeholders: variáveis e loops
function detectPlaceholders(html: string) {
  const vars = new Set<string>()
  const loops = new Set<string>()

  // loops
  const loopRe = /{{\s*#(\w+)\s*}}/g
  let m: RegExpExecArray | null
  while ((m = loopRe.exec(html)) !== null) {
    loops.add(m[1])
  }

  // vars
  const varRe = /{{\s*([^{}#\/][^}]*)\s*}}/g
  while ((m = varRe.exec(html)) !== null) {
    const key = String(m[1]).trim()
    if (!key || key.startsWith('#') || key.startsWith('/')) continue
    vars.add(key)
  }

  // evita duplicatas de nome igual ao loop
  for (const l of loops) {
    if (vars.has(l)) vars.delete(l)
  }

  return {
    variables: Array.from(vars).sort(),
    loops: Array.from(loops).sort(),
  }
}

/* ---------------------------------------------
   Componente
---------------------------------------------- */
export function HtmlComposer({ template, onClose, onSaved }: HtmlComposerProps) {
  const { user } = useAuth()

  const rawHtml = String(template.template_content || '')
  const { variables, loops } = useMemo(() => detectPlaceholders(rawHtml), [rawHtml])

  // valores de preenchimento
  const [values, setValues] = useState<Record<string, string>>({})
  const [loopJson, setLoopJson] = useState<Record<string, string>>({}) // cada loop tem um textarea com JSON
  const [parsedLoops, setParsedLoops] = useState<Record<string, any[]>>({})
  const [parseError, setParseError] = useState<string>('')

  // preview
  const [rendered, setRendered] = useState<string>('')

  // Dados de exemplo (se houver) — tentamos ler de template.template_json.sample ou .sample_data
  useEffect(() => {
    const sample =
      (template as any)?.template_json?.sample ??
      (template as any)?.template_json?.sample_data ??
      null

    if (sample && typeof sample === 'object') {
      // Preenche variáveis simples se existirem no sample
      const v: Record<string, string> = {}
      variables.forEach((k) => {
        const got = resolvePath(k, null, sample)
        if (got) v[k] = String(got)
      })
      setValues(v)

      // Preenche loops
      const lj: Record<string, string> = {}
      const pl: Record<string, any[]> = {}
      loops.forEach((l) => {
        const arr = (sample as any)[l]
        if (Array.isArray(arr)) {
          pl[l] = arr
          try {
            lj[l] = JSON.stringify(arr, null, 2)
          } catch {
            lj[l] = '[]'
          }
        } else {
          lj[l] = '[]'
          pl[l] = []
        }
      })
      setLoopJson(lj)
      setParsedLoops(pl)
    } else {
      // sem sample: zera loops
      const lj: Record<string, string> = {}
      const pl: Record<string, any[]> = {}
      loops.forEach((l) => {
        lj[l] = '[]'
        pl[l] = []
      })
      setLoopJson(lj)
      setParsedLoops(pl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id])

  // Atualiza preview
  const doRender = () => {
    setParseError('')
    // parse dos loops
    const compiledLoops: Record<string, any[]> = {}
    for (const name of loops) {
      const txt = loopJson[name] ?? '[]'
      try {
        const parsed = JSON.parse(txt)
        if (!Array.isArray(parsed)) throw new Error(`O loop "${name}" deve ser um array de objetos.`)
        compiledLoops[name] = parsed
      } catch (e: any) {
        setParseError(e?.message || `JSON inválido no loop "${name}"`)
        return
      }
    }

    const data: any = {}
    // variáveis simples
    for (const k of Object.keys(values)) data[k] = values[k]
    // loops
    for (const l of Object.keys(compiledLoops)) data[l] = compiledLoops[l]

    const html = renderTemplate(rawHtml, data)
    setRendered(html)
    setParsedLoops(compiledLoops)
  }

  useEffect(() => {
    doRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetAll = () => {
    setValues({})
    const lj: Record<string, string> = {}
    const pl: Record<string, any[]> = {}
    loops.forEach((l) => {
      lj[l] = '[]'
      pl[l] = []
    })
    setLoopJson(lj)
    setParsedLoops(pl)
    setRendered(rawHtml)
    setParseError('')
  }

  // Salva em "documents" como HTML (data URL) + guarda json_content com os dados
  const saveDocument = async () => {
    if (!user) {
      alert('Faça login novamente.')
      return
    }
    try {
      // Garante último render
      doRender()
      const html = rendered || renderTemplate(rawHtml, { ...values, ...parsedLoops })
      const dataUrl = `data:text/html;base64,${toBase64Utf8(html)}`
      const title =
        `${template.name || 'Documento'} - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`

      const json_content: Record<string, JsonVal> = {
        template_id: template.id,
        filled_at: new Date().toISOString(),
        variables: values,
        loops: parsedLoops,
      }

      const { data, error } = await supabase
        .from('documents')
        .insert([
          {
            user_id: user.id,
            title,
            type: 'document', // HTML tratado como "document" na sua tabela
            file_url: dataUrl,
            template_id: template.id,
            json_content,
            status: 'draft',
          },
        ])
        .select()
        .limit(1)

      if (error) throw error

      if (data && data[0]) {
        onSaved?.(data[0])
        alert('✅ Documento salvo em Documentos.')
      }
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Erro ao salvar documento.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold">
                Preencher Template HTML: <span className="text-blue-300">{template.name}</span>
              </h2>
              <p className="text-gray-400 text-sm">
                Detectei {variables.length} variáveis e {loops.length} loop(s)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          {/* Coluna esquerda: formulário */}
          <div className="p-4 overflow-y-auto border-r border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={doRender}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                <Eye className="w-4 h-4" />
                Atualizar preview
              </button>
              <button
                onClick={resetAll}
                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Limpar
              </button>
              <button
                onClick={saveDocument}
                className="ml-auto inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm"
              >
                <Save className="w-4 h-4" />
                Salvar em Documentos
              </button>
            </div>

            {parseError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-300 rounded">
                {parseError}
              </div>
            )}

            <div className="space-y-6">
              {/* Variáveis simples */}
              <div>
                <h3 className="text-white font-medium mb-2">
                  Variáveis (<code className="font-mono text-xs">{`{{chave}}`}</code>)
                </h3>
                {variables.length === 0 ? (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-600/30 text-yellow-200 rounded">
                    Nenhuma variável {'{{chave}}'} detectada neste HTML.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {variables.map((v) => (
                      <div key={v}>
                        <label className="block text-xs text-gray-400 mb-1">{v}</label>
                        <input
                          value={values[v] ?? ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                          placeholder={`Valor para ${v}`}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Loops */}
              <div>
                <h3 className="text-white font-medium mb-2">
                  Loops (<code className="font-mono text-xs">{`{{#lista}}...{{/lista}}`}</code>)
                </h3>
                {loops.length === 0 ? (
                  <div className="p-3 bg-gray-800/60 border border-gray-700 text-gray-300 rounded">
                    Nenhum loop detectado.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loops.map((l) => (
                      <div key={l} className="bg-gray-800/50 border border-gray-700 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-blue-300 font-mono">
                            {`{{#${l}}} ... {{/${l}}}`}
                          </span>
                          <span className="text-xs text-gray-400">
                            Insira um JSON de array (ex.: [ {'{'}"campo":"valor"{'}'} ])
                          </span>
                        </div>
                        <textarea
                          value={loopJson[l] ?? '[]'}
                          onChange={(e) =>
                            setLoopJson((prev) => ({
                              ...prev,
                              [l]: e.target.value,
                            }))
                          }
                          rows={6}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white font-mono text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna direita: preview */}
          <div className="p-4 overflow-auto bg-gray-950">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" /> Preview
              </h3>
              <span className="text-xs text-gray-400">
                Este preview usa o HTML do template com os valores inseridos
              </span>
            </div>

            {/* Render do HTML preenchido */}
            <div
              className="bg-white rounded-lg p-4 shadow-inner min-h-[400px]"
              // ⚠️ Estamos renderizando o HTML do admin: considere higienizar se for multi-tenant aberto
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
