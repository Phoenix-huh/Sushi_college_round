import { findBestMatch } from '@patchwork/shared';
import type { Patch, PatchAnchor } from '@patchwork/shared';

export function attemptHeal(patch: Patch, root: Document = document): Element | null {
  // If we can't find it directly by selector, let's look for candidates
  const candidates = Array.from(root.querySelectorAll('*'));
  
  const matchResult = findBestMatch(patch.anchors, candidates);
  
  // Set a threshold for healing
  if (matchResult && matchResult.score > 0.6) {
    reportHeal(patch.id, matchResult);
    return matchResult.element;
  }
  
  return null;
}

function reportHeal(patchId: string, matchResult: any) {
  // Send a message to the background script to report the healed event
  chrome.runtime.sendMessage({
    type: 'PATCH_HEALED',
    payload: {
      patchId,
      score: matchResult.score,
      breakdown: matchResult.breakdown,
    }
  }).catch(() => {
    // ignore if background script is not ready
  });
}
