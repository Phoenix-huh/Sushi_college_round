// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { findTarget } from '@patchwork/shared';
import { TEXT_CAP, buildAnchor, buildSelector, buildXPath, looksGenerated, stableClasses } from './anchor';

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

/** The core promise: the selector matches exactly the element it was built for. */
function expectUniqueFor(el: Element) {
  const selector = buildSelector(el);
  const all = document.querySelectorAll(selector);
  expect(all.length).toBe(1);
  expect(all[0]).toBe(el);
  return selector;
}

describe('looksGenerated', () => {
  it('flags machine-made names', () => {
    for (const t of ['css-1a2b3c', 'sc-bdVaJa', 'jsx-123456', 'svelte-xyz', ':r1:', 'radix-:r2:', 'x8f3a9c2d1', 'item-20240101', '_3xK9d2', 'a1B2c3']) {
      expect(looksGenerated(t)).toBe(true);
    }
  });
  it('keeps human-written names', () => {
    for (const t of ['product-title', 'btn-primary', 'card', 'cart-actions', 'nav', 'Header', 'price2', 'col-md-6']) {
      expect(looksGenerated(t)).toBe(false);
    }
  });
});

describe('buildSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers a stable unique id', () => {
    document.body.innerHTML = '<div><button id="checkout" class="btn">Go</button></div>';
    expect(buildSelector($('#checkout'))).toBe('#checkout');
  });

  it('skips a generated id and falls back to something stable', () => {
    document.body.innerHTML = '<div><button id="el_12345678" class="btn buy">Go</button><button class="btn">Other</button></div>';
    const selector = expectUniqueFor($('.buy'));
    expect(selector).not.toContain('12345678');
  });

  it('skips an id that is not unique', () => {
    document.body.innerHTML = '<p id="dup">a</p><p id="dup">b</p>';
    const second = document.querySelectorAll('p')[1]!;
    const selector = expectUniqueFor(second);
    expect(selector).not.toBe('#dup');
  });

  it('uses data-testid when present', () => {
    document.body.innerHTML = '<div><button data-testid="buy-now" class="css-9f8e7d6c">Buy</button><button class="css-9f8e7d6c">Other</button></div>';
    expect(buildSelector($('[data-testid]'))).toBe('button[data-testid="buy-now"]');
  });

  it('escapes quotes in attribute values', () => {
    document.body.innerHTML = '<div><input name=\'say "hi"\'><input name="other"></div>';
    expectUniqueFor($('input'));
  });

  it('drops generated classes', () => {
    document.body.innerHTML = '<div><span class="css-1a2b3c sc-bdVaJa price">1</span><span class="css-1a2b3c sc-bdVaJa price">2</span></div>';
    const second = document.querySelectorAll('span')[1]!;
    const selector = expectUniqueFor(second);
    expect(selector).not.toContain('css-');
    expect(selector).not.toContain('sc-');
  });

  it('survives tailwind-style classes that need escaping', () => {
    document.body.innerHTML = '<div class="md:flex w-1/2 hover:bg-red-500"><p class="text-sm">a</p><p class="text-sm">b</p></div>';
    for (const p of Array.from(document.querySelectorAll('p'))) expectUniqueFor(p);
  });

  it('numbers repeated siblings with :nth-of-type so each card gets its own selector', () => {
    document.body.innerHTML = `<ul class="list">
      <li class="card"><h3 class="product-title">Laptop</h3></li>
      <li class="card"><h3 class="product-title">Phone</h3></li>
      <li class="card"><h3 class="product-title">Tablet</h3></li></ul>`;
    const selectors = Array.from(document.querySelectorAll('.product-title')).map((h) => expectUniqueFor(h));
    expect(new Set(selectors).size).toBe(3);
    expect(selectors.every((s) => s.includes(':nth-of-type'))).toBe(true);
  });

  it('anchors the path at a stable ancestor id', () => {
    document.body.innerHTML = '<div><section id="cart"><div><span>1</span><span>2</span></div></section><section><div><span>3</span></div></section></div>';
    const selector = expectUniqueFor(document.querySelectorAll('span')[1]!);
    expect(selector.startsWith('#cart')).toBe(true);
  });

  it('uses the tag for html and body', () => {
    expect(buildSelector(document.body)).toBe('body');
    expect(buildSelector(document.documentElement)).toBe('html');
  });

  it('is unique for EVERY element of a messy page', () => {
    document.body.innerHTML = `
      <header class="css-aaa111bb"><nav><a href="/">Home</a><a href="/cart">Cart</a><a href="/cart?x=1">Cart2</a></nav></header>
      <main>
        <div class="row"><div class="col"><p>one</p><p>two</p><p>three</p></div><div class="col"><p>one</p><img alt="x"><img alt="y"></div></div>
        <form><input name="q"><input name="q"><button type="submit">Go</button><button type="submit">Go</button></form>
        <table><tbody><tr><td>1</td><td>2</td></tr><tr><td>1</td><td>2</td></tr></tbody></table>
        <div id="a1"><div id="a1">dup</div></div>
        <p class="  spaced   out  ">x</p><span data-testid="t">t</span><span data-testid="t">t</span>
      </main>`;
    for (const el of Array.from(document.body.querySelectorAll('*'))) expectUniqueFor(el);
  });
});

describe('buildXPath', () => {
  const resolve = (xpath: string) => document.evaluate(xpath, document, null, 9, null).singleNodeValue;

  it('finds the element again', () => {
    document.body.innerHTML = '<div><p>a</p><p>b</p></div><div><p>c</p></div>';
    for (const p of Array.from(document.querySelectorAll('p'))) expect(resolve(buildXPath(p))).toBe(p);
  });

  it('starts at a stable id', () => {
    document.body.innerHTML = '<main id="app"><ul><li>a</li><li>b</li></ul></main>';
    const li = document.querySelectorAll('li')[1]!;
    expect(buildXPath(li)).toBe('//*[@id="app"]/ul/li[2]');
    expect(resolve(buildXPath(li))).toBe(li);
    expect(buildXPath($('#app'))).toBe('//*[@id="app"]');
  });
});

describe('buildAnchor', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="cart-actions">
      <span class="note">hint</span>
      <button id="checkout" class="btn primary pw-hover" data-testid="co" style="color:red" pw-find="text" aria-label="Checkout">  Check
        out   now </button>
      <a class="link">more</a></div>`;
  });

  it('collects the text hint with whitespace collapsed', () => {
    expect(buildAnchor($('#checkout')).textContent).toBe('Check out now');
  });

  it('caps long text', () => {
    $('#checkout').textContent = 'x'.repeat(TEXT_CAP + 50);
    expect(buildAnchor($('#checkout')).textContent).toHaveLength(TEXT_CAP);
  });

  it('keeps useful attributes and leaves out style and Patchwork markers', () => {
    const { attributes } = buildAnchor($('#checkout'));
    expect(attributes).toEqual({ id: 'checkout', class: 'btn primary', 'data-testid': 'co', 'aria-label': 'Checkout' });
    expect(attributes).not.toHaveProperty('style');
    expect(attributes).not.toHaveProperty('pw-find');
  });

  it('never marks the anchor text-only (the selector is already unique)', () => {
    expect(buildAnchor($('#checkout')).attributes).not.toHaveProperty('pw-find');
  });

  it('gives a parentContext the shared matcher accepts, and sibling tags', () => {
    const el = $('#checkout');
    const a = buildAnchor(el);
    expect(a.parentContext).toBe('div.cart-actions');
    expect(el.parentElement!.matches(a.parentContext)).toBe(true);
    expect(a.siblingContext).toEqual(['span', 'a']);
  });

  it('has empty parentContext for the body (no meaningful parent)', () => {
    expect(buildAnchor(document.body).parentContext).toBe('');
  });

  it('round trip: the targeting engine finds the same element from the anchor alone', () => {
    document.body.innerHTML = `<ul><li class="card"><h3 class="product-title">Laptop</h3></li>
      <li class="card"><h3 class="product-title">Phone</h3></li><li class="card"><h3 class="product-title">Tablet</h3></li></ul>`;
    for (const h of Array.from(document.querySelectorAll('h3'))) {
      const anchor = buildAnchor(h);
      const hit = findTarget({ id: 'x', anchors: anchor, change: { type: 'text', value: 'y' } }, document);
      expect(hit?.element).toBe(h);
    }
  });

  it('round trip also works with pw-find=text added by a caller', () => {
    document.body.innerHTML = '<p class="a">one</p><p class="a">two</p>';
    const second = document.querySelectorAll('p')[1]!;
    const anchor = buildAnchor(second);
    anchor.attributes['pw-find'] = 'text';
    const hit = findTarget({ id: 'x', anchors: anchor, change: { type: 'text', value: 'y' } }, document);
    expect(hit?.element).toBe(second);
  });

  it('stableClasses ignores generated and unsafe class names', () => {
    document.body.innerHTML = '<div class="card css-1a2b3c md:flex pw-x btn-primary"></div>';
    expect(stableClasses($('div'))).toEqual(['card', 'btn-primary']);
  });

  it('rejects things that are not elements', () => {
    expect(() => buildAnchor(document.createTextNode('x') as unknown as Element)).toThrow('element');
  });
});
