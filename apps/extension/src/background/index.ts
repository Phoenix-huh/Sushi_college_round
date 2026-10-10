/**
 * Background service worker: the only part of the extension that talks to the
 * Patchwork server. Content scripts and the side panel send it typed messages
 * (see ../messages.ts).
 *
 * MV3 service workers are shut down when idle and restarted on demand, so this
 * top-level code runs again on every wake-up. Keep it idempotent and keep no
 * state in module variables (use chrome.storage).
 */
import { parseMessage, type Reply } from '../messages';
import { chromeStore } from '../settings';
import { createHandler } from './handlers';

const handle = createHandler({
  local: chromeStore(chrome.storage.local),
  session: chromeStore(chrome.storage.session),
  // Arrow wrapper: calling the bare global `fetch` as a method of another object throws "Illegal invocation".
  fetch: (input, init) => fetch(input, init),
});

// Listeners must be registered synchronously at top level, or a woken worker misses the event that woke it.
chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse: (reply: Reply<unknown>) => void) => {
  if (sender.id !== chrome.runtime.id) return false; // only our own extension pages and content scripts
  const message = parseMessage(raw);
  if (!message) {
    sendResponse({ ok: false, error: 'Unknown or malformed message' });
    return false;
  }
  handle(message).then(
    (data) => sendResponse({ ok: true, data }),
    (err: unknown) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
  );
  return true; // keep the channel open for the async reply
});

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: unknown) => console.warn('[Patchwork] could not enable side panel:', err));
} else {
  // Browser without the side panel API: show the same page as a toolbar popup.
  void chrome.action.setPopup({ popup: 'sidepanel.html' });
}

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[Patchwork] background ready (' + details.reason + ')');
});
