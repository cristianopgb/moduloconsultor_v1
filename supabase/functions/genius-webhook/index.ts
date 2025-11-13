// supabase/functions/genius-webhook/index.ts
// Edge Function: Webhook receiver para eventos do Manus
// Features:
// - Validação de assinatura (X-Webhook-Signature + X-Webhook-Timestamp)
// - Idempotência por event_id
// - Comparação de updated_at para evitar processar eventos antigos
// - Atualização de genius_tasks e messages
// - Publicação no Realtime para notificar frontend

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Signature, X-Webhook-Timestamp",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const manusWebhookSecret = Deno.env.get("MANUS_WEBHOOK_SECRET");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// Verify Manus webhook signature using HMAC
async function verifyManusSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): Promise<boolean> {
  try {
    // Construct the signed payload: timestamp.payload
    const signedPayload = `${timestamp}.${payload}`;

    // Create HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(signatureBytes));
    const computedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Compare signatures (timing-safe)
    return timingSafeEqual(signature, computedSignature);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

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

  // Handle GET/HEAD requests (Manus webhook validation test)
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "genius-webhook",
        version: "1.0.0",
        ready: true
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();

    // Log incoming webhook headers for debugging
    const signature = req.headers.get("X-Webhook-Signature");
    const timestamp = req.headers.get("X-Webhook-Timestamp");

    console.log(JSON.stringify({
      event: "webhook_headers_received",
      has_signature: !!signature,
      has_timestamp: !!timestamp,
      has_secret_configured: !!manusWebhookSecret
    }));

    // Validate signature if secret is configured
    if (manusWebhookSecret) {
      if (!signature || !timestamp) {
        console.warn("Missing signature or timestamp headers");
        return new Response(
          JSON.stringify({
            error: "Missing webhook signature headers",
            details: "X-Webhook-Signature and X-Webhook-Timestamp required"
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify timestamp is recent (within 5 minutes)
      const timestampMs = parseInt(timestamp) * 1000;
      const now = Date.now();
      const timeDiff = Math.abs(now - timestampMs);

      if (timeDiff > 5 * 60 * 1000) {
        console.warn("Webhook timestamp too old or future");
        return new Response(
          JSON.stringify({ error: "Invalid timestamp" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify signature
      const isValid = await verifyManusSignature(rawBody, signature, timestamp, manusWebhookSecret);

      if (!isValid) {
        console.warn("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // If no secret configured, accept all webhooks (for initial setup/testing)
      console.warn("MANUS_WEBHOOK_SECRET not configured - accepting webhook without validation");
    }

    // Parse payload
    const payload = JSON.parse(rawBody);

    // Log full payload structure for debugging
    console.log(JSON.stringify({
      event: "webhook_payload_received",
      payload_keys: Object.keys(payload),
      payload_preview: {
        event_id: payload.event_id,
        event_type: payload.event_type,
        has_task_detail: !!payload.task_detail,
        task_detail_keys: payload.task_detail ? Object.keys(payload.task_detail) : []
      }
    }));

    const { event_id, event_type, task_detail } = payload;

    if (!event_id || !event_type || !task_detail) {
      console.error(JSON.stringify({
        event: "invalid_payload_structure",
        received_keys: Object.keys(payload),
        missing_fields: {
          event_id: !event_id,
          event_type: !event_type,
          task_detail: !task_detail
        }
      }));

      return new Response(
        JSON.stringify({
          error: "Invalid payload",
          details: "Missing required fields: event_id, event_type, or task_detail"
        }),
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

      // Find existing message with this task_id
      const { data: existingMessage } = await supabase
        .from("messages")
        .select("*")
        .eq("external_task_id", task_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingMessage && existingMessage.role === "assistant") {
        // Update existing assistant message
        const messageUpdate: any = {
          genius_status: stop_reason === "finish" ? "completed" : stop_reason === "ask" ? "ask" : "failed",
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
          .eq("id", existingMessage.id);

        console.log(
          JSON.stringify({
            event: "message_updated",
            message_id: existingMessage.id,
            task_id,
          })
        );
      } else {
        // Create new assistant message if none exists
        const newMessage: any = {
          conversation_id: taskRecord.conversation_id,
          role: "assistant",
          content: message || "Tarefa concluída",
          message_type: stop_reason === "finish" ? "genius_result" : "genius_error",
          external_task_id: task_id,
          genius_status: stop_reason === "finish" ? "completed" : stop_reason === "ask" ? "ask" : "failed",
        };

        if (updateData.attachments) {
          newMessage.genius_attachments = updateData.attachments;
        }

        if (updateData.credit_usage !== undefined) {
          newMessage.genius_credit_usage = updateData.credit_usage;
        }

        const { data: insertedMessage, error: insertError } = await supabase
          .from("messages")
          .insert(newMessage)
          .select()
          .single();

        if (insertError) {
          console.error(
            JSON.stringify({
              event: "message_insert_failed",
              task_id,
              error: insertError,
            })
          );
        } else {
          console.log(
            JSON.stringify({
              event: "message_created",
              message_id: insertedMessage.id,
              task_id,
            })
          );
        }
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
