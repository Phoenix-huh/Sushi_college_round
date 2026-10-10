import { Link } from 'react-router-dom';
import { DEMO_URL } from '../lib/api';

export function Landing() {
  return (
    <div className="flex flex-col justify-between w-full min-h-[calc(100vh-5rem)] relative overflow-hidden bg-[#0c0a10]">
      {/* Subtle Cyber Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, rgba(255, 59, 129, 0.15) 0%, transparent 70%),
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 64px 64px, 64px 64px',
        }}
      />

      {/* Hero Main */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:py-20 max-w-7xl mx-auto w-full text-center relative z-10">
        {/* Top Badge / Kicker */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#17141f] border border-[#ff3b81]/30 mb-8 shadow-sm">
          <span className="font-mono text-xs uppercase tracking-widest text-[#d8b4c0]">Make code fixes on the go</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#ff3b81]/20 text-[#ff75a0] uppercase font-bold tracking-wider">LIVE EDGE</span>
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
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-script text-4xl sm:text-5xl md:text-6xl text-[#ff3b81] -rotate-[10deg] pointer-events-none whitespace-nowrap font-bold tracking-normal z-20"
            style={{
              textShadow: '0 0 12px rgba(255, 59, 129, 0.9), 0 0 25px rgba(255, 59, 129, 0.6), 0 0 40px rgba(255, 59, 129, 0.4)',
              filter: 'drop-shadow(0 0 15px rgba(255, 59, 129, 0.8))',
            }}
          >
            Hotfix Engine
          </span>
        </div>

        {/* Center Sub-title / Tagline */}
        <p className="text-sm sm:text-base md:text-lg text-[#c5b8c8] font-normal max-w-2xl text-center leading-relaxed mt-6 mb-10 font-mono tracking-wide">
          Self-healing DOM runtime that patches live web applications at the edge without rebuilds or redeployments.
        </p>

        {/* Pair of Centered Pill CTA Buttons matching the reference picture */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full sm:w-auto">
          <Link
            to="/patches"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#ff2a6d] hover:bg-[#ff165d] text-white text-sm font-semibold tracking-wide transition-all shadow-[0_0_25px_rgba(255,42,109,0.55)] hover:shadow-[0_0_35px_rgba(255,42,109,0.8)] hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Launch App / Console</span>
            <span className="material-symbols-outlined text-base">terminal</span>
          </Link>

          <Link
            to="/patches"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#16131c] hover:bg-[#1f1b27] border border-[#383144] hover:border-[#524765] text-white text-sm font-semibold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Explore Architecture</span>
            <span className="material-symbols-outlined text-base text-[#a397b3]">deployed_code</span>
          </Link>
        </div>
      </section>

        {/* Technical Status Footer */}
        <footer className="w-full border-t border-outline-variant/30 cyber-glass py-5 sm:py-6 mt-12">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-outline">
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-primary-container" />
              <span>© 2026 PATCHWORK. ALL RIGHTS RESERVED.</span>
            </div>
            <div className="flex items-center gap-6">
              <a className="hover:text-primary transition-colors flex items-center gap-1" href="#">
                <span className="material-symbols-outlined text-sm">description</span>
                Documentation
              </a>
              <a
                className="hover:text-primary transition-colors flex items-center gap-1"
                href="https://github.com/Phoenix-huh/Sushi_college_round"
                target="_blank"
                rel="noreferrer"
              >
                <span className="material-symbols-outlined text-sm">code</span>
                GitHub
              </a>
              <span className="text-outline-variant">|</span>
            </div>
          </div>
        </footer>
    </div>
  );
}
