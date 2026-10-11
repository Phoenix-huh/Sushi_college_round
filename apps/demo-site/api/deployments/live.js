/**
 * Vercel Serverless Function: GET /api/deployments/live
 *
 * Reads the live deployment from Supabase, resolves its version and patches in order,
 * and returns { deployment, version, patches, signature }.
 *
 * Caches with Cache-Control: s-maxage=2, stale-while-revalidate=5 so many visitors cost
 * only 1 Supabase invocation per 2 seconds.
 */
import { fetchSupabase, getSupabaseConfig } from '../_supabase.js';

export async function getLiveDeploymentData(fetchFn = globalThis.fetch) {
  // 1. Fetch the live deployment and its associated version
  const deployments = await fetchSupabase('deployments?is_live=eq.true&select=*,versions(*)', fetchFn);
  
  if (!deployments || !Array.isArray(deployments) || deployments.length === 0 || !deployments[0].versions) {
    return {
      deployment: null,
      version: null,
      patches: [],
      signature: 'none',
    };
  }

  const liveDep = deployments[0];
  const { versions: version, ...deployment } = liveDep;
  const patchIds = Array.isArray(version.patch_ids) ? version.patch_ids : [];

  let patches = [];
  if (patchIds.length > 0) {
    // 2. Fetch the patches that belong to this version
    const patchRows = await fetchSupabase(`patches?id=in.(${patchIds.join(',')})&select=*`, fetchFn);
    if (Array.isArray(patchRows)) {
      // Preserve the exact order specified by version.patch_ids
      patches = patchIds
        .map((id) => patchRows.find((p) => p && p.id === id))
        .filter(Boolean);
    }
  }

  // 3. Compute deterministic signature
  const signature = `${deployment.id}|${patches.map((p) => `${p.id}@${p.updated_at}`).join(',')}`;

  return {
    deployment,
    version,
    patches,
    signature,
  };
}

export default async function handler(req, res) {
  try {
    if (!getSupabaseConfig()) {
      res.statusCode = 500;
      if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json');
      const errBody = JSON.stringify({ error: 'Supabase credentials are not configured in environment' });
      return typeof res.json === 'function' ? res.status(500).json({ error: 'Supabase credentials are not configured in environment' }) : res.end(errBody);
    }

    const data = await getLiveDeploymentData();

    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
    }

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(data);
    }

    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (error) {
    const status = error.status || 500;
    if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json');
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(status).json({ error: error.message || 'Internal Server Error' });
    }
    res.statusCode = status;
    res.end(JSON.stringify({ error: error.message || 'Internal Server Error' }));
  }
}
