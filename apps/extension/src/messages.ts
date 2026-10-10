/**
 * The one message protocol shared by the background service worker, the content
 * script and the side panel. Content scripts and UI never call the Patchwork
 * server themselves; they send one of these messages to the background worker,
 * which calls the server (host_permissions, so page CSP/CORS cannot interfere).
 *
 * To add a message: add ONE entry to `MessageMap`, ONE validator to `validators`,
 * and a handler in background/handlers.ts. TypeScript then checks every sender.
 *
 * This module has no top-level `chrome` access, so it can be unit-tested in Node.
 */

export interface Settings {
  /** Origin of the Patchwork server, e.g. http://localhost:4000 (no trailing slash). */
  serverUrl: string;
  /** Sent as `author_id` when saving patches and as the `x-actor-id` header. */
  authorId: string;
}

export type ConnectionStatus =
  | { state: 'connected'; serverUrl: string; checkedAt: number; store: string }
  | { state: 'offline'; serverUrl: string; checkedAt: number; error: string };

/** request = the fields a sender supplies (besides `type`); response = what `send` resolves to. */
export interface MessageMap {
  GET_SETTINGS: { request: Record<never, never>; response: Settings };
  SET_SETTINGS: { request: { settings: Partial<Settings> }; response: Settings };
  /** Fresh check: calls GET /health on the configured server. */
  CHECK_CONNECTION: { request: Record<never, never>; response: ConnectionStatus };
  /** Last known status (cached in chrome.storage.session), or null if none for the current server. */
  GET_CONNECTION_STATUS: { request: Record<never, never>; response: ConnectionStatus | null };
}

export type MessageType = keyof MessageMap;

export type Message = {
  [K in MessageType]: { type: K } & MessageMap[K]['request'];
}[MessageType];

export type ResponseOf<K extends MessageType> = MessageMap[K]['response'];

/** What the background worker puts on the wire. Errors are data, never a missing reply. */
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Runtime check per message type (TypeScript types vanish at runtime, and anything can send us a message). */
const validators: { [K in MessageType]: (m: Record<string, unknown>) => boolean } = {
  GET_SETTINGS: () => true,
  SET_SETTINGS: (m) => isRecord(m.settings),
  CHECK_CONNECTION: () => true,
  GET_CONNECTION_STATUS: () => true,
};

/** Returns the message if it is a well-formed, known message; otherwise null. */
export function parseMessage(raw: unknown): Message | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  // hasOwn, not `in`: "constructor" or "toString" must not count as message types.
  if (!Object.hasOwn(validators, raw.type)) return null;
  if (!validators[raw.type as MessageType](raw)) return null;
  return raw as unknown as Message;
}

/** Shape check for ConnectionStatus values read back from storage. */
export function isConnectionStatus(v: unknown): v is ConnectionStatus {
  if (!isRecord(v)) return false;
  if (typeof v.serverUrl !== 'string' || typeof v.checkedAt !== 'number') return false;
  if (v.state === 'connected') return typeof v.store === 'string';
  if (v.state === 'offline') return typeof v.error === 'string';
  return false;
}

/**
 * Send a message to the background worker and get its typed answer.
 * Rejects with the worker's error message, or if the worker did not answer
 * (for example the extension was reloaded while this page stayed open).
 */
export async function send<M extends Message>(message: M): Promise<ResponseOf<M['type']>> {
  const reply = (await chrome.runtime.sendMessage(message)) as Reply<ResponseOf<M['type']>> | undefined;
  if (!reply) throw new Error('The Patchwork background worker did not reply. Reload the extension and the page.');
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
