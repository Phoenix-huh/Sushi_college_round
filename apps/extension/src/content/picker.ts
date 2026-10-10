/**
 * Visual picker: hover highlights an element, a click selects it, Esc cancels.
 *
 * - The overlay lives in a closed shadow root on a host appended to <html>
 *   (not <body>), so page CSS cannot restyle it and it never changes the
 *   :nth-of-type numbering of body children.
 * - While picking, mouse and pointer events are swallowed in the capture phase,
 *   so the page's own click handlers (links, buttons) do not run.
 * - stop() removes everything and is safe to call twice.
 * - The host is removed BEFORE onPick runs, so building the anchor sees the real page.
 */

export const PICKER_HOST_ID = 'patchwork-picker-host';

export interface PickerOptions {
  doc: Document;
  onPick: (element: Element) => void;
  onCancel?: () => void;
}

const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick', 'dblclick', 'contextmenu', 'touchstart', 'touchend', 'submit'];

export function isPickable(el: EventTarget | null, host: Element | null): el is Element {
  if (!(el instanceof Element)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'html' || tag === 'body') return false;
  if (host && (el === host || host.contains(el))) return false;
  return true;
}

export function startPicker(options: PickerOptions): { stop(): void } {
  const { doc } = options;
  const win = doc.defaultView;
  if (!win) return { stop() {} };

  const host = doc.createElement('div');
  host.id = PICKER_HOST_ID;
  host.setAttribute('style', 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none');
  const shadow = host.attachShadow({ mode: 'closed' });

  const box = doc.createElement('div');
  box.setAttribute('style', 'position:fixed;display:none;box-sizing:border-box;border:2px solid #4f46e5;background:rgba(79,70,229,.14);border-radius:2px;pointer-events:none');
  const label = doc.createElement('div');
  label.setAttribute('style', 'position:fixed;display:none;padding:2px 6px;border-radius:3px;background:#4f46e5;color:#fff;font:600 11px/1.4 system-ui,sans-serif;pointer-events:none;white-space:nowrap');
  shadow.append(box, label);
  doc.documentElement.appendChild(host);

  let hovered: Element | null = null;
  let stopped = false;

  function draw() {
    if (!hovered || !hovered.isConnected) {
      box.style.display = label.style.display = 'none';
      return;
    }
    const r = hovered.getBoundingClientRect();
    box.style.cssText += `;display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    const classes = (hovered.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((c) => '.' + c).join('');
    label.textContent = hovered.tagName.toLowerCase() + classes;
    const below = r.bottom + 4 + 20 < win!.innerHeight;
    label.style.cssText += `;display:block;left:${Math.max(0, r.left)}px;top:${below ? r.bottom + 4 : Math.max(0, r.top - 22)}px`;
  }

  const onMove = (e: Event) => {
    const target = e.target;
    hovered = isPickable(target, host) ? target : null;
    draw();
  };

  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  const onClick = (e: Event) => {
    swallow(e);
    if (!isPickable(e.target, host)) return; // clicked <html>/<body>: keep picking
    const picked = e.target;
    stop();
    try {
      options.onPick(picked);
    } catch (err) {
      console.warn('[Patchwork] picker callback failed:', err);
    }
  };

  const onKey = (e: Event) => {
    if ((e as KeyboardEvent).key !== 'Escape') return;
    swallow(e);
    stop();
    options.onCancel?.();
  };

  function stop() {
    if (stopped) return;
    stopped = true;
    doc.removeEventListener('mousemove', onMove, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('scroll', draw, true);
    win!.removeEventListener('resize', draw);
    for (const name of BLOCKED_EVENTS) doc.removeEventListener(name, swallow, true);
    host.remove();
  }

  doc.addEventListener('mousemove', onMove, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('scroll', draw, true);
  win.addEventListener('resize', draw);
  for (const name of BLOCKED_EVENTS) doc.addEventListener(name, swallow, true);

  return { stop };
}
