// supabase/functions/genius-create-task/index.ts
// Edge Function: Criar tarefa no Manus com upload de arquivos
// Features:
// - Validação rigorosa: limites, MIME types, magic bytes
// - Upload para S3 presignado via /v1/files
// - Retry com exponential backoff + jitter
// - Trace_id para correlação de logs
// - Telemetria completa
//
// CONFIGURAÇÃO NECESSÁRIA:
// No Supabase Dashboard, configure o secret MANUS_API_KEY:
// 1. Vá para Project Settings > Edge Functions
// 2. Adicione o secret: MANUS_API_KEY=<seu_token_do_manus>
// 3. O token deve ser obtido em https://manus.im (formato JWT)

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

// Validar formato do API key (deve começar com sk- e ter pelo menos 50 chars)
function validateApiKeyFormat(key: string | undefined): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: "MANUS_API_KEY não configurado" };
  }

  // Manus API keys começam com "sk-" e têm pelo menos 50 caracteres
  if (!key.startsWith('sk-')) {
    return {
      valid: false,
      error: `MANUS_API_KEY formato inválido (esperado chave iniciando com 'sk-', encontrado: '${key.substring(0, 5)}...')`
    };
  }

  if (key.length < 50) {
    return {
      valid: false,
      error: `MANUS_API_KEY muito curta (esperado pelo menos 50 caracteres, encontrado ${key.length})`
    };
  }

  return { valid: true };
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const MANUS_API_BASE = "https://api.manus.ai/v1";

// Limites
const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

// Magic bytes para validação
const MAGIC_BYTES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/png": [0x89, 0x50, 0x4e, 0x47], // PNG
  "image/jpeg": [0xff, 0xd8, 0xff], // JPEG
  "application/zip": [0x50, 0x4b, 0x03, 0x04], // ZIP (para detectar .docx/.xlsx)
};

const BLOCKED_EXTENSIONS = [".exe", ".dll", ".sh", ".bat", ".cmd", ".ps1"];

interface FileToUpload {
  filename: string;
  content: string; // base64
  size_bytes: number;
  mime_type: string;
}

// Utility: sleep com jitter
function sleep(ms: number): Promise<void> {
  const jitter = Math.random() * 200;
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

// Utility: validar magic bytes
function validateMagicBytes(base64: string, expectedMime: string): boolean {
  try {
    const binary = atob(base64.substring(0, 100));
    const bytes: number[] = [];
    for (let i = 0; i < Math.min(8, binary.length); i++) {
      bytes.push(binary.charCodeAt(i));
    }

    const expected = MAGIC_BYTES[expectedMime];
    if (!expected) return true; // Se não temos magic bytes definidos, permitir

    for (let i = 0; i < expected.length; i++) {
      if (bytes[i] !== expected[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Utility: validar extensão
function validateExtension(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return !BLOCKED_EXTENSIONS.includes(ext);
}

// Upload de arquivo para Manus com retry
async function uploadFileToManus(
  file: FileToUpload,
  traceId: string,
  attemptNum = 1
): Promise<string> {
  const maxAttempts = 3;

  try {
    console.log(
      JSON.stringify({
        event: "upload_started",
        trace_id: traceId,
        filename: file.filename,
        size_bytes: file.size_bytes,
        attempt: attemptNum,
      })
    );

    // 1. Solicitar upload_url presignado
    const createFileRes = await fetch(`${MANUS_API_BASE}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API_KEY": manusApiKey,
      },
      body: JSON.stringify({ filename: file.filename }),
    });

    if (!createFileRes.ok) {
      const errorText = await createFileRes.text();
      throw new Error(
        `Manus /files failed: ${createFileRes.status} - ${errorText}`
      );
    }

    const createFileData = await createFileRes.json();

    // Log the actual response structure for debugging
    console.log(
      JSON.stringify({
        event: "manus_files_response",
        trace_id: traceId,
        response_keys: Object.keys(createFileData),
        response: createFileData,
      })
    );

    // Handle different response structures from Manus API
    // Try multiple possible formats: { upload_url, file_id }, { upload_url, id }, or nested { file: {...} }
    let upload_url: string;
    let file_id: string;

    if (createFileData.upload_url && createFileData.file_id) {
      upload_url = createFileData.upload_url;
      file_id = createFileData.file_id;
    } else if (createFileData.upload_url && createFileData.id) {
      upload_url = createFileData.upload_url;
      file_id = createFileData.id;
    } else if (createFileData.file && createFileData.file.upload_url && createFileData.file.id) {
      upload_url = createFileData.file.upload_url;
      file_id = createFileData.file.id;
    } else if (createFileData.uploadUrl && createFileData.id) {
      upload_url = createFileData.uploadUrl;
      file_id = createFileData.id;
    } else {
      throw new Error(
        `Unexpected response format from Manus /files: ${JSON.stringify(createFileData)}`
      );
    }

    if (!upload_url || !file_id) {
      throw new Error("Missing upload_url or file_id from Manus");
    }

    // 2. Upload do conteúdo para S3 presignado
    const binaryContent = Uint8Array.from(atob(file.content), (c) =>
      c.charCodeAt(0)
    );

    const uploadStartTime = Date.now();
    const uploadRes = await fetch(upload_url, {
      method: "PUT",
      body: binaryContent,
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
      },
    });

    const uploadDuration = Date.now() - uploadStartTime;

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(
        `S3 upload failed: ${uploadRes.status} - ${errorText}`
      );
    }

    console.log(
      JSON.stringify({
        event: "upload_completed",
        trace_id: traceId,
        file_id,
        filename: file.filename,
        duration_ms: uploadDuration,
        attempt: attemptNum,
      })
    );

    return file_id;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "upload_failed",
        trace_id: traceId,
        filename: file.filename,
        attempt: attemptNum,
        error: String(error),
      })
    );

    if (attemptNum < maxAttempts) {
      const delay = Math.pow(2, attemptNum) * 1000; // 1s, 2s, 4s
      await sleep(delay);
      return uploadFileToManus(file, traceId, attemptNum + 1);
    }

    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  const traceId = crypto.randomUUID();

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

    // Validar MANUS_API_KEY
    const keyValidation = validateApiKeyFormat(manusApiKey);
    if (!keyValidation.valid) {
      console.error(JSON.stringify({
        event: "api_key_validation_failed",
        trace_id: traceId,
        error: keyValidation.error
      }));

      return new Response(
        JSON.stringify({
          error: "Serviço Genius não configurado",
          details: keyValidation.error,
          instructions: "Configure MANUS_API_KEY no Supabase Dashboard > Edge Functions"
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse payload
    const body = await req.json();
    const { prompt, files, conversation_id } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "Missing conversation_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitizar prompt (limitar a 5000 chars)
    const sanitizedPrompt = prompt.substring(0, 5000).trim();

    // Validar arquivos
    const filesToUpload: FileToUpload[] = files || [];

    if (filesToUpload.length > MAX_FILES) {
      return new Response(
        JSON.stringify({
          error: `Você pode anexar no máximo ${MAX_FILES} arquivos por tarefa`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSize = 0;
    for (const file of filesToUpload) {
      // Validar extensão
      if (!validateExtension(file.filename)) {
        return new Response(
          JSON.stringify({
            error: `O arquivo ${file.filename} tem uma extensão não permitida`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validar tamanho individual
      if (file.size_bytes > MAX_FILE_SIZE_BYTES) {
        return new Response(
          JSON.stringify({
            error: `O arquivo ${file.filename} excede o limite de 25MB`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      totalSize += file.size_bytes;

      // Validar magic bytes
      if (!validateMagicBytes(file.content, file.mime_type)) {
        return new Response(
          JSON.stringify({
            error: `O arquivo ${file.filename} não corresponde ao tipo declarado`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validar tamanho total
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      return new Response(
        JSON.stringify({
          error: `O tamanho total dos arquivos (${Math.round(totalSize / 1024 / 1024)}MB) excede o limite de 100MB`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      JSON.stringify({
        event: "task_creation_started",
        trace_id: traceId,
        user_id: user.id,
        conversation_id,
        file_count: filesToUpload.length,
        total_size_mb: Math.round(totalSize / 1024 / 1024),
      })
    );

    // Upload de arquivos
    const fileIds: string[] = [];
    for (const file of filesToUpload) {
      const fileId = await uploadFileToManus(file, traceId);
      fileIds.push(fileId);
    }

    // Criar tarefa no Manus
    const taskPayload: any = {
      prompt: sanitizedPrompt,
      agentProfile: "manus-1.5",
      taskMode: "agent",
    };

    // Adicionar attachments apenas se houver arquivos
    if (fileIds.length > 0) {
      taskPayload.attachments = fileIds.map((id, idx) => ({
        file_id: id,
        filename: filesToUpload[idx].filename,
      }));
    }

    // Se não há arquivos, o Manus vai funcionar como LLM conversacional normal

    const createTaskRes = await fetch(`${MANUS_API_BASE}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API_KEY": manusApiKey,
      },
      body: JSON.stringify(taskPayload),
    });

    if (!createTaskRes.ok) {
      const errorText = await createTaskRes.text();
      throw new Error(
        `Manus /tasks failed: ${createTaskRes.status} - ${errorText}`
      );
    }

    const taskData = await createTaskRes.json();
    const taskId = taskData.task_id || taskData.id;

    if (!taskId) {
      throw new Error("Missing task_id from Manus response");
    }

    // Salvar no banco
    const { error: dbError } = await supabase.from("genius_tasks").insert({
      task_id: taskId,
      conversation_id,
      user_id: user.id,
      prompt: sanitizedPrompt,
      status: "pending",
      file_count: filesToUpload.length,
      total_size_bytes: totalSize,
      trace_id: traceId,
    });

    if (dbError) {
      console.error("Failed to save genius_task:", dbError);
    }

    const duration = Date.now() - startTime;

    console.log(
      JSON.stringify({
        event: "task_created",
        trace_id: traceId,
        task_id: taskId,
        user_id: user.id,
        file_count: filesToUpload.length,
        total_mb: Math.round(totalSize / 1024 / 1024),
        duration_ms: duration,
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        task_id: taskId,
        trace_id: traceId,
        status: "pending",
        estimated_time_seconds: 60, // Placeholder
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(
      JSON.stringify({
        event: "task_creation_failed",
        trace_id: traceId,
        error: String(error),
        duration_ms: duration,
      })
    );

    return new Response(
      JSON.stringify({
        error: "Failed to create task",
        message: String(error),
        trace_id: traceId,
        retryable: true,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});