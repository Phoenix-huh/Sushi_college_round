import { describe, expect, it } from 'vitest';
import { generateHeuristicPatch, parseElementContext, TEXT_SEARCH_SELECTOR } from './ai';

const URL = 'http://localhost:4100/';
const gen = (instruction: string, context = '') => generateHeuristicPatch(instruction, context, URL);

describe('parseElementContext', () => {
  it('reads tag, classes and inner text', () => {
    expect(parseElementContext('<h3 class="product-title">Smart Watch</h3>')).toEqual({
      tag: 'h3', id: undefined, classes: ['product-title'], text: 'Smart Watch',
    });
  });
  it('strips nested tags from the text and reads the id', () => {
    const el = parseElementContext('<button id="buy" class="btn big"><b>Buy</b> now</button>');
    expect(el).toMatchObject({ tag: 'button', id: 'buy', classes: ['btn', 'big'], text: 'Buy now' });
  });
  it('returns null when there is no element', () => {
    expect(parseElementContext('just words')).toBeNull();
  });
});

describe('generateHeuristicPatch', () => {
  it('Smart Watch -> Analog Watch with the pasted <h3> targets THAT title, with the right new text', () => {
    const p = gen('Change Smart Watch to Analog Watch', '<h3 class="product-title">Smart Watch</h3>');
    expect(p.change).toEqual({ type: 'text', value: 'Analog Watch' });
    expect(p.anchors.cssSelector).toBe('h3.product-title');
    expect(p.anchors.textContent).toBe('Smart Watch'); // lets the page choose it among the three titles
  });

  it('without any pasted HTML it finds the element by its text', () => {
    const p = gen('Change Smart Watch to Analog Watch');
    expect(p.change).toEqual({ type: 'text', value: 'Analog Watch' });
    expect(p.anchors.cssSelector).toBe(TEXT_SEARCH_SELECTOR);
    expect(p.anchors.textContent).toBe('Smart Watch');
    expect(p.anchors.attributes['pw-find']).toBe('text');
  });

  it('"Wired" does not trigger the colour "red"', () => {
    const p = gen('Change Wireless Earphones to Wired Earphones');
    expect(p.change).toEqual({ type: 'text', value: 'Wired Earphones' });
    expect(p.anchors.textContent).toBe('Wireless Earphones');
  });

  it('descriptor phrases still use keyword selectors', () => {
    const p = gen('Change logo text to SuperStore');
    expect(p.anchors.cssSelector).toBe('.logo');
    expect(p.change).toEqual({ type: 'text', value: 'SuperStore' });
  });

  it('strips quotes around the new value', () => {
    expect(gen('Rename Smart Watch to "Analog Watch"').change.value).toBe('Analog Watch');
  });

  it('colour requests become style patches on the pasted element', () => {
    const p = gen('Make the checkout button green', '<button id="checkout-btn">Checkout</button>');
    expect(p.change.type).toBe('style');
    expect(p.change.value).toContain('#10b981');
    expect(p.anchors.cssSelector).toBe('#checkout-btn');
  });

  it('hide requests become visibility patches', () => {
    const p = gen('Hide the footer');
    expect(p.change).toEqual({ type: 'visibility', value: 'hidden' });
    expect(p.anchors.cssSelector).toBe('.footer');
  });
});
