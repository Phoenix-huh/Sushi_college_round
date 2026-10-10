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

import type { PatchAnchor, PatchChange } from '@patchwork/shared';

export interface Settings {
  /** Origin of the Patchwork server, e.g. http://localhost:4000 (no trailing slash). */
  serverUrl: string;
  /** Sent as `author_id` when saving patches and as the `x-actor-id` header. */
  authorId: string;
}

export type ConnectionStatus =
  | { state: 'connected'; serverUrl: string; checkedAt: number; store: string }
  | { state: 'offline'; serverUrl: string; checkedAt: number; error: string };

/** The part of a live patch the content script needs. Extra server fields are dropped. */
export interface LivePatch {
  id: string;
  target_url: string;
  anchors: PatchAnchor;
  change: PatchChange;
}

/** What GET /deployments/live says is live right now. `signature` changes whenever the live set changes. */
export interface LiveState {
  signature: string;
  patches: LivePatch[];
}

/** An element the user picked on a page, with the anchor that finds it again. */
export interface Pick {
  anchor: PatchAnchor;
  /** Lower-case tag name of the picked element, for display. */
  tag: string;
  /** location.href of the page when it was picked. */
  pageUrl: string;
  pickedAt: number;
}

/** Messages the side panel sends to a page's content script (not to the background worker). */
export type ContentMessage = { type: 'START_PICKER' } | { type: 'STOP_PICKER' };

/** request = the fields a sender supplies (besides `type`); response = what `send` resolves to. */
export interface MessageMap {
  GET_SETTINGS: { request: Record<never, never>; response: Settings };
  SET_SETTINGS: { request: { settings: Partial<Settings> }; response: Settings };
  /** Fresh check: calls GET /health on the configured server. */
  CHECK_CONNECTION: { request: Record<never, never>; response: ConnectionStatus };
  /** Last known status (cached in chrome.storage.session), or null if none for the current server. */
  GET_CONNECTION_STATUS: { request: Record<never, never>; response: ConnectionStatus | null };
  /** The live patches (GET /deployments/live). The content script applies them to the page. */
  GET_LIVE_PATCHES: { request: Record<never, never>; response: LiveState };
  /** The content script reports the element the user picked. The worker keeps it for the side panel. */
  PICK_RESULT: { request: { pick: Pick }; response: Record<never, never> };
  /** The last picked element (chrome.storage.session), or null. */
  GET_LAST_PICK: { request: Record<never, never>; response: Pick | null };
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
  GET_LIVE_PATCHES: () => true,
  PICK_RESULT: (m) => isRecord(m.pick),
  GET_LAST_PICK: () => true,
};

/** Returns the message if it is a well-formed, known message; otherwise null. */
export function parseMessage(raw: unknown): Message | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  // hasOwn, not `in`: "constructor" or "toString" must not count as message types.
  if (!Object.hasOwn(validators, raw.type)) return null;
  if (!validators[raw.type as MessageType](raw)) return null;
  return raw as unknown as Message;
}

/** Returns a clean PatchAnchor from untrusted data, or null if it has neither a selector nor an xpath. Extra fields are dropped. */
export function normalizeAnchor(raw: unknown): PatchAnchor | null {
  if (!isRecord(raw) || typeof raw.cssSelector !== 'string') return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  if (raw.cssSelector === '' && str(raw.xpath) === '') return null; // nothing to find the element with
  return {
    cssSelector: raw.cssSelector,
    xpath: str(raw.xpath),
    textContent: str(raw.textContent),
    attributes: isRecord(raw.attributes)
      ? Object.fromEntries(Object.entries(raw.attributes).filter((e): e is [string, string] => typeof e[1] === 'string'))
      : {},
    parentContext: str(raw.parentContext),
    siblingContext: Array.isArray(raw.siblingContext) ? raw.siblingContext.filter((x): x is string => typeof x === 'string') : [],
  };
}

/** Returns a clean Pick from untrusted data (a message or storage), or null. */
export function normalizePick(raw: unknown): Pick | null {
  if (!isRecord(raw)) return null;
  const anchor = normalizeAnchor(raw.anchor);
  if (!anchor || typeof raw.tag !== 'string' || typeof raw.pageUrl !== 'string' || typeof raw.pickedAt !== 'number') return null;
  return { anchor, tag: raw.tag, pageUrl: raw.pageUrl, pickedAt: raw.pickedAt };
}

/** Returns the message if it is a known content-script message; otherwise null. */
export function parseContentMessage(raw: unknown): ContentMessage | null {
  if (!isRecord(raw)) return null;
  return raw.type === 'START_PICKER' || raw.type === 'STOP_PICKER' ? ({ type: raw.type } as ContentMessage) : null;
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
