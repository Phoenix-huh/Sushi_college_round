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
  // Pre-mapped component detail objects
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
    <div className="space-y-6">
      {/* Interactive SVG Diagram */}
      <div className="p-4 sm:p-6 rounded-2xl cyber-glass border border-outline-variant/40 shadow-xl overflow-hidden relative">
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .topology-dot {
              display: none !important;
            }
          }
        `}</style>
        <svg
          viewBox="0 0 900 470"
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
            <filter id="pink-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ff3b81" floodOpacity="0.8" />
            </filter>

            {/* Marker Arrowheads */}
            <marker
              id="arrow-pink"
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
              id="arrow-slate"
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
            <path id="path-ext-server" d="M 160 100 L 160 160" />
            <path id="path-dash-server" d="M 450 100 L 450 160" />
            <path id="path-server-runtime" d="M 740 160 L 740 100" />
          </defs>

          {/* ═══════════════════════════════════════════════════ */}
          {/* CONNECTING ARROWS & LABELS */}
          {/* ═══════════════════════════════════════════════════ */}

          {/* 1. Extension -> Server (Save patch) */}
          <line
            x1="160"
            y1="100"
            x2="160"
            y2="155"
            stroke="#ff3b81"
            strokeWidth="2"
            markerEnd="url(#arrow-pink)"
          />
          {/* Traveling dot on arrow 1 */}
          <circle r="3.5" fill="#ffb1c2" className="topology-dot">
            <animateMotion dur="2.4s" repeatCount="indefinite">
              <mpath href="#path-ext-server" />
            </animateMotion>
          </circle>
          {/* Badge 1 */}
          <g transform="translate(160, 130)">
            <circle cx="0" cy="0" r="11" fill="#ff3b81" />
            <text x="0" y="4" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              1
            </text>
          </g>

          {/* 2. Dashboard <-> Server (Review and deploy) */}
          <line
            x1="450"
            y1="105"
            x2="450"
            y2="155"
            stroke="#ff3b81"
            strokeWidth="2"
            markerEnd="url(#arrow-pink)"
            markerStart="url(#arrow-pink)"
          />
          {/* Traveling dot on arrow 2 */}
          <circle r="3.5" fill="#ffb1c2" className="topology-dot">
            <animateMotion dur="2.8s" repeatCount="indefinite">
              <mpath href="#path-dash-server" />
            </animateMotion>
          </circle>
          {/* Badge 2 */}
          <g transform="translate(450, 130)">
            <circle cx="0" cy="0" r="11" fill="#ff3b81" />
            <text x="0" y="4" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              2
            </text>
          </g>

          {/* 3. Server -> Page Runtime (Runtime polls live version) */}
          <line
            x1="740"
            y1="160"
            x2="740"
            y2="105"
            stroke="#ff3b81"
            strokeWidth="2"
            markerEnd="url(#arrow-pink)"
          />
          {/* Traveling dot on arrow 3 */}
          <circle r="3.5" fill="#ffb1c2" className="topology-dot">
            <animateMotion dur="2.2s" repeatCount="indefinite">
              <mpath href="#path-server-runtime" />
            </animateMotion>
          </circle>
          {/* Badge 3 */}
          <g transform="translate(740, 130)">
            <circle cx="0" cy="0" r="11" fill="#ff3b81" />
            <text x="0" y="4" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              3
            </text>
          </g>

          {/* Server <-> Database Store */}
          <line
            x1="160"
            y1="225"
            x2="160"
            y2="275"
            stroke="#aa888e"
            strokeWidth="1.5"
            markerEnd="url(#arrow-slate)"
            markerStart="url(#arrow-slate)"
          />

          {/* Server -> Playwright */}
          <line
            x1="450"
            y1="225"
            x2="450"
            y2="275"
            stroke="#aa888e"
            strokeWidth="1.5"
            markerEnd="url(#arrow-slate)"
          />

          {/* Server -> Gemini */}
          <line
            x1="740"
            y1="225"
            x2="740"
            y2="275"
            stroke="#aa888e"
            strokeWidth="1.5"
            markerEnd="url(#arrow-slate)"
          />

          {/* Connectors to packages/shared */}
          <path
            d="M 160 345 L 160 380 L 450 380 L 450 390 M 740 345 L 740 380"
            fill="none"
            stroke="#5a4045"
            strokeWidth="1.5"
            strokeDasharray="4 4"
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
              x="40"
              y="30"
              width="240"
              height="70"
              rx="12"
              fill="#1b1b20"
              stroke={activeNodeId === 'extension' ? '#ff3b81' : '#aa888e'}
              strokeWidth={activeNodeId === 'extension' ? '2.5' : '1.2'}
              filter={activeNodeId === 'extension' ? 'url(#pink-glow)' : undefined}
            />
            <circle cx="65" cy="53" r="5" fill="#ff3b81" />
            <text x="78" y="57" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="Syne, sans-serif">
              Chrome Extension
            </text>
            <text x="65" y="80" fill="#d4b8be" fontSize="11" fontFamily="JetBrains Mono, monospace">
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
              x="330"
              y="30"
              width="240"
              height="70"
              rx="12"
              fill="#1b1b20"
              stroke={activeNodeId === 'dashboard' ? '#ff3b81' : '#aa888e'}
              strokeWidth={activeNodeId === 'dashboard' ? '2.5' : '1.2'}
              filter={activeNodeId === 'dashboard' ? 'url(#pink-glow)' : undefined}
            />
            <circle cx="355" cy="53" r="5" fill="#ffb1c2" />
            <text x="368" y="57" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="Syne, sans-serif">
              Dashboard Console
            </text>
            <text x="355" y="80" fill="#d4b8be" fontSize="11" fontFamily="JetBrains Mono, monospace">
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
              x="620"
              y="30"
              width="240"
              height="70"
              rx="12"
              fill="#1b1b20"
              stroke={activeNodeId === 'runtime' ? '#ff3b81' : '#aa888e'}
              strokeWidth={activeNodeId === 'runtime' ? '2.5' : '1.2'}
              filter={activeNodeId === 'runtime' ? 'url(#pink-glow)' : undefined}
            />
            <circle cx="645" cy="53" r="5" fill="#ff3b81" />
            <text x="658" y="57" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="Syne, sans-serif">
              Page Runtime
            </text>
            <text x="645" y="80" fill="#d4b8be" fontSize="11" fontFamily="JetBrains Mono, monospace">
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
              x="40"
              y="160"
              width="820"
              height="65"
              rx="14"
              fill="#24232a"
              stroke={activeNodeId === 'server' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'server' ? '2.5' : '1.4'}
              filter={activeNodeId === 'server' ? 'url(#pink-glow)' : undefined}
            />
            <text x="70" y="198" fill="#ffffff" fontSize="15" fontWeight="bold" fontFamily="Syne, sans-serif">
              Fastify API Server
            </text>
            <text x="235" y="198" fill="#ffb1c2" fontSize="11" fontFamily="JetBrains Mono, monospace">
              Port 4000 control plane & CAS engine
            </text>
            <text x="590" y="198" fill="#aa888e" fontSize="11" fontFamily="JetBrains Mono, monospace">
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
              x="40"
              y="275"
              width="240"
              height="70"
              rx="12"
              fill="#1b1b20"
              stroke={activeNodeId === 'store' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'store' ? '2.5' : '1.2'}
              filter={activeNodeId === 'store' ? 'url(#pink-glow)' : undefined}
            />
            <text x="65" y="303" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="Syne, sans-serif">
              Database Store
            </text>
            <text x="65" y="325" fill="#d4b8be" fontSize="11" fontFamily="JetBrains Mono, monospace">
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
              x="330"
              y="275"
              width="240"
              height="70"
              rx="12"
              fill="#1b1b20"
              stroke={activeNodeId === 'playwright' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'playwright' ? '2.5' : '1.2'}
              filter={activeNodeId === 'playwright' ? 'url(#pink-glow)' : undefined}
            />
            <text x="355" y="303" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="Syne, sans-serif">
              Playwright Sandbox
            </text>
            <text x="355" y="325" fill="#d4b8be" fontSize="11" fontFamily="JetBrains Mono, monospace">
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
              x="620"
              y="275"
              width="240"
              height="70"
              rx="12"
              fill="#1b1b20"
              stroke={activeNodeId === 'gemini' ? '#ff3b81' : '#5a4045'}
              strokeWidth={activeNodeId === 'gemini' ? '2.5' : '1.2'}
              filter={activeNodeId === 'gemini' ? 'url(#pink-glow)' : undefined}
            />
            <text x="645" y="303" fill="#ffffff" fontSize="13" fontWeight="bold" fontFamily="Syne, sans-serif">
              Gemini 3.8 Flash
            </text>
            <text x="645" y="325" fill="#d4b8be" fontSize="11" fontFamily="JetBrains Mono, monospace">
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
              x="40"
              y="390"
              width="820"
              height="55"
              rx="12"
              fill="#151419"
              stroke={activeNodeId === 'shared' ? '#ff3b81' : '#353439'}
              strokeWidth={activeNodeId === 'shared' ? '2.5' : '1.2'}
              filter={activeNodeId === 'shared' ? 'url(#pink-glow)' : undefined}
            />
            <text x="70" y="423" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="Syne, sans-serif">
              packages/shared
            </text>
            <text x="210" y="423" fill="#d4b8be" fontSize="11" fontFamily="JetBrains Mono, monospace">
              Schemas, targeting locators, and conflict rules
            </text>
            <text x="710" y="423" fill="#aa888e" fontSize="11" fontFamily="JetBrains Mono, monospace">
              TypeScript Monorepo Core
            </text>
          </g>
        </svg>

        {/* Legend for 1, 2, 3 numbered badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-3 border-t border-outline-variant/30 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-[10px]">
              1
            </span>
            <span className="text-on-surface">Save patch</span>
            <span className="text-outline text-[10px]">({getRouteString('POST', '/patches')})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-[10px]">
              2
            </span>
            <span className="text-on-surface">Review and deploy</span>
            <span className="text-outline text-[10px]">({getRouteString('POST', '/deploy')})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-[10px]">
              3
            </span>
            <span className="text-on-surface">Runtime polls live version</span>
            <span className="text-outline text-[10px]">({getRouteString('GET', '/deployments/live')})</span>
          </div>
        </div>
      </div>

      {/* Horizontal Lifecycle Stepper */}
      <div className="p-5 rounded-2xl cyber-glass border border-outline-variant/40 space-y-3 font-mono">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            7-Stage Hotfix Lifecycle Stepper
          </span>
          <span className="text-[11px] text-outline">Click any pill for details</span>
        </div>

        {/* Stepper pills row */}
        <div className="relative pt-2 pb-1 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[700px] gap-2">
            {LIFECYCLE_STAGES.map((stage, idx) => {
              const isSelected = activeNodeId === stage.id;
              return (
                <React.Fragment key={stage.id}>
                  <button
                    onClick={() => handleStageClick(idx)}
                    className={`px-3 py-2 rounded-xl text-left border transition-all text-xs font-mono shrink-0 flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-primary ${
                      isSelected
                        ? 'bg-primary-container text-white border-primary-container shadow-md cyber-glow-tab'
                        : 'bg-surface-container/80 text-on-surface hover:text-white border-outline-variant/30 hover:border-primary/50'
                    }`}
                  >
                    <span className="text-[10px] font-bold opacity-80">0{stage.step}</span>
                    <span className="font-semibold">{stage.name}</span>
                  </button>
                  {idx < LIFECYCLE_STAGES.length - 1 && (
                    <div className="flex-1 h-0.5 bg-outline-variant/40 min-w-[12px]" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
