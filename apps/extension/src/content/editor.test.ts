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
          <div id="item1">First Item</div>
          <button id="btn" class="cta">Submit Order</button>
          <div id="item3">Third Item</div>
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

  it('creates resize overlay with 8 handles and dimension tooltip', () => {
    const { window, document, btn, anchor } = setupDom();

    let capturedShadow: any = null;
    const origAttach = window.Element.prototype.attachShadow;
    window.Element.prototype.attachShadow = function (this: any, init: any) {
      const s = origAttach.call(this, init);
      capturedShadow = s;
      return s;
    };

    const editor = openEditor({
      doc: document as unknown as Document,
      element: btn as unknown as Element,
      anchor,
    });

    expect(capturedShadow).not.toBeNull();
    const overlay = capturedShadow.getElementById('pw-element-overlay');
    expect(overlay).not.toBeNull();

    const handles = overlay.querySelectorAll('[data-dir]');
    expect(handles.length).toBe(8);

    const dirs = Array.from(handles).map((h: any) => h.dataset.dir);
    expect(dirs).toEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);

    editor.close();
    window.Element.prototype.attachShadow = origAttach;
  });

  it('can reorder element among siblings using Move Up and Move Down', () => {
    const { window, document, btn, anchor } = setupDom();

    let capturedShadow: any = null;
    const origAttach = window.Element.prototype.attachShadow;
    window.Element.prototype.attachShadow = function (this: any, init: any) {
      const s = origAttach.call(this, init);
      capturedShadow = s;
      return s;
    };

    const editor = openEditor({
      doc: document as unknown as Document,
      element: btn as unknown as Element,
      anchor,
    });

    const container = document.getElementById('container')!;
    // Initially: item1, btn, item3
    expect(container.children[1].id).toBe('btn');

    // Click Move Up
    const moveUpBtn = capturedShadow.getElementById('pw-move-up');
    expect(moveUpBtn).not.toBeNull();
    moveUpBtn.click();

    // Now btn should be before item1: btn, item1, item3
    expect(container.children[0].id).toBe('btn');
    expect(container.children[1].id).toBe('item1');

    // Click Move Down twice
    const moveDownBtn = capturedShadow.getElementById('pw-move-down');
    expect(moveDownBtn).not.toBeNull();
    moveDownBtn.click();
    // After one move down: item1, btn, item3
    expect(container.children[1].id).toBe('btn');

    moveDownBtn.click();
    // After second move down: item1, item3, btn
    expect(container.children[2].id).toBe('btn');

    editor.close();
    window.Element.prototype.attachShadow = origAttach;
  });

  it('can resize element via width and height inputs', () => {
    const { window, document, btn, anchor } = setupDom();

    let capturedShadow: any = null;
    const origAttach = window.Element.prototype.attachShadow;
    window.Element.prototype.attachShadow = function (this: any, init: any) {
      const s = origAttach.call(this, init);
      capturedShadow = s;
      return s;
    };

    const editor = openEditor({
      doc: document as unknown as Document,
      element: btn as unknown as Element,
      anchor,
    });

    const widthInput = capturedShadow.getElementById('pw-resize-width') as HTMLInputElement;
    const heightInput = capturedShadow.getElementById('pw-resize-height') as HTMLInputElement;
    expect(widthInput).not.toBeNull();
    expect(heightInput).not.toBeNull();

    widthInput.value = '320';
    widthInput.dispatchEvent(new window.Event('input') as any);

    heightInput.value = '180';
    heightInput.dispatchEvent(new window.Event('input') as any);

    expect((btn as unknown as HTMLElement).style.width).toBe('320px');
    expect((btn as unknown as HTMLElement).style.height).toBe('180px');

    editor.close();
    window.Element.prototype.attachShadow = origAttach;
  });

  it('can drag and move the editor window on screen', () => {
    const { window, document, btn, anchor } = setupDom();

    let capturedShadow: any = null;
    const origAttach = window.Element.prototype.attachShadow;
    window.Element.prototype.attachShadow = function (this: any, init: any) {
      const s = origAttach.call(this, init);
      capturedShadow = s;
      return s;
    };

    const editor = openEditor({
      doc: document as unknown as Document,
      element: btn as unknown as Element,
      anchor,
    });

    const header = capturedShadow.getElementById('pw-editor-header') as HTMLElement;
    expect(header).not.toBeNull();

    const panel = header.parentElement as HTMLElement;
    expect(panel).not.toBeNull();

    // Trigger pointerdown on header at (100, 100)
    const downEvent = new window.PointerEvent('pointerdown', { clientX: 100, clientY: 100 } as any);
    header.dispatchEvent(downEvent as any);

    // Trigger pointermove at (250, 300)
    const moveEvent = new window.PointerEvent('pointermove', { clientX: 250, clientY: 300 } as any);
    window.dispatchEvent(moveEvent as any);

    // Panel left and top should have shifted
    expect(panel.style.left).toBeDefined();
    expect(panel.style.top).toBeDefined();

    // Trigger pointerup
    const upEvent = new window.PointerEvent('pointerup', { clientX: 250, clientY: 300 } as any);
    window.dispatchEvent(upEvent as any);

    editor.close();
    window.Element.prototype.attachShadow = origAttach;
  });

  it('can preview and revert multiple changes simultaneously on an element', () => {
    const { window, document, btn, anchor } = setupDom();

    let capturedShadow: any = null;
    const origAttach = window.Element.prototype.attachShadow;
    window.Element.prototype.attachShadow = function (this: any, init: any) {
      const s = origAttach.call(this, init);
      capturedShadow = s;
      return s;
    };

    const editor = openEditor({
      doc: document as unknown as Document,
      element: btn as unknown as Element,
      anchor,
    });

    // 1. Text change: change to "Buy Now"
    const textArea = capturedShadow.querySelector('textarea') as HTMLTextAreaElement;
    expect(textArea).not.toBeNull();
    textArea.value = 'Buy Now';
    textArea.dispatchEvent(new window.Event('input') as any);

    // 2. Style change: switch to Style tab and set width
    const widthInput = capturedShadow.getElementById('pw-resize-width') as HTMLInputElement;
    expect(widthInput).not.toBeNull();
    widthInput.value = '280';
    widthInput.dispatchEvent(new window.Event('input') as any);

    // Check preview button
    const buttons = Array.from(capturedShadow.querySelectorAll('button')) as HTMLButtonElement[];
    const previewBtn = buttons.find((b) => b.textContent?.trim() === 'Preview');
    const revertBtn = buttons.find((b) => b.textContent?.trim() === 'Revert');
    expect(previewBtn).toBeDefined();
    expect(revertBtn).toBeDefined();

    // Click Preview
    previewBtn!.click();

    // Both text and style should be applied simultaneously!
    expect(btn.textContent).toBe('Buy Now');
    expect((btn as unknown as HTMLElement).style.width).toBe('280px');

    // Click Revert
    revertBtn!.click();

    // Both should revert back!
    expect(btn.textContent).toBe('Submit Order');
    expect((btn as unknown as HTMLElement).style.width).not.toBe('280px');

    editor.close();
    window.Element.prototype.attachShadow = origAttach;
  });

  it('can stage changes and queue for next element', () => {
    const { window, document, btn, anchor } = setupDom();

    let capturedShadow: any = null;
    const origAttach = window.Element.prototype.attachShadow;
    window.Element.prototype.attachShadow = function (this: any, init: any) {
      const s = origAttach.call(this, init);
      capturedShadow = s;
      return s;
    };

    let pickNextCalled = false;
    const editor = openEditor({
      doc: document as unknown as Document,
      element: btn as unknown as Element,
      anchor,
      onPickNext: () => {
        pickNextCalled = true;
      },
    });

    const textArea = capturedShadow.querySelector('textarea') as HTMLTextAreaElement;
    textArea.value = 'Order Placed';
    textArea.dispatchEvent(new window.Event('input') as any);

    const buttons = Array.from(capturedShadow.querySelectorAll('button')) as HTMLButtonElement[];
    const stageBtn = buttons.find((b) => b.textContent?.includes('Stage & Pick Next'));
    expect(stageBtn).toBeDefined();

    stageBtn!.click();

    // Changes should remain previewed on the DOM
    expect(btn.textContent).toBe('Order Placed');
    expect(pickNextCalled).toBe(true);

    window.Element.prototype.attachShadow = origAttach;
  });
});

