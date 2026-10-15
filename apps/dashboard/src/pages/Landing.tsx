import React from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { Dynamic3DCore } from '../components/landing/Dynamic3DCore';
import { Dynamic3DPuzzlePiece } from '../components/landing/Dynamic3DPuzzlePiece';

export function Landing() {
  return (
    <div className="flex flex-col justify-between w-full min-h-[calc(100vh-5rem)] relative overflow-hidden">
      {/* Subtle Cyber Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, rgba(255, 59, 129, 0.15) 0%, transparent 70%),
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 64px 64px, 64px 64px',
        }}
      />

      {/* Dynamic 3D Interactive Cyber Core (Wireframe + Satellites) */}
      <Dynamic3DCore />

      {/* Spaced 3D Telemetry Cards — Cleanly placed in the 4 corners */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* ─── TOP-LEFT CARD: Patch Piece #01 ─── */}
        <Dynamic3DPuzzlePiece
          baseRotateX={8}
          baseRotateY={-12}
          baseRotateZ={-4}
          depth={0.9}
          floatSpeed={0.9}
          floatAmp={4}
          phaseOffset={0}
          className="absolute top-8 sm:top-12 left-4 sm:left-10 lg:left-16 w-52 sm:w-60 pointer-events-auto group cursor-pointer"
        >
          <div className="relative p-4 rounded-2xl cyber-glass border border-primary-container/40 shadow-[0_8px_32px_rgba(255,59,129,0.15)] group-hover:border-primary-container group-hover:shadow-[0_0_25px_rgba(255,59,129,0.45)] transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary-container animate-pulse" />
                <span className="font-mono text-[10px] text-primary tracking-wider uppercase font-bold">PATCH PIECE #01</span>
              </div>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary">v2-EDGE</span>
            </div>
            <p className="font-mono text-xs text-white font-bold truncate">target: "button.checkout"</p>
            <p className="font-mono text-[10px] text-on-surface-variant mt-1.5 flex items-center justify-between">
              <span>DOM Anchor</span>
              <span className="text-[#10b981] font-semibold">99.8% match</span>
            </p>
          </div>
        </Dynamic3DPuzzlePiece>

        {/* ─── TOP-RIGHT CARD: Live Runtime ─── */}
        <Dynamic3DPuzzlePiece
          baseRotateX={8}
          baseRotateY={12}
          baseRotateZ={4}
          depth={0.9}
          floatSpeed={0.88}
          floatAmp={4}
          phaseOffset={1.8}
          className="absolute top-8 sm:top-12 right-4 sm:right-10 lg:right-16 w-52 sm:w-60 pointer-events-auto group cursor-pointer"
        >
          <div className="relative p-4 rounded-2xl cyber-glass border border-secondary-container/60 shadow-[0_8px_32px_rgba(125,42,83,0.3)] group-hover:border-secondary group-hover:shadow-[0_0_25px_rgba(255,59,129,0.4)] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#ffb0cf] uppercase tracking-wider font-bold">LIVE RUNTIME</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary font-bold">ACTIVE</span>
            </div>
            <p className="font-mono text-xs text-white font-bold truncate">Self-Healing DOM Engine</p>
            <p className="font-mono text-[10px] text-outline mt-1.5 flex items-center justify-between">
              <span>Hotfix Mode</span>
              <span className="text-primary font-semibold">Zero Rebuild</span>
            </p>
          </div>
        </Dynamic3DPuzzlePiece>

        {/* ─── BOTTOM-LEFT CARD: Rollback & Audit ─── */}
        <Dynamic3DPuzzlePiece
          baseRotateX={-6}
          baseRotateY={-10}
          baseRotateZ={3}
          depth={0.8}
          floatSpeed={1.05}
          floatAmp={4}
          phaseOffset={3.2}
          className="absolute bottom-16 sm:bottom-20 left-4 sm:left-10 lg:left-16 w-52 sm:w-60 pointer-events-auto group cursor-pointer hidden sm:block"
        >
          <div className="relative p-4 rounded-2xl cyber-glass border border-primary-container/30 shadow-[0_8px_32px_rgba(255,59,129,0.12)] group-hover:border-primary-container group-hover:shadow-[0_0_25px_rgba(255,59,129,0.35)] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-primary uppercase tracking-wider font-bold">ROLLBACK SAFE</span>
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="font-mono text-xs text-white font-bold truncate">Audit: cryptographic signature</p>
            <p className="font-mono text-[10px] text-outline mt-1.5 flex items-center justify-between">
              <span>CAS Versioning</span>
              <span className="text-[#38bdf8] font-semibold">Instant Revert</span>
            </p>
          </div>
        </Dynamic3DPuzzlePiece>

        {/* ─── BOTTOM-RIGHT CARD: Playwright Verification ─── */}
        <Dynamic3DPuzzlePiece
          baseRotateX={-6}
          baseRotateY={10}
          baseRotateZ={-3}
          depth={0.85}
          floatSpeed={1.1}
          floatAmp={4}
          phaseOffset={4.8}
          className="absolute bottom-16 sm:bottom-20 right-4 sm:right-10 lg:right-16 w-52 sm:w-60 pointer-events-auto group cursor-pointer hidden sm:block"
        >
          <div className="relative p-4 rounded-2xl cyber-glass border border-outline-variant/40 shadow-lg group-hover:border-primary-container/80 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px] text-[#38bdf8]">verified</span>
                <span className="font-mono text-[10px] text-on-surface uppercase font-bold">PLAYWRIGHT VERIFY</span>
              </div>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-sky-950/60 text-[#38bdf8] border border-sky-500/40">PASSED</span>
            </div>
            <p className="font-mono text-xs text-white font-bold truncate">Pixel diff: 0.00%</p>
            <p className="font-mono text-[10px] text-on-surface-variant mt-1.5 flex items-center justify-between">
              <span>Automated Sandbox</span>
              <span className="text-emerald-400 font-semibold">100% Match</span>
            </p>
          </div>
        </Dynamic3DPuzzlePiece>
      </div>

      {/* Hero Main */}
      <section className="flex-1 flex flex-col justify-center items-center px-4 sm:px-8 xl:px-12 py-12 md:py-20 max-w-[1600px] mx-auto w-full text-center relative z-10">
        {/* Top Badge / Kicker */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-container/90 border border-primary-container/30 mb-8 shadow-sm backdrop-blur-md">
          <span className="size-2 rounded-full bg-primary-container animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary-fixed-dim">Make code fixes on the go</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary uppercase font-bold tracking-wider">LIVE EDGE</span>
        </div>

        {/* Stacked Two-Line Title (PATCH / WORK) with Layered Diagonal Neon Cursive Script */}
        <div className="relative flex flex-col items-center justify-center select-none my-4 max-w-5xl">
          {/* Line 1: PATCH */}
          <h1 className="font-headline font-black text-7xl sm:text-8xl md:text-9xl tracking-tight text-white uppercase leading-[0.88] drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
            PATCH
          </h1>
          {/* Line 2: WORK */}
          <h1 className="font-headline font-black text-7xl sm:text-8xl md:text-9xl tracking-tight text-white uppercase leading-[0.88] drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
            WORK
          </h1>

          {/* Glowing Pink Cursive Script */}
          <span
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-script text-4xl sm:text-5xl md:text-6xl text-primary-container -rotate-[10deg] pointer-events-none whitespace-nowrap font-bold tracking-normal z-20 cyber-glow-text"
          >
            Hotfix Engine
          </span>
        </div>

        {/* Center Sub-title / Tagline matching Image 2 */}
        <p
          className="text-sm sm:text-base md:text-lg text-[#ffb0cf] font-mono font-medium max-w-3xl text-center leading-relaxed mt-6 mb-10 tracking-wide"
          style={{ textShadow: '0 0 12px rgba(255, 59, 129, 0.4)' }}
        >
          Patch any live website without a rebuild or redeploy.<br />
          Every change is tracked, verified and reversible.
        </p>

        {/* Pair of Retro Buttons matching Image 2 */}
        <div className="flex flex-wrap items-center justify-center gap-5 w-full sm:w-auto">
          <Link
            to="/patches"
            className="relative inline-flex items-center justify-center px-7 py-3.5 text-xs tracking-wider uppercase font-bold transition-all duration-200 select-none group text-pink-100 hover:text-white hover:scale-[1.02] active:scale-[0.98]"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              background: 'linear-gradient(rgba(140, 50, 90, 0.35) 0%, rgba(85, 20, 52, 0.5) 100%)',
              border: '2px solid rgba(255, 195, 225, 0.45)',
              boxShadow: 'rgba(255, 60, 130, 0.12) 0px 0px 6px, rgba(255, 100, 160, 0.1) 0px 0px 6px inset',
              textShadow: 'rgba(255, 255, 255, 0.4) 0px 0px 2px, rgba(255, 110, 170, 0.35) 0px 0px 4px',
            }}
          >
            <span className="absolute inset-[3px] border pointer-events-none border-pink-200/40" />
            <svg className="absolute -bottom-1 -left-1 w-3 h-3 text-pink-100" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0L14 9L23 12L14 15L12 24L10 15L1 12L10 9Z" />
            </svg>
            <span className="relative z-10 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-sm leading-none text-pink-200">terminal</span>
              LAUNCH APP
            </span>
          </Link>

          <Link
            to="/architecture"
            className="relative inline-flex items-center justify-center px-7 py-3.5 text-pink-100 text-xs tracking-wider uppercase font-bold transition-all duration-200 select-none group hover:text-white hover:scale-[1.02] active:scale-[0.98]"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              background: 'linear-gradient(rgba(140, 50, 90, 0.35) 0%, rgba(85, 20, 52, 0.5) 100%)',
              border: '2px solid rgba(255, 195, 225, 0.45)',
              boxShadow: 'rgba(255, 60, 130, 0.12) 0px 0px 6px, rgba(255, 100, 160, 0.1) 0px 0px 6px inset',
              textShadow: 'rgba(255, 255, 255, 0.4) 0px 0px 2px, rgba(255, 110, 170, 0.35) 0px 0px 4px',
            }}
          >
            <span className="absolute inset-[3px] border border-pink-200/40 pointer-events-none" />
            <svg className="absolute -bottom-1 -right-1 w-3 h-3 text-pink-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0L14 9L23 12L14 15L12 24L10 15L1 12L10 9Z" />
            </svg>
            <span className="relative z-10 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-sm leading-none text-pink-200">deployed_code</span>
              EXPLORE ARCHITECTURE
            </span>
          </Link>
        </div>
      </section>

      {/* Technical Status Footer */}
      <Footer />
    </div>
  );
}
