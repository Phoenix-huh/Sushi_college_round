/**
 * Targeting engine: finds the element a patch is about and applies the change.
 * DOM-only (no Chrome APIs, no network), so it runs in a content script, in the
 * demo runtime and in happy-dom tests.
 *
 * Rules (same as apps/demo-site/public/shared/patchwork-runtime.js):
 *  - A selector may match several elements. The patch remembers the element's text
 *    (anchors.textContent); the match whose text equals it wins (innermost first).
 *  - anchors.attributes['pw-find'] === 'text'  ->  find by text only. No first-match
 *    and no xpath fallback: either the text matches or the patch has no target.
 *  - Patches with no text hint fall back to the first selector match.
 *  - Two phases: resolveTargets() finds EVERY target before applyResolved() changes
 *    anything, so an earlier patch that renames an element cannot hide it from a later one.
 *  - Style takes CSS text or a JSON object. Visibility "hidden" sets display:none,
 *    any other value restores the element's own display.
 *  - Every apply returns an undo record that puts the original state back.
 */
import type { PatchAnchor, PatchChange } from "./types.js";

/** The part of a Patch this engine needs. */
export interface TargetablePatch {
  id: string;
  anchors: PatchAnchor;
  change: PatchChange;
}

export type FindMethod = "selector" | "selector+text" | "xpath" | "healed";

export interface ResolvedTarget<P extends TargetablePatch = TargetablePatch> {
  patch: P;
  element: Element;
  how: FindMethod;
}

export interface ResolveOptions {
  /** Called only when selector and xpath found nothing and the patch is not text-only. */
  heal?: (patch: TargetablePatch, root: Document) => Element | null;
  /** Elements to never target (for example the extension's own UI). */
  ignore?: (element: Element) => boolean;
}

export interface ApplyOptions {
  /**
   * Run "script" patches. Off by default: extension content scripts must not eval
   * code, and a page that does not opt in should never run patch scripts.
   */
  allowScript?: boolean;
}

export interface Undo {
  /** False when the change cannot be taken back (script patches). */
  reversible: boolean;
  /** Restores the original state. Safe to call more than once. */
  revert(): void;
}

export type ApplyOutcome =
  | { status: "applied"; target: ResolvedTarget; undo: Undo }
  | { status: "skipped"; target: ResolvedTarget; reason: string }
  | { status: "failed"; target: ResolvedTarget; error: string };

// ---------- finding ----------

const normalize = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function isTextOnly(anchors: PatchAnchor): boolean {
  return anchors.attributes?.["pw-find"] === "text";
}

/** Picks one of several selector matches by text. See the rules at the top of this file. */
export function pickByText(matches: Element[], text: string, textOnly: boolean): Element | null {
  const want = normalize(text);
  if (!want) return textOnly ? null : (matches[0] ?? null);
  const exact = matches.filter((m) => normalize(m.textContent) === want);
  if (exact.length > 0) {
    // "Innermost" = fewest descendants, so <div><h3>Title</h3></div> picks the h3, not the div.
    return [...exact].sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length)[0] ?? null;
  }
  return textOnly ? null : (matches[0] ?? null);
}

function byXPath(root: Document, xpath: string): Element | null {
  if (!xpath) return null; // an empty xpath never matches
  try {
    const node = root.evaluate(xpath, root, null, 9 /* FIRST_ORDERED_NODE_TYPE */, null).singleNodeValue;
    return node instanceof Element ? node : null;
  } catch {
    return null; // malformed xpath
  }
}

/** Finds the element for one patch, or null. Does not change the page. */
export function findTarget<P extends TargetablePatch>(
  patch: P,
  root: Document,
  opts: ResolveOptions = {},
): ResolvedTarget<P> | null {
  const a = patch.anchors;
  const textOnly = isTextOnly(a);
  const ignored = (el: Element) => opts.ignore?.(el) === true;

  let matches: Element[] = [];
  try {
    if (a.cssSelector) matches = Array.from(root.querySelectorAll(a.cssSelector));
  } catch {
    // invalid selector: treat as no match
  }
  matches = matches.filter((m) => !ignored(m));

  const picked = matches.length > 0 ? pickByText(matches, a.textContent, textOnly) : null;
  if (picked) {
    return { patch, element: picked, how: matches.length > 1 && a.textContent ? "selector+text" : "selector" };
  }

  if (textOnly) return null; // never guess for text-only patches

  const viaXPath = byXPath(root, a.xpath);
  if (viaXPath && !ignored(viaXPath)) return { patch, element: viaXPath, how: "xpath" };

  const healed = opts.heal?.(patch, root) ?? null;
  if (healed && !ignored(healed)) return { patch, element: healed, how: "healed" };
  return null;
}

/** Phase 1. Finds every target before anything is changed. Result has one entry per found patch, in input order. */
export function resolveTargets<P extends TargetablePatch>(
  patches: P[],
  root: Document,
  opts: ResolveOptions = {},
): { found: ResolvedTarget<P>[]; missing: P[] } {
  const found: ResolvedTarget<P>[] = [];
  const missing: P[] = [];
  for (const patch of patches) {
    const hit = findTarget(patch, root, opts);
    if (hit) found.push(hit);
    else missing.push(patch);
  }
  return { found, missing };
}

// ---------- changing ----------

const camelToKebab = (s: string): string => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/** Parses style patch values: a JSON object ({"backgroundColor":"red"}) or CSS text ("color: red; margin: 0"). */
export function parseDeclarations(value: string): Array<{ prop: string; value: string; important: boolean }> {
  const out: Array<{ prop: string; value: string; important: boolean }> = [];
  const push = (prop: string, raw: string) => {
    const important = /!important\s*$/i.test(raw);
    const v = raw.replace(/!important\s*$/i, "").trim();
    if (prop && v) out.push({ prop, value: v, important });
  };
  try {
    const obj: unknown = JSON.parse(value);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) push(camelToKebab(k.trim()), String(v));
      return out;
    }
  } catch {
    // not JSON: CSS text
  }
  for (const part of String(value).split(";")) {
    const i = part.indexOf(":");
    if (i > 0) push(part.slice(0, i).trim(), part.slice(i + 1));
  }
  return out;
}

const HIDE = /^(hidden|hide|none|invisible)$/i;

function undoOf(revert: () => void): Undo {
  let done = false;
  return {
    reversible: true,
    revert() {
      if (done) return;
      done = true;
      revert();
    },
  };
}

/** Applies one change to an element and returns how to undo it. */
export function applyChange(el: Element, change: PatchChange, opts: ApplyOptions = {}): Undo | { skipped: string } {
  const style = (el as HTMLElement).style;

  if (change.type === "text") {
    const originalNodes = Array.from(el.childNodes); // keep the real nodes so listeners and structure survive a revert
    el.textContent = change.value;
    return undoOf(() => el.replaceChildren(...originalNodes));
  }

  if (change.type === "style") {
    const decls = parseDeclarations(change.value);
    if (decls.length === 0) return { skipped: "style patch has no valid CSS declarations" };
    const before = decls.map((d) => ({ prop: d.prop, value: style.getPropertyValue(d.prop), priority: style.getPropertyPriority(d.prop) }));
    for (const d of decls) style.setProperty(d.prop, d.value, d.important ? "important" : "");
    return undoOf(() => {
      for (const b of before) {
        if (b.value) style.setProperty(b.prop, b.value, b.priority);
        else style.removeProperty(b.prop);
      }
    });
  }

  if (change.type === "visibility") {
    const before = { value: style.getPropertyValue("display"), priority: style.getPropertyPriority("display") };
    if (HIDE.test(change.value.trim())) style.setProperty("display", "none");
    else style.removeProperty("display"); // "anything else restores it"
    return undoOf(() => {
      if (before.value) style.setProperty("display", before.value, before.priority);
      else style.removeProperty("display");
    });
  }

  // change.type === "script"
  if (!opts.allowScript) return { skipped: "script patches are not run here" };
  new Function("target", change.value)(el);
  return { reversible: false, revert() {} };
}

/** Phase 2. Applies already-resolved patches in order. One failing patch never stops the rest. */
export function applyResolved(found: ResolvedTarget[], opts: ApplyOptions = {}): ApplyOutcome[] {
  return found.map((target): ApplyOutcome => {
    try {
      const result = applyChange(target.element, target.patch.change, opts);
      if ("skipped" in result) return { status: "skipped", target, reason: result.skipped };
      return { status: "applied", target, undo: result };
    } catch (e) {
      return { status: "failed", target, error: e instanceof Error ? e.message : String(e) };
    }
  });
}
