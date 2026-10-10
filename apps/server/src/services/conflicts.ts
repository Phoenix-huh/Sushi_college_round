import type { Patch } from '@patchwork/shared';

export interface ConflictResult {
  hasConflict: boolean;
  conflictingPatches: [Patch, Patch][];
}

const norm = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Do two patches target the same element?
 * A selector such as ".product-title" can match several elements, so when BOTH patches
 * remember the element's text and the texts differ, they are different elements.
 * (An empty xpath never counts as a match.)
 */
export function targetsSameElement(a: Patch, b: Patch): boolean {
  const sameSelector =
    a.anchors.cssSelector === b.anchors.cssSelector ||
    (!!a.anchors.xpath && a.anchors.xpath === b.anchors.xpath);
  if (!sameSelector) return false;
  const ta = norm(a.anchors.textContent);
  const tb = norm(b.anchors.textContent);
  if (ta && tb && ta !== tb) return false;
  return true;
}

/**
 * Basic conflict detection.
 * Flags patches as conflicting if they target the same element (based on cssSelector) 
 * and modify the same property.
 */
export function detectConflicts(patches: Patch[]): ConflictResult {
  const conflicts: [Patch, Patch][] = [];
  
  for (let i = 0; i < patches.length; i++) {
    for (let j = i + 1; j < patches.length; j++) {
      const p1 = patches[i];
      const p2 = patches[j];
      
      const sameElement = targetsSameElement(p1, p2);
      const sameProperty = p1.change.type === p2.change.type;
      
      if (sameElement && sameProperty) {
        conflicts.push([p1, p2]);
      }
    }
  }
  
  return {
    hasConflict: conflicts.length > 0,
    conflictingPatches: conflicts
  };
}
