import type { PatchAnchor } from "./types.js";
import { distance } from "fastest-levenshtein";

export interface MatchResult {
  element: Element;
  score: number; // 0-1 overall confidence
  breakdown: {
    text: number;
    attributes: number;
    parent: number;
    sibling: number;
  };
}

export function findBestMatch(
  anchor: PatchAnchor,
  candidates: Element[]
): MatchResult | null {
  if (candidates.length === 0) return null;

  let bestMatch: MatchResult | null = null;
  let highestScore = -1;

  for (const el of candidates) {
    // 1. Text Score
    const textScore = calculateTextScore(anchor.textContent, el.textContent || "");
    
    // 2. Attributes Score
    const attrScore = calculateAttributeScore(anchor.attributes, el);
    
    // 3. Parent Context Score
    const parentScore = calculateParentScore(anchor.parentContext, el);
    
    // 4. Sibling Context Score
    const siblingScore = calculateSiblingScore(anchor.siblingContext, el);

    // Weights
    const totalScore = (textScore * 0.4) + (attrScore * 0.3) + (parentScore * 0.2) + (siblingScore * 0.1);

    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestMatch = {
        element: el,
        score: totalScore,
        breakdown: {
          text: textScore,
          attributes: attrScore,
          parent: parentScore,
          sibling: siblingScore
        }
      };
    }
  }

  return bestMatch;
}

function calculateTextScore(anchorText: string, elementText: string): number {
  if (!anchorText && !elementText) return 1;
  if (!anchorText || !elementText) return 0;
  
  const aText = anchorText.trim();
  const eText = elementText.trim();
  if (aText === eText) return 1;
  
  const dist = distance(aText, eText);
  const maxLen = Math.max(aText.length, eText.length);
  if (maxLen === 0) return 1;
  
  return Math.max(0, 1 - (dist / maxLen));
}

function calculateAttributeScore(anchorAttrs: Record<string, string>, element: Element): number {
  const keys = Object.keys(anchorAttrs);
  if (keys.length === 0) return 1;

  let matchCount = 0;
  for (const key of keys) {
    if (element.getAttribute(key) === anchorAttrs[key]) {
      matchCount++;
    }
  }
  return matchCount / keys.length;
}

function calculateParentScore(anchorParent: string, element: Element): number {
  if (!anchorParent) return 1;
  
  let current = element.parentElement;
  if (current) {
    try {
      if (current.matches(anchorParent)) {
        return 1;
      }
    } catch {
      // Invalid selector fallback
    }
    
    // Check if the parent context is just a tag name
    if (anchorParent.toUpperCase() === current.tagName) {
      return 0.8;
    }
  }
  return 0;
}

function calculateSiblingScore(anchorSiblings: string[], element: Element): number {
  if (!anchorSiblings || anchorSiblings.length === 0) return 1;
  // Simplistic check: do any of the siblings match the expected tags
  const siblings = Array.from(element.parentElement?.children || []).filter(c => c !== element);
  if (siblings.length === 0) return 0;
  
  let matchCount = 0;
  for (const expected of anchorSiblings) {
    if (siblings.some(s => s.tagName.toLowerCase() === expected.toLowerCase())) {
      matchCount++;
    }
  }
  
  return matchCount / anchorSiblings.length;
}
