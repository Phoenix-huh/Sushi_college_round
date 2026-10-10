/**
 * Side panel. Connection status indicator, element picker and settings form.
 * Talks to the background worker only through typed messages. All text is set
 * with textContent / .value; nothing from the server or the page is ever parsed as HTML.
 */
import { normalizePick, send, type ConnectionStatus, type ContentMessage, type Pick } from '../messages';

const CHECK_EVERY_MS = 5000;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Side panel is missing #${id}`);
  return node as T;
}

const dot = el('conn-dot');
const connText = el('conn-text');
const connHint = el('conn-hint');
const recheck = el<HTMLButtonElement>('conn-recheck');
const form = el<HTMLFormElement>('settings-form');
const serverUrlInput = el<HTMLInputElement>('serverUrl');
const authorIdInput = el<HTMLInputElement>('authorId');
const saveButton = el<HTMLButtonElement>('settings-save');
const settingsMsg = el('settings-msg');

function renderStatus(status: ConnectionStatus | null): void {
  if (!status) {
    dot.dataset.state = 'checking';
    connText.textContent = 'Checking connection...';
    connHint.textContent = '';
    return;
  }
  dot.dataset.state = status.state;
  if (status.state === 'connected') {
    connText.textContent = `Connected to ${status.serverUrl}`;
    connHint.textContent = `Data store: ${status.store}`;
  } else {
    connText.textContent = `Not connected: ${status.error}`;
    connHint.textContent = 'Start it with "npm run demo", or fix the Server URL below.';
  }
}

function renderBackgroundFailure(err: unknown): void {
  dot.dataset.state = 'offline';
  connText.textContent = `Extension background worker problem: ${err instanceof Error ? err.message : String(err)}`;
  connHint.textContent = 'Reload the extension at chrome://extensions, then reopen this panel.';
}

let checking = false;
async function runCheck(): Promise<void> {
  if (checking) return;
  checking = true;
  recheck.disabled = true;
  try {
    renderStatus(await send({ type: 'CHECK_CONNECTION' }));
  } catch (err) {
    renderBackgroundFailure(err);
  } finally {
    checking = false;
    recheck.disabled = false;
  }
}

function showMessage(kind: 'ok' | 'error' | '', text: string): void {
  settingsMsg.dataset.kind = kind;
  settingsMsg.textContent = text;
}

recheck.addEventListener('click', () => void runCheck());

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void (async () => {
    saveButton.disabled = true;
    showMessage('', '');
    try {
      const saved = await send({
        type: 'SET_SETTINGS',
        settings: { serverUrl: serverUrlInput.value, authorId: authorIdInput.value },
      });
      serverUrlInput.value = saved.serverUrl; // show the cleaned-up values
      authorIdInput.value = saved.authorId;
      showMessage('ok', 'Saved.');
      renderStatus(null);
      void runCheck();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : String(err));
    } finally {
      saveButton.disabled = false;
    }
  })();
});

// ---------- element picker ----------

const pickButton = el<HTMLButtonElement>('pick-start');
const pickMsg = el('pick-msg');
const pickCard = el('pick-card');

function renderPick(pick: Pick | null): void {
  pickCard.hidden = !pick;
  if (!pick) return;
  el('pick-selector').textContent = pick.anchor.cssSelector;
  el('pick-text').textContent = pick.anchor.textContent || '(no text)';
  el('pick-parent').textContent = pick.anchor.parentContext || '(none)';
  el('pick-siblings').textContent = pick.anchor.siblingContext.join(', ') || '(none)';
  el('pick-page').textContent = pick.pageUrl;
  pickMsg.dataset.kind = '';
  pickMsg.textContent = `Picked <${pick.tag}>.`;
}

/** Sends a message to the content script of the tab the user is looking at. */
async function sendToActiveTab(message: ContentMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined) throw new Error('No active tab.');
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    // Chrome gives "Receiving end does not exist" for pages without our content script.
    throw new Error('Cannot pick on this page. Reload the page (content scripts load only when a page loads), and note that chrome:// pages and the Web Store are off limits.');
  }
}

pickButton.addEventListener('click', () => {
  void (async () => {
    try {
      await sendToActiveTab({ type: 'START_PICKER' });
      pickMsg.dataset.kind = '';
      pickMsg.textContent = 'Click an element on the page. Esc cancels.';
    } catch (err) {
      pickMsg.dataset.kind = 'error';
      pickMsg.textContent = err instanceof Error ? err.message : String(err);
    }
  })();
});

// The worker stores each pick in session storage; show it as soon as it changes.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.lastPick) renderPick(normalizePick(changes.lastPick.newValue));
});

async function init(): Promise<void> {
  try {
    const settings = await send({ type: 'GET_SETTINGS' });
    serverUrlInput.value = settings.serverUrl;
    authorIdInput.value = settings.authorId;
    renderStatus(await send({ type: 'GET_CONNECTION_STATUS' })); // instant: last known result
    renderPick(await send({ type: 'GET_LAST_PICK' }));
  } catch (err) {
    renderBackgroundFailure(err);
    return;
  }
  await runCheck(); // then a fresh one
  setInterval(() => {
    if (document.visibilityState === 'visible') void runCheck();
  }, CHECK_EVERY_MS);
}

void init();
