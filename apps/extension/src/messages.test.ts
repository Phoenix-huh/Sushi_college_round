import { describe, expect, it } from 'vitest';
import { isConnectionStatus, parseMessage, send } from './messages';

describe('parseMessage', () => {
  it('accepts every known message when well formed', () => {
    expect(parseMessage({ type: 'GET_SETTINGS' })).toEqual({ type: 'GET_SETTINGS' });
    expect(parseMessage({ type: 'CHECK_CONNECTION' })).toEqual({ type: 'CHECK_CONNECTION' });
    expect(parseMessage({ type: 'GET_CONNECTION_STATUS' })).toEqual({ type: 'GET_CONNECTION_STATUS' });
    const set = { type: 'SET_SETTINGS', settings: { serverUrl: 'http://x.test' } };
    expect(parseMessage(set)).toEqual(set);
  });

  it('rejects things that are not messages', () => {
    for (const bad of [null, undefined, 42, 'GET_SETTINGS', [], [{ type: 'GET_SETTINGS' }], {}, { type: 5 }]) {
      expect(parseMessage(bad)).toBeNull();
    }
  });

  it('rejects unknown types, including names that exist on every object', () => {
    for (const type of ['NOPE', 'constructor', 'toString', '__proto__', 'hasOwnProperty', 'get_settings']) {
      expect(parseMessage({ type })).toBeNull();
    }
  });

  it('rejects messages with missing or wrongly shaped fields', () => {
    expect(parseMessage({ type: 'SET_SETTINGS' })).toBeNull();
    expect(parseMessage({ type: 'SET_SETTINGS', settings: 'http://x.test' })).toBeNull();
    expect(parseMessage({ type: 'SET_SETTINGS', settings: null })).toBeNull();
    expect(parseMessage({ type: 'SET_SETTINGS', settings: [] })).toBeNull();
  });
});

describe('isConnectionStatus', () => {
  it('accepts both states and rejects garbage', () => {
    expect(isConnectionStatus({ state: 'connected', serverUrl: 'u', checkedAt: 1, store: 'memory' })).toBe(true);
    expect(isConnectionStatus({ state: 'offline', serverUrl: 'u', checkedAt: 1, error: 'x' })).toBe(true);
    expect(isConnectionStatus({ state: 'connected', serverUrl: 'u', checkedAt: 1 })).toBe(false);
    expect(isConnectionStatus({ state: 'offline', serverUrl: 'u', checkedAt: '1', error: 'x' })).toBe(false);
    expect(isConnectionStatus({ state: 'weird', serverUrl: 'u', checkedAt: 1 })).toBe(false);
    expect(isConnectionStatus(null)).toBe(false);
    expect(isConnectionStatus('connected')).toBe(false);
  });
});

describe('send', () => {
  const withChrome = async (reply: unknown, run: () => Promise<void>) => {
    const g = globalThis as unknown as { chrome?: unknown };
    const before = g.chrome;
    g.chrome = { runtime: { sendMessage: async () => reply } };
    try {
      await run();
    } finally {
      g.chrome = before;
    }
  };

  it('resolves with the data of an ok reply', async () => {
    await withChrome({ ok: true, data: { serverUrl: 'a', authorId: 'b' } }, async () => {
      expect(await send({ type: 'GET_SETTINGS' })).toEqual({ serverUrl: 'a', authorId: 'b' });
    });
  });

  it('rejects with the error text of a failed reply', async () => {
    await withChrome({ ok: false, error: 'Server URL is not a valid URL.' }, async () => {
      await expect(send({ type: 'CHECK_CONNECTION' })).rejects.toThrow('Server URL is not a valid URL.');
    });
  });

  it('rejects clearly when the worker sent no reply at all', async () => {
    await withChrome(undefined, async () => {
      await expect(send({ type: 'GET_SETTINGS' })).rejects.toThrow('did not reply');
    });
  });
});
