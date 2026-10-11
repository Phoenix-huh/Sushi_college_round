import React from 'react';
import type { NodeDetail } from './NodeDetailPanel';
import {
  LIFECYCLE_STAGES,
  getRouteString,
  CODEBASE_FACTS,
} from '../../lib/lifecycle';

interface TopologyDiagramProps {
  activeNodeId: string | null;
  onSelectNode: (node: NodeDetail) => void;
}

export function TopologyDiagram({
  activeNodeId,
  onSelectNode,
}: TopologyDiagramProps) {
  const nodeDetailsMap: Record<string, NodeDetail> = {
    extension: {
      id: 'extension',
      title: 'Chrome MV3 Extension',
      subtitle: 'Visual DOM editor & content scripts',
      category: 'Authoring Layer',
      badge: 'apps/extension',
      color: 'primary',
      route: getRouteString('POST', '/patches'),
      description:
        'Manifest V3 browser extension with point-and-click element picker, visual property modifier, and sidepanel cockpit for authoring draft patches.',
      bullets: [
        'Content script captures 6 anchor fields: CSS selector, XPath, text, attributes, parent, sibling',
        'Directly dispatches POST /patches or calls Gemini route for instant draft creation',
        'Runs preview overlay in isolated DOM context without mutating page bundle',
      ],
      code: 'npm run build -w apps/extension\n// Loads unpacked in chrome://extensions',
      meta: {
        Runtime: 'Chrome MV3',
        Target: 'Any live web tab',
      },
    },
    dashboard: {
      id: 'dashboard',
      title: 'React Dashboard Console',
      subtitle: 'Vite management cockpit on :5173',
      category: 'Control Cockpit',
      badge: 'apps/dashboard',
      color: 'primary',
      route: getRouteString('POST', '/deploy'),
      description:
        'Single-page application cockpit built with React, Vite, and Tailwind. Manages patch lifecycles, reviewer sign-offs, conflict resolutions, and deployments.',
      bullets: [
        'Enforces reviewer approvals (author cannot approve own patch)',
        'Renders 3-way property conflict diffs and resolution decisions',
        'Triggers Playwright visual regression runs and manual rollbacks',
      ],
      meta: {
        Port: '5173',
        Framework: 'React 18 + Vite',
      },
    },
    runtime: {
      id: 'runtime',
      title: 'Page Runtime Script',
      subtitle: 'Client script on target storefront',
      category: 'Target App',
      badge: 'apps/demo-site',
      color: 'primary',
      route: getRouteString('GET', '/deployments/live'),
      description:
        'Lightweight JavaScript runtime (`patchwork-runtime.js`) embedded into target web pages. Periodically polls the server for live version bundles and patches DOM.',
      bullets: [
        `Polls ${getRouteString('GET', '/deployments/live')} every ${CODEBASE_FACTS.runtimePollingIntervalMs}ms with Cache-Control: no-store`,
        'Phase 1 resolves all targets before changing anything; Phase 2 executes DOM operations',
        `MutationObserver (${CODEBASE_FACTS.mutationObserverDebounceMs}ms debounce) reapplies patches when dynamic SPAs re-render`,
      ],
      code: 'GET /deployments/live\nCache-Control: no-store\n=> { version_id, ops: [...] }',
      meta: {
        Polling: `${CODEBASE_FACTS.runtimePollingIntervalMs}ms`,
        Observer: 'Active',
      },
    },
    server: {
      id: 'server',
      title: 'Fastify API Server',
      subtitle: 'Port 4000 control plane & orchestrator',
      category: 'Infrastructure',
      badge: 'apps/server',
      color: 'neutral',
      route: getRouteString('GET', '/health'),
      description:
        'Core Fastify server handling atomic CAS merges, version increment bundles, conflict detection, deployment manifests, and audit trail logging.',
      bullets: [
        'Validates compare-and-swap (CAS) base version when patches are merged',
        'Synthesizes merged operations snapshots and creates immutable Version bundles',
        'Falls back to in-memory store when Supabase credentials are not configured or unreachable',
      ],
      meta: {
        Port: '4000',
        Engine: 'Fastify + TypeScript',
      },
    },
    store: {
      id: 'store',
      title: 'Database Store Layer',
      subtitle: 'Supabase PostgreSQL or memory store',
      category: 'Persistence',
      badge: 'apps/server/src/store.ts',
      color: 'neutral',
      description:
        'Persists patches, versions, deployments, conflict records, and audit events. Automatically checks connection health on startup.',
      bullets: [
        'Primary storage: Supabase PostgreSQL tables (patches, versions, deployments, audit_events)',
        'Fallback storage: In-memory store (active if Supabase credentials missing or unreachable)',
        'In-memory fallback loses data on server restart',
      ],
      meta: {
        Mode: 'Supabase / In-Memory',
        Tables: '4 core schemas',
      },
    },
    playwright: {
      id: 'playwright',
      title: 'Playwright Sandbox',
      subtitle: 'Headless checkout visual verification',
      category: 'Verification',
      badge: 'apps/server/src/services/verifier.ts',
      color: 'neutral',
      route: getRouteString('POST', '/verify'),
      description:
        'Headless Chromium pipeline running synthetic checkout journeys against the target web application with pixel-level screenshot diffing.',
      bullets: [
        `Verifies DOM stability using ${CODEBASE_FACTS.verificationEngine}`,
        'Executed post-deploy or on-demand via POST /verify',
        'If verification fails on a live version, the server initiates an automatic reactive rollback',
      ],
      meta: {
        Engine: CODEBASE_FACTS.verificationEngine,
        Browser: 'Chromium headless',
      },
    },
    gemini: {
      id: 'gemini',
      title: 'Gemini 3.8 Flash AI',
      subtitle: 'Natural language patch authoring',
      category: 'AI Service',
      badge: 'apps/server/src/services/ai.ts',
      color: 'neutral',
      route: getRouteString('POST', '/ai/patch'),
      description:
        'Google Gemini endpoint transforming natural language instructions into structured patch JSON payloads with multi-anchor targeting locators.',
      bullets: [
        `Uses model: ${CODEBASE_FACTS.geminiModel}`,
        'Generates complete patch schema with anchors, change type, and fallback tokens',
        'Gracefully falls back to heuristic keyword rules if GEMINI_API_KEY is not set',
      ],
      meta: {
        Model: CODEBASE_FACTS.geminiModel,
        Fallback: 'Rule heuristics',
      },
    },
    shared: {
      id: 'shared',
      title: 'Shared Monorepo Core',
      subtitle: 'Schemas, targeting, conflict rules',
      category: 'Shared Package',
      badge: 'packages/shared',
      color: 'neutral',
      description:
        'Universal TypeScript module imported across the extension, server, dashboard, and demo-site. Houses shared Zod schemas and targeting algorithms.',
      bullets: [
        `Defines 8 change types: ${CODEBASE_FACTS.changeTypes.join(', ')}`,
        `Defines 6 anchor types: ${CODEBASE_FACTS.anchors.join(', ')}`,
        `Fuzzy Jaccard token matcher with threshold >= ${CODEBASE_FACTS.jaccardHealingThreshold}`,
      ],
      meta: {
        Package: 'packages/shared',
        Types: `${CODEBASE_FACTS.changeTypeCount} changes, ${CODEBASE_FACTS.anchorCount} anchors`,
      },
    },
  };

  const handleNodeClick = (id: string) => {
    if (nodeDetailsMap[id]) {
      onSelectNode(nodeDetailsMap[id]);
    }
  };

  const handleStageClick = (stepIndex: number) => {
    const stage = LIFECYCLE_STAGES[stepIndex];
    if (stage) {
      onSelectNode({
        id: stage.id,
        title: `0${stage.step}. ${stage.name}`,
        subtitle: stage.summary,
        category: 'Lifecycle Stage',
        badge: `Status: ${stage.resultingStatus}`,
        route: stage.route,
        color: 'primary',
        description: stage.description,
        bullets: stage.details,
      });
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Wide Interactive SVG Diagram */}
      <div className="p-5 sm:p-8 rounded-3xl cyber-glass border border-outline-variant/40 shadow-2xl overflow-hidden relative w-full">
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .topology-dot {
              display: none !important;
            }
          }
        `}</style>
        <svg
          viewBox="0 0 1160 480"
          className="w-full h-auto select-none"
          role="img"
          aria-labelledby="topology-title topology-desc"
        >
          <title id="topology-title">Patchwork System Topology</title>
          <desc id="topology-desc">
            Inter-module architecture diagram showing Chrome Extension, Dashboard, Fastify Server, backing services, and packages/shared.
          </desc>

          <defs>
            {/* Glow Filter */}
            <filter id="pink-glow-wide" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ff3b81" floodOpacity="0.85" />
            </filter>

            {/* Marker Arrowheads */}
            <marker
              id="arrow-pink-wide"
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
              id="arrow-slate-wide"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#aa888e" />
            </marker>

            {/* Motion Paths for Traveling Dots */}
            <path id="path-ext-server-wide" d="M 220 105 L 220 165" />
            <path id="path-dash-server-wide" d="M 580 105 L 580 165" />
            <path id="path-server-runtime-wide" d="M 940 165 L 940 105" />
          </defs>

          {/* ═══════════════════════════════════════════════════ */}
          {/* CONNECTING ARROWS & NUMBERED BADGES */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* 1. Extension -> Server (Save patch) */}
          <line
            x1="220"
            y1="105"
            x2="220"
            y2="160"
            stroke="#ff3b81"
            strokeWidth="2.5"
            markerEnd="url(#arrow-pink-wide)"
          />
          <circle r="4" fill="#ffb1c2" className="topology-dot">
            <animateMotion dur="2.4s" repeatCount="indefinite">
              <mpath href="#path-ext-server-wide" />
            </animateMotion>
          </circle>
          <g transform="translate(220, 135)">
            <circle cx="0" cy="0" r="12" fill="#ff3b81" />
            <text x="0" y="4.5" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              1
            </text>
          </g>

          {/* 2. Dashboard <-> Server (Review and deploy) */}
          <line
            x1="580"
            y1="110"
            x2="580"
            y2="160"
            stroke="#ff3b81"
            strokeWidth="2.5"
            markerEnd="url(#arrow-pink-wide)"
            markerStart="url(#arrow-pink-wide)"
          />
          <circle r="4" fill="#ffb1c2" className="topology-dot">
            <animateMotion dur="2.8s" repeatCount="indefinite">
              <mpath href="#path-dash-server-wide" />
            </animateMotion>
          </circle>
          <g transform="translate(580, 135)">
            <circle cx="0" cy="0" r="12" fill="#ff3b81" />
            <text x="0" y="4.5" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              2
            </text>
          </g>

          {/* 3. Server -> Page Runtime (Runtime polls live version) */}
          <line
            x1="940"
            y1="165"
            x2="940"
            y2="110"
            stroke="#ff3b81"
            strokeWidth="2.5"
            markerEnd="url(#arrow-pink-wide)"
          />
          <circle r="4" fill="#ffb1c2" className="topology-dot">
            <animateMotion dur="2.2s" repeatCount="indefinite">
              <mpath href="#path-server-runtime-wide" />
            </animateMotion>
          </circle>
          <g transform="translate(940, 135)">
            <circle cx="0" cy="0" r="12" fill="#ff3b81" />
            <text x="0" y="4.5" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              3
            </text>
          </g>

          {/* Server <-> Database Store */}
          <line
            x1="220"
            y1="235"
            x2="220"
            y2="285"
            stroke="#aa888e"
            strokeWidth="2"
            markerEnd="url(#arrow-slate-wide)"
            markerStart="url(#arrow-slate-wide)"
          />

          {/* Server -> Playwright */}
          <line
            x1="580"
            y1="235"
            x2="580"
            y2="285"
            stroke="#aa888e"
            strokeWidth="2"
            markerEnd="url(#arrow-slate-wide)"
          />

          {/* Server -> Gemini */}
          <line
            x1="940"
            y1="235"
            x2="940"
            y2="285"
            stroke="#aa888e"
            strokeWidth="2"
            markerEnd="url(#arrow-slate-wide)"
          />

          {/* Connectors to packages/shared */}
          <path
            d="M 220 365 L 220 395 L 580 395 L 580 405 M 940 365 L 940 395"
            fill="none"
            stroke="#5a4045"
            strokeWidth="1.8"
            strokeDasharray="5 5"
          />

          {/* ═══════════════════════════════════════════════════ */}
          {/* ROW 1: CLIENT & TARGET LAYER */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* Box 1: Chrome MV3 Extension */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Chrome MV3 Extension: Visual DOM editor"
            onClick={() => handleNodeClick('extension')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('extension')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="60"
              y="30"
              width="320"
              height="75"
              rx="14"
              fill="#1b1b20"
              stroke={activeNodeId === 'extension' ? '#ff3b81' : '#aa888e'}
              strokeWidth={activeNodeId === 'extension' ? '2.5' : '1.4'}
              filter={activeNodeId === 'extension' ? 'url(#pink-glow-wide)' : undefined}
            />
            <circle cx="90" cy="55" r="5.5" fill="#ff3b81" />
            <text x="106" y="60" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Chrome Extension
            </text>
            <text x="90" y="85" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              MV3 visual DOM editor
            </text>
          </g>

          {/* Box 2: React Dashboard */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Dashboard Console: Vite React cockpit"
            onClick={() => handleNodeClick('dashboard')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('dashboard')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="420"
              y="30"
              width="320"
              height="75"
              rx="14"
              fill="#1b1b20"
              stroke={activeNodeId === 'dashboard' ? '#ff3b81' : '#aa888e'}
              strokeWidth={activeNodeId === 'dashboard' ? '2.5' : '1.4'}
              filter={activeNodeId === 'dashboard' ? 'url(#pink-glow-wide)' : undefined}
            />
            <circle cx="450" cy="55" r="5.5" fill="#ffb1c2" />
            <text x="466" y="60" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Dashboard Console
            </text>
            <text x="450" y="85" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Vite cockpit on :5173
            </text>
          </g>

          {/* Box 3: Page Runtime */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Page Runtime: Live script polling manifest"
            onClick={() => handleNodeClick('runtime')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('runtime')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="780"
              y="30"
              width="320"
              height="75"
              rx="14"
              fill="#1b1b20"
              stroke={activeNodeId === 'runtime' ? '#ff3b81' : '#aa888e'}
              strokeWidth={activeNodeId === 'runtime' ? '2.5' : '1.4'}
              filter={activeNodeId === 'runtime' ? 'url(#pink-glow-wide)' : undefined}
            />
            <circle cx="810" cy="55" r="5.5" fill="#ff3b81" />
            <text x="826" y="60" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Page Runtime
            </text>
            <text x="810" y="85" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Live script polling manifest
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* ROW 2: FASTIFY API SERVER (WIDE BAR) */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Fastify API Server: Port 4000 control plane"
            onClick={() => handleNodeClick('server')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('server')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="60"
              y="165"
              width="1040"
              height="70"
              rx="16"
              fill="#24232a"
              stroke={activeNodeId === 'server' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'server' ? '2.8' : '1.5'}
              filter={activeNodeId === 'server' ? 'url(#pink-glow-wide)' : undefined}
            />
            <text x="95" y="206" fill="#ffffff" fontSize="16" fontWeight="bold" fontFamily="Syne, sans-serif">
              Fastify API Server
            </text>
            <text x="290" y="206" fill="#ffb1c2" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Port 4000 control plane & CAS engine
            </text>
            <text x="880" y="206" fill="#aa888e" fontSize="12" fontFamily="JetBrains Mono, monospace">
              apps/server
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* ROW 3: BACKING SERVICES */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* Box 4: Database Store */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Database Store: Supabase or memory fallback"
            onClick={() => handleNodeClick('store')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('store')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="60"
              y="290"
              width="320"
              height="75"
              rx="14"
              fill="#1b1b20"
              stroke={activeNodeId === 'store' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'store' ? '2.5' : '1.3'}
              filter={activeNodeId === 'store' ? 'url(#pink-glow-wide)' : undefined}
            />
            <text x="90" y="320" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Database Store
            </text>
            <text x="90" y="344" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Supabase or memory fallback
            </text>
          </g>

          {/* Box 5: Playwright Sandbox */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Playwright Sandbox: Headless checkout visual verification"
            onClick={() => handleNodeClick('playwright')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('playwright')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="420"
              y="290"
              width="320"
              height="75"
              rx="14"
              fill="#1b1b20"
              stroke={activeNodeId === 'playwright' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'playwright' ? '2.5' : '1.3'}
              filter={activeNodeId === 'playwright' ? 'url(#pink-glow-wide)' : undefined}
            />
            <text x="450" y="320" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Playwright Sandbox
            </text>
            <text x="450" y="344" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Headless checkout verification
            </text>
          </g>

          {/* Box 6: Gemini 3.8 Flash */}
          <g
            role="button"
            tabIndex={0}
            aria-label="Gemini 3.8 Flash: Natural language AI patch route"
            onClick={() => handleNodeClick('gemini')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('gemini')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="780"
              y="290"
              width="320"
              height="75"
              rx="14"
              fill="#1b1b20"
              stroke={activeNodeId === 'gemini' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'gemini' ? '2.5' : '1.3'}
              filter={activeNodeId === 'gemini' ? 'url(#pink-glow-wide)' : undefined}
            />
            <text x="810" y="320" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              Gemini 3.8 Flash
            </text>
            <text x="810" y="344" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Natural language AI route
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════ */}
          {/* BOTTOM BAR: PACKAGES/SHARED */}
          {/* ═══════════════════════════════════════════════════ */}
          <g
            role="button"
            tabIndex={0}
            aria-label="packages/shared: Schemas, targeting, conflict rules"
            onClick={() => handleNodeClick('shared')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNodeClick('shared')}
            className="cursor-pointer transition-transform hover:opacity-95 focus:outline-none"
          >
            <rect
              x="60"
              y="410"
              width="1040"
              height="55"
              rx="14"
              fill="#151419"
              stroke={activeNodeId === 'shared' ? '#ff3b81' : '#353439'}
              strokeWidth={activeNodeId === 'shared' ? '2.5' : '1.3'}
              filter={activeNodeId === 'shared' ? 'url(#pink-glow-wide)' : undefined}
            />
            <text x="95" y="443" fill="#ffffff" fontSize="15" fontWeight="bold" fontFamily="Syne, sans-serif">
              packages/shared
            </text>
            <text x="270" y="443" fill="#d4b8be" fontSize="12" fontFamily="JetBrains Mono, monospace">
              Schemas, targeting locators, and conflict rules
            </text>
            <text x="880" y="443" fill="#aa888e" fontSize="12" fontFamily="JetBrains Mono, monospace">
              TypeScript Monorepo Core
            </text>
          </g>
        </svg>

        {/* Legend for 1, 2, 3 numbered badges */}
        <div className="flex flex-wrap items-center justify-center gap-8 pt-4 border-t border-outline-variant/30 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-[11px]">
              1
            </span>
            <span className="text-on-surface">Save patch</span>
            <span className="text-outline text-[11px]">({getRouteString('POST', '/patches')})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-[11px]">
              2
            </span>
            <span className="text-on-surface">Review and deploy</span>
            <span className="text-outline text-[11px]">({getRouteString('POST', '/deploy')})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-[11px]">
              3
            </span>
            <span className="text-on-surface">Runtime polls live version</span>
            <span className="text-outline text-[11px]">({getRouteString('GET', '/deployments/live')})</span>
          </div>
        </div>
      </div>

      {/* 7-Stage Lifecycle Stepper: Zero Scroll Wheel / Zero Horizontal Scrollbar */}
      <div className="p-6 rounded-3xl cyber-glass border border-outline-variant/40 space-y-4 font-mono shadow-xl w-full">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 pb-3">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            7-Stage Hotfix Lifecycle Stepper
          </span>
          <span className="text-[11px] text-outline">Click any stage pill for complete details</span>
        </div>

        {/* Responsive grid that fits all 7 items on desktop with zero scrollbar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const isSelected = activeNodeId === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => handleStageClick(idx)}
                className={`p-3 rounded-2xl text-left border transition-all text-xs font-mono flex flex-col justify-between gap-2 focus:outline-none focus:ring-1 focus:ring-primary ${
                  isSelected
                    ? 'bg-primary-container text-white border-primary-container shadow-lg cyber-glow-tab'
                    : 'bg-surface-container/70 text-on-surface hover:text-white border-outline-variant/30 hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold opacity-80 px-1.5 py-0.5 rounded bg-surface-container-lowest border border-outline-variant/20">
                    0{stage.step}
                  </span>
                  <span className="text-[10px] text-outline truncate max-w-[85px]" title={stage.resultingStatus}>
                    {stage.resultingStatus}
                  </span>
                </div>
                <span className="font-semibold text-xs leading-snug">{stage.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
