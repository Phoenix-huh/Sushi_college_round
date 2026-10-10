import { Link } from 'react-router-dom';
import { Download, ExternalLink, ArrowRight, Sparkles, Layers, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { DEMO_URL } from '../lib/api';

export function Extension() {
  return (
    <div className="flex flex-col justify-between w-full min-h-[calc(100vh-5rem)]">
      {/* Extension Content */}
      <div className="flex-1 max-w-6xl mx-auto px-6 py-12 md:py-16 w-full">
          {/* Hero Header */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container/90 border border-primary-container/40 mb-6 shadow-sm backdrop-blur-md">
              <span className="size-2 rounded-full bg-primary-container" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary-fixed-dim">Chrome Extension MV3</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary uppercase font-bold tracking-wider">v1.0.0</span>
            </div>

            <h1 className="font-headline font-extrabold text-4xl sm:text-5xl md:text-6xl text-white tracking-tight uppercase leading-tight">
              Hotfix Directly From <br />
              <span className="text-primary-container">The Browser</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-on-surface-variant leading-relaxed">
              Inspect any live web application, click to target elements, visually tweak styles or text, use AI prompts to craft instant hotfixes, and submit directly to the Patchwork engine for visual verification and zero-downtime deployment.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/patchwork-extension.zip"
                download="patchwork-extension.zip"
                className="px-6 py-3.5 rounded-xl bg-primary-container hover:bg-[#ff1e70] text-white font-headline font-bold text-sm tracking-wide transition-all flex items-center gap-2.5 shadow-md"
              >
                <Download className="w-5 h-5" />
                <span>Download Extension</span>
                <span className="text-xs font-mono opacity-80 border-l border-white/30 pl-2">.zip (121 KB)</span>
              </a>

              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3.5 rounded-xl bg-surface-container/80 hover:bg-surface-container border border-outline-variant/40 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <span>Test on Demo Site</span>
                <ExternalLink className="w-4 h-4 text-outline" />
              </a>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="cyber-glass p-6 rounded-2xl border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-primary-container/20 border border-primary-container/40 flex items-center justify-center text-primary mb-4">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="font-headline font-bold text-lg text-white mb-2">Point & Click Selector</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Hover and select any element on the page. The extension automatically computes robust CSS selectors, XPath, and text anchor fallbacks.
                </p>
              </div>
            </div>

            <div className="cyber-glass p-6 rounded-2xl border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-secondary-container/30 border border-secondary/40 flex items-center justify-center text-secondary mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-headline font-bold text-lg text-white mb-2">Natural Language AI</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Describe the fix you want in plain English (e.g. <em>"Make this banner green"</em>) and let Gemini generate the exact patch payload instantly.
                </p>
              </div>
            </div>

            <div className="cyber-glass p-6 rounded-2xl border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-headline font-bold text-lg text-white mb-2">Instant Review Sync</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Submit drafts straight to your team dashboard. Preview hotfixes in isolation, run visual regression tests, and deploy with zero downtime.
                </p>
              </div>
            </div>
          </div>

          {/* 3-Step Installation Guide */}
          <div className="cyber-glass rounded-2xl border border-outline-variant/30 p-8 sm:p-10 mb-14">
            <div className="text-center max-w-xl mx-auto mb-8">
              <span className="font-mono text-xs text-primary uppercase font-bold tracking-widest">Setup Guide</span>
              <h2 className="font-headline font-bold text-2xl sm:text-3xl text-white mt-1">How to Install in 3 Steps</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface-container/60 border border-outline-variant/30 p-6 rounded-xl flex flex-col">
                <span className="font-headline font-black text-2xl text-primary mb-2">01</span>
                <h4 className="font-bold text-white text-base mb-1">Unzip Archive</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Click the download button above and extract <code className="text-xs bg-surface-container-highest px-1.5 py-0.5 rounded text-primary">patchwork-extension.zip</code> to any folder on your machine.
                </p>
              </div>

              <div className="bg-surface-container/60 border border-outline-variant/30 p-6 rounded-xl flex flex-col">
                <span className="font-headline font-black text-2xl text-primary mb-2">02</span>
                <h4 className="font-bold text-white text-base mb-1">Enable Dev Mode</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Open Google Chrome or Edge, navigate to <code className="text-xs bg-surface-container-highest px-1.5 py-0.5 rounded text-primary">chrome://extensions</code>, and toggle on <strong>Developer mode</strong> in the top right.
                </p>
              </div>

              <div className="bg-surface-container/60 border border-outline-variant/30 p-6 rounded-xl flex flex-col">
                <span className="font-headline font-black text-2xl text-primary mb-2">03</span>
                <h4 className="font-bold text-white text-base mb-1">Load Unpacked</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Click <strong>Load unpacked</strong>, select the extracted folder, and the Patchwork extension icon will appear in your toolbar ready to use!
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-outline">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Compatible with Chrome, Chromium, Brave, and Edge</span>
              </div>
              <a
                href="/patchwork-extension.zip"
                download="patchwork-extension.zip"
                className="text-primary hover:text-white underline font-semibold transition-colors"
              >
                Download patchwork-extension.zip &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full border-t border-outline-variant/20 py-6 px-6 text-center text-xs font-mono text-outline relative z-10">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <span>PATCHWORK &copy; 2026 &middot; Luminescent Hotfix Engine</span>
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:text-white transition-colors">Overview</Link>
              <Link to="/extension" className="text-primary font-bold">Extension</Link>
              <Link to="/patches" className="hover:text-white transition-colors">Dashboard</Link>
            </div>
          </div>
        </footer>
    </div>
  );
}
