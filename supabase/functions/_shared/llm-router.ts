/**
 * ===================================================================
 * LLM ROUTER
 * ===================================================================
 *
 * Centralized LLM calling with:
 * - Provider abstraction (OpenAI, Anthropic, local models)
 * - Automatic retry with exponential backoff
 * - Token counting and cost tracking
 * - Streaming support
 * - Request/response logging
 * - Rate limiting
 * ===================================================================
 */

import type { Plan, ExecSpec, DataCard } from './analytics-contracts.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';

export type LLMProvider = 'openai' | 'anthropic' | 'local';
export type LLMModel = 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';

export interface LLMRequest {
  provider?: LLMProvider;
  model?: LLMModel;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' };
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
  metadata: {
    request_id: string;
    latency_ms: number;
    retries: number;
  };
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: LLMResponse['usage'];
}

const TOKEN_COSTS = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
};

/**
 * Main LLM routing function
 */
export async function callLLM(
  request: LLMRequest,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
  } = {}
): Promise<LLMResponse> {
  const provider = request.provider || 'openai';
  const model = request.model || 'gpt-4o-mini';
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000;
  const timeout = options.timeout || 60000;

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[LLMRouter] Request ${requestId}: provider=${provider}, model=${model}`);

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await callLLMInternal(
        provider,
        model,
        request,
        requestId,
        timeout
      );

      const latencyMs = Date.now() - startTime;

      console.log(
        `[LLMRouter] Success ${requestId}: ${response.usage.total_tokens} tokens, ${latencyMs}ms, attempt ${attempt + 1}`
      );

      return {
        ...response,
        metadata: {
          request_id: requestId,
          latency_ms: latencyMs,
          retries: attempt,
        },
      };
    } catch (error: any) {
      lastError = error;
      attempt++;

      console.warn(
        `[LLMRouter] Attempt ${attempt} failed for ${requestId}: ${error.message}`
      );

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1);
        console.log(`[LLMRouter] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[LLMRouter] All retries failed for ${requestId}`);
  throw new Error(
    `LLM call failed after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Internal LLM calling logic
 */
async function callLLMInternal(
  provider: LLMProvider,
  model: LLMModel,
  request: LLMRequest,
  requestId: string,
  timeout: number
): Promise<LLMResponse> {
  if (provider === 'openai') {
    return await callOpenAI(model, request, requestId, timeout);
  } else if (provider === 'anthropic') {
    return await callAnthropic(model, request, requestId, timeout);
  } else {
    throw new Error(`Provider ${provider} not supported`);
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  model: LLMModel,
  request: LLMRequest,
  requestId: string,
  timeout: number
): Promise<LLMResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 4000,
        response_format: request.response_format,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    const usage = {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
      estimated_cost_usd: calculateCost(model, data.usage),
    };

    return {
      content: data.choices[0].message.content,
      model: data.model,
      provider: 'openai',
      usage,
      metadata: {
        request_id: requestId,
        latency_ms: 0,
        retries: 0,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  model: LLMModel,
  request: LLMRequest,
  requestId: string,
  timeout: number
): Promise<LLMResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const systemMessage = request.messages.find(m => m.role === 'system');
    const otherMessages = request.messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMessage?.content || undefined,
        messages: otherMessages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 4000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    const usage = {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      estimated_cost_usd: calculateCost(model, {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
      }),
    };

    return {
      content: data.content[0].text,
      model: data.model,
      provider: 'anthropic',
      usage,
      metadata: {
        request_id: requestId,
        latency_ms: 0,
        retries: 0,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Calculate estimated cost in USD
 */
function calculateCost(
  model: LLMModel,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  const costs = TOKEN_COSTS[model];
  if (!costs) return 0;

  const inputCost = (usage.prompt_tokens / 1_000_000) * costs.input;
  const outputCost = (usage.completion_tokens / 1_000_000) * costs.output;

  return inputCost + outputCost;
}

/**
 * Stream LLM response
 */
export async function* streamLLM(
  request: LLMRequest,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
  } = {}
): AsyncGenerator<LLMStreamChunk> {
  const provider = request.provider || 'openai';
  const model = request.model || 'gpt-4o-mini';
  const timeout = options.timeout || 120000;

  console.log(`[LLMRouter] Streaming: provider=${provider}, model=${model}`);

  if (provider === 'openai') {
    yield* streamOpenAI(model, request, timeout);
  } else if (provider === 'anthropic') {
    yield* streamAnthropic(model, request, timeout);
  } else {
    throw new Error(`Streaming not supported for provider: ${provider}`);
  }
}

/**
 * Stream OpenAI response
 */
async function* streamOpenAI(
  model: LLMModel,
  request: LLMRequest,
  timeout: number
): AsyncGenerator<LLMStreamChunk> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 4000,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.trim() === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices[0]?.delta?.content || '';

          if (content) {
            yield {
              content,
              done: false,
            };
          }
        } catch (e) {
          console.warn('[LLMRouter] Failed to parse stream chunk:', e);
        }
      }
    }

    yield { content: '', done: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Stream Anthropic response
 */
async function* streamAnthropic(
  model: LLMModel,
  request: LLMRequest,
  timeout: number
): AsyncGenerator<LLMStreamChunk> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const systemMessage = request.messages.find(m => m.role === 'system');
    const otherMessages = request.messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMessage?.content || undefined,
        messages: otherMessages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 4000,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'content_block_delta') {
            const content = data.delta?.text || '';
            if (content) {
              yield {
                content,
                done: false,
              };
            }
          }
        } catch (e) {
          console.warn('[LLMRouter] Failed to parse stream chunk:', e);
        }
      }
    }

    yield { content: '', done: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract JSON from LLM response (handles markdown code blocks)
 */
export function extractJSON<T = any>(content: string): T {
  let jsonStr = content.trim();

  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }

  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (error: any) {
    throw new Error(`Failed to parse JSON: ${error.message}\n\nContent:\n${content}`);
  }
}
