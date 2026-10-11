import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  BookOpen,
  Layers,
  GitMerge,
  AlertTriangle,
} from 'lucide-react';
import { DEMO_URL } from '../lib/api';
import {
  LIFECYCLE_STAGES,
  REAL_API_ENDPOINTS,
  CODEBASE_FACTS,
  KNOWN_LIMITATIONS,
} from '../lib/lifecycle';
import { Footer } from '../components/Footer';
import { StageCard } from '../components/StageCard';

export function Readme() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16 font-body">
      {/* Header Banner */}
      <div className="relative p-8 rounded-3xl cyber-glass border border-outline-variant/40 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-container/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container/90 border border-primary-container/40 text-xs font-mono shadow-sm">
            <span className="size-2 rounded-full bg-primary-container animate-pulse" />
            <span className="text-primary-fixed-dim uppercase tracking-wider font-semibold">PATCHWORK CORE</span>
            <span className="text-outline">/</span>
            <span className="text-primary font-bold">README.md</span>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span>Demo Store</span>
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

        <h1 className="font-headline font-black text-4xl sm:text-5xl text-white tracking-tight uppercase leading-tight mb-4">
          Patchwork — <span className="text-primary">Live DOM Hotfix Engine</span>
        </h1>
        <p className="font-mono text-sm sm:text-base text-on-surface-variant max-w-3xl leading-relaxed">
          Zero-rebuild DOM runtime that patches live web applications in production.
          Every hotfix is authored visually via Chrome MV3 extension or AI prompt, auto-healed through multi-anchor DOM locators,
          collaboratively reviewed with 3-way conflict detection, verified with Playwright, and reversible via version rollbacks.
        </p>

        {/* Feature Badges from Codebase Truth */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-outline-variant/30 mt-6 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/30 text-on-surface">
            Status: <strong className="text-amber-300">Hackathon prototype</strong>
          </span>
          <a
            href="https://github.com/Phoenix-huh/Sushi_college_round/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/30 text-on-surface hover:text-primary transition-colors flex items-center gap-1"
          >
            <span>License:</span> <strong className="text-primary underline">MIT</strong>
          </a>
          <span className="px-2.5 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/30 text-on-surface">
            Runtime: <strong className="text-secondary">Chrome MV3 extension + page runtime</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/30 text-on-surface">
            Verification: <strong className="text-[#38bdf8]">{CODEBASE_FACTS.verificationEngine}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/30 text-on-surface">
            AI Model: <strong className="text-primary">{CODEBASE_FACTS.geminiModel}</strong>
          </span>
        </div>
      </div>

      {/* Quickstart Section */}
      <section className="space-y-4">
        <h2 className="font-headline font-bold text-2xl text-white flex items-center gap-2.5">
          <Terminal className="w-6 h-6 text-primary" />
          <span>Quickstart & Setup</span>
        </h2>
        <div className="p-6 rounded-2xl cyber-glass border border-outline-variant/40 space-y-6">
          <p className="text-sm font-mono text-on-surface-variant leading-relaxed">
            Follow the complete step-by-step instructions to install, seed, launch, and test the entire Patchwork ecosystem:
          </p>

          <div className="space-y-4 font-mono text-xs">
            {/* Step 1 */}
            <div className="space-y-1.5">
              <span className="text-white font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-primary-container text-white text-[10px]">1</span>
                <span>Install dependencies across monorepo:</span>
              </span>
              <div className="relative group bg-surface-container-lowest/90 rounded-xl p-3 border border-outline-variant/30 text-white flex items-center justify-between">
                <code>npm install</code>
                <button
                  onClick={() => copyToClipboard('npm install', 'install')}
                  className="p-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-outline hover:text-white"
                  title="Copy"
                >
                  {copiedCmd === 'install' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-1.5">
              <span className="text-white font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-primary-container text-white text-[10px]">2</span>
                <span>Configure environment variables:</span>
              </span>
              <div className="relative group bg-surface-container-lowest/90 rounded-xl p-3 border border-outline-variant/30 text-white flex items-center justify-between">
                <code>cp .env.example .env</code>
                <button
                  onClick={() => copyToClipboard('cp .env.example .env', 'env')}
                  className="p-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-outline hover:text-white"
                  title="Copy"
                >
                  {copiedCmd === 'env' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Set <code>GEMINI_API_KEY</code> for AI-driven patch authoring. Supabase is optional; the server automatically falls back to an in-memory store if Supabase credentials are not provided.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-1.5">
              <span className="text-white font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-primary-container text-white text-[10px]">3</span>
                <span>Seed demo data:</span>
              </span>
              <div className="relative group bg-surface-container-lowest/90 rounded-xl p-3 border border-outline-variant/30 text-white flex items-center justify-between">
                <code>npm run seed</code>
                <button
                  onClick={() => copyToClipboard('npm run seed', 'seed')}
                  className="p-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-outline hover:text-white"
                  title="Copy"
                >
                  {copiedCmd === 'seed' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-1.5">
              <span className="text-white font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-primary-container text-white text-[10px]">4</span>
                <span>Run all three apps concurrently:</span>
              </span>
              <div className="relative group bg-surface-container-lowest/90 rounded-xl p-3 border border-outline-variant/30 text-white flex items-center justify-between">
                <code>npm run demo</code>
                <button
                  onClick={() => copyToClipboard('npm run demo', 'demo')}
                  className="p-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-outline hover:text-white"
                  title="Copy"
                >
                  {copiedCmd === 'demo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Step 5 */}
            <div className="space-y-1.5">
              <span className="text-white font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-primary-container text-white text-[10px]">5</span>
                <span>Build and load the Chrome Extension (MV3):</span>
              </span>
              <div className="relative group bg-surface-container-lowest/90 rounded-xl p-3 border border-outline-variant/30 text-white flex items-center justify-between">
                <code>npm run build -w apps/extension</code>
                <button
                  onClick={() => copyToClipboard('npm run build -w apps/extension', 'build-ext')}
                  className="p-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-outline hover:text-white"
                  title="Copy"
                >
                  {copiedCmd === 'build-ext' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Open Chrome &rarr; Navigate to <code>chrome://extensions/</code> &rarr; Enable <strong>Developer mode</strong> &rarr; Click <strong>Load unpacked</strong> &rarr; Select <code>apps/extension/dist</code>.
              </p>
            </div>

            {/* Step 6 */}
            <div className="space-y-1.5">
              <span className="text-white font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-primary-container text-white text-[10px]">6</span>
                <span>Run test suites & end-to-end verifications:</span>
              </span>
              <div className="space-y-2">
                <div className="relative group bg-surface-container-lowest/90 rounded-xl p-3 border border-outline-variant/30 text-white flex items-center justify-between">
                  <code>npm test</code>
                  <button
                    onClick={() => copyToClipboard('npm test', 'test')}
                    className="p-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-outline hover:text-white"
                    title="Copy"
                  >
                    {copiedCmd === 'test' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="relative group bg-surface-container-lowest/90 rounded-xl p-3 border border-outline-variant/30 text-white flex items-center justify-between">
                  <code>npm run e2e && npm run e2e:ext</code>
                  <button
                    onClick={() => copyToClipboard('npm run e2e && npm run e2e:ext', 'e2e')}
                    className="p-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-outline hover:text-white"
                    title="Copy"
                  >
                    {copiedCmd === 'e2e' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Three Ports Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-outline-variant/30 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/30">
              <span className="text-[10px] text-outline uppercase font-semibold">Demo Storefront</span>
              <p className="font-bold text-white text-sm mt-1">http://localhost:4100</p>
              <p className="text-on-surface-variant text-[11px] mt-0.5">Live TechMart e-commerce target</p>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/30">
              <span className="text-[10px] text-outline uppercase font-semibold">Fastify API & DB</span>
              <p className="font-bold text-white text-sm mt-1">http://localhost:4000</p>
              <p className="text-on-surface-variant text-[11px] mt-0.5">Fastify server & store</p>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/30">
              <span className="text-[10px] text-outline uppercase font-semibold">Dashboard Console</span>
              <p className="font-bold text-white text-sm mt-1">http://localhost:5173</p>
              <p className="text-on-surface-variant text-[11px] mt-0.5">Vite + React cockpit</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Modules Section */}
      <section className="space-y-4">
        <h2 className="font-headline font-bold text-2xl text-white flex items-center gap-2.5">
          <Layers className="w-6 h-6 text-primary" />
          <span>Core Architecture & Modules</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl cyber-glass border border-outline-variant/30 space-y-2">
            <div className="flex items-center gap-2 font-headline font-bold text-base text-white">
              <span className="size-2 rounded-full bg-primary-container" />
              <h3>1. Chrome Extension (MV3)</h3>
            </div>
            <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
              Provides point-and-click DOM inspection, visual property modification, text editing, and AI-assisted patch generation directly on any live browser tab.
            </p>
          </div>

          <div className="p-5 rounded-2xl cyber-glass border border-outline-variant/30 space-y-2">
            <div className="flex items-center gap-2 font-headline font-bold text-base text-white">
              <span className="size-2 rounded-full bg-primary" />
              <h3>2. Multi-Anchor Locator & Token Healer</h3>
            </div>
            <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
              Computes CSS selectors, structural XPath, and text anchors. When classes or structures mutate, fuzzy Jaccard token matching (threshold &ge; 0.25) self-heals target elements.
            </p>
          </div>

          <div className="p-5 rounded-2xl cyber-glass border border-outline-variant/30 space-y-2">
            <div className="flex items-center gap-2 font-headline font-bold text-base text-white">
              <span className="size-2 rounded-full bg-[#38bdf8]" />
              <h3>3. Playwright Pixelmatch Verification</h3>
            </div>
            <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
              Automated headless Chromium pipeline running checkout user flows and baseline vs. patched screenshot diffing with pixelmatch to prevent visual and operational regressions.
            </p>
          </div>

          <div className="p-5 rounded-2xl cyber-glass border border-outline-variant/30 space-y-2">
            <div className="flex items-center gap-2 font-headline font-bold text-base text-white">
              <span className="size-2 rounded-full bg-secondary" />
              <h3>4. Element + Property Conflict Engine</h3>
            </div>
            <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
              Detects concurrent property-level overlaps between open patches and newer versions, allows non-overlapping edits to auto-merge, and enforces reviewer approvals.
            </p>
          </div>
        </div>
      </section>

      {/* Lifecycle Flow Section Rendered from lifecycle.ts */}
      <section className="space-y-4">
        <h2 className="font-headline font-bold text-2xl text-white flex items-center gap-2.5">
          <GitMerge className="w-6 h-6 text-primary" />
          <span>Hotfix Lifecycle (Real Statuses from Shared Schema)</span>
        </h2>
        <div className="p-6 rounded-2xl cyber-glass border border-outline-variant/40 space-y-4">
          <p className="text-xs font-mono text-on-surface-variant">
            Every patch moves through exact status states backed by <code>PatchStatusSchema</code> in <code>packages/shared/src/schema.ts</code>:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
            {LIFECYCLE_STAGES.slice(0, 4).map((stage) => (
              <StageCard key={stage.id} stage={stage} showRoute />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            {LIFECYCLE_STAGES.slice(4).map((stage) => (
              <StageCard key={stage.id} stage={stage} showRoute />
            ))}
          </div>
        </div>
      </section>

      {/* Real API Reference Table */}
      <section className="space-y-4">
        <h2 className="font-headline font-bold text-2xl text-white flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-primary" />
          <span>Audited Fastify API Endpoints</span>
        </h2>
        <div className="rounded-2xl cyber-glass border border-outline-variant/40 overflow-x-auto shadow-lg">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-surface-container-highest/60 border-b border-outline-variant/30 text-outline uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Endpoint</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-on-surface">
              {REAL_API_ENDPOINTS.map((endpoint, i) => (
                <tr key={`${endpoint.method}-${endpoint.path}-${i}`}>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded font-bold border ${
                        endpoint.method === 'GET'
                          ? 'bg-blue-950 text-blue-300 border-blue-500/40'
                          : endpoint.method === 'POST'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                          : endpoint.method === 'PUT'
                          ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                          : 'bg-rose-950 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {endpoint.method}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-white">{endpoint.path}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{endpoint.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Known Limitations */}
      <section className="space-y-4">
        <h2 className="font-headline font-bold text-2xl text-white flex items-center gap-2.5">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <span>Known Limitations & Architectural Bounds</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KNOWN_LIMITATIONS.map((lim, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl cyber-glass border border-amber-500/20 bg-amber-500/5 space-y-2"
            >
              <div className="flex items-center gap-2 font-headline font-bold text-base text-amber-300">
                <span className="size-2 rounded-full bg-amber-400" />
                <h3>{lim.title}</h3>
              </div>
              <p className="text-xs font-mono text-on-surface-variant leading-relaxed">
                {lim.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
