/**
 * Self-healer: when the primary CSS selector for a live patch fails,
 * this module uses the shared fuzzy matcher to find the best candidate
 * in the whole DOM and reports the result to the background worker.
 *
 * Uses the typed `send()` helper so the PATCH_HEALED message goes through
 * the message protocol (parsed + validated in background/handlers.ts).
 * Content scripts NEVER call the server directly.
 */
import { findBestMatch } from '@patchwork/shared';
import type { Patch } from '@patchwork/shared';
import { send } from '../messages';

/** Minimum confidence score to accept a healed element (0–1). */
const HEAL_THRESHOLD = 0.6;

/**
 * Attempts to find the target element for `patch` by fuzzy-matching the whole
 * document tree. Returns the matched element on success, or null if no
 * candidate exceeds the threshold.
 */
export function attemptHeal(patch: Patch, root: Document = document): Element | null {
  const candidates = Array.from(root.querySelectorAll('*'));
  const matchResult = findBestMatch(patch.anchors, candidates);

  if (matchResult && matchResult.score > HEAL_THRESHOLD) {
    reportHeal(patch.id, matchResult.score, matchResult.breakdown ?? {});
    return matchResult.element;
  }

  return null;
}

/**
 * Fires-and-forgets a PATCH_HEALED message through the typed protocol so the
 * background worker can call POST /patches/:id/healed and write the audit log.
 */
function reportHeal(patchId: string, score: number, breakdown: Record<string, number>): void {
  send({ type: 'PATCH_HEALED', patchId, score, breakdown }).catch(() => {
    // Ignore: the background worker may be sleeping; the next poll will cover it.
  });
}
