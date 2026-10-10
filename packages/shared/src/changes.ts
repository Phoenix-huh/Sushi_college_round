/**
 * Structured change values for the visual-patching change types.
 *
 * A patch change is always { type, value: string }. The newer types keep JSON in `value`
 * (so there is no database change): attribute, remove, move and behavior.
 *
 * Everything here is pure (no DOM, no Chrome APIs). The same checks run in the editor
 * (to tell the person what is wrong), on the server (to refuse bad drafts) and in the
 * targeting engine (so a bad value that got stored anyway is skipped, never applied).
 *
 *  - attribute: { name, value } sets an attribute, { name, remove: true } removes it.
 *      Event handler attributes (on*), style, id and srcdoc are refused. URL attributes must
 *      be http(s), mailto, tel or relative (images may also be small data:image/png|jpeg|gif|webp).
 *  - remove:    value is the word "remove". The element is taken out of the page.
 *  - move:      { to: "before"|"after"|"first"|"last", ref: PatchAnchor } puts the element
 *      before/after the reference element, or as the first/last child of it.
 *  - behavior:  declarative actions on click: navigate, confirm, disable, toggle, scroll_to.
 *      No code is evaluated, so these also run inside the extension.
 */
import type { PatchAnchor, PatchChange } from "./types.js";

export const CHANGE_TYPES = ["text", "style", "visibility", "script", "attribute", "remove", "move", "behavior"] as const;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseJson(raw: string, what: string): Parsed<Record<string, unknown>> {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return fail(`${what} must be a JSON object.`);
  }
  return isRecord(v) ? { ok: true, value: v } : fail(`${what} must be a JSON object.`);
}

// ---------- URLs ----------

/**
 * True when the URL is safe to put in a link or an image.
 * Browsers ignore tabs, newlines and spaces inside a scheme ("java\nscript:"), so those are stripped
 * before looking at the scheme. Anything with a scheme other than http, https, mailto or tel is refused
 * (so javascript:, vbscript:, data:text/html, file:, blob: are all out).
 */
export function isSafeUrl(url: string, kind: "link" | "image" = "link"): boolean {
  const v = url.replace(/[\u0000-\u0020\u007f]+/g, "");
  if (v === "") return false;
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(v);
  if (!m) return true; // relative path, //host, #hash or ?query
  const scheme = m[1]!.toLowerCase();
  if (scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel") return true;
  return kind === "image" && /^data:image\/(png|jpe?g|gif|webp)[;,]/i.test(v);
}

// ---------- attribute ----------

export interface AttributeValue {
  /** Lower-case attribute name. */
  name: string;
  /** The new value (omitted when `remove` is true). */
  value?: string;
  remove?: boolean;
}

const ATTR_NAME = /^[a-z_:][-a-z0-9_:.]*$/;
const BLOCKED_ATTRS = new Set(["style", "id", "srcdoc", "is"]);
const LINK_ATTRS = new Set(["href", "action", "formaction", "cite", "longdesc", "manifest", "ping", "xlink:href", "background", "data"]);
const IMAGE_ATTRS = new Set(["src", "poster"]);
const MAX_ATTR_VALUE = 2000;

export function parseAttributeValue(raw: string): Parsed<AttributeValue> {
  const j = parseJson(raw, "Attribute change");
  if (!j.ok) return j;
  const name = typeof j.value.name === "string" ? j.value.name.trim().toLowerCase() : "";
  if (!name || name.length > 64 || !ATTR_NAME.test(name)) return fail("Attribute name is missing or not a valid attribute name.");
  if (name.startsWith("on")) return fail("Event handler attributes (onclick...) are not allowed. Use a behavior change instead.");
  if (BLOCKED_ATTRS.has(name)) {
    return fail(name === "style" ? "Change style with a style change, not an attribute." : `The "${name}" attribute cannot be changed.`);
  }
  if (j.value.remove === true) return { ok: true, value: { name, remove: true } };
  if (typeof j.value.value !== "string") return fail("Attribute value is missing.");
  const value = j.value.value;
  if (value.length > MAX_ATTR_VALUE) return fail(`Attribute value is longer than ${MAX_ATTR_VALUE} characters.`);

  if (LINK_ATTRS.has(name) && value.trim() !== "" && !isSafeUrl(value, "link")) {
    return fail("That URL is not allowed. Use http(s), mailto, tel, or a relative link.");
  }
  if (IMAGE_ATTRS.has(name) && value.trim() !== "" && !isSafeUrl(value, "image")) {
    return fail("That image URL is not allowed. Use http(s), a relative path, or a small data:image/png|jpeg|gif|webp.");
  }
  if (name === "srcset") {
    for (const candidate of value.split(",")) {
      const url = candidate.trim().split(/\s+/)[0] ?? "";
      if (url && !isSafeUrl(url, "image")) return fail("srcset contains a URL that is not allowed.");
    }
  }
  return { ok: true, value: { name, value } };
}

// ---------- element references (used by move and behavior) ----------

/** Cleans an untrusted anchor. Needs a selector or an xpath; the rest gets safe defaults. */
export function parseAnchor(raw: unknown): Parsed<PatchAnchor> {
  if (!isRecord(raw)) return fail("Reference element is missing.");
  const cssSelector = typeof raw.cssSelector === "string" ? raw.cssSelector : "";
  const xpath = typeof raw.xpath === "string" ? raw.xpath : "";
  if (!cssSelector && !xpath) return fail("Reference element has no selector.");
  const attributes: Record<string, string> = {};
  if (isRecord(raw.attributes)) {
    for (const [k, v] of Object.entries(raw.attributes)) if (typeof v === "string") attributes[k] = v;
  }
  return {
    ok: true,
    value: {
      cssSelector,
      xpath,
      textContent: typeof raw.textContent === "string" ? raw.textContent : "",
      attributes,
      parentContext: typeof raw.parentContext === "string" ? raw.parentContext : "",
      siblingContext: Array.isArray(raw.siblingContext) ? raw.siblingContext.filter((s): s is string => typeof s === "string") : [],
    },
  };
}

// ---------- move ----------

export type MovePlacement = "before" | "after" | "first" | "last";
export const MOVE_PLACEMENTS: readonly MovePlacement[] = ["before", "after", "first", "last"];

export interface MoveValue {
  to: MovePlacement;
  ref: PatchAnchor;
}

export function parseMoveValue(raw: string): Parsed<MoveValue> {
  const j = parseJson(raw, "Move change");
  if (!j.ok) return j;
  const to = j.value.to;
  if (typeof to !== "string" || !(MOVE_PLACEMENTS as readonly string[]).includes(to)) {
    return fail('Move needs "to": one of before, after, first, last.');
  }
  const ref = parseAnchor(j.value.ref);
  if (!ref.ok) return ref;
  return { ok: true, value: { to: to as MovePlacement, ref: ref.value } };
}

// ---------- behavior ----------

export type BehaviorValue =
  | { action: "navigate"; url: string; newTab?: boolean }
  | { action: "confirm"; message: string }
  | { action: "disable" }
  | { action: "toggle"; ref: PatchAnchor }
  | { action: "scroll_to"; ref: PatchAnchor };

export const BEHAVIOR_ACTIONS = ["navigate", "confirm", "disable", "toggle", "scroll_to"] as const;

export function parseBehaviorValue(raw: string): Parsed<BehaviorValue> {
  const j = parseJson(raw, "Behavior change");
  if (!j.ok) return j;
  const action = j.value.action;
  switch (action) {
    case "navigate": {
      if (typeof j.value.url !== "string" || j.value.url.trim() === "") return fail("Navigate needs a URL.");
      if (!isSafeUrl(j.value.url, "link")) return fail("That URL is not allowed. Use http(s), mailto, tel, or a relative link.");
      return { ok: true, value: { action, url: j.value.url.trim(), ...(j.value.newTab === true ? { newTab: true } : {}) } };
    }
    case "confirm": {
      const message = typeof j.value.message === "string" ? j.value.message.trim() : "";
      if (!message) return fail("Confirm needs a message.");
      if (message.length > 300) return fail("Confirm message is longer than 300 characters.");
      return { ok: true, value: { action, message } };
    }
    case "disable":
      return { ok: true, value: { action } };
    case "toggle":
    case "scroll_to": {
      const ref = parseAnchor(j.value.ref);
      if (!ref.ok) return ref;
      return { ok: true, value: { action, ref: ref.value } };
    }
    default:
      return fail(`Behavior needs "action": one of ${BEHAVIOR_ACTIONS.join(", ")}.`);
  }
}

// ---------- the whole change ----------

/**
 * Checks a change before it is stored or applied.
 * The older types (text, style, visibility, script) are accepted as before; the newer ones are validated strictly.
 */
export function validateChange(change: PatchChange): Parsed<PatchChange> {
  switch (change.type) {
    case "attribute": {
      const r = parseAttributeValue(change.value);
      return r.ok ? { ok: true, value: change } : r;
    }
    case "move": {
      const r = parseMoveValue(change.value);
      return r.ok ? { ok: true, value: change } : r;
    }
    case "behavior": {
      const r = parseBehaviorValue(change.value);
      return r.ok ? { ok: true, value: change } : r;
    }
    case "remove":
      return change.value.trim() === "remove" ? { ok: true, value: change } : fail('A remove change must have the value "remove".');
    default:
      return { ok: true, value: change };
  }
}
