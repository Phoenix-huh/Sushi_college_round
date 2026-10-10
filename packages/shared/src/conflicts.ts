import type { Patch, PatchOp, PatchAnchor, Conflict } from "./types.js";
import { targetsSameElement } from "./matcher.js";
import { parseAttributeValue } from "./changes.js";

export { targetsSameElement };

const isHidden = (val: string) => /^(hidden|hide|none|invisible)$/i.test(val.trim());

/**
 * Extracts operations from a Patch.
 * If patch.ops exists, returns it; otherwise synthesizes ops from anchors and change.
 */
export function getPatchOps(patch: Patch): PatchOp[] {
  if (patch.ops && patch.ops.length > 0) {
    return patch.ops;
  }
  const change = patch.change;
  if (!change) return [];

  if (change.type === "style") {
    // If the style value contains multiple CSS properties, split them
    const decls = change.value.split(";").map((p) => p.trim()).filter(Boolean);
    if (decls.length > 0) {
      return decls.map((decl, i) => {
        const colon = decl.indexOf(":");
        const prop = colon > 0 ? decl.slice(0, colon).trim().toLowerCase() : "style";
        const val = colon > 0 ? decl.slice(colon + 1).trim() : decl;
        return {
          id: `${patch.id}-op-${i}`,
          patch_id: patch.id,
          anchors: patch.anchors,
          property: prop,
          old_value: null,
          new_value: val,
        };
      });
    }
  }

  // One property per attribute name, so changing href and alt on the same element does not conflict.
  let property: string = change.type;
  let newValue = change.value;
  if (change.type === "attribute") {
    const a = parseAttributeValue(change.value);
    if (a.ok) {
      property = `attr:${a.value.name}`;
      newValue = a.value.remove ? "(removed)" : a.value.value ?? "";
    }
  }

  return [
    {
      id: `${patch.id}-op-0`,
      patch_id: patch.id,
      anchors: patch.anchors,
      property,
      old_value: null,
      new_value: newValue,
    },
  ];
}

export interface OpConflictResult {
  isConflict: boolean;
  type?: "concurrent" | "stale_base" | "semantic";
  reason?: string;
}

export function detectOpConflict(
  opA: PatchOp,
  opB: PatchOp,
  defaultType: "concurrent" | "stale_base" = "concurrent"
): OpConflictResult {
  if (!targetsSameElement(opA.anchors, opB.anchors)) {
    return { isConflict: false };
  }

  // Semantic overlap: visibility:hidden vs text change
  const aIsHide = opA.property === "visibility" && isHidden(opA.new_value);
  const bIsHide = opB.property === "visibility" && isHidden(opB.new_value);
  if ((aIsHide && opB.property === "text") || (bIsHide && opA.property === "text")) {
    return {
      isConflict: true,
      type: "semantic",
      reason: "Semantic conflict: visibility:hidden overlaps with text edit on the same element",
    };
  }

  const propA = opA.property.toLowerCase().trim();
  const propB = opB.property.toLowerCase().trim();

  // Semantic overlap: taking an element out of the page overlaps with any other change to it.
  if ((propA === "remove") !== (propB === "remove")) {
    return {
      isConflict: true,
      type: "semantic",
      reason: "Semantic conflict: one patch removes this element while another changes it",
    };
  }

  // Same property on same element -> conflict between different patches
  if (propA === propB) {
    if (opA.patch_id !== opB.patch_id || opA.new_value.trim() !== opB.new_value.trim()) {
      return {
        isConflict: true,
        type: defaultType,
        reason: `Both modify property '${opA.property}' ('${opA.new_value}' vs '${opB.new_value}')`,
      };
    }
    return { isConflict: false };
  }

  // Different properties on the same element -> auto-merge, no conflict
  return { isConflict: false };
}

export interface DetectedConflictDetail {
  patchA: Patch;
  patchB: Patch;
  opA: PatchOp;
  opB: PatchOp;
  type: "concurrent" | "stale_base" | "semantic";
  reason: string;
}

export interface ConflictsSummary {
  hasConflict: boolean;
  conflictingPatches: [Patch, Patch][];
  details: DetectedConflictDetail[];
}

/**
 * Detects conflicts across a list of patches (e.g. for the conflicts page / API).
 */
export function detectConflicts(patches: Patch[]): ConflictsSummary {
  const conflictingPatches: [Patch, Patch][] = [];
  const details: DetectedConflictDetail[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < patches.length; i++) {
    for (let j = i + 1; j < patches.length; j++) {
      const pA = patches[i];
      const pB = patches[j];
      const opsA = getPatchOps(pA);
      const opsB = getPatchOps(pB);

      let pairConflict = false;
      for (const opA of opsA) {
        for (const opB of opsB) {
          const res = detectOpConflict(opA, opB, "concurrent");
          if (res.isConflict && res.type) {
            pairConflict = true;
            details.push({
              patchA: pA,
              patchB: pB,
              opA,
              opB,
              type: res.type,
              reason: res.reason || "Conflict detected",
            });
          }
        }
      }

      if (pairConflict) {
        const pairKey = `${pA.id}-${pB.id}`;
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          conflictingPatches.push([pA, pB]);
        }
      }
    }
  }

  return {
    hasConflict: details.length > 0,
    conflictingPatches,
    details,
  };
}

/**
 * Checks conflicts when a patch is submitted for review:
 * (1) against ops in other open patches (draft, in_review, approved) -> 'concurrent'
 * (2) against ops merged into versions newer than patch's base_version -> 'stale_base'
 */
export function checkSubmitConflicts(
  patch: Patch,
  otherOpenPatches: Patch[],
  newerVersionOps: Array<{ version_number: number; ops: PatchOp[] }> = []
): {
  status: "in_review" | "conflicted" | "stale";
  conflicts: Array<{
    patch_a: string;
    patch_b: string;
    op_a: string | null;
    op_b: string | null;
    type: "concurrent" | "stale_base" | "semantic";
    status: "open";
    resolution: null;
    reason: string;
  }>;
} {
  const ops = getPatchOps(patch);
  if (ops.length === 0 || (!patch.anchors.cssSelector && !patch.anchors.textContent && !patch.anchors.xpath)) {
    return { status: "stale", conflicts: [] };
  }

  const conflicts: Array<{
    patch_a: string;
    patch_b: string;
    op_a: string | null;
    op_b: string | null;
    type: "concurrent" | "stale_base" | "semantic";
    status: "open";
    resolution: null;
    reason: string;
  }> = [];

  // Check 1: Concurrent against other open patches
  for (const other of otherOpenPatches) {
    if (other.id === patch.id) continue;
    const otherOps = getPatchOps(other);
    for (const opA of ops) {
      for (const opB of otherOps) {
        const res = detectOpConflict(opA, opB, "concurrent");
        if (res.isConflict && res.type) {
          conflicts.push({
            patch_a: patch.id,
            patch_b: other.id,
            op_a: opA.id,
            op_b: opB.id,
            type: res.type,
            status: "open",
            resolution: null,
            reason: res.reason || "Concurrent conflict",
          });
        }
      }
    }
  }

  // Check 2: Stale base against ops merged into newer versions
  for (const v of newerVersionOps) {
    for (const opA of ops) {
      for (const opMerged of v.ops) {
        const res = detectOpConflict(opA, opMerged, "stale_base");
        if (res.isConflict && res.type) {
          conflicts.push({
            patch_a: patch.id,
            patch_b: opMerged.patch_id,
            op_a: opA.id,
            op_b: opMerged.id,
            type: res.type,
            status: "open",
            resolution: null,
            reason: `Stale base against version ${v.version_number}: ${res.reason}`,
          });
        }
      }
    }
  }

  return {
    status: conflicts.length > 0 ? "conflicted" : "in_review",
    conflicts,
  };
}
