// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyChange, type Undo } from './targeting';
import type { PatchChange } from './types';

const J = (o: unknown) => JSON.stringify(o);
const anchorFor = (selector: string, text = '') => ({ cssSelector: selector, xpath: '', textContent: text, attributes: {}, parentContext: '', siblingContext: [] });
const apply = (el: Element, change: PatchChange): Undo => {
  const r = applyChange(el, change);
  if ('skipped' in r) throw new Error('skipped: ' + r.skipped);
  return r;
};
const skipped = (el: Element, change: PatchChange): string => {
  const r = applyChange(el, change);
  if (!('skipped' in r)) throw new Error('expected a skip');
  return r.skipped;
};
const ids = (parent: Element) => Array.from(parent.children).map((c) => c.id).join(',');

let doc: Document;
beforeEach(() => {
  document.body.innerHTML =
    '<div id="list"><a id="a" href="/old" title="t">A</a><a id="b" href="/b">B</a><a id="c" href="/c">C</a></div>' +
    '<img id="pic" src="/old.png" alt="old"><div id="box"></div><button id="btn">Go</button><p id="note">Note</p>';
  doc = document;
});
const $ = (id: string) => doc.getElementById(id)!;

describe('attribute', () => {
  it('changes a link and puts it back', () => {
    const undo = apply($('a'), { type: 'attribute', value: J({ name: 'href', value: 'https://new.test/' }) });
    expect($('a').getAttribute('href')).toBe('https://new.test/');
    undo.revert();
    expect($('a').getAttribute('href')).toBe('/old');
  });
  it('swaps an image source and alt text', () => {
    const u1 = apply($('pic'), { type: 'attribute', value: J({ name: 'src', value: '/new.png' }) });
    const u2 = apply($('pic'), { type: 'attribute', value: J({ name: 'alt', value: 'new' }) });
    expect($('pic').getAttribute('src')).toBe('/new.png');
    expect($('pic').getAttribute('alt')).toBe('new');
    u2.revert();
    u1.revert();
    expect($('pic').getAttribute('src')).toBe('/old.png');
    expect($('pic').getAttribute('alt')).toBe('old');
  });
  it('adds an attribute that was not there, and removes it again on revert', () => {
    const undo = apply($('b'), { type: 'attribute', value: J({ name: 'target', value: '_blank' }) });
    expect($('b').getAttribute('target')).toBe('_blank');
    undo.revert();
    expect($('b').hasAttribute('target')).toBe(false);
  });
  it('removes an attribute and restores it on revert', () => {
    const undo = apply($('a'), { type: 'attribute', value: J({ name: 'title', remove: true }) });
    expect($('a').hasAttribute('title')).toBe(false);
    undo.revert();
    expect($('a').getAttribute('title')).toBe('t');
  });
  it('never applies an unsafe value, even if it was stored', () => {
    expect(skipped($('a'), { type: 'attribute', value: J({ name: 'href', value: 'javascript:alert(1)' }) })).toContain('not allowed');
    expect(skipped($('a'), { type: 'attribute', value: J({ name: 'onclick', value: 'alert(1)' }) })).toContain('behavior');
    expect($('a').getAttribute('href')).toBe('/old');
    expect($('a').hasAttribute('onclick')).toBe(false);
  });
  it('revert is safe twice', () => {
    const undo = apply($('a'), { type: 'attribute', value: J({ name: 'href', value: '/x' }) });
    undo.revert();
    undo.revert();
    expect($('a').getAttribute('href')).toBe('/old');
  });
});

describe('remove', () => {
  it('takes the element out and puts it back in the same place, same node', () => {
    const b = $('b');
    const undo = apply(b, { type: 'remove', value: 'remove' });
    expect(ids($('list'))).toBe('a,c');
    undo.revert();
    expect(ids($('list'))).toBe('a,b,c');
    expect($('b')).toBe(b);
  });
  it('restores the last child and the first child to their places', () => {
    const u1 = apply($('c'), { type: 'remove', value: 'remove' });
    const u2 = apply($('a'), { type: 'remove', value: 'remove' });
    expect(ids($('list'))).toBe('b');
    u2.revert();
    u1.revert();
    expect(ids($('list'))).toBe('a,b,c');
  });
  it('refuses html, head and body, and an element that is already gone', () => {
    expect(skipped(doc.body, { type: 'remove', value: 'remove' })).toContain('cannot be removed');
    expect(skipped(doc.documentElement, { type: 'remove', value: 'remove' })).toContain('cannot be removed');
    const loose = doc.createElement('div');
    expect(skipped(loose, { type: 'remove', value: 'remove' })).toContain('already removed');
  });
});

describe('move', () => {
  const mv = (to: string, selector: string) => ({ type: 'move' as const, value: J({ to, ref: anchorFor(selector) }) });

  it('moves before a sibling (reorder) and back', () => {
    const undo = apply($('c'), mv('before', '#a'));
    expect(ids($('list'))).toBe('c,a,b');
    undo.revert();
    expect(ids($('list'))).toBe('a,b,c');
  });
  it('moves after a sibling', () => {
    const undo = apply($('a'), mv('after', '#c'));
    expect(ids($('list'))).toBe('b,c,a');
    undo.revert();
    expect(ids($('list'))).toBe('a,b,c');
  });
  it('moves into another container as first or last child, and back to where it was', () => {
    const u1 = apply($('btn'), mv('last', '#box'));
    expect($('btn').parentElement).toBe($('box'));
    const u2 = apply($('note'), mv('first', '#box'));
    expect(ids($('box'))).toBe('note,btn');
    u2.revert();
    u1.revert();
    expect($('box').children).toHaveLength(0);
    expect(ids(doc.body)).toBe('list,pic,box,btn,note');
  });
  it('keeps the same node, so listeners and state survive', () => {
    const c = $('c');
    apply(c, mv('before', '#a'));
    expect($('c')).toBe(c);
  });
  it('refuses to move an element into itself or its own descendant, or next to a missing element', () => {
    expect(skipped($('list'), mv('last', '#a'))).toContain('into itself');
    expect(skipped($('a'), mv('after', '#a'))).toContain('into itself');
    expect(skipped($('a'), mv('after', '#nope'))).toContain('not found');
    expect(ids($('list'))).toBe('a,b,c');
  });
  it('refuses to move body, and to place something beside <html>', () => {
    expect(skipped(doc.body, mv('first', '#box'))).toContain('cannot be moved');
    expect(skipped($('a'), mv('before', 'html'))).toContain('top-level');
  });
  it('skips a move with a broken value', () => {
    expect(skipped($('a'), { type: 'move', value: 'nope' })).toContain('JSON');
  });
});

describe('behavior', () => {
  const beh = (o: unknown): PatchChange => ({ type: 'behavior', value: J(o) });
  const click = (el: Element) => {
    const e = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e;
  };

  it('disable: blocks page click handlers, sets aria and disabled, and fully reverts', () => {
    let pageClicks = 0;
    $('btn').addEventListener('click', () => void pageClicks++);
    const undo = apply($('btn'), beh({ action: 'disable' }));
    expect($('btn').getAttribute('aria-disabled')).toBe('true');
    expect($('btn').hasAttribute('disabled')).toBe(true);
    click($('btn'));
    expect(pageClicks).toBe(0);
    undo.revert();
    expect($('btn').hasAttribute('aria-disabled')).toBe(false);
    expect($('btn').hasAttribute('disabled')).toBe(false);
    click($('btn'));
    expect(pageClicks).toBe(1);
  });

  it('disable on a plain element blocks clicks without a disabled attribute', () => {
    let pageClicks = 0;
    $('note').addEventListener('click', () => void pageClicks++);
    const undo = apply($('note'), beh({ action: 'disable' }));
    expect($('note').hasAttribute('disabled')).toBe(false);
    click($('note'));
    expect(pageClicks).toBe(0);
    undo.revert();
    click($('note'));
    expect(pageClicks).toBe(1);
  });

  it('confirm: Cancel blocks the click, OK lets it through, revert removes it', () => {
    let pageClicks = 0;
    $('btn').addEventListener('click', () => void pageClicks++);
    const win = doc.defaultView as unknown as { confirm: (m: string) => boolean };
    const original = win.confirm;
    const asked: string[] = [];
    let answer = false;
    win.confirm = (m: string) => {
      asked.push(m);
      return answer;
    };
    try {
      const undo = apply($('btn'), beh({ action: 'confirm', message: 'Really?' }));
      click($('btn'));
      expect(pageClicks).toBe(0);
      answer = true;
      click($('btn'));
      expect(pageClicks).toBe(1);
      expect(asked).toEqual(['Really?', 'Really?']);
      undo.revert();
      click($('btn'));
      expect(asked).toHaveLength(2);
      expect(pageClicks).toBe(2);
    } finally {
      win.confirm = original;
    }
  });

  it('toggle: shows and hides another element on click, and stops after revert', () => {
    const undo = apply($('btn'), beh({ action: 'toggle', ref: anchorFor('#box') }));
    click($('btn'));
    expect($('box').style.display).toBe('none');
    click($('btn'));
    expect($('box').style.display).toBe('');
    undo.revert();
    click($('btn'));
    expect($('box').style.display).toBe('');
  });

  it('scroll_to: scrolls the target into view and cancels the default action', () => {
    let scrolledTo = '';
    ($('note') as unknown as { scrollIntoView: () => void }).scrollIntoView = () => void (scrolledTo = 'note');
    apply($('a'), beh({ action: 'scroll_to', ref: anchorFor('#note') }));
    const e = click($('a'));
    expect(scrolledTo).toBe('note');
    expect(e.defaultPrevented).toBe(true);
  });

  it('navigate: cancels the click and goes to the URL (new tab: opens it), reverts cleanly', () => {
    const win = doc.defaultView as unknown as { open: (...a: unknown[]) => unknown };
    const original = win.open;
    const opened: unknown[][] = [];
    win.open = (...a: unknown[]) => void opened.push(a);
    try {
      const undo = apply($('btn'), beh({ action: 'navigate', url: 'https://example.test/x', newTab: true }));
      const e = click($('btn'));
      expect(e.defaultPrevented).toBe(true);
      expect(opened).toHaveLength(1);
      expect(opened[0]![0]).toBe('https://example.test/x');
      expect(opened[0]![1]).toBe('_blank');
      undo.revert();
      const e2 = click($('btn'));
      expect(e2.defaultPrevented).toBe(false);
      expect(opened).toHaveLength(1);
    } finally {
      win.open = original;
    }
  });

  it('refuses javascript: navigation and unknown actions without touching the element', () => {
    expect(skipped($('btn'), beh({ action: 'navigate', url: 'javascript:alert(1)' }))).toContain('not allowed');
    expect(skipped($('btn'), beh({ action: 'eval', code: 'x' }))).toContain('action');
    expect(click($('btn')).defaultPrevented).toBe(false);
  });
});

describe('older types are unchanged', () => {
  it('text, style, visibility still apply and undo; script is still skipped', () => {
    const u1 = apply($('note'), { type: 'text', value: 'Changed' });
    const u2 = apply($('note'), { type: 'style', value: 'color: red' });
    const u3 = apply($('note'), { type: 'visibility', value: 'hidden' });
    expect($('note').textContent).toBe('Changed');
    expect(($('note') as HTMLElement).style.display).toBe('none');
    u3.revert();
    u2.revert();
    u1.revert();
    expect($('note').textContent).toBe('Note');
    expect(($('note') as HTMLElement).style.color).toBe('');
    expect(skipped($('note'), { type: 'script', value: 'x' })).toContain('not run');
  });
});
