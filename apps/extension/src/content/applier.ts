import { attemptHeal } from "./healer";
import type { Patch } from "@patchwork/shared";

// Request patches from background script on load
chrome.runtime.sendMessage({ type: "GET_PATCHES" }, (response) => {
  if (response && response.patches) {
    const patches: Patch[] = response.patches;
    for (const patch of patches) {
      applyPatch(patch);
    }
  }
});

function applyPatch(patch: Patch) {
  let element = document.querySelector(patch.anchors.cssSelector);
  
  if (!element) {
    element = attemptHeal(patch, document);
  }

  if (!element) {
    console.warn("Patchwork: Could not find or heal element for patch", patch.id);
    return;
  }

  try {
    if (patch.change.type === "text") {
      element.textContent = patch.change.value;
    } else if (patch.change.type === "style") {
      (element as HTMLElement).style.cssText += patch.change.value;
    } else if (patch.change.type === "visibility") {
      (element as HTMLElement).style.display = patch.change.value;
    }
    console.log("Patchwork: Applied patch", patch.id);
  } catch (e) {
    console.error("Patchwork: Error applying patch", patch.id, e);
  }
}
