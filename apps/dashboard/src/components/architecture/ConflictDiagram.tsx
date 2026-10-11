import React, { useState } from 'react';
import type { NodeDetail } from './NodeDetailPanel';
import { getRouteString } from '../../lib/lifecycle';

interface ConflictDiagramProps {
  activeNodeId: string | null;
  onSelectNode: (node: NodeDetail) => void;
}

export function ConflictDiagram({ activeNodeId, onSelectNode }: ConflictDiagramProps) {
  const [conflictMode, setConflictMode] = useState<'different' | 'same'>('different');

  const baseNodeDetail: NodeDetail = {
    id: 'base-version',
    title: 'Base Version v1',
    subtitle: 'Shared starting point before branch edits',
    category: 'Git-Graph Base',
    badge: 'Live Deployment v1',
    color: 'neutral',
    description:
      'The clean production state deployed on the live storefront. Both engineers checkout or branch from this version.',
    bullets: [
      'Target element: #checkout-btn (Pay & Complete Order)',
      'Baseline styles: background-color: #2563eb; color: #ffffff;',
      'Both author branches record base_version: 1 for atomic CAS verification',
    ],
    code: '{\n  element: "#checkout-btn",\n  base_version: 1,\n  text: "Pay & Complete Order"\n}',
  };

  const branchADetail: NodeDetail = {
    id: 'branch-a',
    title: 'Branch A: Dev (Bob)',
    subtitle: conflictMode === 'different' ? 'Text edit on #checkout-btn' : 'Style edit on #checkout-btn',
    category: 'Author Branch A',
    badge: 'Bob (Developer)',
    color: 'primary',
    route: getRouteString('POST', '/patches'),
    description:
      conflictMode === 'different'
        ? 'Bob edits text property on #checkout-btn from "Pay & Complete Order" to "Complete Purchase".'
        : 'Bob edits background-color style on #checkout-btn to #10b981 (emerald).',
    bullets: [
      'Target element: #checkout-btn',
      conflictMode === 'different'
        ? 'Property modified: text ("Complete Purchase")'
        : 'Property modified: style (background-color: #10b981)',
      'Recorded in audit trail upon submission (patch_submitted)',
    ],
    code:
      conflictMode === 'different'
        ? '{\n  target: "#checkout-btn",\n  change: { type: "text", value: "Complete Purchase" }\n}'
        : '{\n  target: "#checkout-btn",\n  change: { type: "style", value: "background-color: #10b981" }\n}',
  };

  const branchBDetail: NodeDetail = {
    id: 'branch-b',
    title: 'Branch B: Alice (Reviewer)',
    subtitle: 'Style edit on #checkout-btn',
    category: 'Author Branch B',
    badge: 'Alice (Reviewer)',
    color: 'primary',
    route: getRouteString('POST', '/patches'),
    description:
      'Alice concurrently updates the styling of #checkout-btn to background-color: #f43f5e (rose).',
    bullets: [
      'Target element: #checkout-btn',
      'Property modified: style (background-color: #f43f5e)',
      'Created against the same base version v1',
    ],
    code: '{\n  target: "#checkout-btn",\n  change: { type: "style", value: "background-color: #f43f5e" }\n}',
  };

  const mergeNodeDetail: NodeDetail = {
    id: 'merge-node',
    title: conflictMode === 'different' ? 'Auto-Merge (Success)' : 'Conflict Detected (Blocked)',
    subtitle:
      conflictMode === 'different'
        ? 'Non-overlapping properties combine cleanly'
        : 'Overlapping background-color on same element',
    category: conflictMode === 'different' ? 'Merge Outcome' : 'Conflict Outcome',
    badge: conflictMode === 'different' ? 'Status: Approved' : 'Status: Conflicted',
    color: conflictMode === 'different' ? 'success' : 'failure',
    route: conflictMode === 'different' ? getRouteString('POST', '/patches/:id/merge') : getRouteString('POST', '/conflicts/:id/resolve'),
    description:
      conflictMode === 'different'
        ? 'Because Bob changed text and Alice changed style (background-color), detectOpConflict() determines property orthogonality. Both operations cleanly combine into Version v2 without human intervention.'
        : 'Both Bob and Alice modified background-color on the same element (#checkout-btn). The engine detects the collision, creates a row in the conflicts table, and blocks CAS merge until resolved.',
    bullets:
      conflictMode === 'different'
        ? [
            'detectOpConflict(opA, opB) => { isConflict: false }',
            'Operations synthesized: [opA (text), opB (style)]',
            'CAS merge proceeds to increment live version',
          ]
        : [
            'detectOpConflict(opA, opB) => { isConflict: true, type: "concurrent" }',
            'Patch status set to "conflicted"',
            'Resolution endpoint: POST /conflicts/:id/resolve (choice: a, b, or custom)',
          ],
    code:
      conflictMode === 'different'
        ? '// packages/shared/src/conflicts.ts\nif (propA !== propB) {\n  return { isConflict: false }; // Auto-merge!\n}'
        : '// packages/shared/src/conflicts.ts\nif (propA === propB && valA !== valB) {\n  return { isConflict: true, reason: "Both modify property background-color" };\n}',
  };

  return (
    <div className="space-y-6 w-full">
      {/* Mode Toggle & Caption */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl cyber-glass border border-outline-variant/40 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-outline font-semibold uppercase">Scenario:</span>
          <div className="inline-flex rounded-2xl bg-surface-container-lowest p-1 border border-outline-variant/30 font-mono text-xs">
            <button
              onClick={() => setConflictMode('different')}
              className={`px-4 py-2 rounded-xl transition-all font-semibold flex items-center gap-2 ${
                conflictMode === 'different'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <span className="size-2 rounded-full bg-emerald-400" />
              <span>Different Properties (Auto-merge)</span>
            </button>
            <button
              onClick={() => setConflictMode('same')}
              className={`px-4 py-2 rounded-xl transition-all font-semibold flex items-center gap-2 ${
                conflictMode === 'same'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <span className="size-2 rounded-full bg-rose-400" />
              <span>Same Property (Conflict)</span>
            </button>
          </div>
        </div>

        <p className="text-xs font-mono text-on-surface-variant max-w-xl">
          {conflictMode === 'different' ? (
            <span className="text-emerald-300">
              Properties are orthogonal (text vs background-color). Ops merge into new version without conflict.
            </span>
          ) : (
            <span className="text-rose-300">
              Both patches modify background-color on #checkout-btn. Flagged as conflict; requires POST /conflicts/:id/resolve.
            </span>
          )}
        </p>
      </div>

      {/* Wide Interactive Git-Graph SVG */}
      <div className="p-5 sm:p-8 rounded-3xl cyber-glass border border-outline-variant/40 shadow-2xl overflow-hidden relative w-full">
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .conflict-dot {
              display: none !important;
            }
          }
        `}</style>
        <svg
          viewBox="0 0 1160 370"
          className="w-full h-auto select-none"
          role="img"
          aria-labelledby="conflict-title conflict-desc"
        >
          <title id="conflict-title">Git-Graph Conflict Detection Engine</title>
          <desc id="conflict-desc">
            Visual Git-graph showing concurrent branches on #checkout-btn resolving via auto-merge or conflict detection.
          </desc>

          <defs>
            <filter id="conflict-glow-wide" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ff3b81" floodOpacity="0.85" />
            </filter>

            <marker
              id="conflict-arrow-pink-wide"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ff3b81" />
            </marker>

            <marker
              id="conflict-arrow-green-wide"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>

            <marker
              id="conflict-arrow-red-wide"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
            </marker>

            {/* Git Branch Splitting Paths */}
            <path id="path-split-a-wide" d="M 280 165 C 330 165, 360 88, 410 88" />
            <path id="path-split-b-wide" d="M 280 195 C 330 195, 360 272, 410 272" />
            <path id="path-join-a-wide" d="M 770 88 C 820 88, 850 160, 890 165" />
            <path id="path-join-b-wide" d="M 770 272 C 820 272, 850 190, 890 185" />
          </defs>

          {/* ═══════════════════════════════════════════════════ */}
          {/* GIT BRANCH CURVES */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* Branch A Split Curve */}
          <path
            d="M 280 165 C 330 165, 360 88, 410 88"
            fill="none"
            stroke="#ff3b81"
            strokeWidth="3"
            markerEnd="url(#conflict-arrow-pink-wide)"
          />
          <circle r="4" fill="#ffb1c2" className="conflict-dot">
            <animateMotion dur="2.4s" repeatCount="indefinite">
              <mpath href="#path-split-a-wide" />
            </animateMotion>
          </circle>

          {/* Branch B Split Curve */}
          <path
            d="M 280 195 C 330 195, 360 272, 410 272"
            fill="none"
            stroke="#ff3b81"
            strokeWidth="3"
            markerEnd="url(#conflict-arrow-pink-wide)"
          />
          <circle r="4" fill="#ffb1c2" className="conflict-dot">
            <animateMotion dur="2.4s" repeatCount="indefinite">
              <mpath href="#path-split-b-wide" />
            </animateMotion>
          </circle>

          {/* Join Curves to Merge Node */}
          <path
            d="M 770 88 C 820 88, 850 160, 890 165"
            fill="none"
            stroke={conflictMode === 'different' ? '#10b981' : '#f43f5e'}
            strokeWidth="3"
            markerEnd={conflictMode === 'different' ? 'url(#conflict-arrow-green-wide)' : 'url(#conflict-arrow-red-wide)'}
          />
          <circle r="3.5" fill={conflictMode === 'different' ? '#6ee7b7' : '#fca5a5'} className="conflict-dot">
            <animateMotion dur="2.4s" repeatCount="indefinite">
              <mpath href="#path-join-a-wide" />
            </animateMotion>
          </circle>

          <path
            d="M 770 272 C 820 272, 850 190, 890 185"
            fill="none"
            stroke={conflictMode === 'different' ? '#10b981' : '#f43f5e'}
            strokeWidth="3"
            markerEnd={conflictMode === 'different' ? 'url(#conflict-arrow-green-wide)' : 'url(#conflict-arrow-red-wide)'}
          />
          <circle r="3.5" fill={conflictMode === 'different' ? '#6ee7b7' : '#fca5a5'} className="conflict-dot">
            <animateMotion dur="2.4s" repeatCount="indefinite">
              <mpath href="#path-join-b-wide" />
            </animateMotion>
          </circle>

          {/* ═══════════════════════════════════════════════════ */}
          {/* BASE VERSION NODE */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Base Version v1: Shared starting point on #checkout-btn"
            onClick={() => onSelectNode(baseNodeDetail)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectNode(baseNodeDetail)}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="60"
              y="135"
              width="220"
              height="90"
              rx="16"
              fill="#1b1b20"
              stroke={activeNodeId === 'base-version' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'base-version' ? '2.8' : '1.5'}
              filter={activeNodeId === 'base-version' ? 'url(#conflict-glow-wide)' : undefined}
            />
            <circle cx="90" cy="162" r="6" fill="#aa888e" />
            <text x="105" y="167" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Base Version v1
            </text>
            <text x="90" y="192" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              #checkout-btn
            </text>
            <text x="90" y="210" fill="#aa888e" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Live starting state
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* BRANCH A: DEV (BOB) */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Branch A: Bob edits #checkout-btn"
            onClick={() => onSelectNode(branchADetail)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectNode(branchADetail)}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="410"
              y="45"
              width="360"
              height="85"
              rx="14"
              fill="#24232a"
              stroke={activeNodeId === 'branch-a' ? '#ff3b81' : '#ff3b81'}
              strokeWidth={activeNodeId === 'branch-a' ? '2.8' : '1.5'}
              filter={activeNodeId === 'branch-a' ? 'url(#conflict-glow-wide)' : undefined}
            />
            <text x="435" y="74" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Branch A: Dev (Bob)
            </text>
            <text x="435" y="94" fill="#ffb1c2" fontSize="12" fontFamily="JetBrains Mono, monospace">
              #checkout-btn
            </text>
            <rect
              x="435"
              y="100"
              width="310"
              height="22"
              rx="5"
              fill="#1b1b20"
              stroke="#5a4045"
              strokeWidth="1"
            />
            <text x="445" y="115" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
              {conflictMode === 'different'
                ? 'text: "Complete Purchase"'
                : 'style: bg-color: #10b981'}
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* BRANCH B: ALICE */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Branch B: Alice edits #checkout-btn"
            onClick={() => onSelectNode(branchBDetail)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectNode(branchBDetail)}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="410"
              y="230"
              width="360"
              height="85"
              rx="14"
              fill="#24232a"
              stroke={activeNodeId === 'branch-b' ? '#ff3b81' : '#ff3b81'}
              strokeWidth={activeNodeId === 'branch-b' ? '2.8' : '1.5'}
              filter={activeNodeId === 'branch-b' ? 'url(#conflict-glow-wide)' : undefined}
            />
            <text x="435" y="259" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Branch B: Alice (Reviewer)
            </text>
            <text x="435" y="279" fill="#ffb1c2" fontSize="12" fontFamily="JetBrains Mono, monospace">
              #checkout-btn
            </text>
            <rect
              x="435"
              y="285"
              width="310"
              height="22"
              rx="5"
              fill="#1b1b20"
              stroke="#5a4045"
              strokeWidth="1"
            />
            <text x="445" y="300" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
              style: bg-color: #f43f5e
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* MERGE NODE: GREEN OR RED */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label={conflictMode === 'different' ? 'Auto-merge node' : 'Conflict resolution node'}
            onClick={() => onSelectNode(mergeNodeDetail)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectNode(mergeNodeDetail)}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="890"
              y="135"
              width="210"
              height="95"
              rx="16"
              fill={conflictMode === 'different' ? '#062e24' : '#381017'}
              stroke={conflictMode === 'different' ? '#10b981' : '#f43f5e'}
              strokeWidth={activeNodeId === 'merge-node' ? '3' : '2'}
              filter={activeNodeId === 'merge-node' ? 'url(#conflict-glow-wide)' : undefined}
            />
            <circle
              cx="915"
              cy="165"
              r="7"
              fill={conflictMode === 'different' ? '#10b981' : '#f43f5e'}
            />
            <text x="930" y="170" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              {conflictMode === 'different' ? 'Auto-Merge' : 'Conflict'}
            </text>
            <text
              x="915"
              y="194"
              fill={conflictMode === 'different' ? '#6ee7b7' : '#fca5a5'}
              fontSize="12"
              fontFamily="JetBrains Mono, monospace"
            >
              {conflictMode === 'different' ? 'Non-overlapping ops' : 'Requires resolution'}
            </text>
            <text
              x="915"
              y="214"
              fill={conflictMode === 'different' ? '#34d399' : '#f87171'}
              fontSize="12"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {conflictMode === 'different' ? 'Version v2 deployed' : 'POST /resolve'}
            </text>
          </g>
        </svg>
      </div>

      {/* Detail helper hints: Zero scrollbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono w-full">
        <div className="p-4 rounded-2xl bg-surface-container/60 border border-outline-variant/30 flex items-start gap-3">
          <span className="size-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
          <div>
            <span className="text-white font-bold text-sm block">Orthogonal Property Rule:</span>
            <p className="text-on-surface-variant text-xs leading-relaxed mt-0.5">
              Different properties on the same element (e.g. text edit + background color) auto-merge into the combined ops array without conflicts.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container/60 border border-outline-variant/30 flex items-start gap-3">
          <span className="size-2 rounded-full bg-rose-400 mt-1.5 shrink-0" />
          <div>
            <span className="text-white font-bold text-sm block">Collision Rule:</span>
            <p className="text-on-surface-variant text-xs leading-relaxed mt-0.5">
              Identical property modifications on the same element create a conflict record, blocking CAS merge until approved via POST /conflicts/:id/resolve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
