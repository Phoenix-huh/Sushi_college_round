/**
 * Content script entry. Injected into every top-level http(s) page.
 * Phase 0: does nothing except announce itself (removed in Phase 1).
 * It must never throw and must not touch the page.
 */
console.info('[Patchwork] content script loaded');

export {};
