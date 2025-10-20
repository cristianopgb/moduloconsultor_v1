// supabase/functions/template-fill/index.ts
// Edge Function: "template-fill"
// Objetivo: copiar um arquivo-modelo do Storage para o bucket `exports`,
// mantendo o nome e retornando URL pública. (Versão simples — não faz merge
// de variáveis; serve para o fluxo funcionar agora.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// --- Config -----------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { 
  global: { fetch },
  auth: { persistSession: false }
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
}

// --- Utils ------------------------------------------------------------------
function parseStorageRef(input: string): { bucket: string; path: string } {
  try {
    if (input.startsWith("http")) {
      const u = new URL(input)
      const marker = "/object/public/"
      const idx = u.pathname.indexOf(marker)
      if (idx >= 0) {
        const rest = u.pathname.slice(idx + marker.length)
        const [bucket, ...pieces] = rest.replace(/^\/+/, "").split("/")
        return { bucket, path: pieces.join("/") }
      }
    }
  } catch (_) {}
  // caminho estilo "templates/algum/pasta/arquivo.pptx"
  const clean = input.replace(/^\/+/, "")
  const [bucket, ...pieces] = clean.split("/")
  return { bucket, path: pieces.join("/") }
}

function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || ""
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if (ext === "pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  if (ext === "xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  if (ext === "html") return "text/html"
  return "application/octet-stream"
}

// --- Handler ----------------------------------------------------------------
serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const storage_path: string = body.storage_path
    const canonical = body.canonical ?? {}
    const document_id: string | undefined = body.document_id
    const user_id: string | undefined = body.user_id
    const output_type: string | undefined = body.output_type // opcional

    if (!storage_path) {
      throw new Error('Parâmetro "storage_path" é obrigatório')
    }

    // 1) Descobre bucket + path do arquivo de origem
    const { bucket: srcBucket, path: srcPath } = parseStorageRef(storage_path)
    if (!srcBucket || !srcPath) throw new Error("storage_path inválido")

    const filename = srcPath.split("/").pop() || "documento.pptx"
    const mimeType = guessMime(filename)

    // 2) Baixa o arquivo de origem
    const dl = await supabase.storage.from(srcBucket).download(srcPath)
    if (dl.error) throw new Error(`download falhou: ${dl.error.message}`)
    const fileBlob = dl.data

    // 3) Sobe no bucket `exports` em uma pasta organizada
    const destPath = `${user_id || "anon"}/${document_id || "tmp"}/${Date.now()}_${filename}`
    
    console.log(`Uploading to exports bucket: ${destPath}`)
    
    const up = await supabase.storage
      .from("exports")
      .upload(destPath, fileBlob, { contentType: mimeType, upsert: true })
    
    if (up.error) {
      console.error("Upload error details:", up.error)
      throw new Error(`upload falhou: ${up.error.message}`)
    }
    
    console.log(`Upload successful: ${destPath}`)

    // 4) URL pública
    const pub = supabase.storage.from("exports").getPublicUrl(destPath)
    const publicUrl = pub.data.publicUrl

    // 5) Atualiza a linha do documento (se veio id)
    if (document_id) {
      await supabase
        .from("documents")
        .update({
          last_export_file_type: (output_type || filename.split(".").pop() || "").toLowerCase(),
          last_export_file_url: publicUrl,
          output_storage_path: `exports/${destPath}`,
          // se quiser persistir o canonical gerado:
          json_content: canonical && typeof canonical === "object" ? canonical : undefined,
          status: "draft",
        })
        .eq("id", document_id)
    }

    const payload = {
      filename,
      path: `exports/${destPath}`,
      publicUrl: publicUrl,
      bucket: "exports"
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("template-fill error:", err)
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
