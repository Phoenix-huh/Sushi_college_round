import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

export function Footer({ className }: { className?: string }) {
  const location = useLocation();

  const handleReadmeClick = (e: React.MouseEvent) => {
    if (location.pathname === '/readme') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer
      className={cn(
        'w-full border-t border-outline-variant/30 cyber-glass py-5 sm:py-6 mt-12 relative z-10',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-outline">
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-primary-container" />
          <span>
            &copy; 2026 PATCHWORK contributors.{' '}
            <a
              href="https://github.com/Phoenix-huh/Sushi_college_round/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="text-white hover:text-primary underline transition-colors"
            >
              Released under the MIT License.
            </a>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/readme"
            onClick={handleReadmeClick}
            className={cn(
              'hover:text-primary transition-colors flex items-center gap-1.5',
              location.pathname === '/readme' ? 'text-primary font-bold' : 'text-white'
            )}
            title={location.pathname === '/readme' ? 'Scroll to top of README' : 'View README documentation'}
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
  );
}
