/**
 * Extension settings (chrome.storage.local): server URL and author id.
 * No login is needed; the server falls back to the demo developer.
 *
 * Pure logic plus a tiny storage interface, so it is unit-tested without Chrome.
 */
import type { Settings } from './messages';

/**
 * Set by build.mjs from the PATCHWORK_SERVER_URL environment variable, so an extension built for a demo
 * already points at the hosted server. When it is not defined (tests, a plain build) the local server is used.
 */
declare const __PATCHWORK_SERVER_URL__: string | undefined;
const BUILT_IN_SERVER_URL =
  typeof __PATCHWORK_SERVER_URL__ === 'string' && __PATCHWORK_SERVER_URL__ !== '' ? __PATCHWORK_SERVER_URL__ : 'http://localhost:4000';

export const DEFAULT_SETTINGS: Settings = {
  serverUrl: BUILT_IN_SERVER_URL,
  authorId: '00000000-0000-0000-0000-000000000001',
};

/** The part of chrome.storage.* that we use, so tests can pass a fake. */
export interface KeyValueStore {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/** Wraps a chrome.storage area (local or session) in the KeyValueStore interface. */
export function chromeStore(area: chrome.storage.StorageArea): KeyValueStore {
  return {
    get: async (keys) => (await area.get(keys)) as Record<string, unknown>,
    set: async (items) => {
      await area.set(items);
    },
  };
}

/** Same pattern the server's zod uuid() accepts. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SettingsError extends Error {}

/** Returns a clean origin like "http://localhost:4000", or throws SettingsError. */
export function normalizeServerUrl(input: string): string {
  const text = input.trim();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new SettingsError('Server URL is not a valid URL. Example: http://localhost:4000');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SettingsError('Server URL must start with http:// or https://');
  }
  return url.origin; // drops any path, query and trailing slash
}

export function normalizeAuthorId(input: string): string {
  const text = input.trim();
  if (!UUID.test(text)) throw new SettingsError('Author id must be a UUID, like 00000000-0000-0000-0000-000000000001');
  return text.toLowerCase();
}

/** Applies a partial update on top of `current`; throws SettingsError if any given field is invalid. */
export function mergeSettings(current: Settings, update: Partial<Settings>): Settings {
  return {
    serverUrl: update.serverUrl !== undefined ? normalizeServerUrl(update.serverUrl) : current.serverUrl,
    authorId: update.authorId !== undefined ? normalizeAuthorId(update.authorId) : current.authorId,
  };
}

/** Reads settings. Missing or corrupt stored values fall back to the defaults; never throws on bad data. */
export async function loadSettings(store: KeyValueStore): Promise<Settings> {
  const raw = await store.get(['serverUrl', 'authorId']);
  let serverUrl = DEFAULT_SETTINGS.serverUrl;
  let authorId = DEFAULT_SETTINGS.authorId;
  try {
    if (typeof raw.serverUrl === 'string') serverUrl = normalizeServerUrl(raw.serverUrl);
  } catch { /* keep default */ }
  try {
    if (typeof raw.authorId === 'string') authorId = normalizeAuthorId(raw.authorId);
  } catch { /* keep default */ }
  return { serverUrl, authorId };
}

/** Validates, stores and returns the new settings. Throws SettingsError (and stores nothing) if invalid. */
export async function saveSettings(store: KeyValueStore, update: Partial<Settings>): Promise<Settings> {
  const next = mergeSettings(await loadSettings(store), update);
  await store.set({ serverUrl: next.serverUrl, authorId: next.authorId });
  return next;
}
