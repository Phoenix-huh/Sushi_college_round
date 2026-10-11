import { describe, expect, it } from "vitest";
import { runChecks, summarize, type CheckResult } from "./deploy-check";

const DEMO = "https://techmart.vercel.app";
const API = "https://patchwork-api.example.com";

interface World {
  health?: object | "down" | number;
  live?: object | number;
  cors?: "ok" | "none";
  demoHtml?: string;
  runtimeJs?: string | number;
  v2?: number;
  dashboard?: number;
  delayMs?: number;
}

const runtimeTag = (api: string | null) => `<html><body><script src="/shared/patchwork-runtime.js"${api ? ` data-api="${api}"` : ""}></script></body></html>`;

/** A fake internet: answers the way a correctly deployed (or broken) demo would. */
function fakeNet(w: World = {}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const origin = (init?.headers as Record<string, string> | undefined)?.Origin;
    const json = (b: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...headers } });
    const corsHeaders: Record<string, string> = w.cors === "none" || !origin ? {} : { "access-control-allow-origin": origin };

    if (url.origin === API) {
      if (w.delayMs) await new Promise((r) => setTimeout(r, w.delayMs));
      if (method === "OPTIONS") return new Response(null, { status: w.cors === "none" ? 204 : 204, headers: corsHeaders });
      if (url.pathname === "/health") {
        if (w.health === "down") throw new TypeError("fetch failed");
        if (typeof w.health === "number") return new Response("nope", { status: w.health });
        return json(w.health ?? { ok: true, store: "supabase" }, 200, corsHeaders);
      }
      if (url.pathname === "/deployments/live") {
        if (typeof w.live === "number") return new Response("err", { status: w.live });
        return json(w.live ?? { signature: "abc", patches: [{}, {}] }, 200, corsHeaders);
      }
    }
    if (url.origin === DEMO) {
      if (url.pathname === "/") return new Response(w.demoHtml ?? runtimeTag(API), { status: 200 });
      if (url.pathname === "/shared/patchwork-runtime.js") {
        if (typeof w.runtimeJs === "number") return new Response("x", { status: w.runtimeJs });
        return new Response(w.runtimeJs ?? "window.Patchwork = {};", { status: 200 });
      }
      if (url.pathname === "/v2/") return new Response("<html></html>", { status: w.v2 ?? 200 });
    }
    if (url.origin === "https://dash.vercel.app") return new Response("<html></html>", { status: w.dashboard ?? 200 });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const run = (w: World = {}, extra: Partial<Parameters<typeof runChecks>[0]> = {}) => runChecks({ demoUrl: DEMO, serverUrl: API, ...extra }, fakeNet(w), 2000);
const by = (rs: CheckResult[], name: string) => rs.filter((r) => r.name === name);
const levels = (rs: CheckResult[]) => rs.map((r) => r.level);

describe("deploy check: a correct deployment", () => {
  it("passes everything", async () => {
    const rs = await run();
    expect(levels(rs).filter((l) => l !== "pass")).toEqual([]);
    expect(summarize(rs)).toMatchObject({ fails: 0, warns: 0 });
    expect(summarize(rs).text).toContain("All good");
    expect(by(rs, "Live deployment")[0]!.detail).toContain("2 patch(es)");
    expect(by(rs, "CORS")[0]!.level).toBe("pass");
    expect(by(rs, "Runtime tag")[0]!.level).toBe("pass");
  });
  it("also checks the dashboard when given, including a client-side route", async () => {
    const rs = await run({}, { dashboardUrl: "https://dash.vercel.app" });
    expect(by(rs, "Dashboard")[0]!.level).toBe("pass");
    const bad = await run({ dashboard: 404 }, { dashboardUrl: "https://dash.vercel.app" });
    expect(by(bad, "Dashboard")[0]!.level).toBe("fail");
    expect(by(bad, "Dashboard")[0]!.detail).toContain("vercel.json");
  });
});

describe("deploy check: what it catches", () => {
  it("an http server behind an https demo (mixed content)", async () => {
    const rs = await runChecks({ demoUrl: DEMO, serverUrl: "http://patchwork-api.example.com" }, fakeNet(), 2000);
    expect(by(rs, "HTTPS")[0]!.level).toBe("fail");
    expect(by(rs, "HTTPS")[0]!.detail).toContain("mixed content");
  });
  it("a server on localhost behind a public demo is a warning (works on this computer only)", async () => {
    const net = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.origin === "http://localhost:4000") return new Response(JSON.stringify({ ok: true, store: "memory", signature: "s", patches: [] }), { status: 200, headers: { "access-control-allow-origin": "*" } });
      return fakeNet({ demoHtml: runtimeTag("http://localhost:4000") })(input, init);
    }) as typeof fetch;
    const rs = await runChecks({ demoUrl: DEMO, serverUrl: "http://localhost:4000" }, net, 2000);
    expect(by(rs, "Server location")[0]!.level).toBe("warn");
    expect(by(rs, "Server location")[0]!.detail).toContain("tunnel");
  });
  it("a server that is down: fails with the reason and stops (no pile of follow-on errors)", async () => {
    const rs = await run({ health: "down" });
    expect(by(rs, "Server health")[0]!.level).toBe("fail");
    expect(by(rs, "Server health")[0]!.detail).toContain("fetch failed");
    expect(by(rs, "CORS")).toHaveLength(0);
  });
  it("something that answers /health but is not Patchwork", async () => {
    const rs = await run({ health: { hello: "world" } });
    expect(by(rs, "Server health")[0]!.level).toBe("fail");
    const err = await run({ health: 502 });
    expect(by(err, "Server health")[0]!.detail).toContain("502");
  });
  it("an in-memory store is a warning that explains the reset", async () => {
    const rs = await run({ health: { ok: true, store: "memory" } });
    expect(by(rs, "Data store")[0]!.level).toBe("warn");
    expect(by(rs, "Data store")[0]!.detail).toContain("resets");
  });
  it("a slow first answer (a sleeping free host) is a warning", async () => {
    const rs = await run({ delayMs: 60 }, { slowMs: 20 });
    expect(by(rs, "Server speed")[0]!.level).toBe("warn");
    expect(by(rs, "Server speed")[0]!.detail).toContain("asleep");
  });
  it("the server not allowing the demo's origin, with the exact fix", async () => {
    const rs = await run({ cors: "none" });
    expect(by(rs, "CORS")[0]!.level).toBe("fail");
    expect(by(rs, "CORS")[0]!.detail).toContain(`Add ${DEMO} to CORS_ORIGINS`);
  });
  it("a live endpoint that does not look right", async () => {
    expect(by(await run({ live: { nope: 1 } }), "Live deployment")[0]!.level).toBe("fail");
    expect(by(await run({ live: 500 }), "Live deployment")[0]!.level).toBe("fail");
  });
  it("a demo page without the runtime, with no data-api, and pointing at the wrong server", async () => {
    expect(by(await run({ demoHtml: "<html><body>hi</body></html>" }), "Runtime tag")[0]!.detail).toContain("never appear");
    const noApi = by(await run({ demoHtml: runtimeTag(null) }), "Runtime tag")[0]!;
    expect(noApi.level).toBe("fail");
    expect(noApi.detail).toContain("localhost:4000");
    const wrong = by(await run({ demoHtml: runtimeTag("http://localhost:4000") }), "Runtime tag")[0]!;
    expect(wrong.level).toBe("fail");
    expect(wrong.detail).toContain("SERVER_URL");
  });
  it("a trailing slash in data-api is fine", async () => {
    expect(by(await run({ demoHtml: runtimeTag(API + "/") }), "Runtime tag")[0]!.level).toBe("pass");
  });
  it("a missing runtime script is a failure; a missing /v2/ page is only a warning", async () => {
    expect(by(await run({ runtimeJs: 404 }), "Runtime script")[0]!.level).toBe("fail");
    expect(by(await run({ runtimeJs: "<html>spa fallback</html>" }), "Runtime script")[0]!.level).toBe("fail");
    expect(by(await run({ v2: 404 }), "Site-update page")[0]!.level).toBe("warn");
  });
  it("bad addresses are reported, not thrown", async () => {
    const rs = await runChecks({ demoUrl: "not a url", serverUrl: "ftp://x" }, fakeNet(), 2000);
    expect(levels(rs)).toEqual(["fail", "fail"]);
  });
});

describe("summarize", () => {
  it("counts problems and warnings and says what to do", () => {
    const text = (rs: CheckResult[]) => summarize(rs).text;
    expect(text([{ level: "fail", name: "a", detail: "x" }])).toContain("1 problem(s) to fix");
    expect(text([{ level: "warn", name: "a", detail: "x" }])).toContain("Ready, with 1");
    expect(text([{ level: "pass", name: "a", detail: "x" }])).toContain("All good");
  });
});
