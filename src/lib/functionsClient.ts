export async function callEdgeFunction(functionName: string, body: any, options?: { method?: string, stream?: boolean }) {
  // Prefer supabase client if available (keeps auth/session)
  const method = options?.method || 'POST';
  try {
    if ((window as any).supabase && (window as any).supabase.functions && (window as any).supabase.functions.invoke) {
      // supabase.functions.invoke returns { data, error } or throws depending on SDK
      return await (window as any).supabase.functions.invoke(functionName, { body });
    }
  } catch (e) {
    // fallthrough to fetch
    console.warn('[functionsClient] supabase.functions.invoke failed, falling back to fetch:', e);
  }

  // Build URL from env or global
  const base = import.meta.env.VITE_SUPABASE_URL || (window as any).SUPABASE_FUNCTIONS_URL || '';
  const url = base ? `${base.replace(/\/$/, '')}/functions/v1/${functionName}` : `/functions/v1/${functionName}`;

  // Try to use Supabase session token if available
  let token: string | null = null;
  try {
    if ((window as any).supabase && (window as any).supabase.auth && (window as any).supabase.auth.getSession) {
      const { data } = await (window as any).supabase.auth.getSession();
      token = data?.session?.access_token || null;
    }
  } catch (e) {
    // ignore
  }

  const headers: Record<string,string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(url, { method, headers, body: JSON.stringify(body) });
  // For parity with supabase.functions.invoke, return { data, error }
  const ok = resp.ok;
  let data = null;
  try { data = await resp.json().catch(()=>null); } catch(e) { data = null; }
  if (!ok) {
    return { data: null, error: data || { status: resp.status, statusText: resp.statusText } };
  }
  return { data, error: null };
}
