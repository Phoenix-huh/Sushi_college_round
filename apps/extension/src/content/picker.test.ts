// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PICKER_HOST_ID, startPicker } from './picker';

const mouse = (type: string) => new MouseEvent(type, { bubbles: true, cancelable: true });
const hostPresent = () => document.getElementById(PICKER_HOST_ID) !== null;

let running: { stop(): void } | null = null;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"><button id="buy">Buy</button><a id="link" href="#x">Link</a></div>';
});
afterEach(() => {
  running?.stop();
  running = null;
});

describe('picker', () => {
  it('adds an overlay host to <html>, not <body>', () => {
    running = startPicker({ doc: document, onPick: () => {} });
    expect(hostPresent()).toBe(true);
    expect(document.getElementById(PICKER_HOST_ID)!.parentElement).toBe(document.documentElement);
  });

  it('a click selects the element, removes the overlay first, and stops the page seeing the click', () => {
    // Observe inside the callback, assert outside: the picker swallows exceptions thrown from onPick.
    let hostWhenCalled: boolean | null = null;
    let pickedId = '';
    const onPick = vi.fn((el: Element) => {
      hostWhenCalled = hostPresent();
      pickedId = el.id;
    });
    const pageHandler = vi.fn();
    document.getElementById('buy')!.addEventListener('click', pageHandler);
    running = startPicker({ doc: document, onPick });
    const ev = mouse('click');
    document.getElementById('buy')!.dispatchEvent(ev);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(hostWhenCalled).toBe(false); // the overlay is gone before the callback runs
    expect(pickedId).toBe('buy');
    expect(pageHandler).toHaveBeenCalledTimes(0);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('does not follow links while picking', () => {
    running = startPicker({ doc: document, onPick: () => {} });
    const ev = mouse('click');
    document.getElementById('link')!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('swallows mousedown and friends so page handlers do not fire', () => {
    const pageHandler = vi.fn();
    document.getElementById('buy')!.addEventListener('mousedown', pageHandler);
    running = startPicker({ doc: document, onPick: () => {} });
    document.getElementById('buy')!.dispatchEvent(mouse('mousedown'));
    expect(pageHandler).toHaveBeenCalledTimes(0);
  });

  it('ignores clicks on <body> and keeps picking', () => {
    const onPick = vi.fn();
    running = startPicker({ doc: document, onPick });
    document.body.dispatchEvent(mouse('click'));
    expect(onPick).toHaveBeenCalledTimes(0);
    expect(hostPresent()).toBe(true);
  });

  it('Escape cancels and cleans up', () => {
    const onCancel = vi.fn();
    const onPick = vi.fn();
    running = startPicker({ doc: document, onPick, onCancel });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(hostPresent()).toBe(false);
    document.getElementById('buy')!.dispatchEvent(mouse('click'));
    expect(onPick).toHaveBeenCalledTimes(0);
  });

  it('other keys do nothing', () => {
    const onCancel = vi.fn();
    running = startPicker({ doc: document, onPick: () => {}, onCancel });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(0);
    expect(hostPresent()).toBe(true);
  });

  it('after stop() the page behaves normally again, and stop() twice is fine', () => {
    const pageHandler = vi.fn();
    document.getElementById('buy')!.addEventListener('click', pageHandler);
    running = startPicker({ doc: document, onPick: () => {} });
    running.stop();
    running.stop();
    document.getElementById('buy')!.dispatchEvent(mouse('click'));
    expect(pageHandler).toHaveBeenCalledTimes(1);
    expect(hostPresent()).toBe(false);
  });

  it('a throwing onPick does not break the page', () => {
    running = startPicker({
      doc: document,
      onPick: () => {
        throw new Error('boom');
      },
    });
    document.getElementById('buy')!.dispatchEvent(mouse('click'));
    expect(hostPresent()).toBe(false);
  });

  it('mouse movement does not throw and does not change the page', () => {
    running = startPicker({ doc: document, onPick: () => {} });
    const before = document.body.innerHTML;
    document.getElementById('buy')!.dispatchEvent(mouse('mousemove'));
    document.body.dispatchEvent(mouse('mousemove'));
    expect(document.body.innerHTML).toBe(before);
  });
});
