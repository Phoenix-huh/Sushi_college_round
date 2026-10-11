import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import liveHandler, { getLiveDeploymentData } from "./deployments/live.js";
import patchHandler, { getPatchById } from "./patches/[id].js";
import { resolveServerUrl } from "../build-static.mjs";

function mockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null,
    setHeader(key: string, value: string) {
      res.headers[key.toLowerCase()] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
    end(raw: string) {
      try {
        res.body = JSON.parse(raw);
      } catch {
        res.body = raw;
      }
      return res;
    },
  };
  return res;
}

describe("Demo Site Serverless API & Static Build", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_URL = "https://fake.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "fake-service-key-12345678901234567890";
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  describe("build-static.mjs resolveServerUrl", () => {
    it("accepts /api as same-origin endpoint", () => {
      expect(resolveServerUrl("/api")).toBe("/api");
      expect(resolveServerUrl("/api/")).toBe("/api");
    });

    it("defaults to /api when SERVER_URL is unset", () => {
      expect(resolveServerUrl("")).toBe("/api");
      expect(resolveServerUrl(undefined as any)).toBe("/api");
    });

    it("accepts valid https server URLs", () => {
      expect(resolveServerUrl("https://example.com")).toBe("https://example.com");
      expect(resolveServerUrl("https://example.com/")).toBe("https://example.com");
    });

    it("accepts localhost http server URLs", () => {
      expect(resolveServerUrl("http://localhost:4000")).toBe("http://localhost:4000");
    });

    it("rejects non-https public remote URLs", () => {
      expect(() => resolveServerUrl("http://insecure.example.com")).toThrow(/not https/);
    });
  });

  describe("GET /api/deployments/live", () => {
    it("returns 500 when Supabase env is missing", async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      const req: any = { method: "GET" };
      const res = mockResponse();

      await liveHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toMatch(/Supabase credentials are not configured/);
    });

    it("returns live deployment with patches in strict order", async () => {
      const fakeDeployments = [
        {
          id: "dep-1",
          version_id: "ver-1",
          is_live: true,
          versions: {
            id: "ver-1",
            patch_ids: ["patch-b", "patch-a"],
          },
        },
      ];

      // Note: database returns patches in arbitrary order (patch-a first)
      const fakePatches = [
        { id: "patch-a", updated_at: "2026-10-11T01:00:00Z", title: "Patch A" },
        { id: "patch-b", updated_at: "2026-10-11T02:00:00Z", title: "Patch B" },
      ];

      const fakeFetch = vi.fn(async (url: string) => {
        if (url.includes("deployments?is_live=eq.true")) {
          return { ok: true, json: async () => fakeDeployments } as any;
        }
        if (url.includes("patches?id=in")) {
          return { ok: true, json: async () => fakePatches } as any;
        }
        return { ok: false, status: 404, text: async () => "Not found" } as any;
      });

      const data = await getLiveDeploymentData(fakeFetch);

      expect(data.deployment.id).toBe("dep-1");
      expect(data.version.id).toBe("ver-1");
      expect(data.patches).toHaveLength(2);
      // Order must match version.patch_ids ("patch-b" first, then "patch-a")
      expect(data.patches[0].id).toBe("patch-b");
      expect(data.patches[1].id).toBe("patch-a");
      expect(data.signature).toBe("dep-1|patch-b@2026-10-11T02:00:00Z,patch-a@2026-10-11T01:00:00Z");
    });

    it("returns null deployment and signature 'none' when no live deployment exists or rolled back", async () => {
      const fakeFetch = vi.fn(async () => {
        return { ok: true, json: async () => [] } as any;
      });

      const data = await getLiveDeploymentData(fakeFetch);

      expect(data.deployment).toBeNull();
      expect(data.version).toBeNull();
      expect(data.patches).toEqual([]);
      expect(data.signature).toBe("none");
    });

    it("handler sets caching headers: s-maxage=2, stale-while-revalidate=5", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).includes("deployments?is_live=eq.true")) {
          return { ok: true, json: async () => [] } as any;
        }
        return { ok: false, status: 404, text: async () => "Not found" } as any;
      });

      const req: any = { method: "GET" };
      const res = mockResponse();

      await liveHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toBe("s-maxage=2, stale-while-revalidate=5");
      expect(res.body.signature).toBe("none");
    });
  });

  describe("GET /api/patches/:id", () => {
    it("returns 500 when Supabase env is missing", async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
      delete process.env.SUPABASE_ANON_KEY;

      const req: any = { query: { id: "patch-1" } };
      const res = mockResponse();

      await patchHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toMatch(/Supabase credentials are not configured/);
    });

    it("returns 400 when id is missing", async () => {
      const req: any = { query: {}, url: "/api/patches/" };
      const res = mockResponse();

      await patchHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Missing patch id/);
    });

    it("returns 404 when patch does not exist", async () => {
      const fakeFetch = vi.fn(async () => {
        return { ok: true, json: async () => [] } as any;
      });
      vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);

      const req: any = { query: { id: "non-existent-id" } };
      const res = mockResponse();

      await patchHandler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe("Patch not found");
    });

    it("returns the patch with 200 and caching header when found", async () => {
      const fakePatch = { id: "patch-123", title: "Checkout button glow", change: { type: "style" } };
      const fakeFetch = vi.fn(async (url: any) => {
        if (String(url).includes("patches?id=eq.patch-123")) {
          return { ok: true, json: async () => [fakePatch] } as any;
        }
        return { ok: true, json: async () => [] } as any;
      });
      vi.spyOn(globalThis, "fetch").mockImplementation(fakeFetch);

      const req: any = { query: { id: "patch-123" } };
      const res = mockResponse();

      await patchHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(fakePatch);
      expect(res.headers["cache-control"]).toBe("s-maxage=2, stale-while-revalidate=5");
    });
  });
});
