import { describe, expect, it } from "vitest";
import { describeBaselineFailure, launchBrowser } from "./verify-env";

describe("launchBrowser", () => {
  it("returns the browser when it starts", async () => {
    const r = await launchBrowser(async () => ({ name: "fake-browser" }));
    expect(r).toEqual({ ok: true, browser: { name: "fake-browser" } });
  });
  it("explains a missing Chromium and names the fix", async () => {
    const r = await launchBrowser(async () => {
      throw new Error("browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome\nLooks like Playwright was just installed");
    });
    expect(r.ok).toBe(false);
    const m = !r.ok ? r.message : "";
    expect(m).toContain("npx playwright install chromium");
    expect(m).toContain("could not start a browser");
    expect(m).not.toContain("Looks like Playwright"); // only the first line of the raw error
  });
  it("explains any other launch failure without the install hint", async () => {
    const r = await launchBrowser(async () => {
      throw new Error("out of memory");
    });
    expect(r.ok).toBe(false);
    const m = !r.ok ? r.message : "";
    expect(m).toContain("out of memory");
    expect(m).not.toContain("playwright install");
  });
  it("copes with a thrown string", async () => {
    const r = await launchBrowser(async () => {
      throw "boom";
    });
    expect(!r.ok && r.message).toContain("boom");
  });
});

describe("describeBaselineFailure", () => {
  it("blames the environment and says the server must be able to open the page", () => {
    const m = describeBaselineFailure("http://localhost:4100/", new Error("page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4100/\nCall log:..."));
    expect(m).toContain("http://localhost:4100/");
    expect(m).toContain("ERR_CONNECTION_REFUSED");
    expect(m).toContain("not reachable from a hosted server");
    expect(m).not.toContain("Call log");
  });
});
