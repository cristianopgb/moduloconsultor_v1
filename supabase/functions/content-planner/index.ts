// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Util: tentar parsear JSON de uma Response
async function safeJson(resp: Response) {
  try { return await resp.json(); } catch { return null; }
}

// Chama seu agente de IA (se existir) ou devolve um fallback canônico mínimo
async function callAIOrFallback(
  user_request: string,
  doc_type: "presentation" | "document",
  templateSchema: any | null,
  userId: string,
  userBearerToken: string
): Promise<any> {
  const agentUrl = Deno.env.get("CONTENT_AGENT_URL"); // opcional: seu agente de IA

  if (agentUrl) {
    const resp = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${userBearerToken}`, // repasse do token do usuário, se o agente exigir
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instruction: user_request,
        template_schema: templateSchema,
        user_id: userId,
      }),
    });
    if (!resp.ok) {
      const err = await safeJson(resp);
      throw new Error(err?.error || `IA agent error: ${resp.status} ${resp.statusText}`);
    }
    return await resp.json();
  }

  // Fallback local (SEM usar chaves externas): já permite testar a função hoje.
  if (doc_type === "presentation") {
    return {
      doc_type: "presentation",
      meta: { tone: "executive", language: "pt-BR", length: 8 },
      slides: [
        { layout: "title", content: { title: user_request.slice(0, 70), subtitle: "Gerado automaticamente" } },
        {
          layout: "title_and_content",
          content: { title: "Resumo", bullets: ["Objetivo", "Contexto", "Proposta de valor", "Próximos passos"] },
        },
      ],
    };
  } else {
    return {
      doc_type: "document",
      meta: { tone: "executive", language: "pt-BR" },
      sections: [
        { title: "Resumo Executivo", paragraphs: [user_request] },
        { title: "Objetivos", bullets: ["Alinhar expectativas", "Definir métricas", "Plano de execução"] },
      ],
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("Content-Type") ?? "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
        status: 415, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { user_request, master_template_id, preferred_layout_id } = await req.json();

    if (!user_request || !master_template_id) {
      return new Response(JSON.stringify({ error: "user_request and master_template_id are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Autenticação do usuário via Authorization: Bearer <token>
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization Bearer token" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userBearerToken = authHeader.split(" ")[1];

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(userBearerToken);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = authData.user.id;

    // 1) Master template
    const { data: masterTemplate, error: masterErr } = await supabaseAdmin
      .from("master_templates")
      .select("*")
      .eq("id", master_template_id)
      .single();

    if (masterErr || !masterTemplate) {
      return new Response(JSON.stringify({ error: "Master template not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2) Layout preferido ou primeiro disponível do master
    let templateLayout: any = null;
    if (preferred_layout_id) {
      const { data: lay, error: layErr } = await supabaseAdmin
        .from("template_layouts")
        .select("*")
        .eq("id", preferred_layout_id)
        .eq("master_template_id", master_template_id)
        .single();
      if (!layErr && lay) templateLayout = lay;
    }
    if (!templateLayout) {
      const { data: lay, error: layErr } = await supabaseAdmin
        .from("template_layouts")
        .select("*")
        .eq("master_template_id", master_template_id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single();
      if (layErr || !lay) {
        return new Response(JSON.stringify({ error: "No layout found for master template" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      templateLayout = lay;
    }

    // 3) IA (ou fallback)
    const docType: "presentation" | "document" = masterTemplate.doc_type;
    const schema = templateLayout.json_schema ?? null;
    const generated = await callAIOrFallback(user_request, docType, schema, userId, userBearerToken);

    if (!generated || generated.doc_type !== docType) {
      generated.doc_type = docType; // sanity check
    }

    // 4) Persistir em documents
    const { data: newDoc, error: insErr } = await supabaseAdmin
      .from("documents")
      .insert({
        user_id: userId,
        doc_type: docType,
        master_template_id: masterTemplate.id,
        initial_layout_id: templateLayout.id,
        json_content: generated,
        status: "draft",
      })
      .select()
      .single();

    if (insErr || !newDoc) {
      console.error("Insert documents error:", insErr?.message);
      return new Response(JSON.stringify({ error: "Failed to save new document" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 5) Snapshot inicial
    await supabaseAdmin
      .from("document_versions")
      .insert({
        document_id: newDoc.id,
        json_content_snapshot: generated,
      });

    // 6) Resposta
    return new Response(JSON.stringify({
      document_id: newDoc.id,
      json_content: newDoc.json_content,
      doc_type: newDoc.doc_type,
      message: "Document content planned successfully",
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (e: any) {
    console.error("content-planner error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
