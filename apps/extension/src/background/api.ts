/**
 * Patchwork server client. Runs ONLY in the background service worker.
 *
 * - Reads the server URL and author id from settings on every call, so a change
 *   in the side panel applies immediately (the worker keeps no copy).
 * - Every request carries `x-actor-id` (the server uses it to know who acts).
 * - Failures become ApiError with a message a person can act on.
 */
import { normalizeAnchor, type LivePatch, type LiveState, type Settings } from '../messages';

export class ApiError extends Error {
  /** HTTP status, or null when the server could not be reached at all. */
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiDeps {
  getSettings: () => Promise<Settings>;
  fetch: typeof fetch;
  /** Per-request timeout. Default 5000 ms. */
  timeoutMs?: number;
}

export interface HealthResponse {
  ok: true;
  store: string;
}

function describeServerError(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const e = (body as { error: unknown }).error;
    if (typeof e === 'string') return e;
    if (e !== undefined) return JSON.stringify(e).slice(0, 300);
  }
  return '';
}

const CHANGE_TYPES = ['text', 'style', 'visibility', 'script'];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keeps only what the applier needs, and checks the shape (the server is not trusted blindly). */
function toLivePatch(raw: unknown): LivePatch | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.change)) return null;
  const anchors = normalizeAnchor(raw.anchors);
  const c = raw.change;
  if (!anchors || typeof c.value !== 'string' || typeof c.type !== 'string' || !CHANGE_TYPES.includes(c.type)) return null;
  return {
    id: raw.id,
    target_url: typeof raw.target_url === 'string' ? raw.target_url : '',
    anchors,
    change: { type: c.type as LivePatch['change']['type'], value: c.value },
  };
}

export function createApi(deps: ApiDeps) {
  const timeoutMs = deps.timeoutMs ?? 5000;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { serverUrl, authorId } = await deps.getSettings();
    const headers: Record<string, string> = { 'x-actor-id': authorId };
    // Only send a JSON content-type when there is a body (the server rejects an empty JSON body).
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await deps.fetch(serverUrl + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError(`No answer from ${serverUrl} after ${Math.round(timeoutMs / 1000)}s`, null);
      }
      throw new ApiError(`Cannot reach ${serverUrl}. Is the Patchwork server running?`, null);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }

    if (!res.ok) {
      const detail = describeServerError(json);
      throw new ApiError(`Server returned ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
    }
    if (text && json === undefined) {
      throw new ApiError(`${serverUrl}${path} did not return JSON. Is this a Patchwork server?`, res.status);
    }
    return json as T;
  }

  return {
    request,

    /** GET /deployments/live. Patches with an unusable shape are dropped (and counted in `dropped`). */
    async liveState(): Promise<LiveState & { dropped: number }> {
      const body = await request<unknown>('GET', '/deployments/live');
      if (!isRecord(body) || !Array.isArray(body.patches) || typeof body.signature !== 'string') {
        throw new ApiError('That address answered, but not with a Patchwork live deployment.', null);
      }
      const patches = body.patches.map(toLivePatch).filter((p): p is LivePatch => p !== null);
      return { signature: body.signature, patches, dropped: body.patches.length - patches.length };
    },

    /** GET /health. Rejects unless the answer looks like a Patchwork server. */
    async health(): Promise<HealthResponse> {
      const h = await request<{ ok?: unknown; store?: unknown } | undefined>('GET', '/health');
      if (!h || h.ok !== true) throw new ApiError('That address answered, but it is not a Patchwork server.', null);
      return { ok: true, store: typeof h.store === 'string' ? h.store : 'unknown' };
    },
  };
}

export type Api = ReturnType<typeof createApi>;
