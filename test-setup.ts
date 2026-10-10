// Polyfill document.evaluate in happy-dom for Vitest
if (typeof document !== 'undefined' && !document.evaluate) {
  const evaluateXPath = (xpath: string, root: Document | Element): Element | null => {
    if (!xpath || typeof xpath !== 'string') return null;
    const trimmed = xpath.trim();
    if (trimmed.startsWith('//[') || trimmed.includes('[//') || trimmed.endsWith('[')) {
      throw new Error('Malformed XPath: ' + xpath);
    }

    // Match (//tag)[n]
    const matchGrouped = trimmed.match(/^\(\/\/([a-zA-Z0-9_-]+)\)\[(\d+)\]$/);
    if (matchGrouped) {
      const [, tag, idx] = matchGrouped;
      const elements = root.querySelectorAll(tag);
      return elements[parseInt(idx, 10) - 1] ?? null;
    }

    let current: Element | null = null;
    let remaining = trimmed;

    if (trimmed.startsWith('//*[@id="')) {
      const endId = trimmed.indexOf('"]');
      if (endId === -1) throw new Error('Malformed XPath: ' + xpath);
      const id = trimmed.slice(9, endId);
      const doc = (root as Document).getElementById ? (root as Document) : (root.ownerDocument ?? document);
      current = doc.getElementById(id);
      if (!current) return null;
      remaining = trimmed.slice(endId + 2);
      if (remaining.startsWith('/')) remaining = remaining.slice(1);
      if (!remaining) return current;
    } else if (trimmed.startsWith('/')) {
      remaining = trimmed.slice(1);
    }

    const parts = remaining.split('/').filter(Boolean);
    let el: Element | null = current ?? ((root as Document).documentElement ?? (root as Element));

    for (let i = 0; i < parts.length; i++) {
      if (!el) return null;
      const part = parts[i];
      const match = part.match(/^([a-zA-Z0-9_*]+)(?:\[(\d+)\])?$/);
      if (!match) return null;
      const [, tag, indexStr] = match;
      const targetIndex = indexStr ? parseInt(indexStr, 10) - 1 : 0;

      if (!current && i === 0 && el.tagName.toLowerCase() === tag.toLowerCase()) {
        continue;
      }

      const directChildren = Array.from(el.children);
      const matchedChildren = tag === '*'
        ? directChildren
        : directChildren.filter((c) => c.tagName.toLowerCase() === tag.toLowerCase());

      el = matchedChildren[targetIndex] ?? null;
    }

    return el;
  };

  const polyfillEvaluate = function (
    xpath: string,
    contextNode: Node,
    _nsResolver: any,
    _resultType: number,
    _result: any,
  ) {
    const el = evaluateXPath(xpath, contextNode as any);
    return {
      singleNodeValue: el,
      iterateNext: () => el,
    };
  };

  (globalThis as any).Document.prototype.evaluate = polyfillEvaluate;
  (document as any).evaluate = polyfillEvaluate;
}
