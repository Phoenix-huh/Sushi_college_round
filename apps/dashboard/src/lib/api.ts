import { useCallback, useEffect, useRef, useState } from 'react';

export const API_URL = ((import.meta.env.VITE_SERVER_URL as string) || 'http://localhost:4000').replace(/\/$/, '');
export const DEMO_URL = ((import.meta.env.VITE_DEMO_URL as string) || 'http://localhost:4100').replace(/\/$/, '');
/** Demo developer used when nobody is signed in (matches the server seed). */
export const DEV_ID = '00000000-0000-0000-0000-000000000001';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const USERS: UserProfile[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Demo Dev', email: 'dev@patchwork.io', role: 'developer' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Alice', email: 'alice@patchwork.io', role: 'developer' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Bob', email: 'bob@patchwork.io', role: 'developer' },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Carol', email: 'carol@patchwork.io', role: 'developer' },
];

export function getActingUser(): UserProfile {
  const savedId = typeof window !== 'undefined' ? localStorage.getItem('patchwork_actor_id') : null;
  return USERS.find((u) => u.id === savedId) || USERS[0];
}

export function setActingUser(user: UserProfile) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('patchwork_actor_id', user.id);
    window.dispatchEvent(new Event('acting_user_changed'));
  }
}

export function useActingUser() {
  const [user, setUser] = useState<UserProfile>(getActingUser());
  useEffect(() => {
    const handler = () => setUser(getActingUser());
    window.addEventListener('acting_user_changed', handler);
    return () => window.removeEventListener('acting_user_changed', handler);
  }, []);
  const changeUser = (u: UserProfile) => {
    setActingUser(u);
    setUser(u);
  };
  return { user, setUser: changeUser, users: USERS };
}

export function getUserName(id?: string): string {
  if (!id) return 'Unknown';
  if (id === DEV_ID) return 'Demo Dev';
  const found = USERS.find((u) => u.id === id);
  return found ? found.name : `User ${id.slice(0, 4)}`;
}

/** Call the Patchwork server. Throws an Error with the server's message on failure. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const actor = getActingUser();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      cache: 'no-store',
      // only declare JSON when there is a body (bodyless POSTs with a JSON header get a 400)
      headers: {
        'x-actor-id': actor.id,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new Error(`Cannot reach the Patchwork server at ${API_URL}. Is it running?`);
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body?.error === 'string') message = body.error;
      else if (body?.error) message = JSON.stringify(body.error);
    } catch { /* keep default message */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/** Load data now and keep it fresh: refetches every `ms` while the tab is visible. */
export function usePolling<T>(load: () => Promise<T>, ms = 3000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => { if (!document.hidden) void refresh(); }, ms);
    return () => clearInterval(t);
  }, [refresh, ms]);

  return { data, error, loading, refresh };
}
