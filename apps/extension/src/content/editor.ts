/**
 * Floating editor panel: opens on a picked element.
 *
 * - Lives in a closed shadow root attached to <html>, so page styles cannot affect it
 *   and it does not alter :nth-of-type indexes of <body> children.
 * - Supports Text, Style, Visibility, and Script tabs.
 * - Performs live local preview via applyChange() from @patchwork/shared.
 * - Reverts local preview upon Cancel, Revert, or Save Draft.
 * - Disallows script execution in local preview (allowScript: false) with clear warning.
 * - Submits draft via SAVE_DRAFT background message (POST /patches).
 * - All text is strictly populated using textContent / value (never innerHTML).
 */
import type { PatchAnchor, PatchChange } from '@patchwork/shared';
import { applyChange, type Undo } from '@patchwork/shared';
import { send } from '../messages';

export const EDITOR_HOST_ID = 'patchwork-editor-host';

export interface EditorOptions {
  doc: Document;
  element: Element;
  anchor: PatchAnchor;
  onClose?: () => void;
  onSaved?: (patchId: string) => void;
}

export function openEditor(options: EditorOptions): { close(): void } {
  const { doc, element, anchor, onClose, onSaved } = options;
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
    'position:fixed;width:380px;max-width:92vw;background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.18);font:13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;pointer-events:auto;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;'
  );

  // Position near element
  const rect = element.getBoundingClientRect();
  const vpWidth = win ? win.innerWidth : 1000;
  const vpHeight = win ? win.innerHeight : 800;

  let left = rect.right + 12;
  if (left + 390 > vpWidth) {
    left = Math.max(12, rect.left - 392);
  }
  if (left < 12) left = 12;

  let top = rect.top;
  if (top + 450 > vpHeight) {
    top = Math.max(12, vpHeight - 460);
  }
  if (top < 12) top = 12;

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;

  // Header
  const header = doc.createElement('div');
  header.setAttribute(
    'style',
    'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;cursor:default;'
  );
  const titleSpan = doc.createElement('div');
  titleSpan.setAttribute('style', 'font-weight:700;color:#0f172a;font-size:13px;display:flex;align-items:center;gap:6px;');
  titleSpan.textContent = `Edit <${element.tagName.toLowerCase()}>`;

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute(
    'style',
    'background:transparent;border:none;color:#64748b;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;border-radius:4px;'
  );
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  header.appendChild(titleSpan);
  header.appendChild(closeBtn);
  panel.appendChild(header);

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
  tabsBar.setAttribute('style', 'display:flex;border-bottom:2px solid #e2e8f0;gap:4px;');
  const tabTypes = ['text', 'style', 'visibility', 'script'] as const;
  type TabType = (typeof tabTypes)[number];
  let activeTab: TabType = 'text';

  const tabButtons: Record<TabType, HTMLButtonElement> = {} as any;

  // Tab contents container
  const tabContentContainer = doc.createElement('div');
  tabContentContainer.setAttribute('style', 'display:flex;flex-direction:column;gap:8px;');

  // Text Tab Fields
  const textContainer = doc.createElement('div');
  textContainer.setAttribute('style', 'display:flex;flex-direction:column;gap:4px;');
  const textLabel = doc.createElement('label');
  textLabel.textContent = 'New text content:';
  textLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const textArea = doc.createElement('textarea');
  textArea.rows = 4;
  textArea.value = element.textContent?.trim() ?? '';
  textArea.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;resize:vertical;font-family:inherit;');
  textContainer.appendChild(textLabel);
  textContainer.appendChild(textArea);

  // Style Tab Fields
  const styleContainer = doc.createElement('div');
  styleContainer.setAttribute('style', 'display:none;flex-direction:column;gap:4px;');
  const styleLabel = doc.createElement('label');
  styleLabel.textContent = 'CSS rules or JSON:';
  styleLabel.setAttribute('style', 'font-size:11px;font-weight:600;color:#475569;');
  const styleArea = doc.createElement('textarea');
  styleArea.rows = 4;
  styleArea.placeholder = 'color: #2563eb; font-weight: bold;\nOR {"color": "#2563eb"}';
  styleArea.setAttribute('style', 'width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;resize:vertical;font-family:monospace;');
  styleContainer.appendChild(styleLabel);
  styleContainer.appendChild(styleArea);

  // Visibility Tab Fields
  const visContainer = doc.createElement('div');
  visContainer.setAttribute('style', 'display:none;flex-direction:column;gap:4px;');
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

  // Script Tab Fields
  const scriptContainer = doc.createElement('div');
  scriptContainer.setAttribute('style', 'display:none;flex-direction:column;gap:6px;');
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

  tabContentContainer.appendChild(textContainer);
  tabContentContainer.appendChild(styleContainer);
  tabContentContainer.appendChild(visContainer);
  tabContentContainer.appendChild(scriptContainer);

  function switchTab(type: TabType) {
    activeTab = type;
    for (const t of tabTypes) {
      const btn = tabButtons[t];
      if (btn) {
        if (t === type) {
          btn.style.borderBottomColor = '#4f46e5';
          btn.style.color = '#4f46e5';
          btn.style.fontWeight = '700';
        } else {
          btn.style.borderBottomColor = 'transparent';
          btn.style.color = '#64748b';
          btn.style.fontWeight = '500';
        }
      }
    }
    textContainer.style.display = type === 'text' ? 'flex' : 'none';
    styleContainer.style.display = type === 'style' ? 'flex' : 'none';
    visContainer.style.display = type === 'visibility' ? 'flex' : 'none';
    scriptContainer.style.display = type === 'script' ? 'flex' : 'none';
  }

  for (const t of tabTypes) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    btn.setAttribute(
      'style',
      'padding:6px 12px;background:none;border:none;border-bottom:2px solid transparent;font-size:12px;cursor:pointer;margin-bottom:-2px;'
    );
    btn.addEventListener('click', () => switchTab(t));
    tabButtons[t] = btn;
    tabsBar.appendChild(btn);
  }
  switchTab('text');

  body.appendChild(tabsBar);
  body.appendChild(tabContentContainer);

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
    'display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;gap:8px;'
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
  rightBtns.setAttribute('style', 'display:flex;gap:6px;');

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
    'padding:6px 14px;background:#4f46e5;border:none;border-radius:6px;color:#ffffff;font-weight:600;font-size:12px;cursor:pointer;'
  );

  rightBtns.appendChild(cancelBtn);
  rightBtns.appendChild(saveBtn);

  footer.appendChild(leftBtns);
  footer.appendChild(rightBtns);
  panel.appendChild(footer);

  shadow.appendChild(panel);
  doc.documentElement.appendChild(host);

  // State
  let currentUndo: Undo | null = null;

  function revertPreview() {
    if (currentUndo) {
      currentUndo.revert();
      currentUndo = null;
    }
    revertBtn.style.display = 'none';
    previewBtn.style.display = 'inline-block';
  }

  function getChange(): PatchChange | null {
    if (activeTab === 'text') {
      return { type: 'text', value: textArea.value };
    }
    if (activeTab === 'style') {
      const val = styleArea.value.trim();
      if (!val) {
        showStatus('Please specify style declarations or JSON.', 'error');
        return null;
      }
      return { type: 'style', value: val };
    }
    if (activeTab === 'visibility') {
      return { type: 'visibility', value: visSelect.value };
    }
    if (activeTab === 'script') {
      const val = scriptArea.value.trim();
      if (!val) {
        showStatus('Please enter a JavaScript snippet.', 'error');
        return null;
      }
      return { type: 'script', value: val };
    }
    return null;
  }

  // Preview Action
  previewBtn.addEventListener('click', () => {
    revertPreview();
    const change = getChange();
    if (!change) return;

    if (change.type === 'script') {
      showStatus('Local script preview is disabled for security.', 'info');
      return;
    }

    const res = applyChange(element, change, { allowScript: false });
    if ('skipped' in res) {
      showStatus(`Preview skipped: ${res.skipped}`, 'error');
      return;
    }
    currentUndo = res;
    revertBtn.style.display = 'inline-block';
    showStatus('Preview applied to element.', 'info');
  });

  revertBtn.addEventListener('click', () => {
    revertPreview();
    showStatus('Preview reverted.', 'info');
  });

  function close() {
    revertPreview();
    host.remove();
    onClose?.();
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // Save Draft Action
  saveBtn.addEventListener('click', () => {
    void (async () => {
      const change = getChange();
      if (!change) return;

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      showStatus('Submitting draft...', 'info');

      try {
        const targetUrl = scopeCheckbox.checked
          ? `${loc.origin}/`
          : `${loc.origin}${loc.pathname}`;

        const baseVerRes = await send({ type: 'GET_BASE_VERSION' });
        const base_version = baseVerRes.base_version;

        const defaultTitle = `Edit <${element.tagName.toLowerCase()}> on ${loc.pathname}`;
        const title = titleInput.value.trim() || defaultTitle;

        const saved = await send({
          type: 'SAVE_DRAFT',
          target_url: targetUrl,
          base_version,
          anchors: anchor,
          change,
          title,
        });

        revertPreview();
        showStatus(`Draft saved (ID: ${saved.id.slice(0, 8)}...).`, 'success');
        onSaved?.(saved.id);

        setTimeout(() => {
          close();
        }, 1200);
      } catch (err) {
        showStatus(`Could not save draft: ${err instanceof Error ? err.message : String(err)}`, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Draft';
      }
    })();
  });

  return { close };
}
