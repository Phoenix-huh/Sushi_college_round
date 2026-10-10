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
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800';
  return <div role="status" className={`border rounded-lg px-4 py-2 text-sm ${style}`}>{notice.text}</div>;
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
      {message}
    </div>
  );
}
