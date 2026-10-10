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
          "textContent": "Current or expected text content",
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

function generateHeuristicPatch(instruction: string, context: string, targetUrl: string): CreatePatch {
  const lower = instruction.toLowerCase();

  // Extract selector from context or instruction
  let selector = "#checkout-btn";
  const idMatch = context.match(/id=["']([^"']+)["']/i);
  const classMatch = context.match(/class=["']([^"']+)["']/i);

  if (idMatch) {
    selector = `#${idMatch[1]}`;
  } else if (classMatch) {
    selector = `.${classMatch[1].split(" ")[0]}`;
  } else if (lower.includes("logo") || lower.includes("brand")) {
    selector = ".logo";
  } else if (lower.includes("headphone") || (lower.includes("title") && lower.includes("first"))) {
    selector = ".product-card:nth-child(1) .product-title";
  } else if (lower.includes("price")) {
    selector = ".product-card:nth-child(1) .product-price";
  } else if (lower.includes("cart") && lower.includes("total")) {
    selector = ".cart-total span:last-child";
  } else if (lower.includes("header")) {
    selector = ".header";
  } else if (lower.includes("footer")) {
    selector = ".footer";
  } else if (lower.includes("order")) {
    selector = "#place-order-btn";
  }

  // Determine change type and value
  let type: "text" | "style" | "visibility" | "script" = "text";
  let value = instruction;

  if (lower.includes("hide") || lower.includes("invisible") || lower.includes("remove")) {
    type = "visibility";
    value = "hidden";
  } else if (
    lower.includes("color") ||
    lower.includes("red") ||
    lower.includes("blue") ||
    lower.includes("green") ||
    lower.includes("yellow") ||
    lower.includes("purple") ||
    lower.includes("background") ||
    lower.includes("font") ||
    lower.includes("border") ||
    lower.includes("style")
  ) {
    type = "style";
    if (lower.includes("red")) {
      value = "background-color: #ef4444; color: white;";
    } else if (lower.includes("green")) {
      value = "background-color: #10b981; color: white;";
    } else if (lower.includes("blue")) {
      value = "background-color: #3b82f6; color: white;";
    } else if (lower.includes("yellow")) {
      value = "background-color: #f59e0b; color: black;";
    } else if (lower.includes("purple")) {
      value = "background-color: #8b5cf6; color: white;";
    } else {
      value = "box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); font-weight: 600;";
    }
  } else {
    type = "text";
    // Clean up text
    const clean = instruction
      .replace(/^(change|make|set|replace|update)\s+(the\s+)?([a-z0-9_-]+\s+)?(text\s+)?(to\s+)?/i, "")
      .replace(/['"]/g, "")
      .trim();
    value = clean || instruction;
  }

  return {
    target_url: targetUrl,
    base_version: 0,
    author_id: DEV_ID,
    anchors: {
      cssSelector: selector,
      xpath: `//*[@id="${selector.replace("#", "")}"]`,
      textContent: "Checkout",
      attributes: { id: selector.replace("#", "") },
      parentContext: "div.cart-actions",
      siblingContext: ["div.cart-summary"],
    },
    change: {
      type,
      value,
    },
  };
}
