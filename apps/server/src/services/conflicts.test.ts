import { describe, it, expect } from 'vitest';
import { detectConflicts } from './conflicts';
import type { Patch } from '@patchwork/shared';

describe('detectConflicts', () => {
  const basePatch = {
    id: 'patch-1',
    target_url: 'http://localhost',
    base_version: 1,
    anchors: {
      cssSelector: '#btn',
      xpath: '//button',
      textContent: 'Btn',
      attributes: {},
      parentContext: 'DIV',
      siblingContext: []
    },
    change: { type: 'text', value: 'New Btn' },
    author_id: 'auth-1',
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Patch;

  it('should not flag conflicts for a single patch', () => {
    const res = detectConflicts([basePatch]);
    expect(res.hasConflict).toBe(false);
  });

  it('should flag conflict when two patches edit text on the same element', () => {
    const p2 = {
      ...basePatch,
      id: 'patch-2',
      change: { type: 'text', value: 'Another Btn' }
    } as Patch;

    const res = detectConflicts([basePatch, p2]);
    expect(res.hasConflict).toBe(true);
    expect(res.conflictingPatches.length).toBe(1);
  });

  it('should not flag conflict when patches edit different properties on the same element', () => {
    const p2 = {
      ...basePatch,
      id: 'patch-2',
      change: { type: 'style', value: 'color: red' }
    } as Patch;

    const res = detectConflicts([basePatch, p2]);
    expect(res.hasConflict).toBe(false);
  });

  it('should not flag conflict when patches edit the same property on different elements', () => {
    const p2 = {
      ...basePatch,
      id: 'patch-2',
      anchors: { ...basePatch.anchors, cssSelector: '#other-btn', xpath: '//button[@id="other"]' }
    } as Patch;

    const res = detectConflicts([basePatch, p2]);
    expect(res.hasConflict).toBe(false);
  });

  it('different elements that share a selector (told apart by their text) do not conflict', () => {
    const a = { ...basePatch, id: 'a', anchors: { ...basePatch.anchors, cssSelector: '.product-title', xpath: '', textContent: 'Wireless Headphones' } } as Patch;
    const b = { ...basePatch, id: 'b', anchors: { ...basePatch.anchors, cssSelector: '.product-title', xpath: '', textContent: 'Smart Watch' } } as Patch;
    expect(detectConflicts([a, b]).hasConflict).toBe(false);
  });

  it('same selector and same element text still conflicts', () => {
    const a = { ...basePatch, id: 'a', anchors: { ...basePatch.anchors, cssSelector: '.product-title', xpath: '', textContent: 'Smart Watch' } } as Patch;
    const b = { ...basePatch, id: 'b', anchors: { ...basePatch.anchors, cssSelector: '.product-title', xpath: '', textContent: ' smart  watch ' } } as Patch;
    expect(detectConflicts([a, b]).hasConflict).toBe(true);
  });

  it('two empty xpaths do not make different selectors "the same element"', () => {
    const a = { ...basePatch, id: 'a', anchors: { ...basePatch.anchors, cssSelector: '.logo', xpath: '' } } as Patch;
    const b = { ...basePatch, id: 'b', anchors: { ...basePatch.anchors, cssSelector: '.footer', xpath: '' } } as Patch;
    expect(detectConflicts([a, b]).hasConflict).toBe(false);
  });
});
