import { GoogleGenAI } from '@google/genai';
import { CreatePatchSchema } from '@patchwork/shared';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });

export async function explainHealing(scoreBreakdown: any, oldContext: any, newContext: any): Promise<string> {
  const prompt = `
  You are an expert web developer explaining why an automated system healed a broken UI patch.
  The original patch targeted an element with this context: ${JSON.stringify(oldContext)}
  The new element found has this context: ${JSON.stringify(newContext)}
  The matching algorithm scored the new element as follows: ${JSON.stringify(scoreBreakdown)}
  
  Explain in one plain-language sentence why this new element was chosen. Keep it under 20 words.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text?.trim() || "The element was found based on matching attributes and text content.";
  } catch (e) {
    return "The element was found based on matching attributes and text content.";
  }
}

export async function generatePatchFromInstruction(instruction: string, context: string) {
  const prompt = `
  You are an AI that writes patches for web pages.
  Context HTML:
  ${context}
  
  User Instruction:
  ${instruction}
  
  Generate a JSON object matching this TypeScript schema:
  {
    "target_url": "string",
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    let text = response.text || '';
    if (text.startsWith('\`\`\`json')) {
      text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    }
    
    const parsed = JSON.parse(text);
    // Let's validate it against Zod schema (we omit id, author_id, etc which are assigned later)
    return CreatePatchSchema.parse(parsed);
  } catch (e) {
    throw new Error('Failed to generate or validate patch: ' + (e as Error).message);
  }
}
