/**
 * Applier: keeps the page in sync with the live patches.
 *
 *  - fetches the live state (through the background worker, see content/index.ts)
 *  - resolves ALL targets first, then applies (shared targeting engine)
 *  - remembers an undo record per patch, so a patch that is no longer live is
 *    taken back WITHOUT reloading the page
 *  - re-applies after the page re-renders (debounced MutationObserver, for SPAs)
 *
 * No `chrome` access in here: the caller passes `fetchLive`, so this is tested in happy-dom.
 */
import { applyResolved, resolveTargets, type ResolveOptions, type Undo } from '@patchwork/shared';
import type { LivePatch, LiveState } from '../messages';

export interface ApplierOptions {
  doc: Document;
  /** location.origin of the page. Only patches for this origin are applied. */
  pageOrigin: string;
  /** location.pathname of the page. */
  pagePath: string;
  fetchLive: () => Promise<LiveState>;
  /** Last-resort element finder (self-healing). */
  heal?: ResolveOptions['heal'];
  /** How often to ask for the live state. Default 3000 ms. 0 turns polling off. */
  pollMs?: number;
  /** Quiet time after DOM changes before re-applying. Default 150 ms. */
  debounceMs?: number;
  log?: Pick<Console, 'info' | 'warn'>;
}

interface Applied {
  key: string;
  element: Element;
  undo: Undo;
}

const keyOf = (p: LivePatch) => JSON.stringify([p.anchors, p.change]);

const trimSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/** A patch applies to a page when the origin matches, and the path matches unless the patch targets the whole site ("/"). */
export function patchAppliesToPage(patch: LivePatch, pageOrigin: string, pagePath: string): boolean {
  let url: URL;
  try {
    url = new URL(patch.target_url);
  } catch {
    return false;
  }
  if (url.origin !== pageOrigin) return false;
  const path = trimSlash(url.pathname);
  return path === '/' || path === trimSlash(pagePath);
}

export function createApplier(options: ApplierOptions) {
  const { doc, fetchLive } = options;
  const pollMs = options.pollMs ?? 3000;
  const debounceMs = options.debounceMs ?? 150;
  const log = options.log ?? console;

  const applied = new Map<string, Applied>();
  const settled = new Map<string, string>(); // patch id -> key, for patches that will never apply (skipped/failed)
  const warned = new Set<string>(); // "id:key" already warned about, so a missing target is not logged on every DOM change
  let current: LiveState | null = null;
  let observer: MutationObserver | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let fetchFailing = false;
  let running = false;

  const warnOnce = (id: string, key: string, message: string) => {
    if (warned.has(id + key)) return;
    warned.add(id + key);
    log.warn(`[Patchwork] ${message}`);
  };

  function revertOne(id: string) {
    const entry = applied.get(id);
    if (!entry) return;
    try {
      entry.undo.revert();
    } catch (e) {
      log.warn('[Patchwork] could not revert patch', id, e);
    }
    applied.delete(id);
  }

  /** Brings the page in line with `state`. Safe to call any number of times. */
  function reconcile(state: LiveState) {
    current = state;
    const wanted = new Map<string, LivePatch>();
    for (const p of state.patches) {
      if (patchAppliesToPage(p, options.pageOrigin, options.pagePath)) wanted.set(p.id, p);
    }

    // 1. Take back patches that are gone, changed, or whose element left the page (the SPA re-rendered).
    for (const id of [...applied.keys()].reverse()) {
      const entry = applied.get(id)!;
      const patch = wanted.get(id);
      if (!patch || keyOf(patch) !== entry.key || !entry.element.isConnected) revertOne(id);
    }
    for (const [id, key] of settled) {
      const patch = wanted.get(id);
      if (!patch || keyOf(patch) !== key) settled.delete(id);
    }

    // 2. Phase 1: find every target before touching the page.
    const pending = [...wanted.values()].filter((p) => !applied.has(p.id) && !settled.has(p.id));
    if (pending.length === 0) return;
    const { found, missing } = resolveTargets(pending, doc, { heal: options.heal });
    for (const p of missing) warnOnce(p.id, keyOf(p), `no target for patch ${p.id.slice(0, 8)} (${p.anchors.cssSelector}); will retry when the page changes`);

    // 3. Phase 2: apply.
    for (const outcome of applyResolved(found)) {
      const patch = outcome.target.patch as LivePatch;
      const key = keyOf(patch);
      if (outcome.status === 'applied') {
        applied.set(patch.id, { key, element: outcome.target.element, undo: outcome.undo });
        log.info(`[Patchwork] applied ${patch.id.slice(0, 8)} via ${outcome.target.how}`);
      } else {
        settled.set(patch.id, key);
        warnOnce(patch.id, key, `patch ${patch.id.slice(0, 8)} not applied: ${outcome.status === 'skipped' ? outcome.reason : outcome.error}`);
      }
    }
  }

  /** Asks for the live state and reconciles when it changed. Never throws. */
  async function refresh(force = false) {
    try {
      const state = await fetchLive();
      if (fetchFailing) log.info('[Patchwork] server reachable again');
      fetchFailing = false;
      if (!running) return; // stopped while the request was in flight
      if (force || !current || state.signature !== current.signature) reconcile(state);
    } catch (e) {
      // Server down or worker asleep: keep what is applied and try again at the next poll.
      if (!fetchFailing) log.warn('[Patchwork] cannot read live patches:', e instanceof Error ? e.message : e);
      fetchFailing = true;
    }
  }

  function onDomChange() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (running && current) reconcile(current);
    }, debounceMs);
  }

  return {
    async start() {
      if (running) return;
      running = true;
      observer = new MutationObserver(onDomChange);
      observer.observe(doc.documentElement, { childList: true, subtree: true });
      await refresh(true);
      if (pollMs > 0) pollTimer = setInterval(() => { if (!doc.hidden) void refresh(); }, pollMs);
    },
    /** Stops watching and puts the page back the way it was. */
    stop() {
      running = false;
      observer?.disconnect();
      observer = null;
      if (pollTimer) clearInterval(pollTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      pollTimer = debounceTimer = null;
      for (const id of [...applied.keys()].reverse()) revertOne(id);
      settled.clear();
      current = null;
    },
    refresh,
    reconcile,
    /** Ids of the patches currently applied to the page. */
    appliedIds: () => [...applied.keys()],
  };
}

export type Applier = ReturnType<typeof createApplier>;
