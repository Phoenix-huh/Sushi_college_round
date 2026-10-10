/**
 * Side panel (Phase 5).
 *
 * Three tabs:
 *   1. Patches — lists all patches for the current site origin, showing
 *      approval status and a Preview link.  Refreshes every 5 s while visible.
 *   2. Picker — element picker + last-picked card (same as before).
 *   3. Settings — server URL + author-id.
 *
 * Content scripts and the side panel NEVER call the server directly; every
 * server interaction goes through typed messages to the background worker
 * (see ../messages.ts).
 */
import {
  normalizePick,
  send,
  type ConnectionStatus,
  type ContentMessage,
  type DraftPatch,
  type Pick,
} from '../messages';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

const CHECK_EVERY_MS = 5_000;
const PATCHES_POLL_MS = 5_000;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Side panel is missing #${id}`);
  return node as T;
}

// ─────────────────────────────────────────────────
// Elements
// ─────────────────────────────────────────────────

const connDot         = el('conn-dot');
const connText        = el('conn-text');
const connHint        = el('conn-hint');
const connPill        = el<HTMLButtonElement>('conn-pill');
const noticeBar       = el('notice-bar');

// tabs
const tabPatches      = el<HTMLButtonElement>('tab-patches');
const tabPick         = el<HTMLButtonElement>('tab-pick');
const tabSettings     = el<HTMLButtonElement>('tab-settings');
const panePatches     = el('pane-patches');
const panePick        = el('pane-pick');
const paneSettings    = el('pane-settings');

// patches
const patchList       = el('patch-list');
const patchesCount    = el('patches-count');
const patchesRefresh  = el<HTMLButtonElement>('patches-refresh');

// picker
const pickButton      = el<HTMLButtonElement>('pick-start');
const pickMsg         = el('pick-msg');
const pickCard        = el('pick-card');

// settings
const form            = el<HTMLFormElement>('settings-form');
const serverUrlInput  = el<HTMLInputElement>('serverUrl');
const authorIdInput   = el<HTMLInputElement>('authorId');
const saveButton      = el<HTMLButtonElement>('settings-save');
const settingsMsg     = el('settings-msg');

// ─────────────────────────────────────────────────
// Notice bar
// ─────────────────────────────────────────────────

let noticeTimer: ReturnType<typeof setTimeout> | null = null;
function showNotice(msg: string, durationMs = 4_000): void {
  noticeBar.textContent = msg;
  noticeBar.dataset.vis = 'true';
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { noticeBar.dataset.vis = 'false'; }, durationMs);
}

// ─────────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────────

type TabId = 'patches' | 'pick' | 'settings';

function switchTab(id: TabId): void {
  const tabs:  Record<TabId, HTMLButtonElement> = { patches: tabPatches, pick: tabPick, settings: tabSettings };
  const panes: Record<TabId, HTMLElement>       = { patches: panePatches, pick: panePick, settings: paneSettings };
  for (const k of Object.keys(tabs) as TabId[]) {
    tabs[k].dataset.active  = String(k === id);
    panes[k].dataset.active = String(k === id);
  }
}

tabPatches.addEventListener('click',  () => { switchTab('patches');  void loadPatches(); });
tabPick.addEventListener('click',     () => switchTab('pick'));
tabSettings.addEventListener('click', () => switchTab('settings'));

// ─────────────────────────────────────────────────
// Connection status
// ─────────────────────────────────────────────────

function renderStatus(status: ConnectionStatus | null): void {
  if (!status) {
    connDot.dataset.state = 'checking';
    connText.textContent  = 'Checking…';
    connHint.textContent  = '';
    return;
  }
  connDot.dataset.state = status.state;
  if (status.state === 'connected') {
    connText.textContent = status.serverUrl.replace(/^https?:\/\//, '');
    connHint.textContent = `Connected · store: ${status.store}`;
  } else {
    connText.textContent = 'Offline';
    connHint.textContent = `${status.error} — start with "npm run demo".`;
  }
}

function renderBackgroundFailure(err: unknown): void {
  connDot.dataset.state = 'offline';
  connText.textContent  = 'Worker error';
  connHint.textContent  = err instanceof Error ? err.message : String(err);
}

let checking = false;
async function runCheck(): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    renderStatus(await send({ type: 'CHECK_CONNECTION' }));
  } catch (err) {
    renderBackgroundFailure(err);
  } finally {
    checking = false;
  }
}

connPill.addEventListener('click', () => void runCheck());

// ─────────────────────────────────────────────────
// Patches panel — Phase 5 core feature
// ─────────────────────────────────────────────────

/** Determine the current tab's origin for filtering patches. */
async function getCurrentOrigin(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url) return null;
    return new URL(tab.url).origin;
  } catch {
    return null;
  }
}

const STATUS_CLASS: Record<string, string> = {
  live:      'pill-live',
  draft:     'pill-draft',
  in_review: 'pill-in-rev',
  approved:  'pill-appr',
  conflicted:'pill-conf',
  rejected:  'pill-reject',
  healed:    'pill-healed',
  stale:     'pill-stale',
  broken:    'pill-broken',
};

const STATUS_LABEL: Record<string, string> = {
  live:      '● live',
  draft:     '○ draft',
  in_review: '⟳ review',
  approved:  '✓ approved',
  conflicted:'✖ conflict',
  rejected:  '✗ rejected',
  healed:    '⟡ healed',
  stale:     '⚠ stale',
  broken:    '✖ broken',
};

function buildPatchRow(p: DraftPatch, pageUrl: string | null): HTMLElement {
  const item = document.createElement('div');
  item.className = 'patch-item';

  const titleEl = document.createElement('div');
  titleEl.className = 'patch-title';
  titleEl.textContent = p.title || p.anchors.cssSelector || '(no title)';
  titleEl.title = p.title || '';

  const selectorEl = document.createElement('div');
  selectorEl.className = 'patch-selector';
  selectorEl.textContent = p.anchors.cssSelector || '(text search)';

  const statusClass = STATUS_CLASS[p.status] ?? 'pill-draft';
  const statusLabel = STATUS_LABEL[p.status] ?? p.status;

  const metaEl = document.createElement('div');
  metaEl.className = 'patch-meta';

  const pill = document.createElement('span');
  pill.className = `pill ${statusClass}`;
  pill.textContent = statusLabel;

  const changeSpan = document.createElement('span');
  changeSpan.textContent = p.change.type;

  const timeSpan = document.createElement('span');
  const d = new Date(p.created_at);
  timeSpan.textContent = d.toLocaleDateString();
  timeSpan.title = d.toLocaleString();

  metaEl.append(pill, changeSpan, timeSpan);

  // Actions row
  const actionsEl = document.createElement('div');
  actionsEl.className = 'patch-actions';

  // Preview link (isolated: only this patch)
  const previewBtn = document.createElement('a');
  const previewBase = pageUrl ?? p.target_url;
  const sep = previewBase.includes('?') ? '&' : '?';
  previewBtn.href = `${p.target_url}${sep}preview_patch=${p.id}`;
  previewBtn.target = '_blank';
  previewBtn.rel = 'noreferrer';
  previewBtn.className = 'btn-preview';
  previewBtn.style.cssText = 'display:inline-block;text-decoration:none;border-radius:4px;cursor:pointer;padding:3px 8px;font-size:9px;font-weight:700;letter-spacing:0.04em;background:var(--surface2);color:var(--sky);border:1px solid rgba(56,189,248,0.2);';
  previewBtn.textContent = '⬡ Preview';

  actionsEl.append(previewBtn);

  // Awaiting review badge (non-interactive; reviewer must use dashboard)
  if (p.status === 'in_review') {
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:9px;color:var(--amber);font-weight:600;';
    badge.textContent = '⟳ Awaiting reviewer';
    actionsEl.append(badge);
  }

  if (p.status === 'approved') {
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:9px;color:var(--purple);font-weight:600;';
    badge.textContent = '✓ Approved — deploy on dashboard';
    actionsEl.append(badge);
  }

  if (p.status === 'healed') {
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:9px;color:var(--sky);font-weight:600;';
    badge.textContent = '⟡ Auto-healed';
    actionsEl.append(badge);
  }

  item.append(titleEl, selectorEl, metaEl, actionsEl);
  return item;
}

let patchesLoading = false;

async function loadPatches(): Promise<void> {
  if (patchesLoading) return;
  patchesLoading = true;
  patchesRefresh.disabled = true;

  try {
    const origin = await getCurrentOrigin();
    if (!origin) {
      patchList.innerHTML = '';
      patchList.appendChild(makeEmpty('No active tab found.'));
      patchesCount.textContent = '';
      return;
    }

    const result = await send({ type: 'GET_SITE_PATCHES', origin });
    const patches = (result as { patches: DraftPatch[] }).patches;

    patchList.innerHTML = '';
    if (!patches || patches.length === 0) {
      patchList.appendChild(makeEmpty(`No patches for ${new URL(origin).hostname}`));
      patchesCount.textContent = '0 patches';
      return;
    }

    patchesCount.textContent = `${patches.length} patch${patches.length !== 1 ? 'es' : ''}`;

    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const pageUrl = tab?.url ?? null;

    for (const p of patches) {
      patchList.appendChild(buildPatchRow(p, pageUrl));
    }
  } catch (err) {
    patchList.innerHTML = '';
    patchList.appendChild(makeEmpty(`Error: ${err instanceof Error ? err.message : String(err)}`));
  } finally {
    patchesLoading = false;
    patchesRefresh.disabled = false;
  }
}

function makeEmpty(msg: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'empty';
  d.innerHTML = `<span class="empty-icon">⬡</span><span>${msg}</span>`;
  return d;
}

patchesRefresh.addEventListener('click', () => void loadPatches());

// Poll patches while on that tab
let patchesPollTimer: ReturnType<typeof setInterval> | null = null;

function startPatchesPoll(): void {
  if (patchesPollTimer) return;
  patchesPollTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && panePatches.dataset.active === 'true') {
      void loadPatches();
    }
  }, PATCHES_POLL_MS);
}

// ─────────────────────────────────────────────────
// Picker panel
// ─────────────────────────────────────────────────

function renderPick(pick: Pick | null): void {
  pickCard.hidden = !pick;
  if (!pick) return;
  el('pick-selector').textContent = pick.anchor.cssSelector;
  el('pick-text').textContent     = pick.anchor.textContent || '(no text)';
  el('pick-parent').textContent   = pick.anchor.parentContext || '(none)';
  el('pick-siblings').textContent = pick.anchor.siblingContext.join(', ') || '(none)';
  el('pick-page').textContent     = pick.pageUrl;
  pickMsg.textContent = `Picked <${pick.tag}>.`;
}

async function sendToActiveTab(message: ContentMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined) throw new Error('No active tab.');
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    throw new Error('Cannot pick on this page. Reload it first, and note that chrome:// pages are off-limits.');
  }
}

pickButton.addEventListener('click', () => {
  void (async () => {
    try {
      await sendToActiveTab({ type: 'START_PICKER' });
      pickMsg.textContent = 'Click an element on the page. Esc cancels.';
    } catch (err) {
      pickMsg.textContent = err instanceof Error ? err.message : String(err);
    }
  })();
});

// React to picks stored by the background worker
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.lastPick) {
    renderPick(normalizePick(changes.lastPick.newValue));
    showNotice('Element picked! Open the Picker tab to see the anchor.');
  }
});

// ─────────────────────────────────────────────────
// Settings panel
// ─────────────────────────────────────────────────

function showSettingsMsg(kind: 'ok' | 'error' | '', text: string): void {
  settingsMsg.dataset.kind = kind;
  settingsMsg.textContent  = text;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void (async () => {
    saveButton.disabled = true;
    showSettingsMsg('', '');
    try {
      const saved = await send({
        type: 'SET_SETTINGS',
        settings: { serverUrl: serverUrlInput.value, authorId: authorIdInput.value },
      });
      serverUrlInput.value = saved.serverUrl;
      authorIdInput.value  = saved.authorId;
      showSettingsMsg('ok', 'Saved.');
      renderStatus(null);
      void runCheck();
    } catch (err) {
      showSettingsMsg('error', err instanceof Error ? err.message : String(err));
    } finally {
      saveButton.disabled = false;
    }
  })();
});

// ─────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────

async function init(): Promise<void> {
  try {
    const settings = await send({ type: 'GET_SETTINGS' });
    serverUrlInput.value = settings.serverUrl;
    authorIdInput.value  = settings.authorId;
    renderStatus(await send({ type: 'GET_CONNECTION_STATUS' }));
    renderPick(await send({ type: 'GET_LAST_PICK' }));
  } catch (err) {
    renderBackgroundFailure(err);
    return;
  }

  await runCheck();
  setInterval(() => { if (document.visibilityState === 'visible') void runCheck(); }, CHECK_EVERY_MS);

  // Load patches immediately on boot (default tab is Patches)
  await loadPatches();
  startPatchesPoll();
}

void init();
