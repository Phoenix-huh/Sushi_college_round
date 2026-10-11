/**
 * Which web pages may call this API from a browser (CORS).
 * Pure functions with no imports, so they are easy to test.
 */

/** "a.com, https://b.com/" -> ["a.com", "https://b.com"]. Placeholder entries from .env.example are ignored. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter((o) => o !== "" && !o.includes("your-extension-id"));
}

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * Decides whether a web page at `origin` may call this API.
 *  - No Origin header (curl, the extension's background worker, server to server): allowed.
 *  - `allowed` empty: every origin is allowed (local development).
 *  - `allowed` set: only those origins, plus localhost on any port, so a local demo keeps working.
 */
export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  if (allowed.length === 0) return true;
  const clean = origin.replace(/\/+$/, "");
  return allowed.includes(clean) || LOOPBACK.test(clean);
}
