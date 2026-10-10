import { describe, expect, it } from 'vitest';
import { detectOpConflict, getPatchOps } from './conflicts';
import type { Patch } from './types';

const anchors = { cssSelector: '#a', xpath: '', textContent: 'A', attributes: {}, parentContext: '', siblingContext: [] };
const patch = (id: string, change: Patch['change']): Patch =>
  ({ id, target_url: 'http://x.test/', base_version: 0, anchors, change, author_id: '00000000-0000-0000-0000-000000000001', status: 'draft' }) as unknown as Patch;
const op = (id: string, change: Patch['change']) => getPatchOps(patch(id, change))[0]!;
const J = (o: unknown) => JSON.stringify(o);

describe('conflicts with the new change types', () => {
  it('different attributes on the same element do not conflict; the same attribute does', () => {
    const href = op('p1', { type: 'attribute', value: J({ name: 'href', value: '/x' }) });
    const alt = op('p2', { type: 'attribute', value: J({ name: 'alt', value: 'y' }) });
    const href2 = op('p3', { type: 'attribute', value: J({ name: 'href', value: '/z' }) });
    expect(href.property).toBe('attr:href');
    expect(detectOpConflict(href, alt).isConflict).toBe(false);
    expect(detectOpConflict(href, href2).isConflict).toBe(true);
  });
  it('removing an element conflicts with any other change to it, as a semantic conflict', () => {
    const remove = op('p1', { type: 'remove', value: 'remove' });
    for (const other of [
      { type: 'text', value: 'x' },
      { type: 'style', value: 'color: red' },
      { type: 'attribute', value: J({ name: 'href', value: '/x' }) },
      { type: 'move', value: J({ to: 'after', ref: anchors }) },
    ] as Patch['change'][]) {
      const r = detectOpConflict(remove, op('p2', other));
      expect(r.isConflict).toBe(true);
      expect(r.type).toBe('semantic');
    }
  });
  it('two moves of the same element conflict; a move and a style change do not', () => {
    const m1 = op('p1', { type: 'move', value: J({ to: 'first', ref: anchors }) });
    const m2 = op('p2', { type: 'move', value: J({ to: 'last', ref: anchors }) });
    expect(detectOpConflict(m1, m2).isConflict).toBe(true);
    expect(detectOpConflict(m1, op('p3', { type: 'style', value: 'color: red' })).isConflict).toBe(false);
  });
  it('a behavior and a text change on the same element do not conflict', () => {
    const b = op('p1', { type: 'behavior', value: J({ action: 'disable' }) });
    expect(detectOpConflict(b, op('p2', { type: 'text', value: 'x' })).isConflict).toBe(false);
  });
});
