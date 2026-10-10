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
        model: "gemini-2.5-flash",
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
      You are an AI that writes patches for web pages.
      Context HTML:
      ${context}
      
      User Instruction:
      ${instruction}
      
      Generate a JSON object matching this TypeScript schema:
      {
        "target_url": "${targetUrl}",
        "base_version": 1,
        "anchors": {
          "cssSelector": "string",
          "xpath": "string",
          "textContent": "string",
          "attributes": { "key": "value" },
          "parentContext": "string",
          "siblingContext": ["string"]
        },
        "change": {
          "type": "text" | "style" | "visibility" | "script",
          "value": "string"
        }
      }
      
      Make sure to only output valid JSON without markdown wrapping.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      let text = response.text || "";
      if (text.startsWith("```json")) {
        text = text.replace(/```json/g, "").replace(/```/g, "");
      }

      const parsed = JSON.parse(text.trim());
      parsed.target_url = targetUrl;
      return CreatePatchSchema.parse(parsed);
    } catch {
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
    lower.includes("background") ||
    lower.includes("font") ||
    lower.includes("style")
  ) {
    type = "style";
    if (lower.includes("red")) {
      value = "background-color: #ef4444; color: white;";
    } else if (lower.includes("green")) {
      value = "background-color: #10b981; color: white;";
    } else if (lower.includes("blue")) {
      value = "background-color: #3b82f6; color: white;";
    } else {
      value = "box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); font-weight: 600;";
    }
  } else {
    type = "text";
    // Clean up text
    const clean = instruction
      .replace(/^(change|make|set|replace)\s+(the\s+)?(button\s+)?(text\s+)?(to\s+)?/i, "")
      .replace(/['"]/g, "")
      .trim();
    value = clean || "Complete Purchase";
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
