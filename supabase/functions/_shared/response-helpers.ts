/**
 * ===================================================================
 * RESPONSE HELPERS - Standardized Response Formatting
 * ===================================================================
 *
 * Provides consistent response formatting across Edge Functions.
 * Implements graceful degradation policy:
 * - 400: Only for invalid input (no data provided)
 * - 200: For all processing results (success or fallback)
 *
 * CORS STRATEGY:
 * - Dynamically echoes Access-Control-Request-Headers from preflight
 * - Ensures all responses (2xx, 4xx, 5xx) include CORS headers
 * - Prevents browser from blocking responses due to missing headers
 * ===================================================================
 */

const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Requested-With, Accept, Accept-Language, Content-Language, X-Supabase-Api-Version, Prefer',
  'Access-Control-Max-Age': '86400',
};

export const corsHeaders = BASE_CORS_HEADERS;

/**
 * Build CORS headers dynamically based on the request
 * Echoes Access-Control-Request-Headers if present (more permissive)
 */
export function buildCorsHeaders(req?: Request): Record<string, string> {
  if (!req) return BASE_CORS_HEADERS;

  const requestedHeaders = req.headers.get('Access-Control-Request-Headers');

  if (requestedHeaders) {
    return {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Headers': requestedHeaders,
    };
  }

  return BASE_CORS_HEADERS;
}

export interface ResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  includeTimestamp?: boolean;
  req?: Request;
}

/**
 * Return successful JSON response (200)
 */
export function jsonOk(data: unknown, options: ResponseOptions = {}): Response {
  const { status = 200, headers = {}, includeTimestamp = true, req } = options;

  const responseData = includeTimestamp
    ? { ...data, timestamp: new Date().toISOString() }
    : data;

  const corsHeaders = buildCorsHeaders(req);

  return new Response(JSON.stringify(responseData), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Return error response (use only for client errors)
 * CRITICAL: Only use for 400 (bad request) - not for processing failures
 * ALWAYS includes CORS headers to prevent browser blocking
 */
export function jsonError(
  code: number,
  message: string,
  extra: Record<string, unknown> = {},
  req?: Request
): Response {
  const corsHeaders = buildCorsHeaders(req);

  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
    {
      status: code,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Return fallback response (200 with is_fallback flag)
 * Use when processing encountered issues but can provide partial results
 */
export function jsonFallback(
  data: unknown,
  reason: string,
  diagnostics: Record<string, unknown> = {},
  req?: Request
): Response {
  return jsonOk({
    success: true,
    is_fallback: true,
    fallback_reason: reason,
    ...data,
    diagnostics: {
      timestamp: new Date().toISOString(),
      ...diagnostics,
    },
  }, { req });
}

/**
 * Return OPTIONS preflight response with dynamic header echoing
 */
export function corsPreflightResponse(req?: Request): Response {
  const corsHeaders = buildCorsHeaders(req);

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Sanitize JSON for transmission (remove undefined, handle Date objects)
 */
export function sanitizeForJson<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) => {
      if (value === undefined) return null;
      if (value instanceof Date) return value.toISOString();
      return value;
    })
  );
}

/**
 * Build diagnostic payload for debugging
 */
export function buildDiagnostics(input: {
  payload_size?: number;
  rows_count?: number;
  columns_count?: number;
  has_parsed_rows?: boolean;
  has_parts?: boolean;
  has_dataset_id?: boolean;
  has_file_data?: boolean;
  frontend_parsed?: boolean;
  [key: string]: unknown;
}): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    ...input,
  };
}

/**
 * Validate conversation_id (relaxed - accepts UUID-like strings)
 */
export function safeConversationId(maybe: unknown): string {
  const s = String(maybe || '');
  const uuidLike = /^[0-9a-f-]{10,}$/i.test(s);

  if (uuidLike) return s;

  // Generate a new UUID if invalid
  return crypto.randomUUID();
}

/**
 * Check if payload size is within limits
 */
export function checkPayloadSize(
  payload: unknown,
  maxBytes: number = 3_000_000
): { ok: boolean; size: number; exceeded: boolean } {
  const size = JSON.stringify(payload || {}).length;
  const exceeded = size > maxBytes;

  return {
    ok: !exceeded,
    size,
    exceeded,
  };
}
