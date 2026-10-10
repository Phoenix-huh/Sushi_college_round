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

/** Stands in for the Patchwork server in phase 1 (which only needs GET /health). Records who called. */
function startFakeServer() {
  const state = { mode: 'ok' as 'ok' | 'not-patchwork', actors: [] as string[] };
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') {
      state.actors.push(String(req.headers['x-actor-id']));
      res.end(JSON.stringify(state.mode === 'ok' ? { ok: true, timestamp: new Date().toISOString(), supabase: 'not configured', store: 'memory' } : { hello: 'world' }));
    } else {
      res.writeHead(404).end(JSON.stringify({ error: 'not found' }));
    }
  });
  return new Promise<{ url: string; state: typeof state; close: () => void }>((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, state, close: () => { server.closeAllConnections(); server.close(); } });
    }),
  );
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
  const loaded = await waitUntil(async () => (await panel.inputValue('#serverUrl').catch(() => '')) !== '');
  check('side panel page loads and its script runs (settings form is filled in)', loaded);
  check('no errors in the side panel console', panelWatch.errors.length === 0, panelWatch.errors);
  await panel.close();
}

// ---------------------------------------------------------------- phase 1
async function phase1(ctx: BrowserContext, extId: string, debugPort: number) {
  console.log('\n-- phase 1: settings, messages, connection status --');
  const DEFAULT_ID = '00000000-0000-0000-0000-000000000001';
  const OTHER_ID = 'abcdef12-0000-4000-8000-abcdef123456';
  const fake = await startFakeServer();

  const panel = await ctx.newPage();
  const watch = watchPage(panel);
  await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
  const status = async () => ({
    state: await panel.getAttribute('#conn-dot', 'data-state'),
    text: (await panel.textContent('#conn-text')) ?? '',
    hint: (await panel.textContent('#conn-hint')) ?? '',
  });
  const msg = () => panel.textContent('#settings-msg').then((t) => t ?? '');
  const save = async (url?: string, id?: string) => {
    if (url !== undefined) await panel.fill('#serverUrl', url);
    if (id !== undefined) await panel.fill('#authorId', id);
    await panel.click('#settings-save');
  };

  // defaults
  await waitUntil(async () => (await panel.inputValue('#serverUrl')) !== '');
  check('default settings are shown', (await panel.inputValue('#serverUrl')) === 'http://localhost:4000' && (await panel.inputValue('#authorId')) === DEFAULT_ID);

  // connect to the fake server
  await save(fake.url + '/');
  check('saving shows a confirmation and the cleaned-up URL', (await waitUntil(async () => (await msg()) === 'Saved.')) && (await panel.inputValue('#serverUrl')) === fake.url);
  check('status turns green with the server URL and data store', await waitUntil(async () => { const s = await status(); return s.state === 'connected' && s.text.includes(fake.url) && s.hint.includes('memory'); }), await status());
  check('server received the default author id as x-actor-id', fake.state.actors.length > 0 && fake.state.actors.every((a) => a === DEFAULT_ID), fake.state.actors);

  // a new author id is used straight away
  fake.state.actors.length = 0;
  await save(undefined, OTHER_ID.toUpperCase());
  check('a new author id is sent on the next check (lowercased)', await waitUntil(() => fake.state.actors.includes(OTHER_ID)), fake.state.actors);

  // invalid input is refused and changes nothing
  await save('banana');
  check('an invalid URL shows an error', await waitUntil(async () => (await msg()).includes('not a valid URL')), await msg());
  await save(fake.url, 'not-a-uuid');
  check('an invalid author id shows an error', await waitUntil(async () => (await msg()).includes('UUID')), await msg());
  await panel.reload();
  await waitUntil(async () => (await panel.inputValue('#serverUrl')) !== '');
  check('invalid saves changed nothing (settings persist across reload)', (await panel.inputValue('#serverUrl')) === fake.url && (await panel.inputValue('#authorId')) === OTHER_ID);

  // protocol: unknown / malformed messages get an error reply, not silence
  const bad = await panel.evaluate(async () => [
    await chrome.runtime.sendMessage({ type: 'NOPE' }),
    await chrome.runtime.sendMessage({ type: 'constructor' }),
    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS' }),
    await chrome.runtime.sendMessage('hello'),
  ]);
  check('unknown or malformed messages are answered with ok:false', bad.every((r: any) => r && r.ok === false), bad);

  // MV3: the service worker sleeps. Stop it, then everything must still work.
  const cdp = await ctx.newCDPSession(panel);
  await cdp.send('ServiceWorker.enable');
  const workerTargets = async () =>
    ((await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()) as any[]).filter((t) => t.type === 'service_worker' && String(t.url).startsWith(`chrome-extension://${extId}/`));
  const before = await workerTargets();
  await cdp.send('ServiceWorker.stopAllWorkers');
  check('the service worker was really stopped (its target is gone)', before.length > 0 && (await waitUntil(async () => (await workerTargets()).length === 0, 5000)), { before: before.length, after: (await workerTargets()).length });
  const afterSleep = await panel.evaluate(async () => ({
    cached: await chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }),
    settings: await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
  }));
  check('after the worker was stopped: settings survive', afterSleep.settings?.ok === true && afterSleep.settings.data.serverUrl === fake.url, afterSleep.settings);
  check('after the worker was stopped: last connection status survives (session storage)', afterSleep.cached?.ok === true && afterSleep.cached.data?.state === 'connected', afterSleep.cached);
  await panel.click('#conn-recheck');
  check('after the worker was stopped: it wakes up and checks again', await waitUntil(async () => (await status()).state === 'connected'), await status());

  // something answers, but it is not Patchwork
  fake.state.mode = 'not-patchwork';
  await panel.click('#conn-recheck');
  check('a non-Patchwork server is reported as not connected', await waitUntil(async () => { const s = await status(); return s.state === 'offline' && s.text.includes('not a Patchwork server'); }), await status());

  // server goes away
  fake.close();
  await panel.click('#conn-recheck');
  check('a stopped server turns the indicator red with a clear reason', await waitUntil(async () => { const s = await status(); return s.state === 'offline' && s.text.includes('Cannot reach'); }), await status());

  // the panel re-checks on its own, so it recovers without a click
  const back = await startFakeServer();
  await save(back.url);
  check('pointing at a running server recovers', await waitUntil(async () => (await status()).state === 'connected'), await status());
  back.close();

  check('no errors in the side panel console during phase 1', watch.errors.filter((e) => !/Failed to load resource|ERR_CONNECTION_REFUSED/.test(e)).length === 0, watch.errors);
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

  // CHROME_PATH=/path/to/chrome uses that browser instead of Playwright's Chromium (any Chrome 114+ works).
  // Extensions only load in the full browser, so for a custom binary we ask for "new headless" ourselves.
  const custom = process.env.CHROME_PATH;
  if (custom && !process.env.HEADED) args.push('--headless=new');
  const ctx = await chromium.launchPersistentContext(profile, {
    ...(custom
      ? { executablePath: custom, headless: false }
      : { channel: 'chromium' as const, headless: !process.env.HEADED }), // full Chromium: the only build that loads extensions in new headless mode
    args,
  });

  try {
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
    const extId = new URL(sw.url()).host;
    const swWatch = watchServiceWorkerErrors(debugPort, extId);

    await phase0(ctx, site.url, extId);
    await phase1(ctx, extId, debugPort);

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
