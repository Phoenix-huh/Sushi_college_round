/**
 * Content script entry. Injected into every top-level http(s) page.
 * It never calls the server: it asks the background worker (see ../messages.ts).
 * It must never throw into the page.
 */
import { parseContentMessage, send, type Pick } from '../messages';
import { buildAnchor } from './anchor';
import { createApplier } from './applier';
import { attemptHeal } from './healer';
import { startPicker } from './picker';

const applier = createApplier({
  doc: document,
  pageOrigin: location.origin,
  pagePath: location.pathname,
  fetchLive: () => send({ type: 'GET_LIVE_PATCHES' }),
  heal: (patch, root) => attemptHeal(patch as Parameters<typeof attemptHeal>[0], root),
});

applier.start().catch((e: unknown) => console.warn('[Patchwork] could not start:', e));

// ---------- picker (started from the side panel) ----------

let picker: { stop(): void } | null = null;

function beginPicking() {
  if (picker) return; // already picking
  picker = startPicker({
    doc: document,
    onPick: (element) => {
      picker = null;
      try {
        const pick: Pick = {
          anchor: buildAnchor(element),
          tag: element.tagName.toLowerCase(),
          pageUrl: location.href,
          pickedAt: Date.now(),
        };
        send({ type: 'PICK_RESULT', pick }).catch((e: unknown) => console.warn('[Patchwork] could not report the pick:', e));
      } catch (e) {
        console.warn('[Patchwork] could not build an anchor for that element:', e);
      }
    },
    onCancel: () => {
      picker = null;
    },
  });
}

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse: (r: { ok: boolean }) => void) => {
  if (sender.id !== chrome.runtime.id) return false; // only our own extension
  const message = parseContentMessage(raw);
  if (!message) return false; // not for us (the background worker answers its own messages)
  if (message.type === 'START_PICKER') beginPicking();
  else {
    picker?.stop();
    picker = null;
  }
  sendResponse({ ok: true });
  return false;
});
