/**
 * Builds the demo store as plain static files for Vercel (or any static host) into ./dist.
 *
 * The local demo server (src/server.ts) is stateful and injects the Patchwork runtime on every request.
 * A static host cannot do that, so this does the injection once, at build time:
 *
 *   dist/index.html       the store (version 1) + the Patchwork runtime pointed at SERVER_URL
 *   dist/v1/index.html    same as above
 *   dist/v2/index.html    the "site was updated" version (renamed button ids), for the self-healing demo
 *   dist/shared/          patchwork-runtime.js, styles.css, demo-controls.js
 *
 * Environment (set it in the Vercel project settings):
 *   SERVER_URL   required. The public https address of the Patchwork server, e.g. https://patchwork-api.onrender.com
 *
 * Run it:  SERVER_URL=https://your-server node build-static.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, 'public');
const out = path.join(root, 'dist');

/** Returns the clean origin or relative path of the server, or throws a message that says what to fix. */
export function resolveServerUrl(raw) {
  const trimmed = (raw && raw.trim()) ? raw.trim() : '/api';
  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '') || '/';
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`SERVER_URL "${raw}" is not a valid URL. Example: /api or https://patchwork-api.onrender.com`);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) {
    throw new Error(
      `SERVER_URL "${raw}" is not https. A page served over https cannot fetch from an http server (the browser blocks it as mixed content).`,
    );
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`SERVER_URL must be http(s), got ${url.protocol}`);
  return url.origin;
}

/** Adds the demo controls and the Patchwork runtime just before </body>. */
export function injectRuntime(html, serverUrl) {
  if (!html.includes('</body>')) throw new Error('page has no </body> to inject the runtime before');
  const tags =
    '<script src="/shared/demo-controls.js"></script>' +
    `<script src="/shared/patchwork-runtime.js" data-api="${serverUrl}"></script>`;
  return html.replace('</body>', `${tags}</body>`);
}

export function build(serverUrl) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'shared'), { recursive: true });
  for (const f of fs.readdirSync(path.join(pub, 'shared'))) fs.copyFileSync(path.join(pub, 'shared', f), path.join(out, 'shared', f));

  for (const v of ['v1', 'v2']) {
    const html = injectRuntime(fs.readFileSync(path.join(pub, v, 'index.html'), 'utf8'), serverUrl);
    fs.mkdirSync(path.join(out, v), { recursive: true });
    fs.writeFileSync(path.join(out, v, 'index.html'), html);
    if (v === 'v1') fs.writeFileSync(path.join(out, 'index.html'), html);
  }
}

// Run only when executed directly (so tests can import the functions above).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const serverUrl = resolveServerUrl(process.env.SERVER_URL);
    build(serverUrl);
    console.log(`[demo-site] static build ok -> ${out}`);
    console.log(`[demo-site] patches are loaded from ${serverUrl}`);
  } catch (e) {
    console.error(`[demo-site] build failed: ${e.message}`);
    process.exit(1);
  }
}
