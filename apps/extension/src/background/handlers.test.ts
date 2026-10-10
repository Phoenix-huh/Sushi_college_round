import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../settings';
import { createHandler } from './handlers';

function fakeStore(initial: Record<string, unknown> = {}): KeyValueStore & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (items) => {
      Object.assign(data, items);
    },
  };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(respond: (url: string) => Response | Promise<Response>) {
  const local = fakeStore();
  const session = fakeStore();
  const urls: string[] = [];
  const handle = createHandler({
    local,
    session,
    now: () => 1234,
    fetch: (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return respond(String(input));
    }) as typeof fetch,
  });
  return { handle, local, session, urls };
}

describe('background handler', () => {
  it('GET_SETTINGS returns the defaults the first time', async () => {
    const { handle } = setup(() => json({}));
    expect(await handle({ type: 'GET_SETTINGS' })).toEqual({
      serverUrl: 'http://localhost:4000',
      authorId: '00000000-0000-0000-0000-000000000001',
    });
  });

  it('SET_SETTINGS validates, stores and returns the cleaned values', async () => {
    const { handle, local } = setup(() => json({}));
    const saved = await handle({ type: 'SET_SETTINGS', settings: { serverUrl: 'http://srv.test:9/' } });
    expect((saved as { serverUrl: string }).serverUrl).toBe('http://srv.test:9');
    expect(local.data.serverUrl).toBe('http://srv.test:9');
  });

  it('SET_SETTINGS rejects invalid input and stores nothing', async () => {
    const { handle, local } = setup(() => json({}));
    await expect(handle({ type: 'SET_SETTINGS', settings: { serverUrl: 'banana' } })).rejects.toThrow('Server URL');
    expect(local.data).toEqual({});
  });

  it('CHECK_CONNECTION reports connected with the store mode, and caches it', async () => {
    const { handle, session, urls } = setup(() => json({ ok: true, store: 'memory' }));
    const status = await handle({ type: 'CHECK_CONNECTION' });
    expect(status).toEqual({ state: 'connected', serverUrl: 'http://localhost:4000', checkedAt: 1234, store: 'memory' });
    expect(urls).toEqual(['http://localhost:4000/health']);
    expect(session.data.connectionStatus).toEqual(status);
    expect(await handle({ type: 'GET_CONNECTION_STATUS' })).toEqual(status);
    expect(urls.length).toBe(1); // reading the cache makes no request
  });

  it('CHECK_CONNECTION reports offline with a readable reason instead of throwing', async () => {
    const { handle } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    const status = (await handle({ type: 'CHECK_CONNECTION' })) as { state: string; error: string };
    expect(status.state).toBe('offline');
    expect(status.error).toContain('Cannot reach http://localhost:4000');
  });

  it('GET_CONNECTION_STATUS is null before any check', async () => {
    const { handle } = setup(() => json({}));
    expect(await handle({ type: 'GET_CONNECTION_STATUS' })).toBeNull();
  });

  it('changing the settings discards the cached status', async () => {
    const { handle } = setup(() => json({ ok: true, store: 'memory' }));
    await handle({ type: 'CHECK_CONNECTION' });
    await handle({ type: 'SET_SETTINGS', settings: { serverUrl: 'http://other.test:5' } });
    expect(await handle({ type: 'GET_CONNECTION_STATUS' })).toBeNull();
  });

  it('does not resurrect an old status when the URL is changed away and back', async () => {
    const { handle } = setup(() => json({ ok: true, store: 'memory' }));
    await handle({ type: 'CHECK_CONNECTION' }); // connected to the default URL
    await handle({ type: 'SET_SETTINGS', settings: { serverUrl: 'http://other.test:5' } });
    await handle({ type: 'SET_SETTINGS', settings: { serverUrl: 'http://localhost:4000' } });
    expect(await handle({ type: 'GET_CONNECTION_STATUS' })).toBeNull();
  });

  it('never returns a cached status that belongs to a different server', async () => {
    const { handle, session, local } = setup(() => json({}));
    session.data.connectionStatus = { state: 'connected', serverUrl: 'http://old.test:1', checkedAt: 1, store: 'memory' };
    local.data.serverUrl = 'http://new.test:2';
    expect(await handle({ type: 'GET_CONNECTION_STATUS' })).toBeNull();
  });

  it('ignores a corrupt cached status', async () => {
    const { handle, session } = setup(() => json({}));
    session.data.connectionStatus = { state: 'connected' };
    expect(await handle({ type: 'GET_CONNECTION_STATUS' })).toBeNull();
  });

  it('uses the server URL from settings for the health check', async () => {
    const { handle, urls } = setup(() => json({ ok: true, store: 'supabase' }));
    await handle({ type: 'SET_SETTINGS', settings: { serverUrl: 'https://patchwork.example.com' } });
    await handle({ type: 'CHECK_CONNECTION' });
    expect(urls).toEqual(['https://patchwork.example.com/health']);
  });
  describe('GET_LIVE_PATCHES', () => {
    const livePatch = {
      id: 'p1',
      target_url: 'http://localhost:4100/',
      anchors: { cssSelector: 'h1', xpath: '', textContent: 'Hi', attributes: { 'pw-find': 'text' }, parentContext: '', siblingContext: [] },
      change: { type: 'text', value: 'Hello' },
      author_id: 'ignored',
    };

    it('returns the signature and the patches, with only the fields the page needs', async () => {
      const { handle, urls } = setup(() => json({ deployment: {}, version: {}, signature: 'abc', patches: [livePatch] }));
      const live = (await handle({ type: 'GET_LIVE_PATCHES' })) as { signature: string; patches: Record<string, unknown>[] };
      expect(urls).toEqual(['http://localhost:4000/deployments/live']);
      expect(live.signature).toBe('abc');
      expect(live.patches).toHaveLength(1);
      expect(live.patches[0]).not.toHaveProperty('author_id');
      expect(live.patches[0]).toMatchObject({ id: 'p1', change: { type: 'text', value: 'Hello' } });
    });

    it('drops patches with an unusable shape instead of failing', async () => {
      const bad = { id: 'p2', anchors: {}, change: { type: 'explode', value: 'x' } };
      const { handle } = setup(() => json({ signature: 's', patches: [bad, livePatch, null] }));
      const live = (await handle({ type: 'GET_LIVE_PATCHES' })) as { patches: { id: string }[] };
      expect(live.patches.map((p) => p.id)).toEqual(['p1']);
    });

    it('rejects an answer that is not a live deployment', async () => {
      const { handle } = setup(() => json({ hello: 'world' }));
      await expect(handle({ type: 'GET_LIVE_PATCHES' })).rejects.toThrow('not with a Patchwork live deployment');
    });

    it('rejects with a readable message when the server is down', async () => {
      const { handle } = setup(() => {
        throw new TypeError('Failed to fetch');
      });
      await expect(handle({ type: 'GET_LIVE_PATCHES' })).rejects.toThrow('Cannot reach http://localhost:4000');
    });
  });
  describe('picks', () => {
    const anchor = { cssSelector: '#a', xpath: '', textContent: 't', attributes: {}, parentContext: 'div', siblingContext: [] };
    const pick = { anchor, tag: 'p', pageUrl: 'http://x.test/', pickedAt: 5 };

    it('GET_LAST_PICK is null before any pick', async () => {
      const { handle } = setup(() => json({}));
      expect(await handle({ type: 'GET_LAST_PICK' })).toBeNull();
    });

    it('PICK_RESULT stores the pick in session storage and GET_LAST_PICK returns it', async () => {
      const { handle, session, local } = setup(() => json({}));
      await handle({ type: 'PICK_RESULT', pick });
      expect(session.data.lastPick).toEqual(pick);
      expect(local.data).toEqual({});
      expect(await handle({ type: 'GET_LAST_PICK' })).toEqual(pick);
    });

    it('PICK_RESULT rejects a pick without a usable selector and stores nothing', async () => {
      const { handle, session } = setup(() => json({}));
      await expect(handle({ type: 'PICK_RESULT', pick: { ...pick, anchor: {} } as never })).rejects.toThrow('usable selector');
      expect(session.data).toEqual({});
    });

    it('a corrupt stored pick reads as null', async () => {
      const { handle, session } = setup(() => json({}));
      session.data.lastPick = { tag: 'p' };
      expect(await handle({ type: 'GET_LAST_PICK' })).toBeNull();
    });

    it('a newer pick replaces the older one', async () => {
      const { handle } = setup(() => json({}));
      await handle({ type: 'PICK_RESULT', pick });
      await handle({ type: 'PICK_RESULT', pick: { ...pick, tag: 'h1', pickedAt: 9 } });
      expect(((await handle({ type: 'GET_LAST_PICK' })) as { tag: string }).tag).toBe('h1');
    });
  });
});
