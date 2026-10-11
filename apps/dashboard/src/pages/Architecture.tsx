import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Cpu,
  GitMerge,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Workflow,
  Eye,
  RefreshCw,
  Terminal,
  Sparkles,
  Zap,
  Code2,
  Database,
  Layout,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';
import { DEMO_URL } from '../lib/api';
import {
  LIFECYCLE_STAGES,
  HEALING_TIERS,
  STATUS_METADATA,
  CODEBASE_FACTS,
  type PatchStatus,
  type HealingTier,
} from '../lib/lifecycle';

type TabKey = 'all' | 'topology' | 'auto-heal' | 'merge' | 'audit';

interface DiagramNavTab {
  id: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DIAGRAM_NAV_TABS: DiagramNavTab[] = [
  { id: 'all', label: 'All Diagrams', icon: Workflow },
  { id: 'topology', label: '1. System Topology', icon: Layers },
  { id: 'auto-heal', label: '2. Multi-Anchor Healer', icon: Sparkles },
  { id: 'merge', label: '3. Element + Property Conflicts', icon: GitMerge },
  { id: 'audit', label: '4. Audit & Rollback', icon: ShieldCheck },
];

const AUDIT_SAMPLE_EVENTS = [
  {
    id: '7b8f2c11-92e1-4561-8ca0-128f9d01e47a',
    event_type: 'patch_created',
    actor_id: '11111111-1111-1111-1111-111111111111',
    entity_id: '4a1e9b20-6d3f-42a1-b844-09c3e1b7f001',
    created_at: '2026-10-10T14:32:00.000Z',
    details: { title: 'Checkout CTA copy', selector: '#checkout-btn', change_type: 'text' },
  },
  {
    id: 'c41a0833-241b-4f90-a312-d891b6e40992',
    event_type: 'patch_submitted',
    actor_id: '11111111-1111-1111-1111-111111111111',
    entity_id: '4a1e9b20-6d3f-42a1-b844-09c3e1b7f001',
    created_at: '2026-10-10T14:35:10.000Z',
    details: { base_version: 1, rebased: true },
  },
  {
    id: 'f93d17a2-6804-4ec2-9e51-ba091176c4e0',
    event_type: 'patch_approved',
    actor_id: '22222222-2222-2222-2222-222222222222',
    entity_id: '4a1e9b20-6d3f-42a1-b844-09c3e1b7f001',
    created_at: '2026-10-10T14:36:45.000Z',
    details: { decision: 'approved', comment: 'Verified against current layout' },
  },
  {
    id: 'a881bc44-5510-4821-bc10-ef021948ba23',
    event_type: 'version_created',
    actor_id: '22222222-2222-2222-2222-222222222222',
    entity_id: 'e1029384-a1b2-4c3d-8e9f-0123456789ab',
    created_at: '2026-10-10T14:38:00.000Z',
    details: { version_number: 2, patch_count: 2 },
  },
  {
    id: 'd018274f-9912-4018-8f12-7819203918a2',
    event_type: 'deployment_created',
    actor_id: '22222222-2222-2222-2222-222222222222',
    entity_id: 'd9911223-4455-6677-8899-aabbccddeeff',
    created_at: '2026-10-10T14:38:01.000Z',
    details: { version_number: 2, patch_ids: ['4a1e9b20-6d3f-42a1-b844-09c3e1b7f001'] },
  },
];

export function Architecture() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedHealTier, setSelectedHealTier] = useState<number>(1);

  const currentTierData: HealingTier =
    HEALING_TIERS.find((t) => t.tier === selectedHealTier) ?? HEALING_TIERS[0];

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex flex-col justify-between font-body text-on-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14 w-full space-y-12">
        {/* Hero Header Banner */}
        <div className="relative p-8 md:p-10 rounded-3xl cyber-glass border border-outline-variant/40 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-container/15 blur-[120px] pointer-events-none rounded-full" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-secondary-container/20 blur-[100px] pointer-events-none rounded-full" />

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-container/90 border border-primary-container/40 text-xs font-mono shadow-sm">
              <span className="size-2 rounded-full bg-primary-container animate-pulse" />
              <span className="text-primary-fixed-dim uppercase tracking-wider font-semibold">PATCHWORK SYSTEM</span>
              <span className="text-outline">/</span>
              <span className="text-primary font-bold">ARCHITECTURE.md</span>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <span>Live Demo</span>
                <ExternalLink className="w-3.5 h-3.5 text-primary" />
              </a>
              <Link
                to="/patches"
                className="px-4 py-1.5 rounded-full bg-primary-container hover:bg-[#ff1e70] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cyber-glow-tab"
              >
                <span>Launch Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <h1 className="font-headline font-black text-3xl sm:text-5xl md:text-6xl text-white tracking-tight uppercase leading-tight mb-4 relative z-10">
            System Topology & <br />
            <span className="text-primary">DOM Runtime Architecture</span>
          </h1>

          <p className="font-mono text-sm sm:text-base text-on-surface-variant max-w-3xl leading-relaxed relative z-10">
            Patchwork patches live web applications in production without rebuilds or redeployments.
            Patches are authored via Chrome MV3 extension or natural-language Gemini instructions, validated through
            element + property conflict detection, verified in headless Playwright sandboxes, and applied in the page runtime.
          </p>

          {/* Verifiable Codebase Fact Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-outline-variant/30 mt-8 text-xs font-mono relative z-10">
            <div className="p-3 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
              <div className="text-outline text-[11px] mb-1">ANCHOR TYPES</div>
              <div className="text-lg font-bold text-primary">{CODEBASE_FACTS.anchorCount} Anchors</div>
              <div className="text-[10px] text-on-surface-variant truncate">CSS, XPath, Text, Attrs, Parent, Sibling</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
              <div className="text-outline text-[11px] mb-1">CHANGE TYPES</div>
              <div className="text-lg font-bold text-primary">{CODEBASE_FACTS.changeTypeCount} Types</div>
              <div className="text-[10px] text-on-surface-variant truncate">text, style, visibility, script, attr, remove...</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
              <div className="text-outline text-[11px] mb-1">VERIFICATION ENGINE</div>
              <div className="text-lg font-bold text-primary">Playwright</div>
              <div className="text-[10px] text-on-surface-variant">Chromium checkout flow + Pixelmatch</div>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30">
              <div className="text-outline text-[11px] mb-1">RUNTIME POLLING</div>
              <div className="text-lg font-bold text-primary">{CODEBASE_FACTS.runtimePollingIntervalMs} ms</div>
              <div className="text-[10px] text-on-surface-variant">GET /deployments/live (no-store)</div>
            </div>
          </div>
        </div>

        {/* Diagram Navigator Tabs */}
        <div
          role="tablist"
          aria-label="Architecture Diagrams"
          className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-outline-variant/30 font-mono text-xs scrollbar-none"
        >
          <span className="text-outline uppercase text-[11px] tracking-wider mr-2 shrink-0">Diagrams:</span>
          {DIAGRAM_NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 font-semibold ${
                  isActive
                    ? 'bg-primary-container text-white cyber-glow-tab'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-white border border-outline-variant/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* DIAGRAM 1: FULL SYSTEM TOPOLOGY & INTER-MODULE DATA FLOW */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'topology') && (
          <section id="panel-topology" role="tabpanel" aria-labelledby="tab-topology" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase font-bold tracking-wider mb-1">
                  <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/30">DIAGRAM 01</span>
                  <span>SYSTEM TOPOLOGY & MODULES</span>
                </div>
                <h2 className="font-headline font-black text-2xl sm:text-3xl text-white">
                  Inter-Module Architecture & Lifecycle Flow
                </h2>
              </div>
              <p className="text-xs font-mono text-outline max-w-md">
                Covers every tier in the monorepo: Chrome Extension, Dashboard, Fastify Server, Supabase/Memory Store, Gemini AI, Playwright, and Page Runtime.
              </p>
            </div>

            {/* Architecture Box with SVG Connectivity */}
            <div className="p-6 md:p-8 rounded-3xl cyber-glass border border-outline-variant/40 space-y-8 shadow-xl">
              {/* Component Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Client / Authoring Layer */}
                <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-container/20 text-primary uppercase font-bold">
                      Authoring Layer
                    </span>
                    <span className="text-xs font-mono text-outline">apps/extension</span>
                  </div>
                  <h3 className="font-headline font-bold text-white text-base">Chrome MV3 Extension</h3>
                  <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                    Content script picker & sidepanel editor. Inspects elements, synthesizes 6-field anchor signatures,
                    and posts draft patches directly to the server.
                  </p>
                  <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 font-mono text-[11px] text-primary">
                    POST /patches (draft)
                  </div>
                </div>

                {/* 2. Control Cockpit */}
                <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary-container/40 text-secondary uppercase font-bold">
                      Control Cockpit
                    </span>
                    <span className="text-xs font-mono text-outline">apps/dashboard</span>
                  </div>
                  <h3 className="font-headline font-bold text-white text-base">React Dashboard (Vite)</h3>
                  <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                    Manages patch review, element + property conflicts, deployments, Playwright verification,
                    and audit history on port 5173.
                  </p>
                  <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 font-mono text-[11px] text-secondary">
                    Review / Merge / Deploy / Rollback
                  </div>
                </div>

                {/* 3. AI Copilot */}
                <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-container/20 text-primary uppercase font-bold">
                      AI Generation
                    </span>
                    <span className="text-xs font-mono text-outline">@google/genai</span>
                  </div>
                  <h3 className="font-headline font-bold text-white text-base">Gemini 3.8 Flash Route</h3>
                  <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                    POST /ai/patch turns natural language instructions into structured patch JSON. Falls back to
                    heuristic rules if GEMINI_API_KEY is omitted.
                  </p>
                  <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 font-mono text-[11px] text-primary">
                    model: gemini-3.8-flash
                  </div>
                </div>

                {/* 4. Core API Server */}
                <div className="p-5 rounded-2xl bg-surface-container border border-primary-container/40 space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-container text-white uppercase font-bold">
                      Core Control Plane
                    </span>
                    <span className="text-xs font-mono text-outline">apps/server (Fastify on :4000)</span>
                  </div>
                  <h3 className="font-headline font-bold text-white text-base">Fastify Server & Conflict Engine</h3>
                  <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                    Enforces CAS rebase checks, detects element + property conflicts, groups approved patches into
                    incremental Version records, sets live deployments, and records audit events.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] pt-1">
                    <div className="p-2 rounded bg-surface-container-lowest border border-outline-variant/20 text-center">
                      <span className="text-outline block text-[10px]">MERGE</span>
                      <span className="text-white font-bold">POST /merge</span>
                    </div>
                    <div className="grid-cell p-2 rounded bg-surface-container-lowest border border-outline-variant/20 text-center">
                      <span className="text-outline block text-[10px]">LIVE STATE</span>
                      <span className="text-white font-bold">GET /live</span>
                    </div>
                    <div className="p-2 rounded bg-surface-container-lowest border border-outline-variant/20 text-center">
                      <span className="text-outline block text-[10px]">ROLLBACK</span>
                      <span className="text-white font-bold">POST /rollback</span>
                    </div>
                    <div className="p-2 rounded bg-surface-container-lowest border border-outline-variant/20 text-center">
                      <span className="text-outline block text-[10px]">AUDIT</span>
                      <span className="text-white font-bold">GET /audit</span>
                    </div>
                  </div>
                </div>

                {/* 5. Database Layer */}
                <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container-highest text-on-surface uppercase font-bold">
                      Data Layer
                    </span>
                    <span className="text-xs font-mono text-outline">apps/server/src/store.ts</span>
                  </div>
                  <h3 className="font-headline font-bold text-white text-base">Supabase or In-Memory</h3>
                  <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                    Persists patches, versions, deployments, audit events, conflicts, and sites to Supabase PostgreSQL;
                    falls back gracefully to memory if unreachable.
                  </p>
                  <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 font-mono text-[11px] text-outline">
                    storeMode: supabase | memory
                  </div>
                </div>

                {/* 6. Verification Sandbox */}
                <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-container/20 text-primary uppercase font-bold">
                      Sandbox Verifier
                    </span>
                    <span className="text-xs font-mono text-outline">Playwright + Pixelmatch</span>
                  </div>
                  <h3 className="font-headline font-bold text-white text-base">Automated Regression Check</h3>
                  <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                    Spawns headless Chromium running the target checkout flow. Does not gate deploy upfront, but
                    auto-triggers rollbackLive if verification fails on a live version.
                  </p>
                  <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 font-mono text-[11px] text-primary">
                    POST /verify (auto-rollback on fail)
                  </div>
                </div>

                {/* 7. Shared Package */}
                <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container-highest text-on-surface uppercase font-bold">
                      Shared Core
                    </span>
                    <span className="text-xs font-mono text-outline">packages/shared</span>
                  </div>
                  <h3 className="font-headline font-bold text-white text-base">Schema & Targeting Engine</h3>
                  <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                    Shared Zod schemas, 2-phase target resolver, matcher, and conflict logic imported by server,
                    extension, dashboard, and demo site.
                  </p>
                  <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 font-mono text-[11px] text-outline">
                    Zero drift across packages
                  </div>
                </div>

                {/* 8. Page Runtime */}
                <div className="p-5 rounded-2xl bg-surface-container border border-primary-container/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-container text-white uppercase font-bold">
                      Page Runtime
                    </span>
                    <span className="text-xs font-mono text-outline">apps/demo-site</span>
                  </div>
                  <h3 className="font-headline font-bold text-white text-base">In-Page Client Loader</h3>
                  <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                    Vanilla script tag embedded on the target site (port 4100). Polls GET /deployments/live every 2s,
                    applies changes via DOM APIs, and reloads on signature change.
                  </p>
                  <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 font-mono text-[11px] text-primary">
                    patchwork-runtime.js (POLL_MS: 2000)
                  </div>
                </div>
              </div>

              {/* Lifecycle Flow Pipeline Cards */}
              <div className="pt-6 border-t border-outline-variant/30 space-y-4">
                <div className="text-xs font-mono font-bold text-outline uppercase tracking-wider">
                  The Real 7-Step Lifecycle (Defined in apps/dashboard/src/lib/lifecycle.ts)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                  {LIFECYCLE_STAGES.slice(0, 4).map((stage) => (
                    <div key={stage.id} className="p-4 rounded-xl bg-surface-container/70 border border-outline-variant/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">Step 0{stage.step}</span>
                        <span className="text-[10px] text-outline px-1.5 py-0.5 rounded bg-surface-container-lowest border border-outline-variant/20">
                          {stage.resultingStatus}
                        </span>
                      </div>
                      <h4 className="font-headline font-bold text-white text-sm">{stage.name}</h4>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{stage.summary}</p>
                      <div className="pt-2 text-[10px] text-outline truncate">{stage.route}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  {LIFECYCLE_STAGES.slice(4).map((stage) => (
                    <div key={stage.id} className="p-4 rounded-xl bg-surface-container/70 border border-outline-variant/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">Step 0{stage.step}</span>
                        <span className="text-[10px] text-outline px-1.5 py-0.5 rounded bg-surface-container-lowest border border-outline-variant/20">
                          {stage.resultingStatus}
                        </span>
                      </div>
                      <h4 className="font-headline font-bold text-white text-sm">{stage.name}</h4>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{stage.summary}</p>
                      <div className="pt-2 text-[10px] text-outline truncate">{stage.route}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* DIAGRAM 2: MULTI-ANCHOR LOCATOR & FUZZY HEALING CASCADE */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'auto-heal') && (
          <section id="panel-auto-heal" role="tabpanel" aria-labelledby="tab-auto-heal" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase font-bold tracking-wider mb-1">
                  <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/30">DIAGRAM 02</span>
                  <span>TARGETING ENGINE</span>
                </div>
                <h2 className="font-headline font-black text-2xl sm:text-3xl text-white">
                  Multi-Anchor Locator & Fuzzy Token Healer
                </h2>
              </div>
              <p className="text-xs font-mono text-outline max-w-md">
                Audited directly from packages/shared/src/targeting.ts and apps/demo-site/public/shared/patchwork-runtime.js.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 md:p-8 rounded-3xl cyber-glass border border-outline-variant/40 shadow-xl">
              {/* Left Column: Interactive Cascade Tiers */}
              <div className="lg:col-span-7 space-y-3">
                <div className="text-xs font-mono font-bold text-outline uppercase tracking-wider mb-2">
                  Resolution Order (Click tier to inspect logic):
                </div>

                {HEALING_TIERS.map((tier) => {
                  const isSelected = selectedHealTier === tier.tier;
                  return (
                    <div
                      key={tier.tier}
                      onClick={() => setSelectedHealTier(tier.tier)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-surface-container-high/90 border-primary-container shadow-md'
                          : 'bg-surface-container/60 hover:bg-surface-container border-outline-variant/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white px-2 py-0.5 rounded bg-surface-container-lowest border border-outline-variant/30">
                            Tier 0{tier.tier}
                          </span>
                          <span className="font-headline font-bold text-sm text-white">{tier.name}</span>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-primary-container/30 text-primary bg-primary-container/10 font-bold">
                          {tier.method}
                        </span>
                      </div>

                      <div className="bg-surface-container-lowest/90 px-3 py-1.5 rounded-lg border border-outline-variant/20 font-mono text-[11px] text-primary mb-2 truncate">
                        <code>{tier.codeSnippet}</code>
                      </div>

                      <p className="text-xs text-on-surface-variant font-mono leading-relaxed">
                        {tier.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Active Tier Detail Panel & Telemetry */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-4">
                  <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-white">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>Tier 0{currentTierData.tier} Inspection</span>
                    </div>
                    <span className="text-xs font-mono text-primary font-bold">
                      {currentTierData.method}
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="text-outline uppercase text-[10px]">Basis of Confidence:</div>
                    <div className="text-white font-semibold">{currentTierData.confidenceBasis}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-1 font-mono text-xs">
                    <div className="text-outline text-[10px]">Active Code Snippet:</div>
                    <code className="text-primary text-[11px] break-all">{currentTierData.codeSnippet}</code>
                  </div>

                  {currentTierData.tier === 3 ? (
                    <div className="p-3 rounded-xl bg-primary-container/10 border border-primary-container/30 space-y-1.5 font-mono text-xs text-on-surface-variant">
                      <div className="text-primary font-bold">Jaccard Token Matching:</div>
                      <p className="text-[11px]">
                        Extracts tokens from id, class, name, textContent, and cssSelector. Normalizes synonyms:
                        (checkout = order = buy = pay; cart = basket = bag).
                      </p>
                      <p className="text-[11px] text-white">
                        Requires <strong className="text-primary">score &ge; 0.25</strong> and skips container elements with &gt; 3 children.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 font-mono text-[11px] text-on-surface-variant">
                      If {currentTierData.name} fails to locate the element, execution falls through to Tier 0{currentTierData.tier + 1}.
                    </div>
                  )}
                </div>

                {/* Real Verified Telemetry Settings */}
                <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 space-y-2.5 font-mono text-xs">
                  <div className="text-outline uppercase text-[10px] font-bold">Targeting Constants in Code</div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Page Poll Interval:</span>
                    <span className="text-white font-semibold">{CODEBASE_FACTS.runtimePollingIntervalMs} ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">MutationObserver Debounce:</span>
                    <span className="text-white font-semibold">{CODEBASE_FACTS.mutationObserverDebounceMs} ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Fuzzy Healer Jaccard Threshold:</span>
                    <span className="text-primary font-semibold">&ge; {CODEBASE_FACTS.jaccardHealingThreshold}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Conflict Anchor Similarity:</span>
                    <span className="text-white font-semibold">&ge; {CODEBASE_FACTS.anchorTargetingSimilarityThreshold}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* DIAGRAM 3: ELEMENT + PROPERTY CONFLICT DETECTION */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'merge') && (
          <section id="panel-merge" role="tabpanel" aria-labelledby="tab-merge" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase font-bold tracking-wider mb-1">
                  <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/30">DIAGRAM 03</span>
                  <span>MERGE RESOLUTION</span>
                </div>
                <h2 className="font-headline font-black text-2xl sm:text-3xl text-white">
                  Element + Property Conflict Detection
                </h2>
              </div>
              <p className="text-xs font-mono text-outline max-w-md">
                How packages/shared/src/conflicts.ts identifies concurrent patch overlaps and auto-merges orthogonal edits.
              </p>
            </div>

            <div className="p-6 md:p-8 rounded-3xl cyber-glass border border-outline-variant/40 shadow-xl space-y-8">
              {/* Conflict Scenario Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Branch A */}
                <div className="p-5 rounded-2xl bg-surface-container border border-primary-container/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-mono text-[10px] font-bold uppercase">
                      Dev Alice
                    </span>
                    <span className="text-[10px] font-mono text-outline">Branch 1</span>
                  </div>
                  <h4 className="font-headline font-bold text-white text-sm">Banner Style Edit</h4>
                  <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant/30 font-mono text-xs text-on-surface-variant space-y-1">
                    <div className="text-outline text-[10px]">Target: .hero-banner</div>
                    <div className="text-emerald-400">+ style: background-color: #ff3b81</div>
                    <div className="text-emerald-400">+ style: border-radius: 8px</div>
                  </div>
                </div>

                {/* Base DOM */}
                <div className="p-5 rounded-2xl bg-surface-container-high/80 border border-outline-variant/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded bg-surface-container-highest text-white font-mono text-[10px] font-bold uppercase">
                        BASE DOM
                      </span>
                      <span className="text-[10px] font-mono text-outline">Live v1.0</span>
                    </div>
                    <h4 className="font-headline font-bold text-white text-sm">Target Element</h4>
                    <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant/30 font-mono text-xs text-outline space-y-1 mt-3">
                      <div>Selector: .hero-banner</div>
                      <div>background-color: #111111</div>
                      <div>text: "TechMart Electronics"</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-center text-xs font-mono text-primary gap-1.5">
                    <GitMerge className="w-4 h-4" />
                    <span>targetsSameElement(a, b)</span>
                  </div>
                </div>

                {/* Branch B */}
                <div className="p-5 rounded-2xl bg-surface-container border border-primary-container/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-mono text-[10px] font-bold uppercase">
                      Dev Bob
                    </span>
                    <span className="text-[10px] font-mono text-outline">Branch 2</span>
                  </div>
                  <h4 className="font-headline font-bold text-white text-sm">Banner Text Edit</h4>
                  <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant/30 font-mono text-xs text-on-surface-variant space-y-1">
                    <div className="text-outline text-[10px]">Target: .hero-banner</div>
                    <div className="text-emerald-400">+ text: "Weekend Flash Sale: 20% Off"</div>
                    <div className="text-outline">~ style: untouched</div>
                  </div>
                </div>
              </div>

              {/* Implementation Logic Matrix */}
              <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-headline font-bold text-white text-xs mb-1">Orthogonal Edits: Clean Auto-Merge</h5>
                    <p className="text-xs text-on-surface-variant font-mono leading-relaxed">
                      Alice edited CSS declarations (background-color, border-radius) while Bob edited text content.
                      Because the operations target distinct properties on the same element, the CAS merge combines them into the new version snapshot.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-headline font-bold text-white text-xs mb-1">Same Property or Semantic Overlap: Conflict Flag</h5>
                    <p className="text-xs text-on-surface-variant font-mono leading-relaxed">
                      If two patches modify the same property (e.g. both change text or background-color to different values),
                      or have semantic overlaps (e.g. visibility:hidden vs text), the patch moves to <strong>conflicted</strong> and
                      requires resolution via POST /conflicts/:id/resolve.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* DIAGRAM 4: AUDIT TRAIL & REAL ROLLBACK BEHAVIOR */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {(activeTab === 'all' || activeTab === 'audit') && (
          <section id="panel-audit" role="tabpanel" aria-labelledby="tab-audit" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase font-bold tracking-wider mb-1">
                  <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/30">DIAGRAM 04</span>
                  <span>AUDIT & SAFETY</span>
                </div>
                <h2 className="font-headline font-black text-2xl sm:text-3xl text-white">
                  Audit Event Trail & Rollback Mechanics
                </h2>
              </div>
              <p className="text-xs font-mono text-outline max-w-md">
                Real audit event records from apps/server/src/store.ts and exact rollback behavior.
              </p>
            </div>

            <div className="p-6 md:p-8 rounded-3xl cyber-glass border border-outline-variant/40 shadow-xl space-y-6">
              {/* Real Audit Event Field Representation */}
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-outline uppercase tracking-wider">
                  Real Audit Event Records in Database (GET /audit):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                  {AUDIT_SAMPLE_EVENTS.slice(0, 4).map((evt) => (
                    <div key={evt.id} className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-primary-container/20 text-primary font-bold">
                          {evt.event_type}
                        </span>
                        <span className="text-[10px] text-outline">{evt.created_at.slice(11, 19)} UTC</span>
                      </div>
                      <div className="text-white text-[11px] truncate">
                        ID: <span className="text-outline">{evt.id}</span>
                      </div>
                      <div className="text-white text-[11px] truncate">
                        Actor: <span className="text-outline">{evt.actor_id}</span>
                      </div>
                      <div className="p-2 rounded bg-surface-container-lowest border border-outline-variant/20 text-[10px] text-on-surface-variant truncate">
                        {JSON.stringify(evt.details)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exact Rollback Mechanics Explanation */}
              <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 space-y-4">
                <h4 className="font-headline font-bold text-white text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  <span>How Undeploy and Rollback Actually Work</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 space-y-2">
                    <span className="text-primary font-bold">1. Undeploy a Single Patch:</span>
                    <p className="text-on-surface-variant leading-relaxed">
                      POST /patches/:id/undeploy filters the target patch out of the live set and invokes deployPatchSet with remaining patches.
                      This generates a new incremented Version record and updates the live deployment.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 space-y-2">
                    <span className="text-primary font-bold">2. Roll Back Deployment:</span>
                    <p className="text-on-surface-variant leading-relaxed">
                      POST /rollback marks the current deployment rolled_back_at and sets the most recent earlier non-rolled-back deployment live again.
                      The page runtime detects the new signature on its next poll (2000 ms) and reloads to clear un-deployed changes.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/20 text-xs font-mono">
                  <span className="text-outline">Reactivate prior deployment: POST /deployments/:id/activate</span>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/audit"
                      className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-white font-mono text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
                    >
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span>View Live Audit</span>
                    </Link>
                    <Link
                      to="/deployments"
                      className="px-4 py-2 rounded-xl bg-primary-container hover:bg-[#ff1e70] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cyber-glow-tab"
                    >
                      <span>Deployments</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Technical Status Footer matching Landing & Readme */}
      <footer className="w-full border-t border-outline-variant/30 cyber-glass py-5 sm:py-6 mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-outline">
          <div className="flex items-center gap-3">
            <span className="size-2 rounded-full bg-primary-container" />
            <span>© 2026 PATCHWORK. ALL RIGHTS RESERVED.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/readme"
              className="text-white hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <span>README</span>
            </Link>
            <span className="text-outline-variant/60">•</span>
            <a
              href="https://github.com/Phoenix-huh/Sushi_college_round"
              target="_blank"
              rel="noreferrer"
              className="text-white hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <span>GITHUB</span>
              <ExternalLink className="w-3.5 h-3.5 text-outline" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
