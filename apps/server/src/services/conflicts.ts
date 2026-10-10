import type { Patch } from '@patchwork/shared';

export interface ConflictResult {
  hasConflict: boolean;
  conflictingPatches: [Patch, Patch][];
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
      
      const sameElement = p1.anchors.cssSelector === p2.anchors.cssSelector || 
                          p1.anchors.xpath === p2.anchors.xpath;
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
