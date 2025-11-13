// /src/components/References/UrlReference.tsx
// Captura uma URL, chama a Edge Function 'fetch-url' para buscar o conteúdo
// sem CORS, e registra a referência em `public.references`.
// Retorna via onCreated(...) o item criado.

import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

type CreatedRef = {
  id?: string;
  title: string;
  type: "url";
  extracted_text?: string | null;
  file?: File | null;
};

type Props = {
  userId: string;
  conversationId: string | null;
  onCreated?: (ref: CreatedRef) => void;
};

export default function UrlReference({ userId, conversationId, onCreated }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleAdd() {
    if (!url) return;
    setBusy(true);
    setErr(null);

    try {
      // 1) Chama a Edge Function para buscar a URL e extrair o texto principal
      const res = await supabase.functions.invoke("fetch-url", {
        body: { url, user_id: userId, conversation_id: conversationId },
      });

      if (res.error) throw res.error;
      const { title, text } = (res.data || {}) as { title?: string; text?: string };

      // 2) Garante que há registro na tabela 'references'
      //    (A função já insere quando recebe user_id, mas reforçamos o insert se necessário)
      let insertedId: string | undefined;

      if (userId) {
        const { data, error } = await supabase
          .from("references")
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            title: title || url,
            type: "url",
            source_url: url,
            extracted_text: (text || "").slice(0, 200_000),
            metadata: { from: "url-input" },
          })
          .select()
          .single();

        if (error) {
          // Se falhar por conflito/duplicidade, apenas segue com o retorno local
          // (não derruba a UX por isso)
          // console.warn("Insert de URL falhou, usando apenas retorno da função:", error);
        } else {
          insertedId = data?.id;
        }
      }

      onCreated?.({
        id: insertedId,
        title: title || url,
        type: "url",
        extracted_text: (text || "").slice(0, 200_000),
        file: null,
      });

      setUrl("");
    } catch (e: any) {
      setErr(e?.message || "Falha ao buscar URL");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3 border rounded-lg bg-white/70">
      <div className="flex items-center gap-2">
        <input
          type="url"
          placeholder="Cole uma URL (artigo, site, PDF público)…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg"
        />
        <button
          disabled={!url || busy}
          onClick={handleAdd}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
        >
          Usar URL
        </button>
      </div>
      <div className="mt-2 text-xs">
        {busy ? (
          <span className="text-gray-600">Buscando conteúdo…</span>
        ) : err ? (
          <span className="text-red-600">{err}</span>
        ) : (
          <span className="text-gray-500">
            A página é baixada no servidor (sem CORS) e o texto limpo é salvo como referência.
          </span>
        )}
      </div>
    </div>
  );
}
