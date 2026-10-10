// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findBestMatch } from './matcher';
import type { PatchAnchor } from './types';

describe('Matcher', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should find the exact match', () => {
    container.innerHTML = `
      <div>
        <button id="checkout" class="btn primary">Checkout</button>
      </div>
    `;
    const btn = container.querySelector('#checkout')!;
    
    const anchor: PatchAnchor = {
      cssSelector: '#checkout',
      xpath: '//button[@id="checkout"]',
      textContent: 'Checkout',
      attributes: { id: 'checkout', class: 'btn primary' },
      parentContext: 'DIV',
      siblingContext: []
    };

    const candidates = Array.from(container.querySelectorAll('*'));
    const result = findBestMatch(anchor, candidates);
    
    expect(result).not.toBeNull();
    expect(result?.element).toBe(btn);
    expect(result?.score).toBeGreaterThan(0.9);
  });

  it('should find the button even if id and classes change (demo-site v1 vs v2 scenario)', () => {
    // In v1, button was <button id="checkout" class="btn primary">Checkout</button>
    // In v2, it moved to a new container and became <button id="buy-now" class="action-btn">Checkout</button>
    
    container.innerHTML = `
      <div class="new-container">
        <span>Cart</span>
        <button id="buy-now" class="action-btn">Checkout</button>
      </div>
    `;
    const btn = container.querySelector('#buy-now')!;
    
    // Anchor represents v1
    const anchor: PatchAnchor = {
      cssSelector: '#checkout',
      xpath: '//button[@id="checkout"]',
      textContent: 'Checkout',
      attributes: { id: 'checkout', class: 'btn primary' },
      parentContext: 'DIV', // Still inside a DIV
      siblingContext: [] // Used to have no siblings, now has a SPAN sibling
    };

    const candidates = Array.from(container.querySelectorAll('*'));
    const result = findBestMatch(anchor, candidates);
    
    expect(result).not.toBeNull();
    expect(result?.element).toBe(btn);
    // It should have a high score because text and parent match, even if attrs don't
    expect(result?.score).toBeGreaterThan(0.5);
  });
});
