/**
 * Pre-flight check for a deployed Patchwork demo. Run it before showing judges:
 *
 *   npm run check:deploy -- --demo https://your-demo.vercel.app --server https://your-api.example.com
 *
 * It checks the same things a judge's browser depends on, in order, and says how to fix each failure:
 * https / mixed content, server reachable (and awake), live deployment, CORS from the demo's origin,
 * the runtime tag on the demo page pointing at the right server, and the "site updated" page.
 *
 * `fetchFn` is injectable so the logic is tested without a network.
 */

export type Level = "pass" | "warn" | "fail";
export interface CheckResult {
  level: Level;
  name: string;
  detail: string;
}
export interface CheckOptions {
  demoUrl: string;
  serverUrl: string;
  /** Optional: where the dashboard is hosted. */
  dashboardUrl?: string;
  /** A server slower than this to answer /health is probably waking up from sleep. Default 3000. */
  slowMs?: number;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const isLoopback = (u: URL) => LOOPBACK.has(u.hostname);

function parseUrl(raw: string, label: string): { url: URL } | { error: string } {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return { error: `${label} must be http(s): ${raw}` };
    return { url };
  } catch {
    return { error: `${label} is not a valid URL: "${raw}"` };
  }
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runChecks(opts: CheckOptions, fetchFn: typeof fetch = fetch, timeoutMs = 15000): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const add = (level: Level, name: string, detail: string) => void results.push({ level, name, detail });
  const get = (url: string, init: RequestInit = {}) => fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

  const demoP = parseUrl(opts.demoUrl, "Demo URL");
  const serverP = parseUrl(opts.serverUrl, "Server URL");
  if ("error" in demoP) add("fail", "Demo URL", demoP.error);
  if ("error" in serverP) add("fail", "Server URL", serverP.error);
  if ("error" in demoP || "error" in serverP) return results;
  const demo = demoP.url;
  const server = serverP.url;
  const demoBase = demo.origin;
  const serverBase = server.origin;

  // ---- 1. Can the demo page's browser reach the server at all? ----
  if (demo.protocol === "https:" && server.protocol === "http:" && !isLoopback(server)) {
    add("fail", "HTTPS", `The demo is https but the server is http (${serverBase}). Browsers block that (mixed content). Put the server behind https.`);
  } else if (!isLoopback(demo) && isLoopback(server)) {
    add("warn", "Server location", `The server is on ${serverBase}. That only works in a browser on this computer; a judge on their own device cannot reach it. Use a hosted server or a tunnel (see docs/DEPLOY.md).`);
  } else {
    add("pass", "HTTPS", isLoopback(server) ? "Everything is local." : "Demo and server both use https.");
  }

  // ---- 2. Server is up and awake ----
  const started = Date.now();
  try {
    const res = await get(`${serverBase}/health`);
    const ms = Date.now() - started;
    const body = (await res.json().catch(() => null)) as { ok?: boolean; store?: string } | null;
    if (!res.ok || !body || body.ok !== true) {
      add("fail", "Server health", `${serverBase}/health answered ${res.status} but not with { ok: true }. Is this the Patchwork server?`);
    } else {
      add("pass", "Server health", `Online (${ms} ms).`);
      if (ms > (opts.slowMs ?? 3000)) add("warn", "Server speed", `The first answer took ${ms} ms. A free host may have been asleep; open the dashboard once right before presenting so it is warm.`);
      if (body.store === "memory") {
        add("warn", "Data store", "The server uses its in-memory store: everything resets when it restarts or sleeps. Configure Supabase for persistence, or re-run the walkthrough setup right before presenting.");
      } else if (body.store) {
        add("pass", "Data store", `Using ${body.store}.`);
      }
    }
  } catch (e) {
    add("fail", "Server health", `Cannot reach ${serverBase}/health (${reason(e)}). Is the server running and is the URL right?`);
    return finish(results);
  }

  // ---- 3. Live deployment ----
  try {
    const res = await get(`${serverBase}/deployments/live`);
    const live = (await res.json().catch(() => null)) as { signature?: unknown; patches?: unknown } | null;
    if (!res.ok || !live || typeof live.signature !== "string" || !Array.isArray(live.patches)) {
      add("fail", "Live deployment", `${serverBase}/deployments/live did not return { signature, patches } (status ${res.status}).`);
    } else {
      add("pass", "Live deployment", `${live.patches.length} patch(es) live right now.`);
    }
  } catch (e) {
    add("fail", "Live deployment", reason(e));
  }

  // ---- 4. CORS: may a page on the demo's origin call the server? ----
  const corsOk = (acao: string | null) => acao === demoBase || acao === "*";
  try {
    const simple = await get(`${serverBase}/deployments/live`, { headers: { Origin: demoBase } });
    const pre = await get(`${serverBase}/patches`, {
      method: "OPTIONS",
      headers: { Origin: demoBase, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-actor-id" },
    });
    if (corsOk(simple.headers.get("access-control-allow-origin")) && pre.status < 300 && corsOk(pre.headers.get("access-control-allow-origin"))) {
      add("pass", "CORS", `${demoBase} is allowed to call the server.`);
    } else {
      add("fail", "CORS", `The server does not allow pages on ${demoBase}. Add ${demoBase} to CORS_ORIGINS on the server (comma separated) and restart it.`);
    }
  } catch (e) {
    add("fail", "CORS", `Could not test CORS (${reason(e)}).`);
  }

  // ---- 5. The demo page loads the runtime and points it at this server ----
  try {
    const res = await get(demoBase + "/");
    const html = await res.text();
    if (!res.ok) {
      add("fail", "Demo page", `${demoBase}/ answered ${res.status}.`);
    } else {
      const tag = /<script[^>]*patchwork-runtime\.js[^>]*>/i.exec(html)?.[0];
      if (!tag) {
        add("fail", "Runtime tag", "The demo page does not load patchwork-runtime.js, so patches can never appear on it. Rebuild the demo (npm run build:static) and redeploy.");
      } else {
        const api = /data-api=["']([^"']+)["']/i.exec(tag)?.[1];
        if (!api) {
          add("fail", "Runtime tag", "The runtime tag has no data-api, so it falls back to http://localhost:4000. Set SERVER_URL for the build and redeploy.");
        } else if (api.replace(/\/+$/, "") !== serverBase) {
          add("fail", "Runtime tag", `The page loads patches from ${api}, but you are checking server ${serverBase}. Fix SERVER_URL and redeploy the demo.`);
        } else {
          add("pass", "Runtime tag", `The demo page loads patches from ${api}.`);
        }
      }
    }
  } catch (e) {
    add("fail", "Demo page", `Cannot reach ${demoBase}/ (${reason(e)}).`);
  }

  // ---- 6. The runtime script itself, and the "site updated" page ----
  try {
    const res = await get(`${demoBase}/shared/patchwork-runtime.js`);
    const js = await res.text();
    add(res.ok && js.includes("Patchwork") ? "pass" : "fail", "Runtime script", res.ok && js.includes("Patchwork") ? "Served." : `${demoBase}/shared/patchwork-runtime.js answered ${res.status} or is not the runtime.`);
  } catch (e) {
    add("fail", "Runtime script", reason(e));
  }
  try {
    const res = await get(`${demoBase}/v2/`);
    add(res.ok ? "pass" : "warn", "Site-update page", res.ok ? `${demoBase}/v2/ is there (for the self-healing demo).` : `${demoBase}/v2/ answered ${res.status}. The self-healing part of the demo needs it.`);
  } catch (e) {
    add("warn", "Site-update page", reason(e));
  }

  // ---- 7. Dashboard (optional) ----
  if (opts.dashboardUrl) {
    const dashP = parseUrl(opts.dashboardUrl, "Dashboard URL");
    if ("error" in dashP) {
      add("fail", "Dashboard", dashP.error);
    } else {
      try {
        const res = await get(`${dashP.url.origin}/patches`); // a client-side route: needs the SPA fallback
        add(res.ok ? "pass" : "fail", "Dashboard", res.ok ? "Loads, including client-side routes." : `${dashP.url.origin}/patches answered ${res.status}. Add the rewrite in apps/dashboard/vercel.json.`);
      } catch (e) {
        add("fail", "Dashboard", reason(e));
      }
    }
  }

  return finish(results);
}

function finish(results: CheckResult[]): CheckResult[] {
  return results;
}

export function summarize(results: CheckResult[]): { fails: number; warns: number; text: string } {
  const icon: Record<Level, string> = { pass: "PASS", warn: "WARN", fail: "FAIL" };
  const lines = results.map((r) => `${icon[r.level]}  ${r.name}: ${r.detail}`);
  const fails = results.filter((r) => r.level === "fail").length;
  const warns = results.filter((r) => r.level === "warn").length;
  lines.push("", fails ? `${fails} problem(s) to fix before presenting.` : warns ? `Ready, with ${warns} thing(s) to be aware of.` : "All good. Ready to present.");
  return { fails, warns, text: lines.join("\n") };
}
