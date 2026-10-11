/**
 * Vercel Serverless Function: GET /api/patches/:id
 *
 * Reads a single patch by ID from Supabase.
 * Powers the dashboard's Preview link (?preview_patch=<id>).
 */
import { fetchSupabase, getSupabaseConfig } from '../_supabase.js';

export async function getPatchById(id, fetchFn = globalThis.fetch) {
  if (!id) return null;
  const rows = await fetchSupabase(`patches?id=eq.${encodeURIComponent(id)}&select=*`, fetchFn);
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0];
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (!getSupabaseConfig()) {
      res.statusCode = 500;
      if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json');
      const errBody = JSON.stringify({ error: 'Supabase credentials are not configured in environment' });
      return typeof res.json === 'function' ? res.status(500).json({ error: 'Supabase credentials are not configured in environment' }) : res.end(errBody);
    }

    // Vercel populates dynamic route parameter in req.query.id
    let id = req.query?.id;
    if (!id && req.url) {
      const urlPath = req.url.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last !== 'patches') {
        id = last;
      }
    }

    if (!id) {
      if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json');
      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(400).json({ error: 'Missing patch id parameter' });
      }
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Missing patch id parameter' }));
    }

    const patch = await getPatchById(id);

    if (!patch) {
      if (typeof res.setHeader === 'function') res.setHeader('Content-Type', 'application/json');
      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(404).json({ error: 'Patch not found' });
      }
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'Patch not found' }));
    }

    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
    }

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(patch);
    }

    res.statusCode = 200;
    res.end(JSON.stringify(patch));
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
