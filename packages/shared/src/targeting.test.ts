// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyChange,
  applyResolved,
  findTarget,
  parseDeclarations,
  resolveTargets,
  type TargetablePatch,
} from './targeting';

function patch(
  id: string,
  anchors: Partial<TargetablePatch['anchors']>,
  change: TargetablePatch['change'],
): TargetablePatch {
  return {
    id,
    anchors: { cssSelector: '', xpath: '', textContent: '', attributes: {}, parentContext: '', siblingContext: [], ...anchors },
    change,
  };
}

beforeEach(() => {
  document.body.innerHTML = `
    <div class="card"><h3 class="product-title">Laptop</h3></div>
    <div class="card"><h3 class="product-title">Phone</h3></div>
    <div class="card"><h3 class="product-title">Tablet</h3></div>`;
});

const titles = () => Array.from(document.querySelectorAll('.product-title')).map((e) => e.textContent);

describe('findTarget', () => {
  it('uses the text hint to choose among several selector matches', () => {
    const hit = findTarget(patch('a', { cssSelector: '.product-title', textContent: 'Phone' }, { type: 'text', value: 'x' }), document);
    expect(hit?.element.textContent).toBe('Phone');
    expect(hit?.how).toBe('selector+text');
  });

  it('falls back to the first match when the patch has no text hint', () => {
    const hit = findTarget(patch('a', { cssSelector: '.product-title' }, { type: 'text', value: 'x' }), document);
    expect(hit?.element.textContent).toBe('Laptop');
  });

  it('falls back to the first match when the hint no longer matches (older patches)', () => {
    const hit = findTarget(patch('a', { cssSelector: '.product-title', textContent: 'Gone' }, { type: 'text', value: 'x' }), document);
    expect(hit?.element.textContent).toBe('Laptop');
  });

  it("pw-find=text never falls back to the first match", () => {
    const p = patch('a', { cssSelector: '.product-title', textContent: 'Gone', attributes: { 'pw-find': 'text' } }, { type: 'text', value: 'x' });
    expect(findTarget(p, document)).toBeNull();
  });

  it('pw-find=text with an empty hint finds nothing', () => {
    const p = patch('a', { cssSelector: '.product-title', attributes: { 'pw-find': 'text' } }, { type: 'text', value: 'x' });
    expect(findTarget(p, document)).toBeNull();
  });

  it('pw-find=text still finds by text', () => {
    const p = patch('a', { cssSelector: 'h3', textContent: 'Tablet', attributes: { 'pw-find': 'text' } }, { type: 'text', value: 'x' });
    expect(findTarget(p, document)?.element.textContent).toBe('Tablet');
  });

  it('prefers the innermost element with the matching text', () => {
    document.body.innerHTML = '<div class="t"><span class="t">Hi</span></div>';
    const hit = findTarget(patch('a', { cssSelector: '.t', textContent: 'Hi' }, { type: 'text', value: 'x' }), document);
    expect(hit?.element.tagName).toBe('SPAN');
  });

  it('uses xpath when the selector matches nothing, but never an empty xpath', () => {
    const viaXPath = patch('a', { cssSelector: '.nope', xpath: '(//h3)[2]' }, { type: 'text', value: 'x' });
    expect(findTarget(viaXPath, document)?.element.textContent).toBe('Phone');
    expect(findTarget(patch('b', { cssSelector: '.nope', xpath: '' }, { type: 'text', value: 'x' }), document)).toBeNull();
  });

  it('survives an invalid selector and a malformed xpath', () => {
    expect(findTarget(patch('a', { cssSelector: '!!!', xpath: '//[' }, { type: 'text', value: 'x' }), document)).toBeNull();
  });

  it('calls heal only as a last resort, and not for text-only patches', () => {
    let calls = 0;
    const heal = () => {
      calls++;
      return document.querySelector('h3');
    };
    const miss = patch('a', { cssSelector: '.nope' }, { type: 'text', value: 'x' });
    expect(findTarget(miss, document, { heal })?.how).toBe('healed');
    const textOnly = patch('b', { cssSelector: '.nope', attributes: { 'pw-find': 'text' } }, { type: 'text', value: 'x' });
    expect(findTarget(textOnly, document, { heal })).toBeNull();
    expect(calls).toBe(1);
  });

  it('skips ignored elements', () => {
    const p = patch('a', { cssSelector: '.product-title' }, { type: 'text', value: 'x' });
    const hit = findTarget(p, document, { ignore: (el) => el.textContent === 'Laptop' });
    expect(hit?.element.textContent).toBe('Phone');
  });
});

describe('two-phase apply', () => {
  it('resolves all targets before changing anything', () => {
    // Patch 1 renames Laptop. Patch 2 targets the element by its OLD text "Laptop" too.
    const p1 = patch('1', { cssSelector: '.product-title', textContent: 'Laptop' }, { type: 'text', value: 'Notebook' });
    const p2 = patch('2', { cssSelector: '.product-title', textContent: 'Laptop' }, { type: 'style', value: 'color: red' });
    const { found, missing } = resolveTargets([p1, p2], document);
    expect(missing).toHaveLength(0);
    const outcomes = applyResolved(found);
    expect(outcomes.map((o) => o.status)).toEqual(['applied', 'applied']);
    const first = document.querySelector('.product-title') as HTMLElement;
    expect(first.textContent).toBe('Notebook');
    expect(first.style.color).toBe('red');
  });

  it('reports missing targets and applies the rest', () => {
    const ok = patch('ok', { cssSelector: '.product-title', textContent: 'Phone' }, { type: 'text', value: 'P' });
    const bad = patch('bad', { cssSelector: '.nope' }, { type: 'text', value: 'x' });
    const { found, missing } = resolveTargets([bad, ok], document);
    expect(missing.map((m) => m.id)).toEqual(['bad']);
    applyResolved(found);
    expect(titles()).toEqual(['Laptop', 'P', 'Tablet']);
  });

  it('one throwing patch does not stop the others', () => {
    const boom = patch('boom', { cssSelector: '.product-title', textContent: 'Laptop' }, { type: 'script', value: 'throw new Error("nope")' });
    const ok = patch('ok', { cssSelector: '.product-title', textContent: 'Phone' }, { type: 'text', value: 'P' });
    const outcomes = applyResolved(resolveTargets([boom, ok], document).found, { allowScript: true });
    expect(outcomes.map((o) => o.status)).toEqual(['failed', 'applied']);
  });
});

describe('parseDeclarations', () => {
  it('reads CSS text', () => {
    expect(parseDeclarations('color: red; margin : 0 !important;')).toEqual([
      { prop: 'color', value: 'red', important: false },
      { prop: 'margin', value: '0', important: true },
    ]);
  });
  it('reads a JSON object with camelCase keys', () => {
    expect(parseDeclarations('{"backgroundColor":"blue","fontSize":"20px"}')).toEqual([
      { prop: 'background-color', value: 'blue', important: false },
      { prop: 'font-size', value: '20px', important: false },
    ]);
  });
  it('ignores junk', () => {
    expect(parseDeclarations('banana')).toEqual([]);
    expect(parseDeclarations('[1,2]')).toEqual([]);
  });
});

describe('applyChange and undo', () => {
  const el = () => document.querySelector('.product-title') as HTMLElement;

  it('text: changes and restores the original child nodes', () => {
    const original = el().firstChild;
    const undo = applyChange(el(), { type: 'text', value: 'New' });
    expect(el().textContent).toBe('New');
    if ('skipped' in undo) throw new Error('unexpected');
    undo.revert();
    expect(el().textContent).toBe('Laptop');
    expect(el().firstChild).toBe(original);
  });

  it('style: restores previous inline values and removes new ones', () => {
    el().style.color = 'green';
    const undo = applyChange(el(), { type: 'style', value: '{"color":"red","margin":"4px"}' });
    expect(el().style.color).toBe('red');
    expect(el().style.margin).toBe('4px');
    if ('skipped' in undo) throw new Error('unexpected');
    undo.revert();
    expect(el().style.color).toBe('green');
    expect(el().style.margin).toBe('');
  });

  it('style with no valid declarations is skipped', () => {
    expect(applyChange(el(), { type: 'style', value: 'nonsense' })).toEqual({ skipped: expect.any(String) });
  });

  it("visibility: 'hidden' sets display:none, anything else restores", () => {
    const undo = applyChange(el(), { type: 'visibility', value: 'hidden' });
    expect(el().style.display).toBe('none');
    applyChange(el(), { type: 'visibility', value: 'visible' });
    expect(el().style.display).toBe('');
    if ('skipped' in undo) throw new Error('unexpected');
    undo.revert();
    expect(el().style.display).toBe('');
  });

  it('visibility revert restores an element that was hidden originally', () => {
    el().style.display = 'none';
    const undo = applyChange(el(), { type: 'visibility', value: 'visible' });
    expect(el().style.display).toBe('');
    if ('skipped' in undo) throw new Error('unexpected');
    undo.revert();
    expect(el().style.display).toBe('none');
  });

  it('revert is idempotent', () => {
    const undo = applyChange(el(), { type: 'text', value: 'New' });
    if ('skipped' in undo) throw new Error('unexpected');
    undo.revert();
    el().textContent = 'Someone else';
    undo.revert();
    expect(el().textContent).toBe('Someone else');
  });

  it('script patches are skipped unless allowed', () => {
    expect(applyChange(el(), { type: 'script', value: 'target.id="x"' })).toEqual({ skipped: expect.any(String) });
    expect(el().id).toBe('');
    const r = applyChange(el(), { type: 'script', value: 'target.id="x"' }, { allowScript: true });
    expect('skipped' in r).toBe(false);
    expect(el().id).toBe('x');
    if (!('skipped' in r)) expect(r.reversible).toBe(false);
  });
});
