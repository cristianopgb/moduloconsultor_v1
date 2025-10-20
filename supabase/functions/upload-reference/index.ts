import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UploadRequest {
  filename: string;
  content_base64: string;
  bucket: string;
}

// Sanitize filename to prevent path traversal
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, '_');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[DEBUG upload-reference] Request received');

    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[DEBUG upload-reference] Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userJwt = authHeader.replace('Bearer ', '');
    console.log('[DEBUG upload-reference] JWT received');

    // Validate JWT and get user_id by calling Supabase Auth API with Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[DEBUG upload-reference] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DEBUG upload-reference] Validating JWT with Auth API...');
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${userJwt}`,
        'apikey': serviceRoleKey,
      },
    });

    if (!userResponse.ok) {
      console.error('[DEBUG upload-reference] JWT validation failed:', userResponse.status);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    console.log('[DEBUG upload-reference] JWT validated, user_id:', userId);

    // Parse request body
    const body: UploadRequest = await req.json();
    const { filename, content_base64, bucket } = body;

    if (!filename || !content_base64 || !bucket) {
      console.error('[DEBUG upload-reference] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: filename, content_base64, bucket' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DEBUG upload-reference] Filename:', filename, 'Bucket:', bucket);

    // Sanitize filename and create safe path
    const safeFilename = sanitizeFilename(filename);
    const objectPath = `${userId}/${safeFilename}`;
    console.log('[DEBUG upload-reference] Safe path:', objectPath);

    // Decode base64 content
    const binaryString = atob(content_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    console.log('[DEBUG upload-reference] File decoded, size:', bytes.length, 'bytes');

    // Upload to Storage using Service Role
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;
    console.log('[DEBUG upload-reference] Uploading to:', uploadUrl);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'x-upsert': 'true',
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[DEBUG upload-reference] Upload failed:', uploadResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${errorText}` }),
        { status: uploadResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DEBUG upload-reference] Upload successful!');

    return new Response(
      JSON.stringify({
        success: true,
        bucket,
        path: objectPath,
        userId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[DEBUG upload-reference] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});