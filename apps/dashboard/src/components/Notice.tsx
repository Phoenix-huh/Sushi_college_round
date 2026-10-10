import { useCallback, useRef, useState } from 'react';

type Kind = 'success' | 'error';

/** Small non-blocking message bar (replaces alert()). */
export function useNotice() {
  const [notice, setNotice] = useState<{ kind: Kind; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string, kind: Kind = 'success') => {
    setNotice({ kind, text });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), kind === 'error' ? 8000 : 4000);
  }, []);
  return { notice, show };
}

export function Notice({ notice }: { notice: { kind: Kind; text: string } | null }) {
  if (!notice) return null;
  const style = notice.kind === 'error'
    ? 'bg-red-950/40 border-red-500/50 text-red-200'
    : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200';
  return (
    <div role="status" className={`border rounded-lg px-4 py-2.5 text-xs font-mono backdrop-blur-md shadow-lg ${style}`}>
      {notice.text}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-red-950/40 border border-red-500/50 text-red-200 rounded-lg px-4 py-3 text-xs font-mono backdrop-blur-md shadow-lg">
      {message}
    </div>
  );
}
