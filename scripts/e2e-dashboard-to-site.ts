/**
 * End-to-end check: "what I do in the dashboard shows up on the demo site".
 *
 * Starts the real Patchwork server + demo site, performs the same API calls the
 * dashboard buttons make, and after each one "visits" the demo site (fetches its
 * real HTML and runs the real patchwork-runtime.js in happy-dom) to see what a
 * visitor would see.
 *
 *   npx tsx scripts/e2e-dashboard-to-site.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'http://localhost:4000';
const SITE = 'http://localhost:4100';
const DEV = '00000000-0000-0000-0000-000000000001';
const runtimeSrc = fs.readFileSync(path.join(root, 'apps/demo-site/public/shared/patchwork-runtime.js'), 'utf8');

const procs: ChildProcess[] = [];
const start = (cmd: string, args: string[]) => {
  const p = spawn(cmd, args, { cwd: root, stdio: 'ignore', detached: true, env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '', SUPABASE_ANON_KEY: '' } });
  procs.push(p);
};
const waitFor = async (url: string) => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout waiting for ${url}`);
};
const post = async (p: string, body?: unknown, method = 'POST') => {
  const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(j)}`);
  return j as any;
};

/** What a visitor sees: real HTML + real runtime, patches applied once. */
async function visit(query = '') {
  const html = (await (await fetch(`${SITE}/${query}`)).text())
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]*>/g, '');
  const win = new Window({ url: `${SITE}/${query}` });
  win.document.documentElement.innerHTML = html;
  Object.assign(globalThis, { window: win, document: win.document, XPathResult: (win as any).XPathResult, location: win.location });
  (win as any).PATCHWORK_API = API;
  (win as any).PATCHWORK_POLL = 3_600_000; // we simulate reloads ourselves
  (0, eval)(runtimeSrc);
  await (win as any).Patchwork.pollLive?.();
  if (query.includes('preview_patch')) await new Promise((r) => setTimeout(r, 800));
  const text = (sel: string) => win.document.querySelector(sel)?.textContent?.trim() ?? null;
  return { win, text, hasBanner: !!win.document.getElementById('patchwork-preview-banner') };
}

let failures = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
};

async function main() {
  start('npx', ['tsx', 'apps/server/src/index.ts']);
  start('npx', ['tsx', 'apps/demo-site/src/server.ts']);
  await waitFor(`${API}/health`);
  await waitFor(`${SITE}/status`);

  const logoPatch = {
    target_url: `${SITE}/`, base_version: 0,
    anchors: { cssSelector: '.logo', xpath: '', textContent: '', attributes: {}, parentContext: '', siblingContext: [] },
    change: { type: 'text', value: 'SuperStore' }, author_id: DEV,
  };

  let v = await visit();
  check('seed: live checkout text patch is visible', v.text('#checkout-btn'), 'Pay & Complete Order');
  check('seed: logo untouched', v.text('.logo'), 'TechMart');

  const created = await post('/patches', logoPatch);
  v = await visit();
  check('a draft is NOT visible to visitors', v.text('.logo'), 'TechMart');

  v = await visit(`?preview_patch=${created.id}`);
  check('preview shows the draft on top of live', v.text('.logo'), 'SuperStore');
  check('preview shows the banner', v.hasBanner, true);
  v = await visit();
  check('preview did not leak to normal visitors', v.text('.logo'), 'TechMart');

  const before = (await (await fetch(`${API}/deployments/live`)).json()).signature;
  await post(`/patches/${created.id}/deploy`);
  const after = (await (await fetch(`${API}/deployments/live`)).json()).signature;
  check('deploy changes the live signature (triggers browser reload)', before !== after, true);
  v = await visit();
  check('after Deploy: logo changed on the site', v.text('.logo'), 'SuperStore');
  check('after Deploy: earlier live patches survive', v.text('#checkout-btn'), 'Pay & Complete Order');

  await post(`/patches/${created.id}`, { change: { type: 'text', value: 'MegaMart' } }, 'PUT');
  v = await visit();
  check('editing a live patch updates the site', v.text('.logo'), 'MegaMart');

  await post('/rollback');
  v = await visit();
  check('Rollback: logo back to original', v.text('.logo'), 'TechMart');
  check('Rollback: previous version restored (checkout patch still there)', v.text('#checkout-btn'), 'Pay & Complete Order');

  await post(`/patches/${created.id}/deploy`);
  await post(`/patches/${created.id}/undeploy`);
  v = await visit();
  check('Remove from live: logo original again', v.text('.logo'), 'TechMart');

  await post(`/patches/${created.id}/deploy`);
  await post(`/patches/${created.id}`, undefined, 'DELETE');
  v = await visit();
  check('Delete a live patch: removed from the site', v.text('.logo'), 'TechMart');

  // each rollback steps back one deployment; keep going until nothing is live
  for (let i = 0; i < 30; i++) { if (!(await fetch(`${API}/rollback`, { method: 'POST' })).ok) break; }
  v = await visit();
  check('Rolled back everything: original site', v.text('#checkout-btn'), 'Checkout');

  const deps = await (await fetch(`${API}/deployments`)).json();
  const first = deps.find((d: any) => d.versions?.number === 1);
  await post(`/deployments/${first.id}/activate`);
  await post('/deploy/v2').catch(() => null);
  await fetch(`${SITE}/deploy/v2`, { method: 'POST' });
  v = await visit();
  check('site v2 (button moved + renamed): patch is healed onto it', v.text('#place-order-btn'), 'Pay & Complete Order');
  check('site v2: other buttons untouched', v.win.document.querySelector('.btn-add')?.textContent, 'Add to Cart');
  await fetch(`${SITE}/deploy/v1`, { method: 'POST' });

  // --- the "Smart Watch" scenario: three titles share the .product-title selector ---
  const titles = (vv: Awaited<ReturnType<typeof visit>>) =>
    Array.from(vv.win.document.querySelectorAll('.product-title')).map((e: any) => e.textContent.trim());
  await fetch(`${SITE}/deploy/v1`, { method: 'POST' });
  const ai1 = await post('/ai/patch', {
    instruction: 'Change Wireless Headphones to Wired Earphones',
    element_context: '<h3 class="product-title">Wireless Headphones</h3>', target_url: `${SITE}/`,
  });
  await post(`/patches/${ai1.draft.id}/deploy`);
  const ai2 = await post('/ai/patch', {
    instruction: 'Change Smart Watch to Analog Watch',
    element_context: '<h3 class="product-title">Smart Watch</h3>', target_url: `${SITE}/`,
  });
  check('AI patch for Smart Watch: right text and a text hint',
    [ai2.draft.change.value, ai2.draft.anchors.textContent], ['Analog Watch', 'Smart Watch']);
  v = await visit(`?preview_patch=${ai2.draft.id}`);
  check('preview changes ONLY the Smart Watch title', titles(v), ['Wired Earphones', 'Analog Watch', 'USB-C Hub']);
  await post(`/patches/${ai2.draft.id}/deploy`);
  v = await visit();
  check('after Deploy: both titles patched, each on its own element', titles(v), ['Wired Earphones', 'Analog Watch', 'USB-C Hub']);
  const ai3 = await post('/ai/patch', { instruction: 'Change USB-C Hub to Charging Hub', target_url: `${SITE}/` });
  await post(`/patches/${ai3.draft.id}/deploy`);
  v = await visit();
  check('no pasted HTML: found by its text alone', titles(v), ['Wired Earphones', 'Analog Watch', 'Charging Hub']);

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
}

main()
  .catch((e) => { console.error(e); failures++; })
  .finally(() => { procs.forEach((p) => { try { process.kill(-p.pid!, 'SIGTERM'); } catch { /* already gone */ } }); setTimeout(() => process.exit(failures ? 1 : 0), 300); });
