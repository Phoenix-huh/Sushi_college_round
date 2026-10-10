// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LivePatch, LiveState } from '../messages';
import { createApplier, patchAppliesToPage } from './applier';

const ORIGIN = 'http://shop.test';
const quiet = { info: () => {}, warn: () => {} };

function lp(id: string, text: string, change: LivePatch['change'], extra: Partial<LivePatch['anchors']> = {}, target_url = ORIGIN + '/'): LivePatch {
  return {
    id,
    target_url,
    anchors: { cssSelector: '.product-title', xpath: '', textContent: text, attributes: {}, parentContext: '', siblingContext: [], ...extra },
    change,
  };
}

let live: LiveState;
const fetchLive = vi.fn(async () => live);
const make = (over: Partial<Parameters<typeof createApplier>[0]> = {}) =>
  createApplier({ doc: document, pageOrigin: ORIGIN, pagePath: '/', fetchLive, pollMs: 0, debounceMs: 10, log: quiet, ...over });

const titles = () => Array.from(document.querySelectorAll('.product-title')).map((e) => e.textContent);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  document.body.innerHTML = `<div id="app"><h3 class="product-title">Laptop</h3><h3 class="product-title">Phone</h3></div>`;
  live = { signature: 's1', patches: [] };
  fetchLive.mockClear();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('patchAppliesToPage', () => {
  it('matches origin; "/" means the whole site; other paths must match', () => {
    expect(patchAppliesToPage(lp('a', '', { type: 'text', value: '' }), ORIGIN, '/anything')).toBe(true);
    expect(patchAppliesToPage(lp('a', '', { type: 'text', value: '' }, {}, ORIGIN + '/cart/'), ORIGIN, '/cart')).toBe(true);
    expect(patchAppliesToPage(lp('a', '', { type: 'text', value: '' }, {}, ORIGIN + '/cart'), ORIGIN, '/home')).toBe(false);
    expect(patchAppliesToPage(lp('a', '', { type: 'text', value: '' }, {}, 'http://other.test/'), ORIGIN, '/')).toBe(false);
    expect(patchAppliesToPage(lp('a', '', { type: 'text', value: '' }, {}, 'not a url'), ORIGIN, '/')).toBe(false);
  });
});

describe('applier', () => {
  it('applies live patches picked by text', async () => {
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'Smartphone' })] };
    const a = make();
    await a.start();
    expect(titles()).toEqual(['Laptop', 'Smartphone']);
    expect(a.appliedIds()).toEqual(['p1']);
    a.stop();
  });

  it('ignores patches for another origin', async () => {
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'X' }, {}, 'http://other.test/')] };
    const a = make();
    await a.start();
    expect(titles()).toEqual(['Laptop', 'Phone']);
    a.stop();
  });

  it('resolves all targets before applying (a rename does not hide the element from the next patch)', async () => {
    live = {
      signature: 's1',
      patches: [lp('p1', 'Laptop', { type: 'text', value: 'Notebook' }), lp('p2', 'Laptop', { type: 'style', value: 'color: red' })],
    };
    const a = make();
    await a.start();
    const first = document.querySelector('.product-title') as HTMLElement;
    expect(first.textContent).toBe('Notebook');
    expect(first.style.color).toBe('red');
    a.stop();
  });

  it('reverts a patch that is no longer live, without a reload', async () => {
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'Smartphone' })] };
    const a = make();
    await a.start();
    live = { signature: 's2', patches: [] };
    await a.refresh();
    expect(titles()).toEqual(['Laptop', 'Phone']);
    expect(a.appliedIds()).toEqual([]);
    a.stop();
  });

  it('replaces a changed patch: reverts the old value, applies the new one', async () => {
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'One' })] };
    const a = make();
    await a.start();
    live = { signature: 's2', patches: [lp('p1', 'Phone', { type: 'text', value: 'Two' })] };
    await a.refresh();
    expect(titles()).toEqual(['Laptop', 'Two']);
    a.stop();
  });

  it('keeps other patches when one is rolled back', async () => {
    const p1 = lp('p1', 'Laptop', { type: 'text', value: 'A' });
    const p2 = lp('p2', 'Phone', { type: 'text', value: 'B' });
    live = { signature: 's1', patches: [p1, p2] };
    const a = make();
    await a.start();
    live = { signature: 's2', patches: [p2] };
    await a.refresh();
    expect(titles()).toEqual(['Laptop', 'B']);
    a.stop();
  });

  it('does nothing when the signature has not changed', async () => {
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'X' })] };
    const a = make();
    await a.start();
    const el = document.querySelectorAll('.product-title')[1] as HTMLElement;
    el.textContent = 'edited by someone else';
    await a.refresh();
    expect(el.textContent).toBe('edited by someone else');
    a.stop();
  });

  it('re-applies after the page re-renders the element (SPA)', async () => {
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'Smartphone' })] };
    const a = make();
    await a.start();
    // The framework throws the list away and renders fresh nodes with the original text.
    document.getElementById('app')!.innerHTML = `<h3 class="product-title">Laptop</h3><h3 class="product-title">Phone</h3>`;
    expect(titles()).toEqual(['Laptop', 'Phone']);
    await wait(60);
    expect(titles()).toEqual(['Laptop', 'Smartphone']);
    a.stop();
  });

  it('applies a patch whose target shows up later', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'Smartphone' })] };
    const a = make();
    await a.start();
    expect(a.appliedIds()).toEqual([]);
    document.getElementById('app')!.innerHTML = '<h3 class="product-title">Phone</h3>';
    await wait(60);
    expect(titles()).toEqual(['Smartphone']);
    a.stop();
  });

  it('does not re-apply or loop on its own mutations', async () => {
    const info = vi.fn();
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'Smartphone' })] };
    const a = make({ log: { info, warn: () => {} } });
    await a.start();
    await wait(80);
    expect(info).toHaveBeenCalledTimes(1);
    a.stop();
  });

  it('warns once, not on every DOM change, about a missing target', async () => {
    const warn = vi.fn();
    live = { signature: 's1', patches: [lp('p1', 'Gone', { type: 'text', value: 'X' }, { attributes: { 'pw-find': 'text' } })] };
    const a = make({ log: { info: () => {}, warn } });
    await a.start();
    for (let i = 0; i < 3; i++) {
      document.body.appendChild(document.createElement('p'));
      await wait(30);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    a.stop();
  });

  it('does not run script patches', async () => {
    const warn = vi.fn();
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'script', value: 'target.id = "hacked"' })] };
    const a = make({ log: { info: () => {}, warn } });
    await a.start();
    expect(document.getElementById('hacked')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    a.stop();
  });

  it('keeps the page as it is when the server is unreachable, and recovers', async () => {
    live = { signature: 's1', patches: [lp('p1', 'Phone', { type: 'text', value: 'Smartphone' })] };
    const a = make();
    await a.start();
    fetchLive.mockRejectedValueOnce(new Error('down'));
    await a.refresh();
    expect(titles()).toEqual(['Laptop', 'Smartphone']);
    live = { signature: 's2', patches: [] };
    await a.refresh();
    expect(titles()).toEqual(['Laptop', 'Phone']);
    a.stop();
  });

  it('stop() puts everything back', async () => {
    live = {
      signature: 's1',
      patches: [lp('p1', 'Phone', { type: 'text', value: 'X' }), lp('p2', 'Laptop', { type: 'visibility', value: 'hidden' })],
    };
    const a = make();
    await a.start();
    expect((document.querySelector('.product-title') as HTMLElement).style.display).toBe('none');
    a.stop();
    expect(titles()).toEqual(['Laptop', 'Phone']);
    expect((document.querySelector('.product-title') as HTMLElement).style.display).toBe('');
  });
});
