import React from 'react';
import { Info, X, Code2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface NodeDetail {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  badge?: string;
  route?: string;
  color?: 'primary' | 'neutral' | 'success' | 'failure';
  description?: string;
  bullets?: string[];
  code?: string;
  meta?: Record<string, string | number | boolean>;
}

interface NodeDetailPanelProps {
  selectedNode: NodeDetail | null;
  onClose?: () => void;
  className?: string;
}

export function NodeDetailPanel({
  selectedNode,
  onClose,
  className,
}: NodeDetailPanelProps) {
  if (!selectedNode) {
    return (
      <div
        className={cn(
          'p-4 rounded-2xl cyber-glass border border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-primary shrink-0">
            <Info className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="text-white font-headline font-bold text-sm block">
              Node Inspector
            </span>
            <span className="text-on-surface-variant text-xs">
              Click any box, arrow, or status pill in the diagram above to inspect exact implementation details, API routes, and codebase facts.
            </span>
          </div>
        </div>
        <span className="text-[11px] text-outline px-3 py-1 rounded-full bg-surface-container-lowest border border-outline-variant/20 shrink-0 hidden sm:inline">
          Keyboard: Tab + Enter / Space
        </span>
      </div>
    );
  }

  const categoryColorClass =
    selectedNode.color === 'primary'
      ? 'bg-primary-container/20 border-primary-container/40 text-primary-fixed-dim'
      : selectedNode.color === 'success'
      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
      : selectedNode.color === 'failure'
      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
      : 'bg-surface-container-highest border-outline-variant/40 text-on-surface-variant';

  return (
    <div
      className={cn(
        'p-6 rounded-2xl cyber-glass border border-outline-variant/40 font-mono space-y-5 shadow-2xl relative',
        className
      )}
      tabIndex={-1}
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[11px] px-2.5 py-0.5 rounded-full border uppercase font-bold tracking-wider',
                categoryColorClass
              )}
            >
              {selectedNode.category || 'Component Detail'}
            </span>
            {selectedNode.badge && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-outline">
                {selectedNode.badge}
              </span>
            )}
          </div>
          <h3 className="text-xl font-headline font-bold text-white tracking-tight">
            {selectedNode.title}
          </h3>
          {selectedNode.subtitle && (
            <p className="text-xs text-on-surface-variant">{selectedNode.subtitle}</p>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-outline hover:text-white transition-colors"
            title="Deselect node"
            aria-label="Close detail panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3-Column Content Grid: Fits full width with ZERO scroll wheel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start text-xs">
        {/* Col 1: Overview & Route & Meta */}
        <div className="space-y-3">
          {selectedNode.route && (
            <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between text-xs">
              <span className="text-outline text-[11px] uppercase font-semibold">API Route:</span>
              <code className="text-primary font-bold text-xs">{selectedNode.route}</code>
            </div>
          )}

          {selectedNode.description && (
            <p className="text-xs text-on-surface leading-relaxed">
              {selectedNode.description}
            </p>
          )}

          {selectedNode.meta && Object.keys(selectedNode.meta).length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              {Object.entries(selectedNode.meta).map(([k, v]) => (
                <div key={k} className="p-2 rounded-lg bg-surface-container/60 border border-outline-variant/20">
                  <span className="text-outline uppercase text-[10px] block font-semibold">{k}</span>
                  <span className="text-white font-bold">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Col 2: Implementation Facts */}
        <div className="space-y-2">
          <span className="text-[11px] uppercase text-outline font-semibold tracking-wider block">
            Implementation Facts
          </span>
          {selectedNode.bullets && selectedNode.bullets.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-on-surface-variant">
              {selectedNode.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-outline italic">No additional bullet items.</p>
          )}
        </div>

        {/* Col 3: Logic & Code Snippet */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] uppercase text-outline font-semibold">
            <Code2 className="w-3.5 h-3.5 text-primary" />
            <span>Logic & Signatures</span>
          </div>
          {selectedNode.code ? (
            <pre className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-[11px] text-primary-fixed-dim whitespace-pre-wrap leading-relaxed">
              <code>{selectedNode.code}</code>
            </pre>
          ) : (
            <div className="p-3 rounded-xl bg-surface-container-lowest/50 border border-outline-variant/20 text-xs text-outline italic">
              Standard REST endpoint conforming to shared schema.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
