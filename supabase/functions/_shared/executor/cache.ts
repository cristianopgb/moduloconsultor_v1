/**
 * ===================================================================
 * EXECUTION CACHE
 * ===================================================================
 *
 * Hash-based caching for execution results
 * - Cache key: SHA-256(ExecSpec + dataset_id)
 * - Cache storage: execution_lineage table (status = 'cached')
 * - TTL: 1 hour (configurable)
 * ===================================================================
 */

import type { ExecSpec, ExecResult } from '../analytics-contracts.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
});

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate hash for ExecSpec + dataset_id
 */
export async function generateCacheKey(
  execSpec: ExecSpec,
  dataset_id: string
): Promise<string> {
  const payload = JSON.stringify({ execSpec, dataset_id });
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Check if cached result exists
 */
export async function checkCache(
  execSpec: ExecSpec,
  dataset_id: string
): Promise<ExecResult | null> {
  try {
    const cacheKey = await generateCacheKey(execSpec, dataset_id);

    console.log(`[Cache] Checking cache for key: ${cacheKey.substring(0, 16)}...`);

    const { data, error } = await supabase
      .from('execution_lineage')
      .select('*')
      .eq('exec_spec_hash', cacheKey)
      .eq('status', 'cached')
      .gte('created_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[Cache] Error checking cache:', error.message);
      return null;
    }

    if (!data) {
      console.log('[Cache] Cache miss');
      return null;
    }

    console.log('[Cache] Cache hit!');

    // Reconstruct ExecResult from lineage record
    const cachedResult: ExecResult = {
      exec_id: data.exec_id,
      success: data.status === 'cached',
      data: data.result_summary?.data || [],
      warnings: data.result_summary?.warnings || [],
      execution_time_ms: data.execution_time_ms || 0,
      rows_processed: data.result_summary?.rows_processed || 0,
      rows_returned: data.result_summary?.rows_returned || 0,
      policies_applied: data.result_summary?.policies_applied || [],
      created_at: data.created_at,
    };

    return cachedResult;

  } catch (error: any) {
    console.warn('[Cache] Exception during cache check:', error.message);
    return null;
  }
}

/**
 * Save result to cache
 */
export async function saveToCache(
  execSpec: ExecSpec,
  dataset_id: string,
  result: ExecResult
): Promise<void> {
  try {
    const cacheKey = await generateCacheKey(execSpec, dataset_id);

    console.log(`[Cache] Saving to cache: ${cacheKey.substring(0, 16)}...`);

    // Store in execution_lineage table
    const { error } = await supabase
      .from('execution_lineage')
      .insert({
        exec_id: result.exec_id,
        exec_spec_hash: cacheKey,
        exec_spec: execSpec as any,
        data_card_summary: { dataset_id },
        result_summary: {
          data: result.data.slice(0, 1000), // Store first 1000 rows only
          warnings: result.warnings,
          rows_processed: result.rows_processed,
          rows_returned: result.rows_returned,
          policies_applied: result.policies_applied,
        },
        user_id: null, // System cache (no specific user)
        conversation_id: null,
        status: 'cached',
        execution_time_ms: result.execution_time_ms,
      });

    if (error) {
      console.warn('[Cache] Error saving to cache:', error.message);
    } else {
      console.log('[Cache] Saved successfully');
    }

  } catch (error: any) {
    console.warn('[Cache] Exception during cache save:', error.message);
  }
}

/**
 * Invalidate cache for a dataset
 */
export async function invalidateCache(dataset_id: string): Promise<void> {
  try {
    console.log(`[Cache] Invalidating cache for dataset: ${dataset_id}`);

    const { error } = await supabase
      .from('execution_lineage')
      .delete()
      .eq('status', 'cached')
      .contains('data_card_summary', { dataset_id });

    if (error) {
      console.warn('[Cache] Error invalidating cache:', error.message);
    } else {
      console.log('[Cache] Cache invalidated');
    }

  } catch (error: any) {
    console.warn('[Cache] Exception during cache invalidation:', error.message);
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanExpiredCache(): Promise<void> {
  try {
    const expiryDate = new Date(Date.now() - CACHE_TTL_MS).toISOString();

    console.log(`[Cache] Cleaning entries older than ${expiryDate}`);

    const { error } = await supabase
      .from('execution_lineage')
      .delete()
      .eq('status', 'cached')
      .lt('created_at', expiryDate);

    if (error) {
      console.warn('[Cache] Error cleaning cache:', error.message);
    } else {
      console.log('[Cache] Expired entries cleaned');
    }

  } catch (error: any) {
    console.warn('[Cache] Exception during cache cleanup:', error.message);
  }
}
