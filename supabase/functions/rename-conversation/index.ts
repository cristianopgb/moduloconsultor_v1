// supabase/functions/rename-conversation/index.ts
// Simple function to rename a conversation title

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
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

interface RenameRequest {
  conversation_id: string;
  new_title: string;
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

    const body: RenameRequest = await req.json();
    const { conversation_id, new_title } = body;

    if (!conversation_id) {
      throw new Error("conversation_id is required");
    }

    if (!new_title || new_title.trim().length === 0) {
      throw new Error("new_title is required and cannot be empty");
    }

    // Update conversation title
    const { data, error } = await supabase
      .from("conversations")
      .update({ title: new_title.trim() })
      .eq("id", conversation_id)
      .eq("user_id", user.id) // Ensure user owns the conversation
      .select("id, title")
      .single();

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }

    if (!data) {
      throw new Error("Conversation not found or you don't have permission to modify it");
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error(`[rename-conversation] ERROR:`, error.message);

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
