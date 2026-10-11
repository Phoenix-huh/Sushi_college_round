// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, test, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runtimeSrc = fs.readFileSync(path.resolve(here, '../public/shared/patchwork-runtime.js'), 'utf8');
const page = (v: 'v1' | 'v2') =>
  fs.readFileSync(path.resolve(here, `../public/${v}/index.html`), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');

const mkPatch = (selector: string, type: string, value: string, extra: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  anchors: {
    cssSelector: selector,
    xpath: `//*[@id="x"]`,
    textContent: 'Checkout',
    attributes: { id: 'checkout-btn', class: 'btn-checkout' },
    parentContext: 'div.cart-actions',
    siblingContext: [],
    ...extra,
  },
  change: { type, value },
});

function load(version: 'v1' | 'v2', live: { patches: unknown[]; signature: string }) {
  document.documentElement.innerHTML = page(version);
  (window as any).PATCHWORK_API = 'http://api.test';
  (window as any).fetch = vi.fn(async () => ({ ok: true, json: async () => live }));
  (globalThis as any).fetch = (window as any).fetch;
  (0, eval)(runtimeSrc);
  return (window as any).Patchwork;
}

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

describe('patchwork runtime', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
  });

  test('text patch changes the element on v1', async () => {
    const pw = load('v1', { patches: [], signature: 's' });
    pw.applyPatches([mkPatch('#checkout-btn', 'text', 'Pay Now')]);
    expect($('#checkout-btn').textContent).toBe('Pay Now');
  });

  test('style patch (CSS text) is applied and keeps existing inline styles', () => {
    const pw = load('v1', { patches: [], signature: 's' });
    $('#checkout-btn').style.color = 'red';
    pw.applyPatches([mkPatch('#checkout-btn', 'style', 'background-color: #ef4444; font-weight: 700;')]);
    // happy-dom keeps the hex string; real browsers normalise it to rgb()
    expect(['#ef4444', 'rgb(239, 68, 68)']).toContain($('#checkout-btn').style.backgroundColor);
    expect($('#checkout-btn').style.fontWeight).toBe('700');
    expect($('#checkout-btn').style.color).toBe('red');
  });

  test('style patch also accepts a JSON object', () => {
    const pw = load('v1', { patches: [], signature: 's' });
    pw.applyPatches([mkPatch('#checkout-btn', 'style', JSON.stringify({ backgroundColor: 'blue' }))]);
    expect($('#checkout-btn').style.backgroundColor).toBe('blue');
  });

  test('visibility patch hides and a later "visible" restores', () => {
    const pw = load('v1', { patches: [], signature: 's' });
    pw.applyPatches([mkPatch('#checkout-btn', 'visibility', 'hidden')]);
    expect($('#checkout-btn').style.display).toBe('none');
    pw.applyPatches([mkPatch('#checkout-btn', 'visibility', 'visible')]);
    expect($('#checkout-btn').style.display).toBe('');
  });

  test('heals onto the moved/renamed checkout button on v2, not onto other buttons', () => {
    const pw = load('v2', { patches: [], signature: 's' });
    expect(document.querySelector('#checkout-btn')).toBeNull();
    pw.applyPatches([mkPatch('#checkout-btn', 'text', 'Pay Now')]);
    expect($('#place-order-btn').textContent).toBe('Pay Now');
    document.querySelectorAll('.btn-add').forEach((b) => expect(b.textContent).toBe('Add to Cart'));
  });

  test('does nothing (and does not throw) when no element is similar enough', () => {
    const pw = load('v2', { patches: [], signature: 's' });
    const before = document.body.innerHTML;
    const patch = mkPatch('#does-not-exist', 'text', 'x', {
      textContent: 'zzz qqq', attributes: { id: 'nope', class: 'nada' }, parentContext: '',
    });
    expect(() => pw.applyPatches([patch])).not.toThrow();
    expect(document.body.innerHTML).toBe(before);
  });

  test('first poll applies the live patches from the server', async () => {
    const live = { patches: [mkPatch('.logo', 'text', 'SuperStore', { attributes: { class: 'logo' }, textContent: 'TechMart' })], signature: 'a' };
    const pw = load('v1', live);
    await pw.pollLive();
    expect($('.logo').textContent).toBe('SuperStore');
  });

  test('text patch on a container element (cart-panel) preserves inner buttons and replaces child text', () => {
    const pw = load('v1', { patches: [], signature: 's' });
    const cart = document.querySelector('.cart-panel')!;
    const originalBtn = cart.querySelector('#checkout-btn');
    expect(originalBtn).not.toBeNull();

    // Text patch targeting .cart-panel with "Wireless Headphones" replaced by "Wired Headphones"
    const originalText = cart.textContent || '';
    const newText = originalText.replace('Wireless Headphones', 'Wired Headphones');
    pw.applyPatches([mkPatch('.cart-panel', 'text', newText, { textContent: originalText })]);

    // Button and structure are preserved
    expect(cart.querySelector('#checkout-btn')).not.toBeNull();
    // Inner span text is updated
    expect(cart.textContent).toContain('Wired Headphones');
    expect(cart.textContent).not.toContain('Wireless Headphones');
  });

  describe('several elements share one selector (three .product-title headings)', () => {
    const titleOf = () => Array.from(document.querySelectorAll('.product-title')).map((e) => e.textContent);
    const titlePatch = (anchorText: string, selector: string, value: string, attrs: Record<string, string> = {}) =>
      mkPatch(selector, 'text', value, { textContent: anchorText, attributes: attrs });

    it('patches the title whose text matches, not the first one', () => {
      const pw = load('v1', { patches: [], signature: 's' });
      pw.applyPatches([titlePatch('Smart Watch', 'h3.product-title', 'Analog Watch')]);
      expect(titleOf()).toEqual(['Wireless Headphones', 'Analog Watch', 'USB-C Hub']);
    });

    it('two patches on the same selector each hit their own element, in any order', () => {
      const a = titlePatch('Wireless Headphones', '.product-title', 'Wired Earphones');
      const b = titlePatch('Smart Watch', 'h3.product-title', 'Analog Watch');
      let pw = load('v1', { patches: [], signature: 's' });
      pw.applyPatches([a, b]);
      expect(titleOf()).toEqual(['Wired Earphones', 'Analog Watch', 'USB-C Hub']);
      pw = load('v1', { patches: [], signature: 's' });
      pw.applyPatches([b, a]);
      expect(titleOf()).toEqual(['Wired Earphones', 'Analog Watch', 'USB-C Hub']);
    });

    it('a later patch can still find an element that an earlier patch renamed', () => {
      const rename = titlePatch('Smart Watch', 'h3.product-title', 'Analog Watch');
      const style = { ...mkPatch('h3.product-title', 'style', 'color: red;', { textContent: 'Smart Watch' }) };
      const pw = load('v1', { patches: [], signature: 's' });
      pw.applyPatches([rename, style]);
      const el = document.querySelectorAll('.product-title')[1] as HTMLElement;
      expect(el.textContent).toBe('Analog Watch');
      expect(el.style.color).toBe('red');
    });

    it('find-by-text patches (no real selector) hit only the matching element', () => {
      const generic = 'h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, strong, em, b, small, div';
      const pw = load('v1', { patches: [], signature: 's' });
      pw.applyPatches([titlePatch('USB-C Hub', generic, 'Charging Hub', { 'pw-find': 'text' })]);
      expect(titleOf()).toEqual(['Wireless Headphones', 'Smart Watch', 'Charging Hub']);
    });

    it('find-by-text patches never fall back to "the first element" when the text is not on the page', () => {
      const generic = 'h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, strong, em, b, small, div';
      const pw = load('v1', { patches: [], signature: 's' });
      const before = document.body.innerHTML;
      pw.applyPatches([titlePatch('Quantum Toaster', generic, 'x', { 'pw-find': 'text' })]);
      expect(document.body.innerHTML).toBe(before);
    });

    it('older patches without a text hint keep the old behaviour (first match)', () => {
      const legacy = titlePatch('Checkout', '.product-title', 'Wired Earphones');
      const pw = load('v1', { patches: [], signature: 's' });
      pw.applyPatches([legacy]);
      expect(titleOf()).toEqual(['Wired Earphones', 'Smart Watch', 'USB-C Hub']);
    });
  });

  describe('extension and runtime coordination (Phase 3)', () => {
    const confirmPatch = {
      id: 'patch-confirm',
      anchors: {
        cssSelector: '#checkout-btn',
        xpath: '//*[@id="checkout-btn"]',
        textContent: 'Checkout',
        attributes: { id: 'checkout-btn', class: 'btn-checkout' },
        parentContext: 'div.cart-actions',
        siblingContext: [],
      },
      change: {
        type: 'behavior',
        value: JSON.stringify({ action: 'confirm', message: 'Proceed with checkout?' }),
      },
    };

    const togglePatch = {
      id: 'patch-toggle',
      anchors: {
        cssSelector: '#checkout-btn',
        xpath: '//*[@id="checkout-btn"]',
        textContent: 'Checkout',
        attributes: { id: 'checkout-btn', class: 'btn-checkout' },
        parentContext: 'div.cart-actions',
        siblingContext: [],
      },
      change: {
        type: 'behavior',
        value: JSON.stringify({
          action: 'toggle',
          ref: {
            cssSelector: '#cart-total',
            xpath: '//*[@id="cart-total"]',
            textContent: '$199.99',
            attributes: { id: 'cart-total' },
            parentContext: 'div.cart-panel',
            siblingContext: [],
          },
        }),
      },
    };

    it('runtime stands down when data-patchwork-extension marker is on <html>', () => {
      document.documentElement.setAttribute('data-patchwork-extension', 'true');
      const pw = load('v1', { patches: [], signature: 's' });
      expect(pw.isExtensionActive()).toBe(true);

      const before = $('#checkout-btn').textContent;
      pw.applyPatches([mkPatch('#checkout-btn', 'text', 'Changed By Runtime')]);
      expect($('#checkout-btn').textContent).toBe(before);
    });

    it('confirm behavior registers exactly once when extension and runtime are on the same page', async () => {
      // Simulate extension marking <html> at document_start
      document.documentElement.setAttribute('data-patchwork-extension', 'true');
      const pw = load('v1', { patches: [], signature: 's' });

      // In-page runtime attempts to apply
      pw.applyPatches([confirmPatch]);

      // Extension applies via targeting engine
      const { resolveTargets, applyResolved } = await import('@patchwork/shared');
      const { found } = resolveTargets([confirmPatch as any], document);
      applyResolved(found);

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      $('#checkout-btn').click();

      // Must be called exactly once, never twice!
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith('Proceed with checkout?');
    });

    it('confirm behavior registers exactly once when extension is NOT present (runtime alone)', () => {
      document.documentElement.removeAttribute('data-patchwork-extension');
      const pw = load('v1', { patches: [], signature: 's' });

      pw.applyPatches([confirmPatch]);

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      $('#checkout-btn').click();

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith('Proceed with checkout?');
    });

    it('toggle behavior toggles once without cancelling itself when extension and runtime are on the same page', async () => {
      // Simulate extension marking <html> at document_start
      document.documentElement.setAttribute('data-patchwork-extension', 'true');
      const pw = load('v1', { patches: [], signature: 's' });

      // Create a test element matching the toggle ref
      const targetEl = document.createElement('div');
      targetEl.id = 'cart-total';
      targetEl.textContent = '$199.99';
      document.body.appendChild(targetEl);

      // In-page runtime attempts to apply
      pw.applyPatches([togglePatch]);

      // Extension applies via targeting engine
      const { resolveTargets, applyResolved } = await import('@patchwork/shared');
      const { found } = resolveTargets([togglePatch as any], document);
      applyResolved(found);

      expect(targetEl.style.display).not.toBe('none');

      // First click: toggles display to 'none'
      $('#checkout-btn').click();
      expect(targetEl.style.display).toBe('none');

      // Second click: toggles back to ''
      $('#checkout-btn').click();
      expect(targetEl.style.display).toBe('');
    });

    it('toggle behavior toggles once when extension is NOT present (runtime alone)', () => {
      document.documentElement.removeAttribute('data-patchwork-extension');
      const pw = load('v1', { patches: [], signature: 's' });

      const targetEl = document.createElement('div');
      targetEl.id = 'cart-total';
      targetEl.textContent = '$199.99';
      document.body.appendChild(targetEl);

      pw.applyPatches([togglePatch]);

      expect(targetEl.style.display).not.toBe('none');

      // First click: toggles display to 'none'
      $('#checkout-btn').click();
      expect(targetEl.style.display).toBe('none');

      // Second click: toggles back to ''
      $('#checkout-btn').click();
      expect(targetEl.style.display).toBe('');
    });
  });
});
