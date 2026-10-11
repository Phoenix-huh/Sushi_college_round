/**
 * Telling "verification could not run here" apart from "verification ran and the patch failed".
 *
 * Verification needs a real browser on the server and a way to reach the page. A hosted server often has
 * neither (no Chromium installed, or the page is on someone's laptop). That is not the patch's fault, and it
 * must never be treated as a failed verification, because a failed verification of the LIVE version
 * automatically rolls it back.
 */

export type Launched<B> = { ok: true; browser: B } | { ok: false; message: string };

const firstLine = (s: string) => s.split("\n")[0]!.trim();

/** Starts a browser, or explains why it cannot (with the command that fixes the common case). */
export async function launchBrowser<B>(launch: () => Promise<B>): Promise<Launched<B>> {
  try {
    return { ok: true, browser: await launch() };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const notInstalled = /executable doesn't exist|playwright install|failed to launch|cannot find module 'playwright/i.test(raw);
    return {
      ok: false,
      message:
        `This server could not start a browser, so verification cannot run here` +
        (notInstalled ? ` (Chromium is not installed: run "npx playwright install chromium" on the server)` : ``) +
        `: ${firstLine(raw)}`,
    };
  }
}

/** The page WITHOUT any patches could not be checked: the problem is the environment, not the patch. */
export function describeBaselineFailure(targetUrl: string, e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return (
    `Verification could not check the original page at ${targetUrl} (${firstLine(raw)}). ` +
    `The server running verification must be able to open that address; a page on localhost or a private network is not reachable from a hosted server.`
  );
}
