// supabase/functions/save-preview/index.ts
// Saves HTML preview to storage using Service Role to bypass RLS

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  global: { fetch },
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SavePreviewRequest {
  html: string;
  path?: string;
  title?: string;
  conversation_id?: string | null;
  user_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Authorization token required");
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const body: SavePreviewRequest = await req.json();
    const { html, path, title, conversation_id, user_id } = body;

    if (!html || html.trim().length < 10) {
      throw new Error("HTML content is required and must be non-empty");
    }

    // Generate path if not provided
    let finalPath = path;
    if (!finalPath) {
      const safeTitle = (title || "documento")
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase();
      const timestamp = Date.now();
      const userId = user_id || user.id;
      const convId = conversation_id || "sem-conversa";
      finalPath = `u_${userId}/c_${convId}/${safeTitle}-${timestamp}.html`;
    }

    console.log(`[save-preview] Saving to: ${finalPath}`);

    // Save to storage using Service Role (bypasses RLS)
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const { error: uploadError } = await supabase.storage
      .from("previews")
      .upload(finalPath, blob, {
        upsert: true,
        contentType: "text/html",
      });

    if (uploadError) {
      console.error(`[save-preview] Upload error:`, uploadError);
      throw new Error(`Failed to save preview: ${uploadError.message}`);
    }

    console.log(`[save-preview] Saved successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        path: finalPath,
        url: `${SUPABASE_URL}/storage/v1/object/public/previews/${finalPath}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error(`[save-preview] ERROR:`, error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
