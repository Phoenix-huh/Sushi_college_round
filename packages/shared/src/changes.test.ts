import { describe, expect, it } from 'vitest';
import { isSafeUrl, parseAttributeValue, parseBehaviorValue, parseMoveValue, validateChange } from './changes';

const ref = { cssSelector: '#nav', xpath: '', textContent: 'Home', attributes: {}, parentContext: '', siblingContext: [] };
const attr = (o: unknown) => JSON.stringify(o);

describe('isSafeUrl', () => {
  it('accepts http(s), mailto, tel and relative URLs', () => {
    for (const u of ['https://a.test/x?y=1', 'http://a.test', 'mailto:me@a.test', 'tel:+123', '/shop', 'shop/1', '#top', '?q=1', '//cdn.test/a.png']) {
      expect(isSafeUrl(u)).toBe(true);
    }
  });
  it('refuses script-capable and other schemes, even when disguised', () => {
    for (const u of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\nscript:alert(1)', 'java\tscript:alert(1)', 'vbscript:x', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'blob:http://a/1', '']) {
      expect(isSafeUrl(u)).toBe(false);
    }
  });
  it('lets images (only) use small data:image URLs, but never svg or html', () => {
    expect(isSafeUrl('data:image/png;base64,AAAA', 'image')).toBe(true);
    expect(isSafeUrl('data:image/png;base64,AAAA', 'link')).toBe(false);
    expect(isSafeUrl('data:image/svg+xml;base64,AAAA', 'image')).toBe(false);
    expect(isSafeUrl('data:text/html;base64,AAAA', 'image')).toBe(false);
  });
});

describe('parseAttributeValue', () => {
  it('sets an attribute (name is lower-cased)', () => {
    expect(parseAttributeValue(attr({ name: 'HREF', value: 'https://a.test/' }))).toEqual({ ok: true, value: { name: 'href', value: 'https://a.test/' } });
    expect(parseAttributeValue(attr({ name: 'alt', value: '' }))).toEqual({ ok: true, value: { name: 'alt', value: '' } });
  });
  it('removes an attribute', () => {
    expect(parseAttributeValue(attr({ name: 'title', remove: true }))).toEqual({ ok: true, value: { name: 'title', remove: true } });
  });
  it('refuses event handlers, style, id and srcdoc', () => {
    for (const name of ['onclick', 'onerror', 'ONLOAD', 'style', 'id', 'srcdoc']) {
      expect(parseAttributeValue(attr({ name, value: 'x' })).ok).toBe(false);
    }
  });
  it('refuses unsafe URLs in link and image attributes, including srcset', () => {
    expect(parseAttributeValue(attr({ name: 'href', value: 'javascript:alert(1)' })).ok).toBe(false);
    expect(parseAttributeValue(attr({ name: 'src', value: 'javascript:alert(1)' })).ok).toBe(false);
    expect(parseAttributeValue(attr({ name: 'action', value: 'data:text/html,x' })).ok).toBe(false);
    expect(parseAttributeValue(attr({ name: 'srcset', value: 'a.png 1x, javascript:x 2x' })).ok).toBe(false);
    expect(parseAttributeValue(attr({ name: 'srcset', value: 'a.png 1x, b.png 2x' })).ok).toBe(true);
    expect(parseAttributeValue(attr({ name: 'src', value: 'data:image/png;base64,AAAA' })).ok).toBe(true);
  });
  it('refuses bad names, missing values, long values and non-JSON', () => {
    expect(parseAttributeValue(attr({ name: 'bad name', value: 'x' })).ok).toBe(false);
    expect(parseAttributeValue(attr({ name: '', value: 'x' })).ok).toBe(false);
    expect(parseAttributeValue(attr({ name: 'title' })).ok).toBe(false);
    expect(parseAttributeValue(attr({ name: 'title', value: 'x'.repeat(2001) })).ok).toBe(false);
    expect(parseAttributeValue('not json').ok).toBe(false);
    expect(parseAttributeValue('[]').ok).toBe(false);
  });
});

describe('parseMoveValue', () => {
  it('accepts the four placements with a reference', () => {
    for (const to of ['before', 'after', 'first', 'last']) {
      const r = parseMoveValue(attr({ to, ref }));
      expect(r.ok).toBe(true);
    }
  });
  it('fills in safe defaults for a thin reference and refuses a missing or empty one', () => {
    const r = parseMoveValue(attr({ to: 'after', ref: { cssSelector: '#a' } }));
    expect(r).toEqual({ ok: true, value: { to: 'after', ref: { cssSelector: '#a', xpath: '', textContent: '', attributes: {}, parentContext: '', siblingContext: [] } } });
    expect(parseMoveValue(attr({ to: 'after' })).ok).toBe(false);
    expect(parseMoveValue(attr({ to: 'after', ref: {} })).ok).toBe(false);
    expect(parseMoveValue(attr({ to: 'sideways', ref })).ok).toBe(false);
  });
});

describe('parseBehaviorValue', () => {
  it('accepts each action', () => {
    expect(parseBehaviorValue(attr({ action: 'navigate', url: 'https://a.test/x', newTab: true }))).toEqual({ ok: true, value: { action: 'navigate', url: 'https://a.test/x', newTab: true } });
    expect(parseBehaviorValue(attr({ action: 'navigate', url: '/cart' })).ok).toBe(true);
    expect(parseBehaviorValue(attr({ action: 'confirm', message: 'Sure?' })).ok).toBe(true);
    expect(parseBehaviorValue(attr({ action: 'disable' })).ok).toBe(true);
    expect(parseBehaviorValue(attr({ action: 'toggle', ref })).ok).toBe(true);
    expect(parseBehaviorValue(attr({ action: 'scroll_to', ref })).ok).toBe(true);
  });
  it('refuses javascript: navigation, empty messages, missing refs and unknown actions', () => {
    expect(parseBehaviorValue(attr({ action: 'navigate', url: 'javascript:alert(1)' })).ok).toBe(false);
    expect(parseBehaviorValue(attr({ action: 'navigate', url: '' })).ok).toBe(false);
    expect(parseBehaviorValue(attr({ action: 'confirm', message: '  ' })).ok).toBe(false);
    expect(parseBehaviorValue(attr({ action: 'toggle' })).ok).toBe(false);
    expect(parseBehaviorValue(attr({ action: 'eval', code: 'x' })).ok).toBe(false);
  });
});

describe('validateChange', () => {
  it('leaves the older change types alone', () => {
    for (const type of ['text', 'style', 'visibility', 'script'] as const) {
      expect(validateChange({ type, value: 'anything' }).ok).toBe(true);
    }
  });
  it('is strict about the newer ones', () => {
    expect(validateChange({ type: 'remove', value: 'remove' }).ok).toBe(true);
    expect(validateChange({ type: 'remove', value: 'yes please' }).ok).toBe(false);
    expect(validateChange({ type: 'attribute', value: attr({ name: 'onclick', value: 'x' }) }).ok).toBe(false);
    expect(validateChange({ type: 'move', value: 'nope' }).ok).toBe(false);
    expect(validateChange({ type: 'behavior', value: attr({ action: 'disable' }) }).ok).toBe(true);
  });
  it('says what is wrong', () => {
    const r = validateChange({ type: 'attribute', value: attr({ name: 'onclick', value: 'x' }) });
    expect(!r.ok && r.error).toContain('behavior');
  });
});
