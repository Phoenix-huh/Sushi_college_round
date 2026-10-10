/**
 * What the background worker does for each message. Dependencies are passed in
 * (storage, fetch, clock) so this is unit-tested without Chrome.
 *
 * MV3 service workers sleep and restart at any time, so nothing here lives in
 * module variables: settings come from chrome.storage.local, the last connection
 * result from chrome.storage.session.
 */
import { isConnectionStatus, normalizePick, type ConnectionStatus, type Message, type ResponseOf, type MessageType } from '../messages';
import { loadSettings, saveSettings, type KeyValueStore } from '../settings';
import { ApiError, createApi } from './api';

export interface HandlerDeps {
  local: KeyValueStore;
  session: KeyValueStore;
  fetch: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

const STATUS_KEY = 'connectionStatus';
const PICK_KEY = 'lastPick';

export function createHandler(deps: HandlerDeps) {
  const now = deps.now ?? Date.now;
  const getSettings = () => loadSettings(deps.local);
  const api = createApi({ getSettings, fetch: deps.fetch, timeoutMs: deps.timeoutMs });

  async function readCachedStatus(): Promise<ConnectionStatus | null> {
    const cached = (await deps.session.get([STATUS_KEY]))[STATUS_KEY];
    if (!isConnectionStatus(cached)) return null;
    // A result for a different server is not an answer about the current one.
    return cached.serverUrl === (await getSettings()).serverUrl ? cached : null;
  }

  async function checkConnection(): Promise<ConnectionStatus> {
    const { serverUrl } = await getSettings();
    let status: ConnectionStatus;
    try {
      const health = await api.health();
      status = { state: 'connected', serverUrl, checkedAt: now(), store: health.store };
    } catch (e) {
      const error = e instanceof ApiError ? e.message : `Unexpected error: ${e instanceof Error ? e.message : String(e)}`;
      status = { state: 'offline', serverUrl, checkedAt: now(), error };
    }
    await deps.session.set({ [STATUS_KEY]: status });
    return status;
  }

  // One handler per message type. The compiler rejects a missing handler or a wrong return type.
  type Table = { [K in MessageType]: (m: Extract<Message, { type: K }>) => Promise<ResponseOf<K>> };
  const table: Table = {
    GET_SETTINGS: () => getSettings(),
    SET_SETTINGS: async (m) => {
      const settings = await saveSettings(deps.local, m.settings);
      await deps.session.set({ [STATUS_KEY]: null }); // the old result no longer describes this configuration
      return settings;
    },
    CHECK_CONNECTION: () => checkConnection(),
    GET_CONNECTION_STATUS: () => readCachedStatus(),
    PICK_RESULT: async (m) => {
      const pick = normalizePick(m.pick);
      if (!pick) throw new Error('The picked element had no usable selector');
      await deps.session.set({ [PICK_KEY]: pick });
      return {};
    },
    GET_LAST_PICK: async () => normalizePick((await deps.session.get([PICK_KEY]))[PICK_KEY]),
    GET_LIVE_PATCHES: async () => {
      const { signature, patches, dropped } = await api.liveState();
      if (dropped > 0) console.warn(`[Patchwork] ignored ${dropped} live patch(es) with an unusable shape`);
      return { signature, patches };
    },
    GET_BASE_VERSION: async () => {
      const base_version = await api.getBaseVersion();
      return { base_version };
    },
    SAVE_DRAFT: async (m) => {
      const res = await api.createPatch({
        target_url: m.target_url,
        base_version: m.base_version,
        anchors: m.anchors,
        change: m.change,
        title: m.title,
      });
      return { id: res.id, status: res.status, title: res.title };
    },
  };

  /** Handles one validated message. Rejects with an Error whose message is safe to show to the user. */
  return (message: Message): Promise<unknown> => (table[message.type] as (m: Message) => Promise<unknown>)(message);
}

export type Handler = ReturnType<typeof createHandler>;
