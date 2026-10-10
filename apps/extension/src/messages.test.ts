import { describe, expect, it } from 'vitest';
import { isConnectionStatus, normalizeAnchor, normalizePick, parseContentMessage, parseMessage, send } from './messages';

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

const anchor = { cssSelector: '#a', xpath: '', textContent: 't', attributes: { id: 'a' }, parentContext: 'div', siblingContext: ['p'] };
const pick = { anchor, tag: 'p', pageUrl: 'http://x.test/', pickedAt: 5 };

describe('picker and draft messages', () => {
  it('accepts PICK_RESULT with a pick object and GET_LAST_PICK', () => {
    expect(parseMessage({ type: 'PICK_RESULT', pick })).toEqual({ type: 'PICK_RESULT', pick });
    expect(parseMessage({ type: 'GET_LAST_PICK' })).toEqual({ type: 'GET_LAST_PICK' });
    expect(parseMessage({ type: 'GET_LIVE_PATCHES' })).toEqual({ type: 'GET_LIVE_PATCHES' });
    expect(parseMessage({ type: 'GET_BASE_VERSION' })).toEqual({ type: 'GET_BASE_VERSION' });
  });

  it('accepts SAVE_DRAFT with valid fields', () => {
    const validDraft = {
      type: 'SAVE_DRAFT' as const,
      target_url: 'http://localhost:4100/checkout',
      base_version: 1,
      anchors: anchor,
      change: { type: 'text' as const, value: 'Buy Now' },
      title: 'Update checkout button',
    };
    expect(parseMessage(validDraft)).toEqual(validDraft);
  });

  it('rejects SAVE_DRAFT with missing or invalid fields', () => {
    expect(parseMessage({ type: 'SAVE_DRAFT' })).toBeNull();
    expect(
      parseMessage({
        type: 'SAVE_DRAFT',
        target_url: 'http://localhost:4100',
        base_version: 'one', // invalid number
        anchors: anchor,
        change: { type: 'text', value: 'Hi' },
      })
    ).toBeNull();
  });
  it('parseContentMessage only knows the two picker commands', () => {
    expect(parseContentMessage({ type: 'START_PICKER' })).toEqual({ type: 'START_PICKER' });
    expect(parseContentMessage({ type: 'STOP_PICKER' })).toEqual({ type: 'STOP_PICKER' });
    for (const bad of [null, 'START_PICKER', {}, { type: 'GET_SETTINGS' }, { type: 'constructor' }]) expect(parseContentMessage(bad)).toBeNull();
  });
});

describe('normalizeAnchor / normalizePick', () => {
  it('keeps a good anchor and drops extra fields', () => {
    expect(normalizeAnchor({ ...anchor, evil: 1 })).toEqual(anchor);
  });
  it('fills defaults, filters non-string values, and needs a selector or an xpath', () => {
    expect(normalizeAnchor({ cssSelector: 'p', attributes: { a: 'b', c: 3 }, siblingContext: ['x', 4] })).toEqual({
      cssSelector: 'p', xpath: '', textContent: '', attributes: { a: 'b' }, parentContext: '', siblingContext: ['x'],
    });
    expect(normalizeAnchor({ cssSelector: '', xpath: '//p' })).not.toBeNull();
    expect(normalizeAnchor({ cssSelector: '', xpath: '' })).toBeNull();
    expect(normalizeAnchor({ xpath: '//p' })).toBeNull();
    expect(normalizeAnchor(null)).toBeNull();
  });
  it('normalizePick needs every field', () => {
    expect(normalizePick(pick)).toEqual(pick);
    expect(normalizePick({ ...pick, tag: 5 })).toBeNull();
    expect(normalizePick({ ...pick, pickedAt: 'now' })).toBeNull();
    expect(normalizePick({ ...pick, anchor: {} })).toBeNull();
    expect(normalizePick(undefined)).toBeNull();
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
