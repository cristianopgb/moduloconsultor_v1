// supabase/functions/genius-webhook/index.ts
// Edge Function: Webhook receiver para eventos do Manus
// Features:
// - Validação de assinatura (X-Webhook-Secret)
// - Idempotência por event_id
// - Comparação de updated_at para evitar processar eventos antigos
// - Atualização de genius_tasks e messages
// - Publicação no Realtime para notificar frontend

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("GENIUS_WEBHOOK_SECRET");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// Timing-safe comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Validar assinatura
    const receivedSecret = req.headers.get("X-Webhook-Secret");

    if (!webhookSecret) {
      console.error("GENIUS_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!receivedSecret || !timingSafeEqual(receivedSecret, webhookSecret)) {
      console.warn("Invalid webhook secret received");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse payload
    const payload = await req.json();
    const { event_id, event_type, task_detail } = payload;

    if (!event_id || !event_type || !task_detail) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { task_id, message, stop_reason, attachments, credit_usage } = task_detail;

    if (!task_id) {
      return new Response(
        JSON.stringify({ error: "Missing task_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair IP de origem
    const sourceIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    console.log(
      JSON.stringify({
        event: "webhook_received",
        event_id,
        event_type,
        task_id,
        stop_reason,
        source_ip: sourceIp,
      })
    );

    // Verificar idempotência
    const { data: existingEvent } = await supabase
      .from("genius_task_events")
      .select("id")
      .eq("task_id", task_id)
      .eq("event_id", event_id)
      .single();

    if (existingEvent) {
      console.log(
        JSON.stringify({
          event: "webhook_already_processed",
          event_id,
          task_id,
        })
      );

      return new Response(
        JSON.stringify({ success: true, already_processed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inserir evento na auditoria
    await supabase.from("genius_task_events").insert({
      task_id,
      event_id,
      event_type,
      payload,
      source_ip: sourceIp,
    });

    // Se for task_created, apenas logar
    if (event_type === "task_created") {
      console.log(
        JSON.stringify({
          event: "task_created_logged",
          task_id,
        })
      );

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se for task_stopped, atualizar genius_tasks
    if (event_type === "task_stopped") {
      // Buscar registro existente
      const { data: taskRecord, error: fetchError } = await supabase
        .from("genius_tasks")
        .select("*")
        .eq("task_id", task_id)
        .single();

      if (fetchError || !taskRecord) {
        console.error(
          JSON.stringify({
            event: "task_not_found",
            task_id,
            error: fetchError,
          })
        );

        return new Response(
          JSON.stringify({ error: "Task not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calcular latência
      const createdAt = new Date(taskRecord.created_at).getTime();
      const now = Date.now();
      const latencyMs = now - createdAt;

      // Preparar dados de atualização
      const updateData: any = {
        updated_at: new Date().toISOString(),
        latency_ms: latencyMs,
      };

      if (stop_reason === "finish") {
        updateData.status = "completed";
        updateData.stop_reason = "finish";

        if (message) updateData.message = message;
        if (credit_usage !== undefined) updateData.credit_usage = credit_usage;

        // Processar attachments: adicionar expires_at
        if (attachments && Array.isArray(attachments)) {
          const processedAttachments = attachments.map((att: any) => {
            const expiresAt = att.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            return {
              file_name: att.file_name || att.filename,
              url: att.url,
              size_bytes: att.size_bytes || att.size || 0,
              mime_type: att.mime_type || att.type || "application/octet-stream",
              expires_at: expiresAt,
            };
          });
          updateData.attachments = processedAttachments;
        }

        if (task_detail.task_url) {
          updateData.task_url = task_detail.task_url;
        }
      } else if (stop_reason === "ask") {
        updateData.status = "completed";
        updateData.stop_reason = "ask";
        if (message) updateData.message = message;
      } else {
        updateData.status = "failed";
        updateData.stop_reason = "timeout";
        updateData.error_message = message || "Unknown error";
      }

      // Atualizar genius_tasks (comparar updated_at para evitar overwrite de eventos antigos)
      const { error: updateError } = await supabase
        .from("genius_tasks")
        .update(updateData)
        .eq("task_id", task_id)
        .lt("updated_at", updateData.updated_at); // Apenas atualizar se mais recente

      if (updateError) {
        console.error(
          JSON.stringify({
            event: "task_update_failed",
            task_id,
            error: updateError,
          })
        );
      }

      // Buscar mensagem correspondente em messages
      const { data: messageRecord } = await supabase
        .from("messages")
        .select("*")
        .eq("external_task_id", task_id)
        .single();

      if (messageRecord) {
        const messageUpdate: any = {
          genius_status: stop_reason === "finish" ? "finished" : stop_reason === "ask" ? "ask" : "failed",
        };

        if (updateData.attachments) {
          messageUpdate.genius_attachments = updateData.attachments;
        }

        if (updateData.credit_usage !== undefined) {
          messageUpdate.genius_credit_usage = updateData.credit_usage;
        }

        if (message) {
          messageUpdate.content = message;
        }

        await supabase
          .from("messages")
          .update(messageUpdate)
          .eq("id", messageRecord.id);

        console.log(
          JSON.stringify({
            event: "message_updated",
            message_id: messageRecord.id,
            task_id,
          })
        );
      }

      console.log(
        JSON.stringify({
          event: "webhook_processed",
          task_id,
          stop_reason,
          latency_ms: latencyMs,
        })
      );

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Evento desconhecido
    return new Response(
      JSON.stringify({ success: true, event_type_unknown: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "webhook_error",
        error: String(error),
      })
    );

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
