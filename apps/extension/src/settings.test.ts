import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SettingsError,
  loadSettings,
  mergeSettings,
  normalizeAuthorId,
  normalizeServerUrl,
  saveSettings,
  type KeyValueStore,
} from './settings';

/** In-memory stand-in for chrome.storage.local. */
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

describe('normalizeServerUrl', () => {
  it('keeps just the origin', () => {
    expect(normalizeServerUrl('http://localhost:4000')).toBe('http://localhost:4000');
    expect(normalizeServerUrl('  http://localhost:4000/  ')).toBe('http://localhost:4000');
    expect(normalizeServerUrl('https://api.example.com/some/path?x=1#h')).toBe('https://api.example.com');
  });

  it('rejects non-http(s) and malformed values with a SettingsError', () => {
    for (const bad of ['', 'localhost:4000', 'ftp://x.test', 'javascript:alert(1)', 'not a url', 'chrome://extensions']) {
      expect(() => normalizeServerUrl(bad)).toThrow(SettingsError);
    }
  });
});

describe('normalizeAuthorId', () => {
  it('accepts a uuid and lowercases it', () => {
    expect(normalizeAuthorId('00000000-0000-0000-0000-000000000001')).toBe('00000000-0000-0000-0000-000000000001');
    expect(normalizeAuthorId(' ABCDEF12-0000-4000-8000-ABCDEF123456 ')).toBe('abcdef12-0000-4000-8000-abcdef123456');
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'abc', '00000000-0000-0000-0000-00000000000', 'g0000000-0000-0000-0000-000000000001']) {
      expect(() => normalizeAuthorId(bad)).toThrow(SettingsError);
    }
  });
});

describe('mergeSettings', () => {
  it('changes only the fields given', () => {
    const a = mergeSettings(DEFAULT_SETTINGS, { serverUrl: 'http://other.test:9/' });
    expect(a).toEqual({ serverUrl: 'http://other.test:9', authorId: DEFAULT_SETTINGS.authorId });
  });

  it('throws if any given field is invalid, even when the other is fine', () => {
    expect(() => mergeSettings(DEFAULT_SETTINGS, { serverUrl: 'http://ok.test', authorId: 'nope' })).toThrow(SettingsError);
  });
});

describe('loadSettings / saveSettings', () => {
  it('returns the defaults when nothing is stored', async () => {
    expect(await loadSettings(fakeStore())).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to the default for corrupt stored values instead of throwing', async () => {
    const store = fakeStore({ serverUrl: 12345, authorId: 'garbage' });
    expect(await loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    const mixed = fakeStore({ serverUrl: 'http://good.test:1', authorId: 'garbage' });
    expect(await loadSettings(mixed)).toEqual({ serverUrl: 'http://good.test:1', authorId: DEFAULT_SETTINGS.authorId });
  });

  it('saves, then loads what was saved', async () => {
    const store = fakeStore();
    const saved = await saveSettings(store, { serverUrl: 'http://srv.test:4000/', authorId: 'ABCDEF12-0000-4000-8000-ABCDEF123456' });
    expect(saved).toEqual({ serverUrl: 'http://srv.test:4000', authorId: 'abcdef12-0000-4000-8000-abcdef123456' });
    expect(await loadSettings(store)).toEqual(saved);
  });

  it('a partial save keeps the other field', async () => {
    const store = fakeStore({ serverUrl: 'http://keep.test:1' });
    const saved = await saveSettings(store, { authorId: 'abcdef12-0000-4000-8000-abcdef123456' });
    expect(saved.serverUrl).toBe('http://keep.test:1');
  });

  it('an invalid save stores nothing', async () => {
    const store = fakeStore({ serverUrl: 'http://keep.test:1' });
    await expect(saveSettings(store, { serverUrl: 'nonsense' })).rejects.toThrow(SettingsError);
    expect(store.data).toEqual({ serverUrl: 'http://keep.test:1' });
  });
});
