/**
 * End-to-end test for the Chrome extension, run in a REAL Chromium with the
 * built extension loaded (apps/extension/dist).
 *
 *   npx tsx scripts/e2e-extension.ts            headless
 *   HEADED=1 npx tsx scripts/e2e-extension.ts   watch it happen in a window
 *
 * It builds the extension first, so you do not need to run the build yourself.
 * Each phase of the extension adds its own checks below; earlier checks keep running.
 *
 * Playwright does not expose service-worker console output, so errors inside the
 * background worker are collected over the Chrome DevTools Protocol directly.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Page } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extDir = path.join(root, 'apps/extension/dist');

let failures = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ''}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

/** A tiny page for the content script to run on, so this phase needs no other server. */
function startTestSite(): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><html><head><title>Test site</title></head><body><h1 id="x">Hello</h1></body></html>');
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    }),
  );
}

/**
 * Collects console.error calls and uncaught exceptions from the extension's
 * service worker. A worker that went to sleep and restarts is a new target, so
 * we keep looking for targets while the test runs.
 */
function watchServiceWorkerErrors(debugPort: number, extId: string) {
  const errors: string[] = [];
  const attached = new Set<string>();
  let stopped = false;
  const sockets: WebSocket[] = [];

  const attach = (wsUrl: string) => {
    const ws = new WebSocket(wsUrl);
    sockets.push(ws);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.onmessage = (m) => {
      const d = JSON.parse(String(m.data));
      if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'assert')) {
        errors.push('console.' + d.params.type + ': ' + d.params.args.map((a: any) => a.value ?? a.description).join(' '));
      } else if (d.method === 'Runtime.exceptionThrown') {
        errors.push('exception: ' + (d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text));
      }
    };
  };

  const loop = (async () => {
    while (!stopped) {
      try {
        const list = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()) as any[];
        for (const t of list) {
          if (t.type === 'service_worker' && String(t.url).startsWith(`chrome-extension://${extId}/`) && !attached.has(t.id)) {
            attached.add(t.id);
            attach(t.webSocketDebuggerUrl);
          }
        }
      } catch { /* browser not ready yet */ }
      await sleep(300);
    }
  })();

  return {
    errors,
    async stop() { stopped = true; await loop; sockets.forEach((s) => { try { s.close(); } catch { /* already closed */ } }); },
  };
}

/** Records console errors and uncaught exceptions on a page. */
function watchPage(page: Page) {
  const messages: string[] = [];
  const errors: string[] = [];
  page.on('console', (m) => {
    messages.push(m.text());
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return { messages, errors };
}

async function waitUntil(fn: () => boolean | Promise<boolean>, ms = 8000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(100);
  }
  return false;
}

// ---------------------------------------------------------------- phase 0
async function phase0(ctx: BrowserContext, siteUrl: string, extId: string) {
  console.log('\n-- phase 0: skeleton loads --');

  const sw = ctx.serviceWorkers().find((w) => w.url().startsWith(`chrome-extension://${extId}/`));
  check('service worker is background.js from dist', !!sw && sw.url().endsWith('/background.js'), sw?.url());

  const behavior = sw ? await sw.evaluate(() => (chrome as any).sidePanel.getPanelBehavior()) : null;
  check('toolbar icon is set to open the side panel', behavior?.openPanelOnActionClick === true, behavior);

  const page = await ctx.newPage();
  const watch = watchPage(page);
  await page.goto(siteUrl);
  const announced = await waitUntil(() => watch.messages.some((m) => m.includes('[Patchwork] content script loaded')));
  check('content script runs on an http page', announced, watch.messages);
  const untouched = await page.evaluate(() => document.body.children.length === 1 && document.getElementById('x')?.textContent === 'Hello');
  check('content script leaves the page untouched', untouched);
  check('no errors in the page console', watch.errors.length === 0, watch.errors);
  await page.close();

  const panel = await ctx.newPage();
  const panelWatch = watchPage(panel);
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  const loaded = await waitUntil(async () => ((await panel.textContent('#status')) ?? '').includes('loaded'));
  check('side panel page loads and its script runs', loaded);
  check('no errors in the side panel console', panelWatch.errors.length === 0, panelWatch.errors);
  await panel.close();
}

// ---------------------------------------------------------------- main
async function main() {
  console.log('Building the extension...');
  const built = spawnSync('node', ['apps/extension/build.mjs'], { cwd: root, stdio: 'inherit' });
  if (built.status !== 0) throw new Error('extension build failed');

  const site = await startTestSite();
  const debugPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patchwork-e2e-'));
  const args = [`--remote-debugging-port=${debugPort}`, `--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`];
  if (process.getuid?.() === 0) args.push('--no-sandbox'); // Chromium refuses to run as root otherwise (CI/containers)

  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', // the full Chromium build; the only one that supports extensions in new headless mode
    headless: !process.env.HEADED,
    args,
  });

  try {
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
    const extId = new URL(sw.url()).host;
    const swWatch = watchServiceWorkerErrors(debugPort, extId);

    await phase0(ctx, site.url, extId);

    await sleep(500); // let late errors arrive
    check('no errors in the service worker', swWatch.errors.length === 0, swWatch.errors);
    await swWatch.stop();
  } finally {
    await ctx.close();
    site.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  console.log(failures === 0 ? '\nAll extension e2e checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
