// supabase/functions/genius-register-webhook/index.ts
// Edge Function: Registrar webhook no Manus (automático + idempotente)

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
const appPublicUrl = Deno.env.get("APP_PUBLIC_URL") || supabaseUrl;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const MANUS_API_BASE = "https://api.manus.im/v1";

function detectEnvironment(url: string): string {
  if (url.includes("localhost")) return "development";
  if (url.includes("staging")) return "staging";
  return "production";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!manusApiKey) {
      return new Response(
        JSON.stringify({ error: "MANUS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const environment = detectEnvironment(appPublicUrl);
    const webhookUrl = `${appPublicUrl}/functions/v1/genius-webhook`;

    console.log(
      JSON.stringify({
        event: "webhook_registration_started",
        environment,
        webhook_url: webhookUrl,
      })
    );

    // Verificar se já existe webhook ativo
    const { data: existing } = await supabase
      .from("genius_webhook_registry")
      .select("*")
      .eq("environment", environment)
      .eq("active", true)
      .single();

    if (existing) {
      console.log(
        JSON.stringify({
          event: "webhook_already_registered",
          webhook_id: existing.webhook_id,
          environment,
        })
      );

      return new Response(
        JSON.stringify({
          success: true,
          webhook_id: existing.webhook_id,
          webhook_url: existing.webhook_url,
          status: "already_registered",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Testar conectividade
    try {
      const testRes = await fetch(webhookUrl, { method: "GET" });
      if (!testRes.ok && testRes.status !== 405) {
        throw new Error(`Connectivity test failed: ${testRes.status}`);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "connectivity_test_failed",
          webhook_url: webhookUrl,
          error: String(error),
        })
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "connectivity_test_failed",
          webhook_url: webhookUrl,
          instructions:
            "Registre manualmente no painel do Manus: https://manus.im/app?show_settings=integrations&app_name=api",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registrar webhook no Manus
    const registerRes = await fetch(`${MANUS_API_BASE}/webhooks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${manusApiKey}`,
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ["task_created", "task_stopped"],
      }),
    });

    if (!registerRes.ok) {
      const errorText = await registerRes.text();
      throw new Error(`Manus webhook registration failed: ${registerRes.status} - ${errorText}`);
    }

    const registerData = await registerRes.json();
    const webhookId = registerData.webhook_id || registerData.id;

    if (!webhookId) {
      throw new Error("Missing webhook_id from Manus response");
    }

    // Salvar no registro
    await supabase.from("genius_webhook_registry").insert({
      webhook_id: webhookId,
      webhook_url: webhookUrl,
      environment,
      active: true,
      verification_status: "verified",
      last_verified_at: new Date().toISOString(),
    });

    console.log(
      JSON.stringify({
        event: "webhook_registered",
        webhook_id: webhookId,
        environment,
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        webhook_id: webhookId,
        webhook_url: webhookUrl,
        status: "registered",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "webhook_registration_failed",
        error: String(error),
      })
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: "registration_failed",
        message: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
