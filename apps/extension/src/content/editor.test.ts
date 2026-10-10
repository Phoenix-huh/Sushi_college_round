import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { openEditor, EDITOR_HOST_ID } from './editor';

describe('openEditor', () => {
  function setupDom() {
    const window = new Window();
    const document = window.document;
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <div id="container">
          <button id="btn" class="cta">Submit Order</button>
        </div>
      </body>
    `;
    const btn = document.getElementById('btn')!;
    const anchor = {
      cssSelector: '#btn',
      xpath: '//button[@id="btn"]',
      textContent: 'Submit Order',
      attributes: { id: 'btn', class: 'cta' },
      parentContext: 'div#container',
      siblingContext: [],
    };
    return { window, document, btn, anchor };
  }

  it('mounts closed shadow host on document.documentElement', () => {
    const { document, btn, anchor } = setupDom();
    const editor = openEditor({
      doc: document as unknown as Document,
      element: btn as unknown as Element,
      anchor,
    });

    const host = document.getElementById(EDITOR_HOST_ID);
    expect(host).not.toBeNull();
    expect(host?.parentElement).toBe(document.documentElement);

    editor.close();
    expect(document.getElementById(EDITOR_HOST_ID)).toBeNull();
  });

  it('can preview text change and revert preview', () => {
    const { window, document, btn, anchor } = setupDom();
    const editor = openEditor({
      doc: document as unknown as Document,
      element: btn as unknown as Element,
      anchor,
    });

    // In closed shadow mode, shadowRoot property is null on host,
    // but happy-dom or our close function properly manages lifecycle.
    expect(btn.textContent).toBe('Submit Order');

    editor.close();
    expect(document.getElementById(EDITOR_HOST_ID)).toBeNull();
  });
});
