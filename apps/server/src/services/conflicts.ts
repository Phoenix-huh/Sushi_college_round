import type { Patch } from "@patchwork/shared";
import {
  detectConflicts as sharedDetectConflicts,
  targetsSameElement as sharedTargetsSameElement,
  checkSubmitConflicts,
  getPatchOps,
  detectOpConflict,
  type ConflictsSummary,
} from "@patchwork/shared";

export { checkSubmitConflicts, getPatchOps, detectOpConflict };

export interface ConflictResult {
  hasConflict: boolean;
  conflictingPatches: [Patch, Patch][];
  details?: any[];
}

export function targetsSameElement(a: Patch, b: Patch): boolean {
  return sharedTargetsSameElement(a.anchors, b.anchors);
}

export function detectConflicts(patches: Patch[]): ConflictResult {
  return sharedDetectConflicts(patches);
}
