/**
 * Floating editor panel: opens on a picked element.
 *
 * - Lives in a closed shadow root attached to <html>, so page styles cannot affect it
 *   and it does not alter :nth-of-type indexes of <body> children.
 * - Supports Text, Style, Visibility, Script, Attribute, Remove, Behavior, and Move tabs.
 * - Provides live visual resizing at will via 8 interactive handles and dedicated numeric inputs.
 * - Provides sibling reordering at will (Move Up, Down, First, Last, or place relative to any sibling).
 * - Draggable anywhere on screen by grabbing the header.
 * - Supports MULTIPLE CHANGES AT ONCE:
 *     1) Multiple changes on the same element (e.g. Text + Style + Attribute + Move) previewed and saved together.
 *     2) Multi-element staging ("+ Stage & Pick Next") allowing queuing and batch saving across multiple elements.
 * - Performs live local preview via applyChange() from @patchwork/shared.
 * - Reverts local preview upon Cancel, Revert, or Save Draft.
 * - Disallows script execution in local preview (allowScript: false) with clear warning.
 * - Submits draft via SAVE_DRAFT background message (POST /patches).
 * - All text is strictly populated using textContent / value (never innerHTML).
 */
import type { PatchAnchor, PatchChange } from '@patchwork/shared';
import { applyChange, type Undo } from '@patchwork/shared';
import { send } from '../messages';
import { buildAnchor } from './anchor';

export const EDITOR_HOST_ID = 'patchwork-editor-host';
export const STAGED_HOST_ID = 'patchwork-staged-host';

export interface StagedItem {
  id: string;
  targetUrl: string;
  baseVersion: number;
  anchor: PatchAnchor;
  change: PatchChange;
  title: string;
  element: Element;
  undo?: Undo;
}

export const stagedBatch: StagedItem[] = [];

export function clearStagedBatch(doc?: Document): void {
  for (const item of stagedBatch) {
    item.undo?.revert();
  }
  stagedBatch.length = 0;
  if (doc) hideStagedBatchBar(doc);
}

export function hideStagedBatchBar(doc: Document): void {
  const existing = doc.getElementById(STAGED_HOST_ID);
  if (existing) existing.remove();
}

export function showStagedBatchBar(
  doc: Document,
  options?: { onPickNext?: () => void }
): void {
  hideStagedBatchBar(doc);
  if (stagedBatch.length === 0) return;

  const host = doc.createElement('div');
  host.id = STAGED_HOST_ID;
  host.setAttribute('style', 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;');
  const shadow = host.attachShadow({ mode: 'closed' });

  const bar = doc.createElement('div');
  bar.setAttribute(
    'style',
    'position:fixed;bottom:20px;right:20px;background:#0f172a;color:#ffffff;border:1px solid #334155;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.3);padding:10px 14px;display:flex;align-items:center;gap:12px;font:12px/1.4 system-ui,-apple-system,sans-serif;pointer-events:auto;z-index:2147483647;'
  );

  const distinctElements = new Set(stagedBatch.map((p) => p.element)).size;
  const infoSpan = doc.createElement('div');
  infoSpan.setAttribute('style', 'display:flex;align-items:center;gap:6px;font-weight:600;');
  infoSpan.innerHTML = `<span>📦</span><span>${stagedBatch.length} change(s) staged across ${distinctElements} element(s)</span>`;
  bar.appendChild(infoSpan);

  const actionsRow = doc.createElement('div');
  actionsRow.setAttribute('style', 'display:flex;align-items:center;gap:6px;');

  if (options?.onPickNext) {
    const pickMoreBtn = doc.createElement('button');
    pickMoreBtn.type = 'button';
    pickMoreBtn.textContent = '+ Pick Next';
    pickMoreBtn.setAttribute(
      'style',
      'padding:5px 9px;background:#1e293b;border:1px solid #475569;border-radius:6px;color:#f8fafc;font-size:11px;font-weight:600;cursor:pointer;'
    );
    pickMoreBtn.addEventListener('click', () => {
      options.onPickNext?.();
    });
    actionsRow.appendChild(pickMoreBtn);
  }

  const saveAllBtn = doc.createElement('button');
  saveAllBtn.type = 'button';
  saveAllBtn.textContent = `Save All (${stagedBatch.length})`;
  saveAllBtn.setAttribute(
    'style',
    'padding:5px 12px;background:#4f46e5;border:none;border-radius:6px;color:#ffffff;font-size:11px;font-weight:700;cursor:pointer;'
  );
  saveAllBtn.addEventListener('click', () => {
    void (async () => {
      saveAllBtn.disabled = true;
      saveAllBtn.textContent = 'Saving all...';
      try {
        const baseVerRes = await send({ type: 'GET_BASE_VERSION' });
        const base_version = baseVerRes.base_version;
        for (const item of stagedBatch) {
          await send({
            type: 'SAVE_DRAFT',
            target_url: item.targetUrl,
            base_version,
            anchors: item.anchor,
            change: item.change,
            title: item.title,
          });
        }
        for (const item of stagedBatch) {
          item.undo?.revert();
        }
        stagedBatch.length = 0;
        hideStagedBatchBar(doc);
      } catch (err) {
        saveAllBtn.disabled = false;
        saveAllBtn.textContent = `Save All (${stagedBatch.length})`;
        alert(`Could not save all staged drafts: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  });
  actionsRow.appendChild(saveAllBtn);

  const discardAllBtn = doc.createElement('button');
  discardAllBtn.type = 'button';
  discardAllBtn.textContent = 'Discard';
  discardAllBtn.setAttribute(
    'style',
    'padding:5px 8px;background:none;border:none;color:#94a3b8;font-size:11px;font-weight:600;cursor:pointer;'
  );
  discardAllBtn.addEventListener('click', () => {
    clearStagedBatch(doc);
  });
  actionsRow.appendChild(discardAllBtn);

  bar.appendChild(actionsRow);
  shadow.appendChild(bar);
  doc.documentElement.appendChild(host);
}

export interface EditorOptions {
  doc: Document;
  element: Element;
  anchor: PatchAnchor;
  onClose?: () => void;
  onSaved?: (patchId: string) => void;
  onPickRef?: (resolve: (refAnchor: PatchAnchor | null) => void) => void;
  onPickNext?: () => void;
}

function updateStyleDeclarations(raw: string, updates: Record<string, string>): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      for (const [k, v] of Object.entries(updates)) {
        if (v === '') delete obj[k];
        else obj[k] = v;
      }
      return JSON.stringify(obj, null, 2);
    } catch {}
  }
  const lines = trimmed ? trimmed.split(';').map((s) => s.trim()).filter(Boolean) : [];
  const rules = new Map<string, string>();
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon !== -1) {
      const prop = line.slice(0, colon).trim().toLowerCase();
      const val = line.slice(colon + 1).trim();
      rules.set(prop, val);
    }
  }
  for (const [prop, val] of Object.entries(updates)) {
    if (val === '') rules.delete(prop.toLowerCase());
    else rules.set(prop.toLowerCase(), val);
  }
  return Array.from(rules.entries())
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n');
}

function truncateText(str: string | null | undefined, max: number): string {
  if (!str) return '';
  const clean = str.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

export function openEditor(options: EditorOptions): { close(): void } {
  const { doc, element, anchor, onClose, onSaved, onPickRef, onPickNext } = options;
  const win = doc.defaultView;

  // Remove any existing editor first
  const existing = doc.getElementById(EDITOR_HOST_ID);
  if (existing) existing.remove();

  const host = doc.createElement('div');
  host.id = EDITOR_HOST_ID;
  host.setAttribute(
    'style',
    'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
  );
  const shadow = host.attachShadow({ mode: 'closed' });

  // Floating modal container
  const panel = doc.createElement('div');
  panel.setAttribute(
    'style',
    'position:fixed;width:410px;max-width:92vw;background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.18);font:13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;pointer-events:auto;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;z-index:2147483647;'
  );

  // Position near element
  const initialRect = element.getBoundingClientRect();
  const vpWidth = win ? win.innerWidth : 1000;
  const vpHeight = win ? win.innerHeight : 800;

  let left = initialRect.right + 12;
  if (left + 420 > vpWidth) {
    left = Math.max(12, initialRect.left - 422);
  }
  if (left < 12) left = 12;

  let top = initialRect.top;
  if (top + 460 > vpHeight) {
    top = Math.max(12, vpHeight - 470);
  }
  if (top < 12) top = 12;

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;

  // Header with drag-to-move support
  const header = doc.createElement('div');
  header.id = 'pw-editor-header';
  header.setAttribute(
    'style',
    'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;cursor:grab;user-select:none;touch-action:none;'
  );
  header.title = 'Drag to move window anywhere on screen';

  const titleSpan = doc.createElement('div');
  titleSpan.setAttribute('style', 'font-weight:700;color:#0f172a;font-size:13px;display:flex;align-items:center;gap:6px;');

  const gripIcon = doc.createElement('span');
  gripIcon.setAttribute('style', 'color:#94a3b8;font-size:13px;letter-spacing:-1px;cursor:grab;');
  gripIcon.textContent = '⋮⋮';

  const titleText = doc.createElement('span');
  titleText.textContent = `Edit <${element.tagName.toLowerCase()}>`;

  const dragHint = doc.createElement('span');
  dragHint.setAttribute('style', 'font-size:10px;color:#94a3b8;font-weight:400;margin-left:2px;');
  dragHint.textContent = '(drag to move)';

  titleSpan.appendChild(gripIcon);
  titleSpan.appendChild(titleText);
  titleSpan.appendChild(dragHint);

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute(
    'style',
    'background:transparent;border:none;color:#64748b;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;border-radius:4px;'
  );
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('pointerdown', (e: Event) => e.stopPropagation());

  header.appendChild(titleSpan);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Dragging logic for floating window
  let isDraggingPanel = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelStartLeft = 0;
  let panelStartTop = 0;

  header.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.target === closeBtn || closeBtn.contains(e.target as Node)) return;

    isDraggingPanel = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const panelRect = panel.getBoundingClientRect();
    panelStartLeft = panelRect.left;
    panelStartTop = panelRect.top;

    header.style.cursor = 'grabbing';
    try {
      header.setPointerCapture(e.pointerId);
    } catch {}

    const onPointerMove = (pe: PointerEvent) => {
      if (!isDraggingPanel) return;
      const dx = pe.clientX - dragStartX;
      const dy = pe.clientY - dragStartY;

      const curVpWidth = win?.innerWidth ?? 1000;
      const curVpHeight = win?.innerHeight ?? 800;
      const panelWidth = panel.offsetWidth || 400;

      let newLeft = panelStartLeft + dx;
      let newTop = panelStartTop + dy;

      newLeft = Math.max(-panelWidth + 40, Math.min(curVpWidth - 40, newLeft));
      newTop = Math.max(0, Math.min(curVpHeight - 40, newTop));

      panel.style.left = `${Math.round(newLeft)}px`;
      panel.style.top = `${Math.round(newTop)}px`;
    };

    const onPointerUp = (pe: PointerEvent) => {
      isDraggingPanel = false;
      header.style.cursor = 'grab';
      try {
        header.releasePointerCapture(pe.pointerId);
      } catch {}
      win?.removeEventListener('pointermove', onPointerMove);
      win?.removeEventListener('pointerup', onPointerUp);
      win?.removeEventListener('pointercancel', onPointerUp);
    };

    win?.addEventListener('pointermove', onPointerMove);
    win?.addEventListener('pointerup', onPointerUp);
    win?.addEventListener('pointercancel', onPointerUp);
  });

  // Body container
  const body = doc.createElement('div');
  body.setAttribute('style', 'padding:14px;display:flex;flex-direction:column;gap:12px;max-height:70vh;overflow-y:auto;');
  panel.appendChild(body);

  // Title input
  const loc = win?.location ?? { pathname: '/', origin: 'http://localhost' };
  const titleGroup = doc.createElement('div');
  titleGroup.setAttribute('style', 'display:flex;flex-direction:column;gap:4px;');
  const titleLabel = doc.createElement('label');
  titleLabel.textContent = 'Patch Title (optional):';
  titleLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.03em;');
  const titleInput = doc.createElement('input');
  titleInput.type = 'text';
  titleInput.placeholder = `e.g. Edit <${element.tagName.toLowerCase()}> on ${loc.pathname}`;
  titleInput.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;outline:none;');
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  body.appendChild(titleGroup);

  // Target URL Scope (whole site vs current page)
  const scopeGroup = doc.createElement('div');
  scopeGroup.setAttribute('style', 'display:flex;align-items:center;gap:8px;');
  const scopeCheckbox = doc.createElement('input');
  scopeCheckbox.type = 'checkbox';
  scopeCheckbox.id = 'pw-scope-site';
  scopeCheckbox.setAttribute('style', 'cursor:pointer;');
  const scopeLabel = doc.createElement('label');
  scopeLabel.setAttribute('style', 'font-size:12px;color:#334155;cursor:pointer;');
  scopeLabel.textContent = 'Apply to whole site (/*) instead of this page';
  scopeLabel.addEventListener('click', () => {
    scopeCheckbox.checked = !scopeCheckbox.checked;
  });
  scopeGroup.appendChild(scopeCheckbox);
  scopeGroup.appendChild(scopeLabel);
  body.appendChild(scopeGroup);

  // Tabs Header
  const tabsBar = doc.createElement('div');
  tabsBar.setAttribute('style', 'display:flex;border-bottom:2px solid #e2e8f0;gap:2px;overflow-x:auto;');
  const tabTypes = ['text', 'style', 'move', 'visibility', 'script', 'attribute', 'remove', 'behavior'] as const;
  type TabType = (typeof tabTypes)[number];
  let activeTab: TabType = 'text';

  const tabButtons: Record<TabType, HTMLButtonElement> = {} as any;
  const tabLabels: Record<TabType, string> = {
    text: 'Text',
    style: 'Style & Size',
    move: 'Reorder / Move',
    visibility: 'Visibility',
    script: 'Script',
    attribute: 'Attribute',
    remove: 'Remove',
    behavior: 'Behavior',
  };

  // Tab contents container
  const tabContentContainer = doc.createElement('div');
  tabContentContainer.setAttribute('style', 'display:flex;flex-direction:column;gap:8px;');

  function createIncludeBanner(tabLabel: string, defaultChecked = false): { row: HTMLDivElement; check: HTMLInputElement } {
    const row = doc.createElement('div');
    row.setAttribute(
      'style',
      'display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;'
    );

    const label = doc.createElement('label');
    label.setAttribute('style', 'display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#334155;cursor:pointer;');

    const check = doc.createElement('input');
    check.type = 'checkbox';
    check.checked = defaultChecked;
    check.setAttribute('style', 'cursor:pointer;');

    label.appendChild(check);
    label.appendChild(doc.createTextNode(`Include ${tabLabel} in this patch set`));

    const hint = doc.createElement('span');
    hint.setAttribute('style', 'font-size:10px;color:#6366f1;font-weight:600;');
    hint.textContent = 'Multi-change';

    row.appendChild(label);
    row.appendChild(hint);
    return { row, check };
  }

  // 1. Text Tab Fields
  const textContainer = doc.createElement('div');
  textContainer.setAttribute('style', 'display:flex;flex-direction:column;gap:6px;');
  // Default unchecked — user must explicitly include text changes to avoid silent no-op patches
  const textInclude = createIncludeBanner('Text', false);
  textContainer.appendChild(textInclude.row);

  // Discover inner text elements if this element has children
  const childTextElements: Element[] = [];
  if (element.children.length > 0) {
    const all = Array.from(element.querySelectorAll('*'));
    for (const c of all) {
      if (c.children.length === 0 && (c.textContent || '').trim().length > 0) {
        childTextElements.push(c);
      }
    }
  }

  let activeTextTarget: Element = childTextElements.length > 0 ? childTextElements[0] : element;
  let activeTextAnchor: PatchAnchor = buildAnchor(activeTextTarget);
  let originalActiveText: string = activeTextTarget.textContent?.trim() ?? '';

  if (childTextElements.length > 0) {
    const targetPickerBox = doc.createElement('div');
    targetPickerBox.setAttribute(
      'style',
      'background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:4px;'
    );
    const targetPickerLabel = doc.createElement('label');
    targetPickerLabel.textContent = '🎯 Target inner element to edit text:';
    targetPickerLabel.setAttribute('style', 'font-size:10px;font-weight:700;color:#334155;');
    targetPickerBox.appendChild(targetPickerLabel);

    const targetSelect = doc.createElement('select');
    targetSelect.setAttribute(
      'style',
      'width:100%;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;background:#ffffff;color:#1e293b;font-family:inherit;'
    );
    for (let i = 0; i < childTextElements.length; i++) {
      const c = childTextElements[i];
      const opt = doc.createElement('option');
      opt.value = String(i);
      const tag = c.tagName.toLowerCase();
      const snippet = truncateText(c.textContent, 28);
      opt.textContent = `<${tag}> "${snippet}"`;
      targetSelect.appendChild(opt);
    }
    const wholeOpt = doc.createElement('option');
    wholeOpt.value = 'all';
    wholeOpt.textContent = `⚠️ Whole <${element.tagName.toLowerCase()}> (replaces all inner HTML)`;
    targetSelect.appendChild(wholeOpt);

    targetSelect.addEventListener('change', () => {
      if (targetSelect.value === 'all') {
        activeTextTarget = element;
        activeTextAnchor = anchor;
        originalActiveText = element.textContent?.trim() ?? '';
      } else {
        const idx = parseInt(targetSelect.value, 10);
        activeTextTarget = childTextElements[idx];
        activeTextAnchor = buildAnchor(activeTextTarget);
        originalActiveText = activeTextTarget.textContent?.trim() ?? '';
      }
      textArea.value = originalActiveText;
      textInclude.check.checked = false;
      updateChangesSummary();
    });
    targetPickerBox.appendChild(targetSelect);
    textContainer.appendChild(targetPickerBox);
  }

  const textLabel = doc.createElement('label');
  textLabel.textContent = 'New text content:';
  textLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const textArea = doc.createElement('textarea');
  textArea.rows = 3;
  textArea.value = originalActiveText;
  textArea.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;resize:vertical;font-family:inherit;');
  textContainer.appendChild(textLabel);
  textContainer.appendChild(textArea);

  // 2. Style Tab: Interactive Dimensions Card & CSS Box
  let initialInlineStyle: { width: string; height: string; boxSizing: string } | null = null;

  const styleContainer = doc.createElement('div');
  styleContainer.setAttribute('style', 'display:none;flex-direction:column;gap:10px;');
  const styleInclude = createIncludeBanner('Style & Size', false);
  styleContainer.appendChild(styleInclude.row);

  const sizeCard = doc.createElement('div');
  sizeCard.setAttribute(
    'style',
    'background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;'
  );
  const sizeTitleRow = doc.createElement('div');
  sizeTitleRow.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;');
  const sizeTitle = doc.createElement('span');
  sizeTitle.setAttribute('style', 'font-size:11px;font-weight:700;color:#334155;');
  sizeTitle.textContent = '📐 Resize Element (Visual or Values)';
  const sizeHint = doc.createElement('span');
  sizeHint.setAttribute('style', 'font-size:10px;color:#64748b;');
  sizeHint.textContent = 'Drag handles on page or type below';
  sizeTitleRow.appendChild(sizeTitle);
  sizeTitleRow.appendChild(sizeHint);
  sizeCard.appendChild(sizeTitleRow);

  const sizeInputsRow = doc.createElement('div');
  sizeInputsRow.setAttribute('style', 'display:flex;align-items:center;gap:8px;');

  // Width
  const wGroup = doc.createElement('div');
  wGroup.setAttribute('style', 'display:flex;align-items:center;gap:4px;flex:1;');
  const wLabel = doc.createElement('label');
  wLabel.textContent = 'W:';
  wLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#64748b;');
  const widthInput = doc.createElement('input');
  widthInput.type = 'number';
  widthInput.id = 'pw-resize-width';
  widthInput.min = '10';
  widthInput.value = String(Math.round(initialRect.width) || '');
  widthInput.setAttribute(
    'style',
    'width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid #cbd5e1;border-radius:5px;font-size:11px;font-family:monospace;'
  );
  const wUnit = doc.createElement('span');
  wUnit.textContent = 'px';
  wUnit.setAttribute('style', 'font-size:11px;color:#64748b;');
  wGroup.appendChild(wLabel);
  wGroup.appendChild(widthInput);
  wGroup.appendChild(wUnit);

  // Height
  const hGroup = doc.createElement('div');
  hGroup.setAttribute('style', 'display:flex;align-items:center;gap:4px;flex:1;');
  const hLabel = doc.createElement('label');
  hLabel.textContent = 'H:';
  hLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#64748b;');
  const heightInput = doc.createElement('input');
  heightInput.type = 'number';
  heightInput.id = 'pw-resize-height';
  heightInput.min = '10';
  heightInput.value = String(Math.round(initialRect.height) || '');
  heightInput.setAttribute(
    'style',
    'width:100%;box-sizing:border-box;padding:5px 7px;border:1px solid #cbd5e1;border-radius:5px;font-size:11px;font-family:monospace;'
  );
  const hUnit = doc.createElement('span');
  hUnit.textContent = 'px';
  hUnit.setAttribute('style', 'font-size:11px;color:#64748b;');
  hGroup.appendChild(hLabel);
  hGroup.appendChild(heightInput);
  hGroup.appendChild(hUnit);

  sizeInputsRow.appendChild(wGroup);
  sizeInputsRow.appendChild(hGroup);
  sizeCard.appendChild(sizeInputsRow);

  // Lock ratio and preset buttons
  const sizePresetsRow = doc.createElement('div');
  sizePresetsRow.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;gap:6px;');

  const lockRatioLabel = doc.createElement('label');
  lockRatioLabel.setAttribute('style', 'display:flex;align-items:center;gap:4px;font-size:11px;color:#475569;cursor:pointer;');
  const lockAspectCheckbox = doc.createElement('input');
  lockAspectCheckbox.type = 'checkbox';
  lockAspectCheckbox.id = 'pw-lock-aspect';
  lockAspectCheckbox.setAttribute('style', 'cursor:pointer;');
  lockRatioLabel.appendChild(lockAspectCheckbox);
  lockRatioLabel.appendChild(doc.createTextNode('🔒 Lock Ratio'));
  sizePresetsRow.appendChild(lockRatioLabel);

  const presetsGroup = doc.createElement('div');
  presetsGroup.setAttribute('style', 'display:flex;gap:4px;');

  const fullWidthBtn = doc.createElement('button');
  fullWidthBtn.type = 'button';
  fullWidthBtn.textContent = '100% W';
  fullWidthBtn.setAttribute(
    'style',
    'padding:3px 7px;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-size:10px;font-weight:600;color:#334155;cursor:pointer;'
  );

  const autoSizeBtn = doc.createElement('button');
  autoSizeBtn.type = 'button';
  autoSizeBtn.textContent = 'Auto';
  autoSizeBtn.setAttribute(
    'style',
    'padding:3px 7px;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-size:10px;font-weight:600;color:#334155;cursor:pointer;'
  );

  const resetSizeBtn = doc.createElement('button');
  resetSizeBtn.type = 'button';
  resetSizeBtn.textContent = 'Reset';
  resetSizeBtn.setAttribute(
    'style',
    'padding:3px 7px;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-size:10px;font-weight:600;color:#64748b;cursor:pointer;'
  );

  presetsGroup.appendChild(fullWidthBtn);
  presetsGroup.appendChild(autoSizeBtn);
  presetsGroup.appendChild(resetSizeBtn);
  sizePresetsRow.appendChild(presetsGroup);
  sizeCard.appendChild(sizePresetsRow);

  styleContainer.appendChild(sizeCard);

  const styleLabel = doc.createElement('label');
  styleLabel.textContent = 'CSS rules or JSON:';
  styleLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const styleArea = doc.createElement('textarea');
  styleArea.rows = 4;
  styleArea.placeholder = 'color: #2563eb; font-weight: bold;\nOR {"color": "#2563eb"}';
  styleArea.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;resize:vertical;font-family:monospace;');
  styleContainer.appendChild(styleLabel);
  styleContainer.appendChild(styleArea);

  // 3. Move Tab Fields
  let moveRefAnchor: PatchAnchor | null = null;
  const moveContainer = doc.createElement('div');
  moveContainer.setAttribute('style', 'display:none;flex-direction:column;gap:10px;');
  const moveInclude = createIncludeBanner('Move / Reorder', false);
  moveContainer.appendChild(moveInclude.row);

  const reorderCard = doc.createElement('div');
  reorderCard.setAttribute(
    'style',
    'background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;'
  );
  const reorderTitle = doc.createElement('div');
  reorderTitle.setAttribute('style', 'font-size:11px;font-weight:700;color:#334155;');
  reorderTitle.textContent = '🔄 Reorder Among Siblings (Up / Down / First / Last)';
  reorderCard.appendChild(reorderTitle);

  const reorderBtnRow = doc.createElement('div');
  reorderBtnRow.setAttribute('style', 'display:flex;gap:4px;flex-wrap:wrap;');

  const moveUpBtn = doc.createElement('button');
  moveUpBtn.type = 'button';
  moveUpBtn.id = 'pw-move-up';
  moveUpBtn.textContent = '⬆ Move Up';
  moveUpBtn.setAttribute(
    'style',
    'flex:1;min-width:70px;padding:5px 8px;background:#ffffff;border:1px solid #cbd5e1;border-radius:5px;font-size:11px;font-weight:600;color:#1e293b;cursor:pointer;'
  );

  const moveDownBtn = doc.createElement('button');
  moveDownBtn.type = 'button';
  moveDownBtn.id = 'pw-move-down';
  moveDownBtn.textContent = '⬇ Move Down';
  moveDownBtn.setAttribute(
    'style',
    'flex:1;min-width:70px;padding:5px 8px;background:#ffffff;border:1px solid #cbd5e1;border-radius:5px;font-size:11px;font-weight:600;color:#1e293b;cursor:pointer;'
  );

  const moveFirstBtn = doc.createElement('button');
  moveFirstBtn.type = 'button';
  moveFirstBtn.id = 'pw-move-first';
  moveFirstBtn.textContent = '⏫ To First';
  moveFirstBtn.setAttribute(
    'style',
    'padding:5px 8px;background:#ffffff;border:1px solid #cbd5e1;border-radius:5px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;'
  );

  const moveLastBtn = doc.createElement('button');
  moveLastBtn.type = 'button';
  moveLastBtn.id = 'pw-move-last';
  moveLastBtn.textContent = '⏬ To Last';
  moveLastBtn.setAttribute(
    'style',
    'padding:5px 8px;background:#ffffff;border:1px solid #cbd5e1;border-radius:5px;font-size:11px;font-weight:600;color:#475569;cursor:pointer;'
  );

  reorderBtnRow.appendChild(moveUpBtn);
  reorderBtnRow.appendChild(moveDownBtn);
  reorderBtnRow.appendChild(moveFirstBtn);
  reorderBtnRow.appendChild(moveLastBtn);
  reorderCard.appendChild(reorderBtnRow);

  const siblingListWrapper = doc.createElement('div');
  siblingListWrapper.setAttribute('style', 'display:flex;flex-direction:column;gap:4px;');
  const siblingListLabel = doc.createElement('div');
  siblingListLabel.setAttribute('style', 'font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;');
  siblingListLabel.textContent = 'Sibling Order:';
  const siblingList = doc.createElement('div');
  siblingList.id = 'pw-sibling-list';
  siblingList.setAttribute(
    'style',
    'max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;border:1px solid #cbd5e1;border-radius:6px;padding:6px;background:#ffffff;'
  );
  siblingListWrapper.appendChild(siblingListLabel);
  siblingListWrapper.appendChild(siblingList);
  reorderCard.appendChild(siblingListWrapper);
  moveContainer.appendChild(reorderCard);

  const customMoveCard = doc.createElement('div');
  customMoveCard.setAttribute('style', 'display:flex;flex-direction:column;gap:6px;border-top:1px solid #e2e8f0;padding-top:8px;');

  const movePlacementLabel = doc.createElement('label');
  movePlacementLabel.textContent = 'Or move relative to another element on page:';
  movePlacementLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const movePlacementSelect = doc.createElement('select');
  movePlacementSelect.id = 'pw-move-placement';
  movePlacementSelect.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;');
  for (const [val, label] of [
    ['before', 'Before — insert as previous sibling'],
    ['after',  'After — insert as next sibling'],
    ['first',  'First child — prepend inside reference'],
    ['last',   'Last child — append inside reference'],
  ] as const) {
    const opt = doc.createElement('option');
    opt.value = val;
    opt.textContent = label;
    movePlacementSelect.appendChild(opt);
  }

  const moveRefRow = doc.createElement('div');
  moveRefRow.setAttribute('style', 'display:flex;flex-direction:column;gap:4px;');
  const moveRefTopRow = doc.createElement('div');
  moveRefTopRow.setAttribute('style', 'display:flex;align-items:center;gap:8px;');
  const moveRefLabel = doc.createElement('label');
  moveRefLabel.textContent = 'Reference element:';
  moveRefLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;flex:1;');
  const pickRefBtn = doc.createElement('button');
  pickRefBtn.type = 'button';
  pickRefBtn.textContent = 'Pick element';
  pickRefBtn.id = 'pw-move-pick-ref';
  pickRefBtn.setAttribute(
    'style',
    'padding:4px 10px;background:#4f46e5;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;'
  );
  const moveRefDisplay = doc.createElement('div');
  moveRefDisplay.setAttribute('style', 'font-size:11px;color:#64748b;font-family:monospace;word-break:break-all;min-height:18px;');
  moveRefDisplay.textContent = '(none selected)';

  if (!onPickRef) {
    pickRefBtn.disabled = true;
    pickRefBtn.title = 'Ref-picking not available in this context';
  }

  pickRefBtn.addEventListener('click', () => {
    if (!onPickRef) return;
    panel.style.visibility = 'hidden';
    overlayBox.style.visibility = 'hidden';
    onPickRef((refAnchor) => {
      panel.style.visibility = 'visible';
      overlayBox.style.visibility = 'visible';
      if (refAnchor) {
        moveRefAnchor = refAnchor;
        moveInclude.check.checked = true;
        moveRefDisplay.textContent = refAnchor.cssSelector || refAnchor.xpath || '(selected)';
        moveRefDisplay.style.color = '#166534';
      } else {
        moveRefDisplay.textContent = '(cancelled)';
        moveRefDisplay.style.color = '#991b1b';
      }
      updateChangesSummary();
    });
  });

  moveRefTopRow.appendChild(moveRefLabel);
  moveRefTopRow.appendChild(pickRefBtn);
  moveRefRow.appendChild(moveRefTopRow);
  moveRefRow.appendChild(moveRefDisplay);
  customMoveCard.appendChild(movePlacementLabel);
  customMoveCard.appendChild(movePlacementSelect);
  customMoveCard.appendChild(moveRefRow);
  moveContainer.appendChild(customMoveCard);

  // 4. Visibility Tab Fields
  const visContainer = doc.createElement('div');
  visContainer.setAttribute('style', 'display:none;flex-direction:column;gap:4px;');
  const visInclude = createIncludeBanner('Visibility', false);
  visContainer.appendChild(visInclude.row);

  const visLabel = doc.createElement('label');
  visLabel.textContent = 'Element visibility:';
  visLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const visSelect = doc.createElement('select');
  visSelect.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;');
  const optHide = doc.createElement('option');
  optHide.value = 'hidden';
  optHide.textContent = 'Hidden (display: none)';
  const optShow = doc.createElement('option');
  optShow.value = 'visible';
  optShow.textContent = 'Visible (default)';
  visSelect.appendChild(optHide);
  visSelect.appendChild(optShow);
  visContainer.appendChild(visLabel);
  visContainer.appendChild(visSelect);

  // 5. Script Tab Fields
  const scriptContainer = doc.createElement('div');
  scriptContainer.setAttribute('style', 'display:none;flex-direction:column;gap:6px;');
  const scriptInclude = createIncludeBanner('Script', false);
  scriptContainer.appendChild(scriptInclude.row);

  const scriptWarning = doc.createElement('div');
  scriptWarning.setAttribute(
    'style',
    'background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;font-size:11px;color:#92400e;line-height:1.4;'
  );
  scriptWarning.textContent =
    '⚠️ Note: Content scripts do not evaluate JavaScript locally. This snippet will not run during local preview, but will execute in the demo site runtime once reviewed & deployed.';
  const scriptLabel = doc.createElement('label');
  scriptLabel.textContent = 'JavaScript snippet (runs with `target` element):';
  scriptLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const scriptArea = doc.createElement('textarea');
  scriptArea.rows = 4;
  scriptArea.placeholder = "target.classList.add('highlight');";
  scriptArea.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;resize:vertical;font-family:monospace;');
  scriptContainer.appendChild(scriptWarning);
  scriptContainer.appendChild(scriptLabel);
  scriptContainer.appendChild(scriptArea);

  // 6. Attribute Tab Fields
  const attrContainer = doc.createElement('div');
  attrContainer.setAttribute('style', 'display:none;flex-direction:column;gap:8px;');
  const attrInclude = createIncludeBanner('Attribute', false);
  attrContainer.appendChild(attrInclude.row);

  const attrNameLabel = doc.createElement('label');
  attrNameLabel.textContent = 'Attribute name (e.g. href, src, alt, title, aria-label):';
  attrNameLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const attrNameInput = doc.createElement('input');
  attrNameInput.type = 'text';
  attrNameInput.placeholder = 'href';
  attrNameInput.id = 'pw-attr-name';
  attrNameInput.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:monospace;');

  const attrValueLabel = doc.createElement('label');
  attrValueLabel.textContent = 'New value:';
  attrValueLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const attrValueInput = doc.createElement('input');
  attrValueInput.type = 'text';
  attrValueInput.placeholder = 'https://example.com';
  attrValueInput.id = 'pw-attr-value';
  attrValueInput.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;');

  const attrRemoveRow = doc.createElement('div');
  attrRemoveRow.setAttribute('style', 'display:flex;align-items:center;gap:8px;');
  const attrRemoveCheck = doc.createElement('input');
  attrRemoveCheck.type = 'checkbox';
  attrRemoveCheck.id = 'pw-attr-remove';
  attrRemoveCheck.setAttribute('style', 'cursor:pointer;');
  const attrRemoveLabel = doc.createElement('label');
  attrRemoveLabel.textContent = 'Remove this attribute instead';
  attrRemoveLabel.setAttribute('for', 'pw-attr-remove');
  attrRemoveLabel.setAttribute('style', 'font-size:12px;color:#334155;cursor:pointer;');
  attrRemoveCheck.addEventListener('change', () => {
    attrValueInput.disabled = attrRemoveCheck.checked;
    attrValueLabel.style.opacity = attrRemoveCheck.checked ? '0.4' : '1';
    attrValueInput.style.opacity = attrRemoveCheck.checked ? '0.4' : '1';
    attrInclude.check.checked = true;
    updateChangesSummary();
  });
  attrRemoveRow.appendChild(attrRemoveCheck);
  attrRemoveRow.appendChild(attrRemoveLabel);

  const attrHint = doc.createElement('div');
  attrHint.setAttribute('style', 'font-size:11px;color:#64748b;line-height:1.5;');
  attrHint.textContent = 'Blocked: on*, style, id, srcdoc, is. URL attributes (href, src, action…) must be http/https, mailto, tel, or relative.';

  attrContainer.appendChild(attrNameLabel);
  attrContainer.appendChild(attrNameInput);
  attrContainer.appendChild(attrValueLabel);
  attrContainer.appendChild(attrValueInput);
  attrContainer.appendChild(attrRemoveRow);
  attrContainer.appendChild(attrHint);

  // 7. Remove Tab Fields
  const removeContainer = doc.createElement('div');
  removeContainer.setAttribute('style', 'display:none;flex-direction:column;gap:8px;');
  const removeInclude = createIncludeBanner('Remove Element', false);
  removeContainer.appendChild(removeInclude.row);

  const removeWarning = doc.createElement('div');
  removeWarning.setAttribute(
    'style',
    'background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 12px;font-size:12px;color:#991b1b;line-height:1.5;'
  );
  removeWarning.textContent =
    '⚠️ This will permanently remove the element from the page for all visitors once deployed. Use Visibility → Hidden if you only want to hide it.';
  const removePreviewNote = doc.createElement('div');
  removePreviewNote.setAttribute('style', 'font-size:11px;color:#64748b;');
  removePreviewNote.textContent = 'Press Preview to see the element disappear. Revert restores it before saving.';
  removeContainer.appendChild(removeWarning);
  removeContainer.appendChild(removePreviewNote);

  // 8. Behavior Tab Fields
  const behaviorContainer = doc.createElement('div');
  behaviorContainer.setAttribute('style', 'display:none;flex-direction:column;gap:8px;');
  const bhInclude = createIncludeBanner('Behavior', false);
  behaviorContainer.appendChild(bhInclude.row);

  const behaviorActionLabel = doc.createElement('label');
  behaviorActionLabel.textContent = 'Click action:';
  behaviorActionLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const behaviorActionSelect = doc.createElement('select');
  behaviorActionSelect.id = 'pw-behavior-action';
  behaviorActionSelect.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;');
  for (const [val, label] of [
    ['navigate', 'Navigate — redirect to a URL'],
    ['disable', 'Disable — prevent clicks / grey out'],
    ['confirm', 'Confirm — show a confirmation dialog first'],
    ['toggle', 'Toggle — show/hide another element'],
    ['scroll_to', 'Scroll to — smooth-scroll to another element'],
  ] as const) {
    const opt = doc.createElement('option');
    opt.value = val;
    opt.textContent = label;
    behaviorActionSelect.appendChild(opt);
  }

  const bhNavSection = doc.createElement('div');
  bhNavSection.setAttribute('style', 'display:flex;flex-direction:column;gap:6px;');
  const bhNavUrlLabel = doc.createElement('label');
  bhNavUrlLabel.textContent = 'Destination URL:';
  bhNavUrlLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const bhNavUrlInput = doc.createElement('input');
  bhNavUrlInput.type = 'url';
  bhNavUrlInput.id = 'pw-bh-url';
  bhNavUrlInput.placeholder = 'https://example.com/page';
  bhNavUrlInput.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;');
  const bhNavNewTabRow = doc.createElement('div');
  bhNavNewTabRow.setAttribute('style', 'display:flex;align-items:center;gap:8px;');
  const bhNavNewTabCheck = doc.createElement('input');
  bhNavNewTabCheck.type = 'checkbox';
  bhNavNewTabCheck.id = 'pw-bh-newtab';
  const bhNavNewTabLabel = doc.createElement('label');
  bhNavNewTabLabel.setAttribute('for', 'pw-bh-newtab');
  bhNavNewTabLabel.textContent = 'Open in new tab';
  bhNavNewTabLabel.setAttribute('style', 'font-size:12px;color:#334155;cursor:pointer;');
  bhNavNewTabRow.appendChild(bhNavNewTabCheck);
  bhNavNewTabRow.appendChild(bhNavNewTabLabel);
  bhNavSection.appendChild(bhNavUrlLabel);
  bhNavSection.appendChild(bhNavUrlInput);
  bhNavSection.appendChild(bhNavNewTabRow);

  const bhConfirmSection = doc.createElement('div');
  bhConfirmSection.setAttribute('style', 'display:none;flex-direction:column;gap:6px;');
  const bhConfirmLabel = doc.createElement('label');
  bhConfirmLabel.textContent = 'Confirmation message:';
  bhConfirmLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const bhConfirmInput = doc.createElement('input');
  bhConfirmInput.type = 'text';
  bhConfirmInput.id = 'pw-bh-confirm-msg';
  bhConfirmInput.placeholder = 'Are you sure you want to continue?';
  bhConfirmInput.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;');
  bhConfirmSection.appendChild(bhConfirmLabel);
  bhConfirmSection.appendChild(bhConfirmInput);

  const bhRefSection = doc.createElement('div');
  bhRefSection.setAttribute('style', 'display:none;flex-direction:column;gap:6px;');
  const bhRefLabel = doc.createElement('label');
  bhRefLabel.textContent = 'Target element CSS selector:';
  bhRefLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const bhRefInput = doc.createElement('input');
  bhRefInput.type = 'text';
  bhRefInput.id = 'pw-bh-ref-selector';
  bhRefInput.placeholder = '#section-id or .class-name';
  bhRefInput.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:monospace;');
  bhRefSection.appendChild(bhRefLabel);
  bhRefSection.appendChild(bhRefInput);

  const bhDisableNote = doc.createElement('div');
  bhDisableNote.setAttribute('style', 'display:none;font-size:11px;color:#64748b;padding:6px 0;');
  bhDisableNote.textContent = 'The element will be marked aria-disabled and clicks will be swallowed.';

  function updateBehaviorSections() {
    const action = behaviorActionSelect.value;
    bhNavSection.style.display    = action === 'navigate'                   ? 'flex' : 'none';
    bhConfirmSection.style.display = action === 'confirm'                   ? 'flex' : 'none';
    bhRefSection.style.display    = (action === 'toggle' || action === 'scroll_to') ? 'flex' : 'none';
    bhDisableNote.style.display   = action === 'disable'                   ? 'block' : 'none';
  }
  behaviorActionSelect.addEventListener('change', updateBehaviorSections);

  const bhPreviewNote = doc.createElement('div');
  bhPreviewNote.setAttribute('style', 'font-size:11px;color:#64748b;line-height:1.5;');
  bhPreviewNote.textContent = '💡 Preview registers the click handler — click the element to test it. Revert removes the handler.';

  behaviorContainer.appendChild(behaviorActionLabel);
  behaviorContainer.appendChild(behaviorActionSelect);
  behaviorContainer.appendChild(bhNavSection);
  behaviorContainer.appendChild(bhConfirmSection);
  behaviorContainer.appendChild(bhRefSection);
  behaviorContainer.appendChild(bhDisableNote);
  behaviorContainer.appendChild(bhPreviewNote);

  // Assemble Tab Content
  tabContentContainer.appendChild(textContainer);
  tabContentContainer.appendChild(styleContainer);
  tabContentContainer.appendChild(moveContainer);
  tabContentContainer.appendChild(visContainer);
  tabContentContainer.appendChild(scriptContainer);
  tabContentContainer.appendChild(attrContainer);
  tabContentContainer.appendChild(removeContainer);
  tabContentContainer.appendChild(behaviorContainer);

  function isTabIncluded(type: TabType): boolean {
    if (type === 'text') return textInclude.check.checked;
    if (type === 'style') return styleInclude.check.checked;
    if (type === 'move') return moveInclude.check.checked;
    if (type === 'visibility') return visInclude.check.checked;
    if (type === 'script') return scriptInclude.check.checked;
    if (type === 'attribute') return attrInclude.check.checked;
    if (type === 'remove') return removeInclude.check.checked;
    if (type === 'behavior') return bhInclude.check.checked;
    return false;
  }

  function setTabIncluded(type: TabType, inc: boolean): void {
    if (type === 'text') textInclude.check.checked = inc;
    if (type === 'style') styleInclude.check.checked = inc;
    if (type === 'move') moveInclude.check.checked = inc;
    if (type === 'visibility') visInclude.check.checked = inc;
    if (type === 'script') scriptInclude.check.checked = inc;
    if (type === 'attribute') attrInclude.check.checked = inc;
    if (type === 'remove') removeInclude.check.checked = inc;
    if (type === 'behavior') bhInclude.check.checked = inc;
  }

  function getSingleChange(type: TabType): { type: TabType; label: string; change: PatchChange; anchor?: PatchAnchor; targetElement?: Element } | null {
    if (type === 'text') {
      const val = textArea.value;
      // Skip if empty or unchanged from original (would be a no-op patch)
      if (!val || val === originalActiveText) return null;
      const tagLabel = activeTextTarget !== element ? `<${activeTextTarget.tagName.toLowerCase()}>` : '';
      return {
        type: 'text',
        label: tagLabel ? `Text (${tagLabel})` : 'Text',
        change: { type: 'text', value: val },
        anchor: activeTextAnchor,
        targetElement: activeTextTarget,
      };
    }
    if (type === 'style') {
      const val = styleArea.value.trim();
      if (!val) return null;
      return { type: 'style', label: 'Style & Size', change: { type: 'style', value: val } };
    }
    if (type === 'visibility') {
      return { type: 'visibility', label: `Visibility (${visSelect.value})`, change: { type: 'visibility', value: visSelect.value } };
    }
    if (type === 'script') {
      const val = scriptArea.value.trim();
      if (!val) return null;
      return { type: 'script', label: 'Script', change: { type: 'script', value: val } };
    }
    if (type === 'attribute') {
      const name = attrNameInput.value.trim().toLowerCase();
      if (!name) return null;
      const val = attrRemoveCheck.checked
        ? JSON.stringify({ name, remove: true })
        : JSON.stringify({ name, value: attrValueInput.value });
      return { type: 'attribute', label: `Attr (${name})`, change: { type: 'attribute', value: val } };
    }
    if (type === 'remove') {
      return { type: 'remove', label: 'Remove', change: { type: 'remove', value: 'remove' } };
    }
    if (type === 'behavior') {
      const action = behaviorActionSelect.value as string;
      if (action === 'navigate') {
        const url = bhNavUrlInput.value.trim();
        if (!url) return null;
        return { type: 'behavior', label: 'Behavior (navigate)', change: { type: 'behavior', value: JSON.stringify({ action, url, ...(bhNavNewTabCheck.checked ? { newTab: true } : {}) }) } };
      }
      if (action === 'confirm') {
        const msg = bhConfirmInput.value.trim();
        if (!msg) return null;
        return { type: 'behavior', label: 'Behavior (confirm)', change: { type: 'behavior', value: JSON.stringify({ action, message: msg }) } };
      }
      if (action === 'disable') {
        return { type: 'behavior', label: 'Behavior (disable)', change: { type: 'behavior', value: JSON.stringify({ action }) } };
      }
      if (action === 'toggle' || action === 'scroll_to') {
        const sel = bhRefInput.value.trim();
        if (!sel) return null;
        return { type: 'behavior', label: `Behavior (${action})`, change: { type: 'behavior', value: JSON.stringify({ action, ref: { cssSelector: sel, xpath: '', textContent: '', attributes: {}, parentContext: '', siblingContext: [] } }) } };
      }
    }
    if (type === 'move') {
      if (!moveRefAnchor) return null;
      const to = movePlacementSelect.value as 'before' | 'after' | 'first' | 'last';
      return { type: 'move', label: `Move (${to})`, change: { type: 'move', value: JSON.stringify({ to, ref: moveRefAnchor }) } };
    }
    return null;
  }

  function getActiveChanges(): Array<{ type: TabType; label: string; change: PatchChange }> {
    const active: Array<{ type: TabType; label: string; change: PatchChange }> = [];
    for (const t of tabTypes) {
      if (isTabIncluded(t)) {
        const ch = getSingleChange(t);
        if (ch) active.push(ch);
      }
    }
    if (active.length === 0) {
      const single = getSingleChange(activeTab);
      if (single) active.push(single);
    }
    return active;
  }

  body.appendChild(tabsBar);
  body.appendChild(tabContentContainer);

  // Changes Summary Bar
  const summaryBar = doc.createElement('div');
  summaryBar.setAttribute(
    'style',
    'padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;display:flex;flex-direction:column;gap:6px;'
  );
  const summaryCountBadge = doc.createElement('div');
  summaryCountBadge.setAttribute('style', 'font-size:11px;font-weight:700;color:#334155;');
  const summaryChips = doc.createElement('div');
  summaryChips.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:4px;');
  summaryBar.appendChild(summaryCountBadge);
  summaryBar.appendChild(summaryChips);
  body.appendChild(summaryBar);

  // Status/Notice area
  const statusMsg = doc.createElement('div');
  statusMsg.setAttribute('style', 'display:none;padding:6px 10px;border-radius:6px;font-size:11px;line-height:1.4;');
  body.appendChild(statusMsg);

  function showStatus(text: string, kind: 'info' | 'error' | 'success') {
    statusMsg.style.display = 'block';
    statusMsg.textContent = text;
    if (kind === 'error') {
      statusMsg.style.background = '#fef2f2';
      statusMsg.style.color = '#991b1b';
      statusMsg.style.border = '1px solid #fecaca';
    } else if (kind === 'success') {
      statusMsg.style.background = '#f0fdf4';
      statusMsg.style.color = '#166534';
      statusMsg.style.border = '1px solid #bbf7d0';
    } else {
      statusMsg.style.background = '#f8fafc';
      statusMsg.style.color = '#334155';
      statusMsg.style.border = '1px solid #e2e8f0';
    }
  }

  // Footer / Buttons
  const footer = doc.createElement('div');
  footer.setAttribute(
    'style',
    'display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;gap:8px;flex-wrap:wrap;'
  );

  const leftBtns = doc.createElement('div');
  leftBtns.setAttribute('style', 'display:flex;gap:6px;');

  const previewBtn = doc.createElement('button');
  previewBtn.type = 'button';
  previewBtn.textContent = 'Preview';
  previewBtn.setAttribute(
    'style',
    'padding:6px 11px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#334155;font-weight:600;font-size:12px;cursor:pointer;'
  );

  const revertBtn = doc.createElement('button');
  revertBtn.type = 'button';
  revertBtn.textContent = 'Revert';
  revertBtn.style.display = 'none';
  revertBtn.setAttribute(
    'style',
    'padding:6px 11px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;color:#64748b;font-weight:600;font-size:12px;cursor:pointer;'
  );

  leftBtns.appendChild(previewBtn);
  leftBtns.appendChild(revertBtn);

  const rightBtns = doc.createElement('div');
  rightBtns.setAttribute('style', 'display:flex;align-items:center;gap:6px;');

  const stageBtn = doc.createElement('button');
  stageBtn.type = 'button';
  stageBtn.textContent = '+ Stage & Pick Next';
  stageBtn.title = 'Keep these changes and pick another element to batch changes';
  stageBtn.setAttribute(
    'style',
    'padding:6px 9px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;color:#4338ca;font-weight:600;font-size:11px;cursor:pointer;white-space:nowrap;'
  );

  const cancelBtn = doc.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.setAttribute(
    'style',
    'padding:6px 11px;background:none;border:none;color:#64748b;font-weight:600;font-size:12px;cursor:pointer;'
  );

  const saveBtn = doc.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save Draft';
  saveBtn.setAttribute(
    'style',
    'padding:6px 14px;background:#4f46e5;border:none;border-radius:6px;color:#ffffff;font-weight:600;font-size:12px;cursor:pointer;white-space:nowrap;'
  );

  rightBtns.appendChild(stageBtn);
  rightBtns.appendChild(cancelBtn);
  rightBtns.appendChild(saveBtn);

  footer.appendChild(leftBtns);
  footer.appendChild(rightBtns);
  panel.appendChild(footer);

  function updateChangesSummary() {
    const active = getActiveChanges();

    for (const t of tabTypes) {
      const btn = tabButtons[t];
      if (btn) {
        const inc = isTabIncluded(t);
        const base = tabLabels[t];
        btn.textContent = inc ? `${base} •` : base;
        btn.style.color = inc ? '#4338ca' : (t === activeTab ? '#4f46e5' : '#64748b');
      }
    }

    if (active.length > 1) {
      summaryBar.style.display = 'flex';
      summaryCountBadge.textContent = `${active.length} changes selected for this element:`;
      summaryChips.replaceChildren();
      for (const item of active) {
        const chip = doc.createElement('span');
        chip.setAttribute(
          'style',
          'display:inline-flex;align-items:center;gap:4px;padding:2px 7px;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;font-weight:600;color:#334155;cursor:pointer;'
        );
        chip.textContent = item.label;
        chip.addEventListener('click', () => switchTab(item.type));

        const removeChip = doc.createElement('span');
        removeChip.textContent = '×';
        removeChip.setAttribute('style', 'color:#94a3b8;font-size:13px;cursor:pointer;margin-left:2px;');
        removeChip.addEventListener('click', (e) => {
          e.stopPropagation();
          setTabIncluded(item.type, false);
          updateChangesSummary();
        });

        chip.appendChild(removeChip);
        summaryChips.appendChild(chip);
      }
      saveBtn.textContent = `Save ${active.length} Drafts`;
    } else if (active.length === 1) {
      summaryBar.style.display = 'flex';
      summaryCountBadge.textContent = `1 change active: ${active[0].label}`;
      summaryChips.replaceChildren();
      saveBtn.textContent = 'Save Draft';
    } else {
      summaryBar.style.display = 'none';
      saveBtn.textContent = 'Save Draft';
    }
  }

  // Auto-check events
  textArea.addEventListener('input', () => {
    // Only mark as included when text actually differs from original
    textInclude.check.checked = textArea.value.length > 0 && textArea.value !== originalActiveText;
    updateChangesSummary();
  });
  styleArea.addEventListener('input', () => { styleInclude.check.checked = true; updateChangesSummary(); });
  visSelect.addEventListener('change', () => { visInclude.check.checked = true; updateChangesSummary(); });
  scriptArea.addEventListener('input', () => { scriptInclude.check.checked = true; updateChangesSummary(); });
  attrNameInput.addEventListener('input', () => { attrInclude.check.checked = true; updateChangesSummary(); });
  attrValueInput.addEventListener('input', () => { attrInclude.check.checked = true; updateChangesSummary(); });
  behaviorActionSelect.addEventListener('change', () => { bhInclude.check.checked = true; updateChangesSummary(); });
  bhNavUrlInput.addEventListener('input', () => { bhInclude.check.checked = true; updateChangesSummary(); });
  bhConfirmInput.addEventListener('input', () => { bhInclude.check.checked = true; updateChangesSummary(); });
  bhRefInput.addEventListener('input', () => { bhInclude.check.checked = true; updateChangesSummary(); });

  for (const inc of [textInclude, styleInclude, moveInclude, visInclude, scriptInclude, attrInclude, removeInclude, bhInclude]) {
    inc.check.addEventListener('change', updateChangesSummary);
  }

  function switchTab(type: TabType) {
    activeTab = type;
    for (const t of tabTypes) {
      const btn = tabButtons[t];
      if (btn) {
        if (t === type) {
          btn.style.borderBottomColor = '#4f46e5';
          btn.style.fontWeight = '700';
        } else {
          btn.style.borderBottomColor = 'transparent';
          btn.style.fontWeight = isTabIncluded(t) ? '600' : '500';
        }
      }
    }
    textContainer.style.display      = type === 'text'      ? 'flex'  : 'none';
    styleContainer.style.display     = type === 'style'     ? 'flex'  : 'none';
    moveContainer.style.display      = type === 'move'      ? 'flex'  : 'none';
    visContainer.style.display       = type === 'visibility' ? 'flex' : 'none';
    scriptContainer.style.display    = type === 'script'    ? 'flex'  : 'none';
    attrContainer.style.display      = type === 'attribute' ? 'flex'  : 'none';
    removeContainer.style.display    = type === 'remove'    ? 'flex'  : 'none';
    behaviorContainer.style.display  = type === 'behavior'  ? 'flex'  : 'none';

    if (type === 'behavior') updateBehaviorSections();
    if (type === 'move') refreshSiblingList();
    if (type === 'style') {
      const r = element.getBoundingClientRect();
      widthInput.value = String(Math.round(r.width) || '');
      heightInput.value = String(Math.round(r.height) || '');
    }
    updateChangesSummary();
  }

  for (const t of tabTypes) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = tabLabels[t];
    btn.setAttribute(
      'style',
      'padding:6px 10px;background:none;border:none;border-bottom:2px solid transparent;font-size:12px;cursor:pointer;white-space:nowrap;margin-bottom:-2px;'
    );
    btn.addEventListener('click', () => switchTab(t));
    tabButtons[t] = btn;
    tabsBar.appendChild(btn);
  }
  switchTab('text');

  // ── Element Overlay with Resize Handles & Quick Reorder Toolbar ──
  const overlayBox = doc.createElement('div');
  overlayBox.id = 'pw-element-overlay';
  overlayBox.setAttribute(
    'style',
    'position:fixed;pointer-events:none;border:2px dashed #4f46e5;border-radius:4px;box-sizing:border-box;z-index:2147483646;display:block;'
  );

  const dimTooltip = doc.createElement('div');
  dimTooltip.setAttribute(
    'style',
    'position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#ffffff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;pointer-events:none;white-space:nowrap;font-family:monospace;box-shadow:0 2px 6px rgba(0,0,0,0.2);'
  );
  overlayBox.appendChild(dimTooltip);

  const overlayToolbar = doc.createElement('div');
  overlayToolbar.setAttribute(
    'style',
    'position:absolute;bottom:calc(100% + 6px);left:0;display:flex;align-items:center;gap:4px;background:#ffffff;border:1px solid #cbd5e1;box-shadow:0 4px 14px rgba(0,0,0,0.14);border-radius:6px;padding:3px 8px;pointer-events:auto;font-family:system-ui,-apple-system,sans-serif;white-space:nowrap;font-size:11px;'
  );
  const overlayTagBadge = doc.createElement('span');
  overlayTagBadge.setAttribute('style', 'font-weight:700;color:#4f46e5;margin-right:2px;');
  overlayTagBadge.textContent = `<${element.tagName.toLowerCase()}>`;
  overlayToolbar.appendChild(overlayTagBadge);

  const overlayUpBtn = doc.createElement('button');
  overlayUpBtn.type = 'button';
  overlayUpBtn.textContent = '⬆ Up';
  overlayUpBtn.title = 'Move before previous sibling';
  overlayUpBtn.setAttribute(
    'style',
    'padding:2px 7px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;font-weight:600;color:#334155;cursor:pointer;'
  );
  overlayToolbar.appendChild(overlayUpBtn);

  const overlayDownBtn = doc.createElement('button');
  overlayDownBtn.type = 'button';
  overlayDownBtn.textContent = '⬇ Down';
  overlayDownBtn.title = 'Move after next sibling';
  overlayDownBtn.setAttribute(
    'style',
    'padding:2px 7px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;font-weight:600;color:#334155;cursor:pointer;'
  );
  overlayToolbar.appendChild(overlayDownBtn);

  const overlayResizeNote = doc.createElement('span');
  overlayResizeNote.setAttribute('style', 'color:#64748b;font-size:10px;margin-left:4px;');
  overlayResizeNote.textContent = '↔ Drag handles to resize';
  overlayToolbar.appendChild(overlayResizeNote);

  overlayBox.appendChild(overlayToolbar);

  // 8 handles
  const handlesConfig: Array<{ dir: string; posStyle: string; cursor: string }> = [
    { dir: 'nw', posStyle: 'top:-5px;left:-5px;', cursor: 'nwse-resize' },
    { dir: 'n',  posStyle: 'top:-5px;left:calc(50% - 5px);', cursor: 'ns-resize' },
    { dir: 'ne', posStyle: 'top:-5px;right:-5px;', cursor: 'nesw-resize' },
    { dir: 'e',  posStyle: 'top:calc(50% - 5px);right:-5px;', cursor: 'ew-resize' },
    { dir: 'se', posStyle: 'bottom:-5px;right:-5px;', cursor: 'nwse-resize' },
    { dir: 's',  posStyle: 'bottom:-5px;left:calc(50% - 5px);', cursor: 'ns-resize' },
    { dir: 'sw', posStyle: 'bottom:-5px;left:-5px;', cursor: 'nesw-resize' },
    { dir: 'w',  posStyle: 'top:calc(50% - 5px);left:-5px;', cursor: 'ew-resize' },
  ];

  for (const h of handlesConfig) {
    const handleEl = doc.createElement('div');
    handleEl.setAttribute(
      'style',
      `position:absolute;width:10px;height:10px;background:#ffffff;border:2px solid #4f46e5;border-radius:2px;box-sizing:border-box;pointer-events:auto;box-shadow:0 1px 3px rgba(0,0,0,0.25);cursor:${h.cursor};${h.posStyle}`
    );
    handleEl.dataset.dir = h.dir;
    handleEl.title = `Drag to resize (${h.dir.toUpperCase()})`;

    handleEl.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startRect = element.getBoundingClientRect();
      const startW = startRect.width;
      const startH = startRect.height;
      const dir = h.dir;
      const aspect = startW / (startH || 1);

      if (!initialInlineStyle) {
        initialInlineStyle = {
          width: (element as HTMLElement).style.width,
          height: (element as HTMLElement).style.height,
          boxSizing: (element as HTMLElement).style.boxSizing,
        };
      }

      const onPointerMove = (pe: PointerEvent) => {
        const dx = pe.clientX - startX;
        const dy = pe.clientY - startY;
        let newW = startW;
        let newH = startH;

        if (dir.includes('e')) newW = startW + dx;
        if (dir.includes('w')) newW = startW - dx;
        if (dir.includes('s')) newH = startH + dy;
        if (dir.includes('n')) newH = startH - dy;

        if (lockAspectCheckbox.checked) {
          if (dir === 'e' || dir === 'w') {
            newH = newW / aspect;
          } else if (dir === 'n' || dir === 's') {
            newW = newH * aspect;
          } else {
            newH = newW / aspect;
          }
        }

        newW = Math.max(10, Math.round(newW));
        newH = Math.max(10, Math.round(newH));

        const elHtml = element as HTMLElement;
        elHtml.style.width = `${newW}px`;
        elHtml.style.height = `${newH}px`;
        elHtml.style.boxSizing = 'border-box';
        if (win?.getComputedStyle?.(element)?.display === 'inline') {
          elHtml.style.display = 'inline-block';
        }

        updateOverlay();
        widthInput.value = String(newW);
        heightInput.value = String(newH);
        styleArea.value = updateStyleDeclarations(styleArea.value, {
          width: `${newW}px`,
          height: `${newH}px`,
          'box-sizing': 'border-box',
        });
        styleInclude.check.checked = true;
        updateChangesSummary();
      };

      const onPointerUp = () => {
        win?.removeEventListener('pointermove', onPointerMove);
        win?.removeEventListener('pointerup', onPointerUp);
        switchTab('style');
        revertBtn.style.display = 'inline-block';
        const r = element.getBoundingClientRect();
        showStatus(`Resized to ${Math.round(r.width)}px × ${Math.round(r.height)}px. Click Save Draft to save as style patch.`, 'info');
      };

      win?.addEventListener('pointermove', onPointerMove);
      win?.addEventListener('pointerup', onPointerUp);
    });

    overlayBox.appendChild(handleEl);
  }

  shadow.appendChild(overlayBox);
  shadow.appendChild(panel);
  doc.documentElement.appendChild(host);

  // Undos state
  let currentUndos: Undo[] = [];

  function updateOverlay() {
    if (!element.isConnected) {
      overlayBox.style.display = 'none';
      return;
    }
    overlayBox.style.display = 'block';
    const r = element.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    overlayBox.style.left = `${Math.round(r.left)}px`;
    overlayBox.style.top = `${Math.round(r.top)}px`;
    overlayBox.style.width = `${w}px`;
    overlayBox.style.height = `${h}px`;
    dimTooltip.textContent = `${w}px × ${h}px`;
  }
  updateOverlay();

  const onWinScrollOrResize = () => {
    updateOverlay();
  };
  win?.addEventListener('scroll', onWinScrollOrResize, { passive: true });
  win?.addEventListener('resize', onWinScrollOrResize, { passive: true });

  function refreshSiblingList() {
    siblingList.replaceChildren();
    if (!element.parentElement) {
      const emptyNote = doc.createElement('div');
      emptyNote.setAttribute('style', 'font-size:11px;color:#94a3b8;padding:4px;');
      emptyNote.textContent = '(Element has no parent container)';
      siblingList.appendChild(emptyNote);
      return;
    }

    const siblings = Array.from(element.parentElement.children).filter(
      (c) => c !== host && c.id !== EDITOR_HOST_ID && c.id !== STAGED_HOST_ID
    );

    if (siblings.length <= 1) {
      const singleNote = doc.createElement('div');
      singleNote.setAttribute('style', 'font-size:11px;color:#94a3b8;padding:4px;');
      singleNote.textContent = 'This is the only element in its container.';
      siblingList.appendChild(singleNote);
      return;
    }

    siblings.forEach((sib, idx) => {
      const isCurrent = sib === element;
      const row = doc.createElement('div');
      row.setAttribute(
        'style',
        `display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:5px;font-size:11px;gap:6px;${
          isCurrent
            ? 'background:#e0e7ff;border:1px solid #818cf8;font-weight:700;color:#3730a3;'
            : 'background:#f8fafc;border:1px solid #e2e8f0;color:#334155;'
        }`
      );

      const labelSpan = doc.createElement('span');
      labelSpan.setAttribute('style', 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;');
      const tagStr = `<${sib.tagName.toLowerCase()}${sib.id ? '#' + sib.id : ''}>`;
      const txtSnippet = truncateText(sib.textContent, 16);
      labelSpan.textContent = isCurrent
        ? `★ ${idx + 1}. ${tagStr} (This element)`
        : `${idx + 1}. ${tagStr} ${txtSnippet ? `"${txtSnippet}"` : ''}`;

      row.appendChild(labelSpan);

      const actionGroup = doc.createElement('div');
      actionGroup.setAttribute('style', 'display:flex;gap:4px;flex-shrink:0;');

      if (isCurrent) {
        const miniUp = doc.createElement('button');
        miniUp.type = 'button';
        miniUp.textContent = '⬆';
        miniUp.title = 'Move up';
        miniUp.disabled = idx === 0;
        miniUp.setAttribute('style', 'padding:1px 5px;font-size:10px;cursor:pointer;background:#ffffff;border:1px solid #818cf8;border-radius:3px;');
        miniUp.addEventListener('click', () => executeSiblingMove('up'));

        const miniDown = doc.createElement('button');
        miniDown.type = 'button';
        miniDown.textContent = '⬇';
        miniDown.title = 'Move down';
        miniDown.disabled = idx === siblings.length - 1;
        miniDown.setAttribute('style', 'padding:1px 5px;font-size:10px;cursor:pointer;background:#ffffff;border:1px solid #818cf8;border-radius:3px;');
        miniDown.addEventListener('click', () => executeSiblingMove('down'));

        actionGroup.appendChild(miniUp);
        actionGroup.appendChild(miniDown);
      } else {
        const beforeBtn = doc.createElement('button');
        beforeBtn.type = 'button';
        beforeBtn.textContent = 'Before';
        beforeBtn.title = `Place current element before this <${sib.tagName.toLowerCase()}>`;
        beforeBtn.setAttribute('style', 'padding:2px 5px;font-size:10px;cursor:pointer;background:#ffffff;border:1px solid #cbd5e1;border-radius:3px;color:#334155;');
        beforeBtn.addEventListener('click', () => executeSiblingMove('before', sib));

        const afterBtn = doc.createElement('button');
        afterBtn.type = 'button';
        afterBtn.textContent = 'After';
        afterBtn.title = `Place current element after this <${sib.tagName.toLowerCase()}>`;
        afterBtn.setAttribute('style', 'padding:2px 5px;font-size:10px;cursor:pointer;background:#ffffff;border:1px solid #cbd5e1;border-radius:3px;color:#334155;');
        afterBtn.addEventListener('click', () => executeSiblingMove('after', sib));

        actionGroup.appendChild(beforeBtn);
        actionGroup.appendChild(afterBtn);
      }

      row.appendChild(actionGroup);
      siblingList.appendChild(row);
    });
  }

  function executeSiblingMove(action: 'up' | 'down' | 'first' | 'last' | 'before' | 'after', targetSib?: Element) {
    if (!element.parentElement) {
      showStatus('Cannot reorder: element has no parent container.', 'error');
      return;
    }
    const siblings = Array.from(element.parentElement.children).filter(
      (c) => c !== host && c.id !== EDITOR_HOST_ID && c.id !== STAGED_HOST_ID
    );
    const currIdx = siblings.indexOf(element);
    if (currIdx === -1) {
      showStatus('Element is no longer in parent children list.', 'error');
      return;
    }

    let target: Element | null = null;
    let placement: 'before' | 'after' = 'before';

    if (action === 'up') {
      if (currIdx <= 0) {
        showStatus('Element is already the first sibling.', 'info');
        return;
      }
      target = siblings[currIdx - 1];
      placement = 'before';
    } else if (action === 'down') {
      if (currIdx >= siblings.length - 1) {
        showStatus('Element is already the last sibling.', 'info');
        return;
      }
      target = siblings[currIdx + 1];
      placement = 'after';
    } else if (action === 'first') {
      if (currIdx === 0) {
        showStatus('Element is already the first child.', 'info');
        return;
      }
      target = siblings[0];
      placement = 'before';
    } else if (action === 'last') {
      if (currIdx === siblings.length - 1) {
        showStatus('Element is already the last child.', 'info');
        return;
      }
      target = siblings[siblings.length - 1];
      placement = 'after';
    } else if ((action === 'before' || action === 'after') && targetSib) {
      target = targetSib;
      placement = action;
    }

    if (!target) return;

    try {
      revertPreview();
      const refAnchor = buildAnchor(target);
      moveRefAnchor = refAnchor;
      movePlacementSelect.value = placement;
      moveInclude.check.checked = true;
      moveRefDisplay.textContent = refAnchor.cssSelector || refAnchor.xpath || `Target: <${target.tagName.toLowerCase()}>`;
      moveRefDisplay.style.color = '#166534';

      switchTab('move');
      const change = getSingleChange('move');
      if (change) {
        const res = applyChange(element, change.change);
        if ('skipped' in res) {
          showStatus(`Move preview skipped: ${res.skipped}`, 'error');
        } else {
          currentUndos.push(res);
          revertBtn.style.display = 'inline-block';
          showStatus(`Reordered: placed ${placement} <${target.tagName.toLowerCase()}>. Save draft to persist.`, 'info');
        }
      }
      updateOverlay();
      refreshSiblingList();
      updateChangesSummary();
    } catch (err) {
      showStatus(`Reorder error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  // Wire move buttons
  overlayUpBtn.addEventListener('click', () => executeSiblingMove('up'));
  overlayDownBtn.addEventListener('click', () => executeSiblingMove('down'));
  moveUpBtn.addEventListener('click', () => executeSiblingMove('up'));
  moveDownBtn.addEventListener('click', () => executeSiblingMove('down'));
  moveFirstBtn.addEventListener('click', () => executeSiblingMove('first'));
  moveLastBtn.addEventListener('click', () => executeSiblingMove('last'));

  // Wire size inputs and presets
  widthInput.addEventListener('input', () => {
    const val = parseInt(widthInput.value, 10);
    if (!isNaN(val) && val > 0) {
      if (!initialInlineStyle) {
        initialInlineStyle = {
          width: (element as HTMLElement).style.width,
          height: (element as HTMLElement).style.height,
          boxSizing: (element as HTMLElement).style.boxSizing,
        };
      }
      if (lockAspectCheckbox.checked) {
        const r = element.getBoundingClientRect();
        const aspect = (r.width || 1) / (r.height || 1);
        const newH = Math.max(10, Math.round(val / aspect));
        heightInput.value = String(newH);
        (element as HTMLElement).style.height = `${newH}px`;
      }
      (element as HTMLElement).style.width = `${val}px`;
      (element as HTMLElement).style.boxSizing = 'border-box';
      if (win?.getComputedStyle?.(element)?.display === 'inline') {
        (element as HTMLElement).style.display = 'inline-block';
      }
      updateOverlay();
      styleArea.value = updateStyleDeclarations(styleArea.value, {
        width: `${val}px`,
        height: `${heightInput.value || val}px`,
        'box-sizing': 'border-box',
      });
      styleInclude.check.checked = true;
      revertBtn.style.display = 'inline-block';
      updateChangesSummary();
    }
  });

  heightInput.addEventListener('input', () => {
    const val = parseInt(heightInput.value, 10);
    if (!isNaN(val) && val > 0) {
      if (!initialInlineStyle) {
        initialInlineStyle = {
          width: (element as HTMLElement).style.width,
          height: (element as HTMLElement).style.height,
          boxSizing: (element as HTMLElement).style.boxSizing,
        };
      }
      if (lockAspectCheckbox.checked) {
        const r = element.getBoundingClientRect();
        const aspect = (r.width || 1) / (r.height || 1);
        const newW = Math.max(10, Math.round(val * aspect));
        widthInput.value = String(newW);
        (element as HTMLElement).style.width = `${newW}px`;
      }
      (element as HTMLElement).style.height = `${val}px`;
      (element as HTMLElement).style.boxSizing = 'border-box';
      if (win?.getComputedStyle?.(element)?.display === 'inline') {
        (element as HTMLElement).style.display = 'inline-block';
      }
      updateOverlay();
      styleArea.value = updateStyleDeclarations(styleArea.value, {
        width: `${widthInput.value || val}px`,
        height: `${val}px`,
        'box-sizing': 'border-box',
      });
      styleInclude.check.checked = true;
      revertBtn.style.display = 'inline-block';
      updateChangesSummary();
    }
  });

  fullWidthBtn.addEventListener('click', () => {
    if (!initialInlineStyle) {
      initialInlineStyle = {
        width: (element as HTMLElement).style.width,
        height: (element as HTMLElement).style.height,
        boxSizing: (element as HTMLElement).style.boxSizing,
      };
    }
    (element as HTMLElement).style.width = '100%';
    (element as HTMLElement).style.boxSizing = 'border-box';
    updateOverlay();
    widthInput.value = String(Math.round(element.getBoundingClientRect().width));
    styleArea.value = updateStyleDeclarations(styleArea.value, { width: '100%', 'box-sizing': 'border-box' });
    styleInclude.check.checked = true;
    revertBtn.style.display = 'inline-block';
    updateChangesSummary();
    showStatus('Applied full width (100%).', 'info');
  });

  autoSizeBtn.addEventListener('click', () => {
    if (!initialInlineStyle) {
      initialInlineStyle = {
        width: (element as HTMLElement).style.width,
        height: (element as HTMLElement).style.height,
        boxSizing: (element as HTMLElement).style.boxSizing,
      };
    }
    (element as HTMLElement).style.width = 'auto';
    (element as HTMLElement).style.height = 'auto';
    updateOverlay();
    widthInput.value = String(Math.round(element.getBoundingClientRect().width));
    heightInput.value = String(Math.round(element.getBoundingClientRect().height));
    styleArea.value = updateStyleDeclarations(styleArea.value, { width: 'auto', height: 'auto' });
    styleInclude.check.checked = true;
    revertBtn.style.display = 'inline-block';
    updateChangesSummary();
    showStatus('Applied auto dimensions.', 'info');
  });

  resetSizeBtn.addEventListener('click', () => {
    if (initialInlineStyle) {
      const elHtml = element as HTMLElement;
      elHtml.style.width = initialInlineStyle.width;
      elHtml.style.height = initialInlineStyle.height;
      elHtml.style.boxSizing = initialInlineStyle.boxSizing;
    } else {
      (element as HTMLElement).style.removeProperty('width');
      (element as HTMLElement).style.removeProperty('height');
    }
    updateOverlay();
    widthInput.value = String(Math.round(element.getBoundingClientRect().width));
    heightInput.value = String(Math.round(element.getBoundingClientRect().height));
    styleArea.value = updateStyleDeclarations(styleArea.value, { width: '', height: '', 'box-sizing': '' });
    updateChangesSummary();
    showStatus('Reset size to original.', 'info');
  });

  function revertPreview() {
    while (currentUndos.length > 0) {
      const u = currentUndos.pop();
      u?.revert();
    }
    if (initialInlineStyle) {
      const elHtml = element as HTMLElement;
      elHtml.style.width = initialInlineStyle.width;
      elHtml.style.height = initialInlineStyle.height;
      elHtml.style.boxSizing = initialInlineStyle.boxSizing;
      initialInlineStyle = null;
    }
    revertBtn.style.display = 'none';
    previewBtn.style.display = 'inline-block';
    updateOverlay();
    refreshSiblingList();
  }

  // Preview Action
  previewBtn.addEventListener('click', () => {
    revertPreview();
    const changes = getActiveChanges();
    if (changes.length === 0) {
      showStatus('No changes configured to preview.', 'info');
      return;
    }

    let appliedCount = 0;
    for (const ch of changes) {
      if (ch.type === 'script') {
        showStatus('Local script preview is disabled for security.', 'info');
        continue;
      }
      const targetEl = (ch as any).targetElement || element;
      const res = applyChange(targetEl, ch.change, { allowScript: false });
      if ('skipped' in res) {
        showStatus(`Preview skipped for ${ch.type}: ${res.skipped}`, 'error');
      } else {
        currentUndos.push(res);
        appliedCount++;
      }
    }

    if (appliedCount > 0) {
      revertBtn.style.display = 'inline-block';
      updateOverlay();
      refreshSiblingList();
      showStatus(`Preview applied: ${appliedCount} change(s) active on element.`, 'info');
    }
  });

  revertBtn.addEventListener('click', () => {
    revertPreview();
    showStatus('Preview reverted.', 'info');
  });

  function close() {
    win?.removeEventListener('scroll', onWinScrollOrResize);
    win?.removeEventListener('resize', onWinScrollOrResize);
    revertPreview();
    host.remove();
    onClose?.();
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // Stage & Pick Next Action
  stageBtn.addEventListener('click', () => {
    const changes = getActiveChanges();
    if (changes.length === 0) {
      showStatus('No changes to stage.', 'error');
      return;
    }

    // Apply preview live on DOM so it remains active
    revertPreview();
    const undos: Undo[] = [];
    for (const ch of changes) {
      if (ch.type === 'script') continue;
      const targetEl = (ch as any).targetElement || element;
      const res = applyChange(targetEl, ch.change, { allowScript: false });
      if (!('skipped' in res)) undos.push(res);
    }

    const targetUrl = scopeCheckbox.checked
      ? `${loc.origin}/`
      : `${loc.origin}${loc.pathname}`;
    const defaultTitle = `Edit <${element.tagName.toLowerCase()}> on ${loc.pathname}`;
    const baseTitle = titleInput.value.trim() || defaultTitle;

    for (const ch of changes) {
      const targetEl = (ch as any).targetElement || element;
      const targetAnch = (ch as any).anchor || anchor;
      stagedBatch.push({
        id: Math.random().toString(36).slice(2),
        targetUrl,
        baseVersion: 0,
        anchor: targetAnch,
        change: ch.change,
        title: changes.length > 1 ? `${baseTitle} - ${ch.label}` : baseTitle,
        element: targetEl,
        undo: undos.shift(),
      });
    }

    currentUndos = [];
    initialInlineStyle = null;
    host.remove();
    onClose?.();

    showStagedBatchBar(doc, { onPickNext });
    onPickNext?.();
  });

  // Save Draft Action (Saves all active changes on this element)
  saveBtn.addEventListener('click', () => {
    void (async () => {
      const changes = getActiveChanges();
      if (changes.length === 0) {
        showStatus('No changes selected to save.', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = changes.length > 1 ? `Saving ${changes.length}...` : 'Saving...';
      showStatus(`Submitting ${changes.length} draft patch(es)...`, 'info');

      try {
        const targetUrl = scopeCheckbox.checked
          ? `${loc.origin}/`
          : `${loc.origin}${loc.pathname}`;

        const baseVerRes = await send({ type: 'GET_BASE_VERSION' });
        const base_version = baseVerRes.base_version;

        const defaultTitle = `Edit <${element.tagName.toLowerCase()}> on ${loc.pathname}`;
        const baseTitle = titleInput.value.trim() || defaultTitle;

        const savedIds: string[] = [];
        for (const ch of changes) {
          const patchTitle = changes.length > 1 ? `${baseTitle} - ${ch.label}` : baseTitle;
          const patchAnchor = (ch as any).anchor || anchor;
          const saved = await send({
            type: 'SAVE_DRAFT',
            target_url: targetUrl,
            base_version,
            anchors: patchAnchor,
            change: ch.change,
            title: patchTitle,
          });
          savedIds.push(saved.id);
          onSaved?.(saved.id);
        }

        revertPreview();
        const msg = savedIds.length > 1
          ? `Saved ${savedIds.length} draft patches successfully!`
          : `Draft saved (ID: ${savedIds[0].slice(0, 8)}...).`;
        showStatus(msg, 'success');

        setTimeout(() => {
          close();
        }, 1200);
      } catch (err) {
        showStatus(`Could not save draft(s): ${err instanceof Error ? err.message : String(err)}`, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = changes.length > 1 ? `Save ${changes.length} Drafts` : 'Save Draft';
      }
    })();
  });

  updateChangesSummary();
  return { close };
}
