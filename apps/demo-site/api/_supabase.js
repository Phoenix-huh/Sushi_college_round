/**
 * Lightweight Supabase REST client for Vercel serverless functions.
 * Uses native fetch with no external dependencies.
 */

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  return {
    url: url.trim().replace(/\/+$/, ''),
    key: key.trim(),
  };
}

export async function fetchSupabase(path, fetchFn = globalThis.fetch) {
  const config = getSupabaseConfig();
  if (!config) {
    const err = new Error('Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY) are missing');
    err.status = 500;
    throw err;
  }

  const endpoint = `${config.url}/rest/v1/${path.replace(/^\/+/, '')}`;
  const response = await fetchFn(endpoint, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err = new Error(`Supabase API responded with status ${response.status}: ${text}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}
