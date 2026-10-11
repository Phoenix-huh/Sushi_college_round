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
 *  - attribute / remove / move / behavior (see changes.ts): structured JSON values, all undoable, none evaluated.
 */
import { parseAttributeValue, parseBehaviorValue, parseMoveValue, type BehaviorValue } from "./changes.js";
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

function applyAttribute(el: Element, raw: string): Undo | { skipped: string } {
  const parsed = parseAttributeValue(raw);
  if (!parsed.ok) return { skipped: parsed.error };
  const { name, value, remove } = parsed.value;
  const had = el.hasAttribute(name);
  const old = el.getAttribute(name);
  if (remove) el.removeAttribute(name);
  else el.setAttribute(name, value ?? "");
  return undoOf(() => {
    if (had) el.setAttribute(name, old ?? "");
    else el.removeAttribute(name);
  });
}

/** Where an element was, so it can be put back exactly there. */
function placeMarker(el: Element) {
  const parent = el.parentNode;
  const next = el.nextSibling;
  return {
    parent,
    restore() {
      if (!parent) return;
      // If the old next sibling has moved elsewhere, append rather than lose the element.
      parent.insertBefore(el, next && next.parentNode === parent ? next : null);
    },
  };
}

const NEVER_MOVE = /^(html|head|body)$/i;

function applyRemove(el: Element): Undo | { skipped: string } {
  if (NEVER_MOVE.test(el.tagName)) return { skipped: `the <${el.tagName.toLowerCase()}> element cannot be removed` };
  if (!el.parentNode) return { skipped: "the element is already removed" };
  const where = placeMarker(el);
  el.remove();
  return undoOf(() => where.restore());
}

function applyMove(el: Element, raw: string): Undo | { skipped: string } {
  const parsed = parseMoveValue(raw);
  if (!parsed.ok) return { skipped: parsed.error };
  if (NEVER_MOVE.test(el.tagName)) return { skipped: `the <${el.tagName.toLowerCase()}> element cannot be moved` };
  if (!el.parentNode) return { skipped: "the element is not on the page" };
  const ref = findTarget({ id: "move-ref", anchors: parsed.value.ref, change: { type: "text", value: "" } }, el.ownerDocument, {})?.element;
  if (!ref) return { skipped: "the element to move next to was not found" };
  if (ref === el || el.contains(ref)) return { skipped: "an element cannot be moved into itself" };

  const { to } = parsed.value;
  if ((to === "before" || to === "after") && (!ref.parentNode || ref.parentNode === el.ownerDocument)) {
    return { skipped: "cannot place an element next to the top-level element" };
  }
  const where = placeMarker(el);
  if (to === "before") ref.parentNode!.insertBefore(el, ref);
  else if (to === "after") ref.parentNode!.insertBefore(el, ref.nextSibling);
  else if (to === "first") ref.insertBefore(el, ref.firstChild);
  else ref.appendChild(el);
  return undoOf(() => where.restore());
}

function applyBehavior(el: Element, raw: string): Undo | { skipped: string } {
  const parsed = parseBehaviorValue(raw);
  if (!parsed.ok) return { skipped: parsed.error };
  const b: BehaviorValue = parsed.value;
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const undos: Array<() => void> = [];

  const onClick = (handler: (e: Event) => void) => {
    el.addEventListener("click", handler, true); // capture: runs before the page's own click handlers
    undos.push(() => el.removeEventListener("click", handler, true));
  };
  const setAttr = (name: string, value: string) => {
    const had = el.hasAttribute(name);
    const old = el.getAttribute(name);
    el.setAttribute(name, value);
    undos.push(() => (had ? el.setAttribute(name, old ?? "") : el.removeAttribute(name)));
  };
  const refElement = (a: PatchAnchor): Element | null =>
    findTarget({ id: "behavior-ref", anchors: a, change: { type: "text", value: "" } }, doc, {})?.element ?? null;
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  switch (b.action) {
    case "navigate": {
      if (!win) return { skipped: "no window to navigate" };
      onClick((e) => {
        stop(e);
        if (b.newTab) win.open(b.url, "_blank", "noopener,noreferrer");
        else win.location.assign(b.url);
      });
      break;
    }
    case "confirm": {
      if (!win) return { skipped: "no window to ask in" };
      onClick((e) => {
        if (!win.confirm(b.message)) stop(e); // "Cancel" blocks the click; "OK" lets it through
      });
      break;
    }
    case "disable": {
      setAttr("aria-disabled", "true");
      if (/^(button|input|select|textarea)$/i.test(el.tagName)) setAttr("disabled", "");
      onClick(stop);
      break;
    }
    case "toggle": {
      onClick(() => {
        const target = refElement(b.ref) as HTMLElement | null;
        if (!target) return;
        if (target.style.display === "none") target.style.removeProperty("display");
        else target.style.setProperty("display", "none");
      });
      break;
    }
    case "scroll_to": {
      onClick((e) => {
        const target = refElement(b.ref);
        if (!target) return;
        stop(e);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      break;
    }
  }
  return undoOf(() => {
    for (const u of undos.reverse()) u();
  });
}

/** Applies one change to an element and returns how to undo it. */
export function applyChange(el: Element, change: PatchChange, opts: ApplyOptions = {}): Undo | { skipped: string } {
  const style = (el as HTMLElement).style;

  if (change.type === "text") {
    const originalNodes = Array.from(el.childNodes); // keep the real nodes so listeners and structure survive a revert
    if (el.children.length > 0) {
      let replaced = false;
      const textNodes: Node[] = [];
      const doc = el.ownerDocument || document;
      const walk = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      let tn: Node | null;
      while ((tn = walk.nextNode())) textNodes.push(tn);

      const value = change.value;
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        const raw = node.nodeValue;
        const trimmed = raw ? raw.trim() : '';
        if (trimmed.length > 0 && value.indexOf(trimmed) === -1) {
          const prevText = i > 0 ? (textNodes[i - 1].nodeValue || '').trim() : '';
          const nextText = i < textNodes.length - 1 ? (textNodes[i + 1].nodeValue || '').trim() : '';
          const start = prevText ? value.indexOf(prevText) + prevText.length : 0;
          const end = nextText ? value.indexOf(nextText, Math.max(0, start)) : value.length;
          if (start !== -1 && end !== -1 && end >= start) {
            const replacement = value.slice(start, end).trim();
            if (replacement) {
              node.nodeValue = replacement;
              replaced = true;
            }
          }
        }
      }
      if (!replaced) el.textContent = value;
    } else {
      el.textContent = change.value;
    }
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

  if (change.type === "attribute") return applyAttribute(el, change.value);
  if (change.type === "remove") return applyRemove(el);
  if (change.type === "move") return applyMove(el, change.value);
  if (change.type === "behavior") return applyBehavior(el, change.value);

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
