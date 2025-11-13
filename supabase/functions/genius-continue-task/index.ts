// supabase/functions/genius-continue-task/index.ts
// Edge Function: Continuar tarefa quando stop_reason = ask

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const manusApiKey = Deno.env.get("MANUS_API_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const MANUS_API_BASE = "https://api.manus.ai/v1";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!manusApiKey) {
      return new Response(
        JSON.stringify({ error: "Manus API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse payload
    const body = await req.json();
    const { task_id, user_response } = body;

    if (!task_id || !user_response) {
      return new Response(
        JSON.stringify({ error: "Missing task_id or user_response" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar tarefa para validar propriedade
    const { data: taskRecord, error: fetchError } = await supabase
      .from("genius_tasks")
      .select("*")
      .eq("task_id", task_id)
      .single();

    if (fetchError || !taskRecord) {
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (taskRecord.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized to continue this task" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (taskRecord.stop_reason !== "ask") {
      return new Response(
        JSON.stringify({ error: "Task is not waiting for user response" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitizar resposta
    const sanitizedResponse = user_response.substring(0, 5000).trim();

    console.log(
      JSON.stringify({
        event: "task_continuation_started",
        task_id,
        user_id: user.id,
      })
    );

    // Continuar tarefa no Manus
    const continueRes = await fetch(`${MANUS_API_BASE}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API_KEY": manusApiKey,
      },
      body: JSON.stringify({
        taskId: task_id,
        prompt: sanitizedResponse,
        agentProfile: "manus-1.5",
      }),
    });

    if (!continueRes.ok) {
      const errorText = await continueRes.text();
      throw new Error(`Manus continuation failed: ${continueRes.status} - ${errorText}`);
    }

    // Atualizar status da tarefa
    await supabase
      .from("genius_tasks")
      .update({
        status: "running",
        stop_reason: null,
      })
      .eq("task_id", task_id);

    // Inserir mensagem do usuário
    await supabase.from("messages").insert({
      conversation_id: taskRecord.conversation_id,
      role: "user",
      content: sanitizedResponse,
      message_type: "text",
      external_task_id: task_id,
    });

    console.log(
      JSON.stringify({
        event: "task_continued",
        task_id,
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        task_id,
        status: "continued",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "task_continuation_failed",
        error: String(error),
      })
    );

    return new Response(
      JSON.stringify({
        error: "Failed to continue task",
        message: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});