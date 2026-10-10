import { Link } from 'react-router-dom';
import { DEMO_URL } from '../lib/api';

export function Landing() {
  return (
    <div className="flex flex-col justify-between w-full min-h-[calc(100vh-5rem)]">
      {/* Hero Main: Stacked Two-Line Title + Glowing Cursive Script */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:py-20 max-w-7xl mx-auto w-full text-center">
          {/* Top Badge / Kicker */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-container/90 border border-primary-container/40 mb-6 sm:mb-8 shadow-sm backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-primary-container animate-ping" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary-fixed-dim">Make code fixes on the go</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary-container/20 text-primary uppercase font-bold tracking-wider">LIVE EDGE</span>
          </div>

          {/* Stacked Two-Line Title (PATCH / WORK) with Layered Diagonal Neon Cursive Script */}
          <div className="relative flex flex-col items-center justify-center select-none my-2 sm:my-4 max-w-5xl">
            {/* Line 1: PATCH */}
            <h1 className="font-headline font-black text-7xl sm:text-8xl md:text-9xl tracking-tighter text-white uppercase leading-[0.85] drop-shadow-2xl">
              PATCH
            </h1>
            {/* Line 2: WORK */}
            <h1 className="font-headline font-black text-7xl sm:text-8xl md:text-9xl tracking-tighter text-white uppercase leading-[0.85] drop-shadow-2xl">
              WORK
            </h1>

            {/* Refined cursive glowing pink neon script bridging both words */}
            <span
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-script text-4xl sm:text-5xl md:text-6xl text-primary-container -rotate-[9deg] pointer-events-none whitespace-nowrap font-bold tracking-normal z-20"
              style={{
                textShadow: '0 0 8px rgba(255, 59, 129, 0.45), 0 0 16px rgba(255, 59, 129, 0.25)',
                filter: 'drop-shadow(0 0 10px rgba(255, 59, 129, 0.2))',
              }}
            >
              Hotfix Engine
            </span>
          </div>

          {/* Center Sub-title / Tagline */}
          <p className="text-base sm:text-lg md:text-xl text-on-surface-variant font-normal max-w-2xl text-center leading-relaxed mt-6 sm:mt-8 mb-8 sm:mb-10 font-mono tracking-wide">
            Patch any live website without a rebuild or redeploy. Every change is tracked, verified and reversible.
          </p>

          {/* Sleek Pair of Centered CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 w-full sm:w-auto">
            <Link
              className="relative inline-flex items-center justify-center px-7 py-3 text-xs tracking-wider uppercase font-bold transition-all duration-200 select-none group text-pink-100 hover:text-white"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                background: 'linear-gradient(rgba(140, 50, 90, 0.35) 0%, rgba(85, 20, 52, 0.5) 100%)',
                border: '2px solid rgba(255, 195, 225, 0.45)',
                boxShadow: 'rgba(255, 60, 130, 0.12) 0px 0px 6px, rgba(255, 100, 160, 0.1) 0px 0px 6px inset',
                textShadow: 'rgba(255, 255, 255, 0.4) 0px 0px 2px, rgba(255, 110, 170, 0.35) 0px 0px 4px',
              }}
              to="/patches"
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
              className="relative inline-flex items-center justify-center px-7 py-3 text-pink-100 text-xs tracking-wider uppercase font-bold transition-all duration-200 select-none group hover:text-white"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                background: 'linear-gradient(rgba(140, 50, 90, 0.35) 0%, rgba(85, 20, 52, 0.5) 100%)',
                border: '2px solid rgba(255, 195, 225, 0.45)',
                boxShadow: 'rgba(255, 60, 130, 0.12) 0px 0px 6px, rgba(255, 100, 160, 0.1) 0px 0px 6px inset',
                textShadow: 'rgba(255, 255, 255, 0.4) 0px 0px 2px, rgba(255, 110, 170, 0.35) 0px 0px 4px',
              }}
              to="/patches"
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
