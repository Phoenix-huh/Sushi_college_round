import { describe, expect, it } from 'vitest';
import { ApiError, createApi } from './api';

const settings = { serverUrl: 'http://srv.test:4000', authorId: '00000000-0000-0000-0000-000000000001' };

type Call = { url: string; init: RequestInit };
function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { fn, calls };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  it('sends x-actor-id and no content-type on a body-less GET', async () => {
    const f = fakeFetch(() => json({ ok: true, store: 'memory' }));
    const api = createApi({ getSettings: async () => settings, fetch: f.fn });
    await api.health();
    expect(f.calls[0]!.url).toBe('http://srv.test:4000/health');
    const headers = f.calls[0]!.init.headers as Record<string, string>;
    expect(headers['x-actor-id']).toBe(settings.authorId);
    expect(headers['Content-Type']).toBeUndefined();
    expect(f.calls[0]!.init.cache).toBe('no-store');
  });

  it('sends a JSON content-type and body when there is a body', async () => {
    const f = fakeFetch(() => json({ id: 'x' }));
    const api = createApi({ getSettings: async () => settings, fetch: f.fn });
    await api.request('POST', '/patches', { a: 1 });
    const headers = f.calls[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(f.calls[0]!.init.body).toBe('{"a":1}');
  });

  it('reads settings on every call, so a settings change applies at once', async () => {
    let current = settings;
    const f = fakeFetch(() => json({ ok: true, store: 'memory' }));
    const api = createApi({ getSettings: async () => current, fetch: f.fn });
    await api.health();
    current = { ...settings, serverUrl: 'http://moved.test:1' };
    await api.health();
    expect(f.calls.map((c) => c.url)).toEqual(['http://srv.test:4000/health', 'http://moved.test:1/health']);
  });

  it('health() reports the data store', async () => {
    const api = createApi({ getSettings: async () => settings, fetch: fakeFetch(() => json({ ok: true, store: 'supabase' })).fn });
    expect(await api.health()).toEqual({ ok: true, store: 'supabase' });
  });

  it('health() refuses an answer that is not from a Patchwork server', async () => {
    for (const body of [{ hello: 'world' }, { ok: false }, [], 'x']) {
      const api = createApi({ getSettings: async () => settings, fetch: fakeFetch(() => json(body)).fn });
      await expect(api.health()).rejects.toThrow('not a Patchwork server');
    }
  });

  it('maps a network failure to a readable ApiError with no status', async () => {
    const f = fakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const api = createApi({ getSettings: async () => settings, fetch: f.fn });
    const err = await api.health().catch((e: unknown) => e);
    expect(err instanceof ApiError).toBe(true);
    expect((err as ApiError).status).toBeNull();
    expect((err as ApiError).message).toContain('Cannot reach http://srv.test:4000');
  });

  it('maps an HTTP error to its status and the server message', async () => {
    const api = createApi({ getSettings: async () => settings, fetch: fakeFetch(() => json({ error: 'No live deployment to rollback' }, 400)).fn });
    const err = (await api.request('POST', '/rollback').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(400);
    expect(err.message).toBe('Server returned 400: No live deployment to rollback');
  });

  it('copes with an HTML error page and with a non-JSON success page', async () => {
    const bad = createApi({ getSettings: async () => settings, fetch: fakeFetch(() => new Response('<h1>Bad gateway</h1>', { status: 502 })).fn });
    expect(((await bad.request('GET', '/x').catch((e: unknown) => e)) as ApiError).message).toBe('Server returned 502');
    const html = createApi({ getSettings: async () => settings, fetch: fakeFetch(() => new Response('<html></html>', { status: 200 })).fn });
    await expect(html.request('GET', '/x')).rejects.toThrow('did not return JSON');
  });

  it('times out when the server never answers', async () => {
    const hang = (async (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    const api = createApi({ getSettings: async () => settings, fetch: hang, timeoutMs: 30 });
    const started = Date.now();
    await expect(api.health()).rejects.toThrow('No answer from http://srv.test:4000');
    expect(Date.now() - started < 2000).toBe(true);
  });
});

describe('live patches with the visual-patching change types', () => {
  it('keeps attribute, remove, move and behavior patches (and still drops unknown types)', async () => {
    const anchor = { cssSelector: '#a', xpath: '', textContent: 'A', attributes: {}, parentContext: '', siblingContext: [] };
    const mk = (id: string, type: string, value: string) => ({ id, target_url: 'http://x.test/', anchors: anchor, change: { type, value }, updated_at: 't' });
    const body = {
      deployment: null, version: null, signature: 's',
      patches: [mk('1', 'attribute', '{"name":"alt","value":"x"}'), mk('2', 'remove', 'remove'), mk('3', 'move', '{}'), mk('4', 'behavior', '{"action":"disable"}'), mk('5', 'teleport', 'x')],
    };
    const api = createApi({ getSettings: async () => settings, fetch: fakeFetch(() => json(body)).fn });
    const live = await api.liveState();
    expect(live.patches.map((p) => p.id)).toEqual(['1', '2', '3', '4']);
  });
});
