import { forwardRef, useRef } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react';
import { buildPreviewUrl } from '../lib/preview';

export interface PreviewTarget {
  id: string;
  /** short human description, e.g. the patch title */
  label: string;
  /** workflow status shown next to the label (draft, in_review, live, ...) */
  status: string;
  /** changes whenever the patch is edited, so the window reloads to show the new version */
  version: string;
}

interface PreviewWindowProps {
  baseUrl: string;
  open: boolean;
  onToggle: () => void;
  /** the patch being previewed, or null to show the live site */
  target: PreviewTarget | null;
  /** bump to force the page inside the window to reload */
  reloadKey: number;
  onReload: () => void;
  onShowLive: () => void;
}

/**
 * A collapsible window that shows the site inside the dashboard, so reviewers and
 * developers do not get a new browser tab every time they click Preview.
 * It is the real site: the page's own patchwork-runtime.js applies the patch.
 */
export const PreviewWindow = forwardRef<HTMLDivElement, PreviewWindowProps>(function PreviewWindow(
  { baseUrl, open, onToggle, target, reloadKey, onReload, onShowLive },
  ref,
) {
  const url = buildPreviewUrl(baseUrl, target?.id ?? null);
  const frameKey = `${target?.id ?? 'live'}:${target?.version ?? ''}:${reloadKey}`;

  // The first load of a frame is ours. If the same frame loads AGAIN while a patch is being
  // previewed, the page navigated itself (its own "Exit preview" link), so it no longer shows
  // the preview and the header must stop claiming it does. (The frame is cross-origin, so its
  // URL cannot be read; counting loads is the only signal.)
  const loadedKey = useRef<string | null>(null);
  const handleLoad = () => {
    if (target && loadedKey.current === frameKey) onShowLive();
    loadedKey.current = frameKey;
  };
  const caption = target ? `Previewing: ${target.label} (${target.status.replace(/_/g, ' ')})` : 'Live site';

  return (
    <div ref={ref} className="cyber-glass border border-outline-variant/30 rounded-xl shadow-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-surface-container/60">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="site-preview-frame"
          className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
        >
          {open ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
          <span className="text-sm font-mono font-bold uppercase tracking-wider text-primary whitespace-nowrap">
            Site preview
          </span>
          <span className="text-xs font-mono text-on-surface-variant truncate" data-testid="preview-caption">
            {caption}
          </span>
        </button>

        {open && (
          <div className="flex items-center gap-2">
            {target && (
              <button
                type="button"
                onClick={onShowLive}
                className="bg-surface-container hover:bg-surface-container-high text-white border border-outline-variant/40 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer"
              >
                Show live site
              </button>
            )}
            <button
              type="button"
              onClick={onReload}
              aria-label="Reload preview"
              title="Reload preview"
              className="p-1.5 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open preview in a new tab"
              title="Open in a new tab"
              className="p-1.5 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {open && (
        <iframe
          id="site-preview-frame"
          key={frameKey}
          title="Site preview"
          src={url}
          onLoad={handleLoad}
          // Drafts can contain script patches. Without allow-top-navigation, a page inside this
          // window cannot redirect the dashboard itself.
          sandbox="allow-scripts allow-same-origin allow-forms"
          className="w-full h-[420px] bg-white border-t border-outline-variant/30"
        />
      )}
    </div>
  );
});
