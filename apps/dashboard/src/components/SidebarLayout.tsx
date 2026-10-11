import React, { useState, useEffect } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, ExternalLink, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';
import { DEMO_URL, useActingUser } from '../lib/api';

export function SidebarLayout() {
  const { user, setUser, users } = useActingUser();
  const [role, setRole] = useState<'developer' | 'reviewer'>('developer');
  const location = useLocation();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('patchwork_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('patchwork_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // App tabs where the full 7-tab bar + Demo site button are displayed
  const isAppTab = ['/patches', '/deployments', '/verification', '/conflicts', '/audit'].some(
    (path) => location.pathname.startsWith(path)
  );

  return (
    <div className="min-h-screen w-full bg-surface-container-lowest text-on-surface font-body relative flex flex-col">
      {/* Ambient Neon Gradient Orbs */}
      <div className="fixed top-[-5%] left-1/2 -translate-x-1/2 w-[850px] h-[550px] bg-primary-container/15 blur-[150px] rounded-full pointer-events-none z-0" />
      <div className="fixed top-[45%] right-[-10%] w-[550px] h-[550px] bg-secondary-container/25 blur-[160px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-primary-container/10 blur-[140px] rounded-full pointer-events-none z-0" />

      {/* Unified Top Navigation Bar - Fits all tabs without any slider */}
      <header className="w-full border-b border-outline-variant/30 cyber-glass sticky top-0 z-50">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-8 xl:px-12 h-18 py-3 flex items-center justify-between gap-4">
          {/* Left: Brand Logo (plus App Tabs & Demo site button when on app pages) */}
          <div className="flex items-center gap-3 lg:gap-4 shrink-0">
            <Link
              to="/"
              className="flex items-center gap-2.5 group transition-all shrink-0"
            >
              <div className="w-8.5 h-8.5 rounded-lg bg-surface-container border border-primary-container/50 flex items-center justify-center text-primary-container group-hover:cyber-glow-primary transition-all duration-300 shadow-sm">
                <svg className="w-4.5 h-4.5 text-primary-container" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor" />
                </svg>
              </div>
              <span className="font-headline font-black text-lg tracking-wider text-white">PATCHWORK</span>
            </Link>

            {isAppTab && (
              <div className="flex items-center gap-2.5 shrink-0">
                <nav className="flex items-center gap-1 bg-surface-container/90 p-1 rounded-full border border-outline-variant/40 text-[13px] font-mono shrink-0 shadow-inner">
                  <TopNavItem to="/">Overview</TopNavItem>
                  <TopNavItem to="/extension">Extension</TopNavItem>
                  <TopNavItem to="/readme">README</TopNavItem>
                  <TopNavItem to="/patches">Patches</TopNavItem>
                  <TopNavItem to="/deployments">Deployments</TopNavItem>
                  <TopNavItem to="/verification">Verification</TopNavItem>
                  <TopNavItem to="/conflicts">Conflicts</TopNavItem>
                  <TopNavItem to="/audit">Audit</TopNavItem>
                </nav>

                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-white font-mono text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all hover:border-primary-container/60 hover:cyber-glow-primary shadow-sm shrink-0 whitespace-nowrap"
                  title="Open live demo site in new tab"
                >
                  <span>Demo site</span>
                  <ExternalLink className="w-3.5 h-3.5 text-primary" />
                </a>

                {/* Light Mode Toggle beside demo site button */}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface hover:text-primary transition-all hover:border-primary-container/60 shadow-sm shrink-0 flex items-center justify-center"
                  title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-300 transition-transform hover:rotate-45" />
                  ) : (
                    <Moon className="w-4 h-4 text-primary transition-transform hover:-rotate-12" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right: Overview & Extension capsule + Launch App button (Public Landing / Extension / Readme state) */}
          {!isAppTab && (
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <nav className="flex items-center gap-1 bg-surface-container/90 p-1 rounded-full border border-outline-variant/40 text-[13px] font-mono shadow-inner">
                <TopNavItem to="/">Overview</TopNavItem>
                <TopNavItem to="/extension">Extension</TopNavItem>
                {location.pathname === '/architecture' && <TopNavItem to="/architecture">Architecture</TopNavItem>}
                {location.pathname === '/readme' && <TopNavItem to="/readme">README</TopNavItem>}
              </nav>

              {/* Light Mode Toggle in header */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface hover:text-primary transition-all hover:border-primary-container/60 shadow-sm shrink-0 flex items-center justify-center"
                title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-300 transition-transform hover:rotate-45" />
                ) : (
                  <Moon className="w-4 h-4 text-primary transition-transform hover:-rotate-12" />
                )}
              </button>

              <Link
                to="/patches"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary-container hover:bg-[#ff1e70] text-white font-headline font-bold text-xs sm:text-sm tracking-wide transition-all shadow-md cyber-glow-primary hover:scale-[1.02] active:scale-[0.98] shrink-0 whitespace-nowrap"
              >
                <span>Launch App</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 w-full">
        <div className={cn("mx-auto w-full", isAppTab ? "p-6 sm:p-8 xl:px-12 pb-32 max-w-[1600px]" : "")}>
          <Outlet context={{ role, setRole }} />
        </div>
      </main>

      {/* Fixed Bottom-Left User Switcher Widget (Pinned to bottom-left on launch app pages) */}
      {isAppTab && (
        <div className="fixed bottom-5 left-5 z-50 w-72 p-3 bg-surface-container/90 rounded-xl border border-outline-variant/40 cyber-glass shadow-xl backdrop-blur-xl">
          <div className="text-[10px] font-mono font-semibold text-outline uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Acting as</span>
            <span className="size-2 rounded-full bg-primary-container/80" />
          </div>
          <div className="grid grid-cols-2 gap-1.5 bg-surface-container-lowest/90 p-1 rounded-lg border border-outline-variant/30">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setUser(u)}
                className={cn(
                  "py-1.5 px-2 rounded-md text-xs font-mono font-semibold text-center transition-all",
                  user.id === u.id
                    ? "bg-primary-container text-white shadow-sm"
                    : "text-on-surface-variant hover:text-white hover:bg-surface-container-high/60"
                )}
                title={u.email}
              >
                {u.name}
              </button>
            ))}
          </div>

          {/* Role Toggle: Developer vs Reviewer (UI toggle for Phase 5) */}
          <div className="mt-2.5 pt-2 border-t border-outline-variant/30">
            <div className="text-[10px] font-mono font-semibold text-outline uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Role</span>
              <span className="text-[10px] font-mono text-primary font-bold uppercase">{role}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-surface-container-lowest/90 p-1 rounded-lg border border-outline-variant/30">
              <button
                onClick={() => setRole('developer')}
                className={cn(
                  "py-1 px-2 rounded-md text-[11px] font-mono font-semibold text-center transition-all",
                  role === 'developer'
                    ? "bg-secondary-container text-white shadow-sm"
                    : "text-on-surface-variant hover:text-white hover:bg-surface-container-high/60"
                )}
              >
                Developer
              </button>
              <button
                onClick={() => setRole('reviewer')}
                className={cn(
                  "py-1 px-2 rounded-md text-[11px] font-mono font-semibold text-center transition-all",
                  role === 'reviewer'
                    ? "bg-primary-container text-white shadow-sm"
                    : "text-on-surface-variant hover:text-white hover:bg-surface-container-high/60"
                )}
              >
                Reviewer
              </button>
            </div>
          </div>

          <div className="mt-2 text-xs font-mono text-outline truncate flex items-center justify-between">
            <span className="truncate text-on-surface-variant text-[11px]">{user.email}</span>
            <span className="font-bold text-primary uppercase text-[10px] ml-2 shrink-0">{user.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TopNavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          "px-3.5 py-1.5 rounded-full transition-all text-[13px] font-mono font-semibold tracking-normal whitespace-nowrap flex items-center gap-1",
          isActive
            ? "bg-primary-container text-white shadow-sm font-bold cyber-glow-tab"
            : "text-on-surface-variant hover:text-white hover:bg-surface-container-high/60 transition-colors"
        )
      }
    >
      {children}
    </NavLink>
  );
}
