import { GoogleGenAI } from "@google/genai";
import { CreatePatchSchema, type CreatePatch } from "@patchwork/shared";
import { DEV_ID } from "../seed.js";

const apiKey = process.env.GEMINI_API_KEY;
const hasApiKey = Boolean(apiKey && apiKey !== "dummy" && apiKey.length > 10);
const ai = hasApiKey ? new GoogleGenAI({ apiKey }) : null;

export async function explainHealing(scoreBreakdown: any, oldContext: any, newContext: any): Promise<string> {
  if (ai) {
    try {
      const prompt = `
      You are an expert web developer explaining why an automated system healed a broken UI patch.
      The original patch targeted an element with this context: ${JSON.stringify(oldContext)}
      The new element found has this context: ${JSON.stringify(newContext)}
      The matching algorithm scored the new element as follows: ${JSON.stringify(scoreBreakdown)}
      
      Explain in one plain-language sentence why this new element was chosen. Keep it under 20 words.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
      });
      return response.text?.trim() || "Element relocated and identified via attribute overlap and container hierarchy.";
    } catch {
      // Fallback
    }
  }

  return "Element relocated and identified via attribute overlap and container hierarchy.";
}

export async function generatePatchFromInstruction(
  instruction: string,
  context: string,
  targetUrl: string = "http://localhost:4100/"
): Promise<CreatePatch> {
  // If real Gemini API key is configured, use it
  if (ai) {
    try {
      const prompt = `
      You are an expert web development AI that generates UI patches for live websites.
      Context HTML of the target element (or surrounding page context):
      ${context}
      
      User Instruction:
      ${instruction}
      
      Generate a valid JSON object matching this schema without markdown codeblocks:
      {
        "target_url": "${targetUrl}",
        "base_version": 1,
        "anchors": {
          "cssSelector": "A precise CSS selector identifying the element (e.g. '.product-title', '#checkout-btn', '.logo', 'header', '.product-card:first-child .product-price')",
          "xpath": "XPath to the element",
          "textContent": "The EXACT current visible text of the target element (needed to tell apart elements that share a selector, e.g. three .product-title headings)",
          "attributes": { "id": "...", "class": "..." },
          "parentContext": "parent tag or class name",
          "siblingContext": ["sibling classes or tags"]
        },
        "change": {
          "type": "text" | "style" | "visibility" | "script",
          "value": "string value (e.g. new text, or CSS styles like 'background-color: #ef4444; color: white;', or 'hidden')"
        }
      }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
      });

      let text = response.text || "";
      if (text.includes("```json")) {
        text = text.replace(/```json/g, "").replace(/```/g, "");
      } else if (text.includes("```")) {
        text = text.replace(/```/g, "");
      }

      const parsed = JSON.parse(text.trim());
      parsed.target_url = targetUrl;
      const ctx = context.trim() ? parseElementContext(context) : null;
      if (parsed.anchors && !parsed.anchors.textContent && ctx?.text) parsed.anchors.textContent = ctx.text;
      if (!parsed.author_id) parsed.author_id = DEV_ID;
      if (parsed.base_version === undefined) parsed.base_version = 0;
      return CreatePatchSchema.parse(parsed);
    } catch (err: any) {
      console.warn("[Patchwork AI] Gemini API attempt failed, using smart heuristic:", err?.message || err);
      // Fall through to heuristic generator
    }
  }

  // Heuristic rule-based NL patch generator
  return generateHeuristicPatch(instruction, context, targetUrl);
}

/** Selector list used when we only know the element's TEXT (matched by text in the page runtime). */
export const TEXT_SEARCH_SELECTOR = "h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, strong, em, b, small, div";

const DESCRIPTOR_WORDS = /\b(logo|brand|header|footer|price|total|button|btn|text|title|heading|label|cart|color|colour|background|font|border|style)\b/i;
const COLORS: Record<string, string> = {
  red: "background-color: #ef4444; color: white;",
  green: "background-color: #10b981; color: white;",
  blue: "background-color: #3b82f6; color: white;",
  yellow: "background-color: #f59e0b; color: black;",
  purple: "background-color: #8b5cf6; color: white;",
};

/** Pull tag / id / classes / visible text out of a pasted snippet like <h3 class="x">Hello</h3>. */
export function parseElementContext(context: string) {
  const full = context.match(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>([\s\S]*?)<\/\1\s*>/);
  const open = full ?? context.match(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/);
  if (!open) return null;
  const attrs = open[2] ?? "";
  const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
  const classes = (attrs.match(/\bclass=["']([^"']+)["']/i)?.[1] ?? "").split(/\s+/).filter(Boolean);
  const text = (full?.[3] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { tag: open[1].toLowerCase(), id, classes, text };
}

export function generateHeuristicPatch(instruction: string, context: string, targetUrl: string): CreatePatch {
  const lower = instruction.toLowerCase();
  const el = context.trim() ? parseElementContext(context) : null;

  // "Change <X> to <Y>": Y is the new value, X is either a descriptor ("the logo text")
  // or the literal text of the element ("Smart Watch").
  const swap = instruction.match(/^\s*(?:please\s+)?(?:change|replace|rename|update|set|switch)\s+(?:the\s+)?(.+?)\s+(?:to|with|into)\s+(.+?)\s*$/i);
  const wantsHide = /\b(hide|invisible|remove)\b/.test(lower);
  const colorWord = Object.keys(COLORS).find((c) => new RegExp(`\\b${c}\\b`).test(lower));
  const wantsStyle = !wantsHide && (!!colorWord || /\b(colou?r|background|font|border|style|bold|shadow)\b/.test(lower));
  // "Change Wireless Earphones to Wired Earphones" is a text change even though it contains "red"
  const isTextSwap = !!swap && !wantsHide && !(wantsStyle && DESCRIPTOR_WORDS.test(swap[1]));

  // ---- what to change ----
  let type: "text" | "style" | "visibility" | "script" = "text";
  let value = instruction;
  if (wantsHide) {
    type = "visibility";
    value = "hidden";
  } else if (isTextSwap) {
    type = "text";
    value = swap![2].replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, "").trim();
  } else if (wantsStyle) {
    type = "style";
    value = colorWord ? COLORS[colorWord] : "box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); font-weight: 600;";
  } else {
    value = instruction
      .replace(/^\s*(?:please\s+)?(?:change|make|set|replace|update)\s+(?:the\s+)?(?:[a-z0-9_-]+\s+)?(?:text\s+)?(?:to\s+)?/i, "")
      .replace(/["']/g, "")
      .trim() || instruction;
  }

  // ---- which element ----
  const literalText = isTextSwap && !DESCRIPTOR_WORDS.test(swap![1]) ? swap![1].replace(/^["'\u201c]+|["'\u201d]+$/g, "").trim() : "";
  let selector: string;
  let textHint = "";
  let findByText = false;
  const attributes: Record<string, string> = {};

  if (el && (el.id || el.classes.length)) {
    selector = el.id ? `#${el.id}` : `${el.tag}.${el.classes.join(".")}`;
    textHint = el.text; // lets the page pick the right one when the selector matches several elements
    if (el.id) attributes.id = el.id;
    if (el.classes.length) attributes.class = el.classes.join(" ");
  } else if (literalText) {
    selector = TEXT_SEARCH_SELECTOR;
    textHint = literalText;
    findByText = true;
  } else if (/\b(logo|brand)\b/.test(lower)) {
    selector = ".logo";
  } else if (/\bheadphones?\b/.test(lower) || (/\btitle\b/.test(lower) && /\bfirst\b/.test(lower))) {
    selector = ".product-card:nth-child(1) .product-title";
  } else if (/\bprice\b/.test(lower)) {
    selector = ".product-card:nth-child(1) .product-price";
  } else if (/\bcart\b/.test(lower) && /\btotal\b/.test(lower)) {
    selector = ".cart-total span:last-child";
  } else if (/\bheader\b/.test(lower)) {
    selector = ".header";
  } else if (/\bfooter\b/.test(lower)) {
    selector = ".footer";
  } else if (/\b(order|place order)\b/.test(lower)) {
    selector = "#place-order-btn";
  } else {
    selector = "#checkout-btn";
  }
  if (findByText) attributes["pw-find"] = "text";

  return {
    target_url: targetUrl,
    base_version: 0,
    author_id: DEV_ID,
    anchors: {
      cssSelector: selector,
      xpath: selector.startsWith("#") ? `//*[@id="${selector.slice(1)}"]` : "",
      textContent: textHint,
      attributes,
      parentContext: "",
      siblingContext: [],
    },
    change: { type, value },
  };
}
