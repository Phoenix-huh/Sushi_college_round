/**
 * Side panel. Phase 1: connection status indicator + settings form.
 * Talks to the background worker only through typed messages. All text is set
 * with textContent / .value; nothing from the server or the page is ever parsed as HTML.
 */
import { send, type ConnectionStatus } from '../messages';

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

async function init(): Promise<void> {
  try {
    const settings = await send({ type: 'GET_SETTINGS' });
    serverUrlInput.value = settings.serverUrl;
    authorIdInput.value = settings.authorId;
    renderStatus(await send({ type: 'GET_CONNECTION_STATUS' })); // instant: last known result
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
