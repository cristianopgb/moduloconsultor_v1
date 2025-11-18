/**
 * ===================================================================
 * RESPONSE HELPERS - Standardized Response Formatting
 * ===================================================================
 *
 * Provides consistent response formatting across Edge Functions.
 * Implements graceful degradation policy:
 * - 400: Only for invalid input (no data provided)
 * - 200: For all processing results (success or fallback)
 * ===================================================================
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

export interface ResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  includeTimestamp?: boolean;
}

/**
 * Return successful JSON response (200)
 */
export function jsonOk(data: unknown, options: ResponseOptions = {}): Response {
  const { status = 200, headers = {}, includeTimestamp = true } = options;

  const responseData = includeTimestamp
    ? { ...data, timestamp: new Date().toISOString() }
    : data;

  return new Response(JSON.stringify(responseData), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Return error response (use only for client errors)
 * CRITICAL: Only use for 400 (bad request) - not for processing failures
 */
export function jsonError(
  code: number,
  message: string,
  extra: Record<string, unknown> = {}
): Response {
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
        ...CORS_HEADERS,
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
  diagnostics: Record<string, unknown> = {}
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
  });
}

/**
 * Return OPTIONS preflight response
 */
export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
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
