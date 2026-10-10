/**
 * Background service worker.
 * Phase 0: only makes the toolbar icon open the side panel. Everything else
 * (server calls, live-patch cache, messages) arrives in later phases.
 *
 * MV3 service workers are shut down when idle and restarted on demand, so this
 * top-level code runs again on every wake-up. Keep it idempotent and keep no
 * state in module variables.
 */

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
