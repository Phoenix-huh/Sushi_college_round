import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Sparkles,
  GitMerge,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { DEMO_URL } from '../lib/api';
import { CODEBASE_FACTS } from '../lib/lifecycle';
import { Footer } from '../components/Footer';
import {
  NodeDetailPanel,
  type NodeDetail,
} from '../components/architecture/NodeDetailPanel';
import { TopologyDiagram } from '../components/architecture/TopologyDiagram';
import { HealerDiagram } from '../components/architecture/HealerDiagram';
import { ConflictDiagram } from '../components/architecture/ConflictDiagram';
import { VersionsDiagram } from '../components/architecture/VersionsDiagram';

type TabKey = 'topology' | 'healer' | 'conflicts' | 'versions';

interface ArchTab {
  id: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ARCH_TABS: ArchTab[] = [
  { id: 'topology', label: '1. System Topology', icon: Layers },
  { id: 'healer', label: '2. Multi-Anchor Healer', icon: Sparkles },
  { id: 'conflicts', label: '3. Conflict Engine', icon: GitMerge },
  { id: 'versions', label: '4. Versions & Audit', icon: ShieldCheck },
];

export function Architecture() {
  const [activeTab, setActiveTab] = useState<TabKey>('topology');
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);

  const handleTabChange = (tabId: TabKey) => {
    setActiveTab(tabId);
    setSelectedNode(null);
  };

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex flex-col justify-between font-body text-on-surface">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-8 xl:px-12 py-10 md:py-14 space-y-10">
        {/* Hero Header Banner */}
        <div className="relative p-8 md:p-10 rounded-3xl cyber-glass border border-outline-variant/40 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-container/15 blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-secondary-container/20 blur-[120px] pointer-events-none rounded-full" />

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-container/90 border border-primary-container/40 text-xs font-mono shadow-sm">
              <span className="size-2 rounded-full bg-primary-container animate-pulse" />
              <span className="text-primary-fixed-dim uppercase tracking-wider font-semibold">
                PATCHWORK SYSTEM
              </span>
              <span className="text-outline">/</span>
              <span className="text-primary font-bold">ARCHITECTURE.md</span>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
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

          <h1 className="font-headline font-black text-3xl sm:text-5xl md:text-6xl text-white tracking-tight uppercase leading-tight mb-3 relative z-10">
            System Topology & <br />
            <span className="text-primary">DOM Runtime Architecture</span>
          </h1>

          <p className="font-mono text-sm sm:text-base text-on-surface-variant max-w-4xl leading-relaxed relative z-10">
            Diagram-first inspection of the Patchwork monorepo. Click any node in the diagrams below to inspect its exact implementation details, API routes, and codebase facts.
          </p>

          {/* Codebase Facts Bar: Spans Wide */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-outline-variant/30 mt-6 relative z-10 font-mono text-xs">
            <div className="p-3.5 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <span className="text-[11px] text-outline uppercase block">Locators</span>
              <span className="text-white font-bold text-sm mt-0.5 block">
                {CODEBASE_FACTS.anchorCount} Anchor Fields
              </span>
              <span className="text-[11px] text-primary truncate block mt-0.5">
                CSS, XPath, Tokens
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <span className="text-[11px] text-outline uppercase block">Change Types</span>
              <span className="text-white font-bold text-sm mt-0.5 block">
                {CODEBASE_FACTS.changeTypeCount} Types Supported
              </span>
              <span className="text-[11px] text-secondary truncate block mt-0.5">
                text, style, script...
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <span className="text-[11px] text-outline uppercase block">Visual Verification</span>
              <span className="text-white font-bold text-sm mt-0.5 block">
                Playwright + Pixelmatch
              </span>
              <span className="text-[11px] text-[#38bdf8] truncate block mt-0.5">
                Automated Checkout Test
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <span className="text-[11px] text-outline uppercase block">AI Model</span>
              <span className="text-white font-bold text-sm mt-0.5 block">
                {CODEBASE_FACTS.geminiModel}
              </span>
              <span className="text-[11px] text-primary truncate block mt-0.5">
                Rule Heuristic Fallback
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div
          role="tablist"
          aria-label="Architecture Diagrams"
          className="flex flex-wrap items-center gap-2.5 p-2 rounded-2xl cyber-glass border border-outline-variant/40 shadow-md w-full"
        >
          {ARCH_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-mono text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-primary ${
                  isSelected
                    ? 'bg-primary-container text-white border border-primary-container shadow-md cyber-glow-tab'
                    : 'text-on-surface-variant hover:text-white hover:bg-surface-container/60 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* ACTIVE DIAGRAM SECTION: FULL-WIDTH, WIDE & BIG, ZERO SCROLL WHEEL */}
        {/* ═════════════════════════════════════════════════════════════════════ */}

        {/* TAB 1: SYSTEM TOPOLOGY */}
        {activeTab === 'topology' && (
          <section
            id="panel-topology"
            role="tabpanel"
            aria-labelledby="tab-topology"
            className="space-y-6 w-full"
          >
            {/* Header: Title and One-Line Caption Only */}
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase font-bold tracking-wider mb-1">
                <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/30">
                  DIAGRAM 01
                </span>
                <span>SYSTEM TOPOLOGY & MODULES</span>
              </div>
              <h2 className="font-headline font-black text-2xl sm:text-3xl text-white">
                Inter-Module Architecture & Lifecycle Flow
              </h2>
              <p className="text-xs font-mono text-outline mt-1">
                Visual map connecting Chrome extension, dashboard, API server, and backing services.
              </p>
            </div>

            {/* Visual Map (Full Width) */}
            <TopologyDiagram
              activeNodeId={selectedNode?.id ?? null}
              onSelectNode={setSelectedNode}
            />

            {/* Detail Inspector Panel (Full Width, Zero Scroll Wheel) */}
            <NodeDetailPanel
              selectedNode={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </section>
        )}

        {/* TAB 2: MULTI-ANCHOR HEALER */}
        {activeTab === 'healer' && (
          <section
            id="panel-healer"
            role="tabpanel"
            aria-labelledby="tab-healer"
            className="space-y-6 w-full"
          >
            {/* Header: Title and One-Line Caption Only */}
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase font-bold tracking-wider mb-1">
                <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/30">
                  DIAGRAM 02
                </span>
                <span>RESILIENT TARGETING & HEALING</span>
              </div>
              <h2 className="font-headline font-black text-2xl sm:text-3xl text-white">
                Multi-Anchor Cascade & Fuzzy Token Healer
              </h2>
              <p className="text-xs font-mono text-outline mt-1">
                3-tier resolution funnel ensuring DOM hotfixes persist across site updates.
              </p>
            </div>

            {/* Visual Map (Full Width) */}
            <HealerDiagram
              activeNodeId={selectedNode?.id ?? null}
              onSelectNode={setSelectedNode}
            />

            {/* Detail Inspector Panel (Full Width, Zero Scroll Wheel) */}
            <NodeDetailPanel
              selectedNode={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </section>
        )}

        {/* TAB 3: CONFLICT ENGINE */}
        {activeTab === 'conflicts' && (
          <section
            id="panel-conflicts"
            role="tabpanel"
            aria-labelledby="tab-conflicts"
            className="space-y-6 w-full"
          >
            {/* Header: Title and One-Line Caption Only */}
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase font-bold tracking-wider mb-1">
                <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/30">
                  DIAGRAM 03
                </span>
                <span>COLLABORATIVE MERGE SAFETY</span>
              </div>
              <h2 className="font-headline font-black text-2xl sm:text-3xl text-white">
                Element + Property Conflict Detection Engine
              </h2>
              <p className="text-xs font-mono text-outline mt-1">
                Git-graph analysis detecting concurrent property collisions on target elements.
              </p>
            </div>

            {/* Visual Map (Full Width) */}
            <ConflictDiagram
              activeNodeId={selectedNode?.id ?? null}
              onSelectNode={setSelectedNode}
            />

            {/* Detail Inspector Panel (Full Width, Zero Scroll Wheel) */}
            <NodeDetailPanel
              selectedNode={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </section>
        )}

        {/* TAB 4: VERSIONS & AUDIT */}
        {activeTab === 'versions' && (
          <section
            id="panel-versions"
            role="tabpanel"
            aria-labelledby="tab-versions"
            className="space-y-6 w-full"
          >
            {/* Header: Title and One-Line Caption Only */}
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase font-bold tracking-wider mb-1">
                <span className="px-2 py-0.5 rounded bg-primary-container/20 border border-primary-container/30">
                  DIAGRAM 04
                </span>
                <span>DEPLOYMENTS, ROLLBACK & AUDIT</span>
              </div>
              <h2 className="font-headline font-black text-2xl sm:text-3xl text-white">
                Immutable Version Bundles, Rollbacks & Audit Trail
              </h2>
              <p className="text-xs font-mono text-outline mt-1">
                Zero-downtime deployment rail, atomic rollback mechanics, and tamper audit log.
              </p>
            </div>

            {/* Visual Map (Full Width) */}
            <VersionsDiagram
              activeNodeId={selectedNode?.id ?? null}
              onSelectNode={setSelectedNode}
            />

            {/* Detail Inspector Panel (Full Width, Zero Scroll Wheel) */}
            <NodeDetailPanel
              selectedNode={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </section>
        )}
      </div>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
