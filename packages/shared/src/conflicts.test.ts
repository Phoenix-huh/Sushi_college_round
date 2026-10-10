import { describe, it, expect } from "vitest";
import {
  detectConflicts,
  detectOpConflict,
  checkSubmitConflicts,
  targetsSameElement,
} from "./conflicts.js";
import type { Patch, PatchOp, PatchAnchor } from "./types.js";

const baseAnchor: PatchAnchor = {
  cssSelector: "#checkout-btn",
  xpath: '//*[@id="checkout-btn"]',
  textContent: "Checkout",
  attributes: { id: "checkout-btn", class: "btn btn-primary" },
  parentContext: "div.cart-actions",
  siblingContext: ["div.cart-total"],
};

function createPatch(overrides: Partial<Patch>): Patch {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: baseAnchor,
    change: { type: "style", value: "background-color: #ef4444" },
    author_id: "00000000-0000-0000-0000-000000000001",
    status: "draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("Conflict Detection", () => {
  it("targetsSameElement matches when selector or xpath matches", () => {
    expect(targetsSameElement(baseAnchor, baseAnchor)).toBe(true);
    const sameSelector: PatchAnchor = { ...baseAnchor, xpath: "" };
    expect(targetsSameElement(baseAnchor, sameSelector)).toBe(true);
    const diffText: PatchAnchor = { ...baseAnchor, textContent: "Different Element" };
    expect(targetsSameElement(baseAnchor, diffText)).toBe(false);
  });

  it("targetsSameElement matches fuzzy anchors with score >= 0.8 even if selector changed", () => {
    const relocatedAnchor: PatchAnchor = {
      cssSelector: "#place-order-btn", // changed selector
      xpath: "",
      textContent: "Checkout", // same text
      attributes: { id: "place-order-btn", class: "btn btn-primary" }, // similar attributes
      parentContext: "div.cart-actions", // same parent
      siblingContext: ["div.cart-total"], // same sibling
    };
    expect(targetsSameElement(baseAnchor, relocatedAnchor)).toBe(true);
  });

  it("detects conflict when same element + same property + different new_value", () => {
    const patchA = createPatch({
      id: "aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      change: { type: "style", value: "background-color: #ef4444" },
    });
    const patchB = createPatch({
      id: "bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      change: { type: "style", value: "background-color: #10b981" },
    });

    const result = detectConflicts([patchA, patchB]);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingPatches.length).toBe(1);
    expect(result.details[0].type).toBe("concurrent");
  });

  it("auto-merges (no conflict) when same element + different properties", () => {
    const patchA = createPatch({
      id: "aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      change: { type: "style", value: "background-color: #ef4444" },
    });
    const patchB = createPatch({
      id: "bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      change: { type: "text", value: "Complete Purchase" },
    });

    const result = detectConflicts([patchA, patchB]);
    expect(result.hasConflict).toBe(false);
    expect(result.conflictingPatches.length).toBe(0);
  });

  it("detects semantic conflict: visibility:hidden vs text edit on the same element", () => {
    const opA: PatchOp = {
      id: "op-1",
      patch_id: "patch-1",
      anchors: baseAnchor,
      property: "visibility",
      old_value: null,
      new_value: "hidden",
    };
    const opB: PatchOp = {
      id: "op-2",
      patch_id: "patch-2",
      anchors: baseAnchor,
      property: "text",
      old_value: null,
      new_value: "Buy Now",
    };

    const res = detectOpConflict(opA, opB);
    expect(res.isConflict).toBe(true);
    expect(res.type).toBe("semantic");
  });

  it("flags stale_base conflict when submitting against newer version merged ops", () => {
    const patch = createPatch({
      id: "submitting-patch",
      change: { type: "text", value: "New Text" },
    });
    const mergedOp: PatchOp = {
      id: "merged-op",
      patch_id: "older-patch",
      anchors: baseAnchor,
      property: "text",
      old_value: null,
      new_value: "Different Merged Text",
    };

    const res = checkSubmitConflicts(patch, [], [{ version_number: 2, ops: [mergedOp] }]);
    expect(res.status).toBe("conflicted");
    expect(res.conflicts.length).toBe(1);
    expect(res.conflicts[0].type).toBe("stale_base");
  });

  it("marks patch as stale if target element anchors are empty", () => {
    const emptyAnchor: PatchAnchor = {
      cssSelector: "",
      xpath: "",
      textContent: "",
      attributes: {},
      parentContext: "",
      siblingContext: [],
    };
    const patch = createPatch({
      id: "broken-patch",
      anchors: emptyAnchor,
    });
    const res = checkSubmitConflicts(patch, []);
    expect(res.status).toBe("stale");
  });
});
