// supabase/functions/fetch-url/index.ts
// Busca uma URL no servidor (evita CORS) e extrai o texto principal.
// Usa deno_dom + Readability quando possível. Fallback para strip de HTML.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.46/deno-dom-wasm.ts";
import { Readability } from "https://esm.sh/@mozilla/readability@0.5.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  global: { fetch },
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Content-Type": "application/json",
};

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { url, user_id, conversation_id } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL obrigatória" }), {
        status: 400,
        headers: cors,
      });
    }

    const res = await fetch(url, { redirect: "follow" });
    const html = await res.text();

    let title = "";
    let text = "";

    try {
      const dom = new DOMParser().parseFromString(html, "text/html");
      if (dom) {
        title = dom.querySelector("title")?.textContent ?? url;

        // Readability tenta extrair o conteúdo principal (artigo)
        const docForReadability: any = dom;
        const reader = new Readability(docForReadability);
        const article = reader.parse();

        text = article?.textContent ?? stripHtml(html);
      } else {
        text = stripHtml(html);
        title = url;
      }
    } catch {
      text = stripHtml(html);
      title = url;
    }

    // Opcional: persistir referência na tabela 'references'
    if (user_id) {
      await supabase.from("references").insert({
        user_id,
        conversation_id: conversation_id ?? null,
        title: title || url,
        type: "url",
        source_url: url,
        storage_bucket: null,
        storage_path: null,
        extracted_text: text?.slice(0, 200_000) || null,
        metadata: { from: "fetch-url", length: text?.length ?? 0 },
      });
    }

    return new Response(JSON.stringify({ title, text }), {
      status: 200,
      headers: cors,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Falha ao buscar URL" }), {
      status: 500,
      headers: cors,
    });
  }
});
