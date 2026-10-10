// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
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
});
