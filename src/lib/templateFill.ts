// /src/lib/templateFill.ts
// SIMPLIFICADO: apenas para compatibilidade com exports de arquivos
import { supabase } from './supabase'

type Args = {
  storagePath: string            // ex.: "mockups/1759....pptx"
  canonical: any                 // você já passa isso do generate_canonical
  documentId: string
  userId: string
  bucket?: string                // default: 'templates'
  outputType?: string            // opcional (pptx/docx/xlsx/html)
}

export async function fillAndSaveTemplate({
  storagePath,
  canonical,
  documentId,
  userId,
  bucket = 'templates',
  outputType,
}: Args) {
  console.log('[DEBUG][templateFill] Iniciando preenchimento de template de arquivo');
  
  // tenta pegar o token do usuário (não é obrigatório, mas ajuda nos headers)
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token

  // gera a URL pública do arquivo no bucket templates
  let fileUrl: string | undefined = undefined
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
    if (data?.publicUrl) fileUrl = data.publicUrl
  } catch {
    // se não conseguir gerar a pública, seguimos só com o storage_path
  }

  // monta o payload para a Edge Function
  const payload = {
    bucket,
    storage_path: storagePath,
    file_url: fileUrl,           // <<<<<< envia a URL pública também!
    output_type: outputType,
    user_id: userId,
    document_id: documentId,
    canonical,
  }

  console.log('[DEBUG][templateFill] Enviando para template-fill:', payload)

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/template-fill`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    }
  )

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`template-fill HTTP ${resp.status}: ${txt}`)
  }

  const json = await resp.json()
  console.log('[DEBUG][templateFill] Resposta recebida:', json)
  
  // a função retorna filename / path / publicUrl
  return {
    filename: json.filename as string,
    path: json.path as string,
    url: json.publicUrl as string | null,
    bucket: json.bucket as string,
  }
}
