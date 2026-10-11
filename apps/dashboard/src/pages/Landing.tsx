import React from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';

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

      {/* Interlocking 3D Puzzle Pieces Environment Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Top-Left Interlocking Cluster: Piece 1 (Anchor Piece) */}
        <div
          className="absolute top-12 left-4 sm:left-12 md:left-20 w-44 sm:w-52 pointer-events-auto floating-piece group cursor-pointer"
          style={{ transform: 'perspective(1000px) rotateX(10deg) rotateY(-14deg) rotateZ(-6deg)' }}
        >
          <div className="relative p-4 rounded-2xl cyber-glass border border-primary-container/40 shadow-[0_8px_32px_rgba(255,59,129,0.15)] group-hover:border-primary-container group-hover:shadow-[0_0_25px_rgba(255,59,129,0.4)] transition-all">
            {/* Jigsaw connector tab on right */}
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-container border border-primary-container/40 group-hover:border-primary-container shadow-sm" />
            <div className="flex items-center gap-2 mb-2">
              <span className="size-2 rounded-full bg-primary-container animate-pulse" />
              <span className="font-mono text-[10px] text-primary tracking-wider uppercase">PATCH PIECE #01</span>
            </div>
            <p className="font-mono text-xs text-white font-bold truncate">target: "button.checkout"</p>
            <p className="font-mono text-[10px] text-on-surface-variant mt-1 flex items-center justify-between">
              <span>DOM Anchor</span>
              <span className="text-[#10b981] font-semibold">99.8% match</span>
            </p>
          </div>
        </div>

        {/* Top-Left Interlocking Cluster: Piece 2 (Interlocked Partner) */}
        <div
          className="absolute top-28 left-40 sm:left-56 md:left-64 w-40 sm:w-48 pointer-events-auto floating-piece group cursor-pointer"
          style={{ transform: 'perspective(1000px) rotateX(12deg) rotateY(-8deg) rotateZ(4deg)' }}
        >
          <div className="relative p-3.5 rounded-2xl cyber-glass border border-outline-variant/50 shadow-lg group-hover:border-primary-container/80 transition-all">
            {/* Jigsaw connector indent on left */}
            <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-container-lowest border border-outline-variant/60" />
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="material-symbols-outlined text-[13px] text-primary">extension</span>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase">INTERLOCKING HOTFIX</span>
            </div>
            <p className="font-mono text-[11px] text-[#ffb0cf] truncate">style: &#123; bg: #ff3b81 &#125;</p>
          </div>
        </div>

        {/* Top-Right Floating Puzzle Piece */}
        <div
          className="absolute top-16 right-4 sm:right-16 md:right-28 w-44 sm:w-52 pointer-events-auto floating-piece group cursor-pointer"
          style={{ transform: 'perspective(1000px) rotateX(14deg) rotateY(16deg) rotateZ(8deg)' }}
        >
          <div className="relative p-4 rounded-2xl cyber-glass border border-secondary-container/60 shadow-[0_8px_32px_rgba(125,42,83,0.3)] group-hover:border-secondary transition-all">
            {/* Jigsaw connector tab on bottom */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-surface-container border border-secondary-container/60 group-hover:border-secondary" />
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#ffb0cf] uppercase tracking-wider">LIVE RUNTIME</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary">v2-EDGE</span>
            </div>
            <p className="font-mono text-xs text-white font-bold truncate">Self-Healing DOM Engine</p>
            <p className="font-mono text-[10px] text-outline mt-1">Zero rebuild redeploy</p>
          </div>
        </div>

        {/* Bottom-Left Floating Puzzle Piece */}
        <div
          className="absolute bottom-24 left-6 sm:left-16 md:left-24 w-44 sm:w-48 pointer-events-auto floating-piece group cursor-pointer hidden sm:block"
          style={{ transform: 'perspective(1000px) rotateX(-8deg) rotateY(-12deg) rotateZ(6deg)' }}
        >
          <div className="relative p-3.5 rounded-2xl cyber-glass border border-outline-variant/40 shadow-lg group-hover:border-primary-container/60 transition-all">
            {/* Jigsaw connector tab on top */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-surface-container border border-outline-variant/50" />
            <div className="flex items-center gap-2 mb-1.5">
              <span className="material-symbols-outlined text-[13px] text-[#38bdf8]">verified</span>
              <span className="font-mono text-[10px] text-on-surface uppercase">PLAYWRIGHT VERIFY</span>
            </div>
            <p className="font-mono text-[11px] text-on-surface-variant">Pixel diff: 0.00%</p>
          </div>
        </div>

        {/* Bottom-Right Interlocking Pair */}
        <div
          className="absolute bottom-28 right-8 sm:right-20 md:right-32 w-48 sm:w-56 pointer-events-auto floating-piece group cursor-pointer hidden sm:block"
          style={{ transform: 'perspective(1000px) rotateX(-10deg) rotateY(14deg) rotateZ(-8deg)' }}
        >
          <div className="relative p-4 rounded-2xl cyber-glass border border-primary-container/30 shadow-[0_8px_32px_rgba(255,59,129,0.12)] group-hover:border-primary-container group-hover:shadow-[0_0_25px_rgba(255,59,129,0.35)] transition-all">
            {/* Jigsaw connector tab on left */}
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-container border border-primary-container/30 group-hover:border-primary-container" />
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-primary uppercase tracking-wider">ROLLBACK SAFE</span>
              <span className="size-2 rounded-full bg-primary-container animate-pulse" />
            </div>
            <p className="font-mono text-xs text-white font-bold truncate">Audit: cryptographically signed</p>
            <p className="font-mono text-[10px] text-outline mt-1">Instant 1-click revert</p>
          </div>
        </div>
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
