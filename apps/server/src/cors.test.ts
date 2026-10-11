import { describe, expect, it } from "vitest";
import { isOriginAllowed, parseCorsOrigins } from "./cors";

describe("parseCorsOrigins", () => {
  it("splits, trims and drops trailing slashes", () => {
    expect(parseCorsOrigins(" https://a.vercel.app/ , https://b.test ")).toEqual(["https://a.vercel.app", "https://b.test"]);
  });
  it("ignores empty values and the placeholder from .env.example", () => {
    expect(parseCorsOrigins("")).toEqual([]);
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins("http://localhost:5173,chrome-extension://your-extension-id")).toEqual(["http://localhost:5173"]);
  });
});

describe("isOriginAllowed", () => {
  it("allows requests with no Origin header (curl, the extension, server to server)", () => {
    expect(isOriginAllowed(undefined, ["https://a.test"])).toBe(true);
    expect(isOriginAllowed(undefined, [])).toBe(true);
  });
  it("allows every origin when no allowlist is set (local development)", () => {
    expect(isOriginAllowed("https://anything.example", [])).toBe(true);
  });
  it("with an allowlist: allows listed origins (with or without a trailing slash) and refuses others", () => {
    const allowed = ["https://demo.vercel.app", "https://dash.vercel.app"];
    expect(isOriginAllowed("https://demo.vercel.app", allowed)).toBe(true);
    expect(isOriginAllowed("https://demo.vercel.app/", allowed)).toBe(true);
    expect(isOriginAllowed("https://evil.example", allowed)).toBe(false);
    expect(isOriginAllowed("https://demo.vercel.app.evil.example", allowed)).toBe(false);
    expect(isOriginAllowed("http://demo.vercel.app", allowed)).toBe(false); // scheme matters
  });
  it("with an allowlist: localhost on any port still works, so the local demo is not broken by a public setting", () => {
    const allowed = ["https://demo.vercel.app"];
    for (const o of ["http://localhost:4100", "http://localhost:5173", "http://127.0.0.1:4100", "http://[::1]:4100"]) {
      expect(isOriginAllowed(o, allowed)).toBe(true);
    }
    expect(isOriginAllowed("http://localhost.evil.example", allowed)).toBe(false);
    expect(isOriginAllowed("http://localhost:4100.evil.example", allowed)).toBe(false);
  });
});
