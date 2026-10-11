/**
 * Builds the extension into ./dist (the folder you "Load unpacked" in Chrome).
 *
 *   node build.mjs                  one-off build
 *   node build.mjs --watch          rebuild on every change (npm run dev)
 *   node build.mjs --outdir=/tmp/x  build somewhere else (used by the tests)
 *
 * Why esbuild and not a Vite plugin: MV3 content scripts cannot use ES `import`,
 * so every entry is bundled into ONE self-contained file (IIFE). esbuild does
 * exactly that, with no plugin layer in between.
 */
import { build, context } from 'esbuild';
import { copyFile, mkdir, rm, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const watch = argv.includes('--watch');
const outArg = argv.find((a) => a.startsWith('--outdir='));
const outdir = path.resolve(outArg ? outArg.slice('--outdir='.length) : path.join(root, 'dist'));

/** output name -> source file. Each becomes dist/<name>.js */
const entries = {
  background: path.join(root, 'src/background/index.ts'),
  content: path.join(root, 'src/content/index.ts'),
  sidepanel: path.join(root, 'src/sidepanel/index.ts'),
};

/** Files copied as-is into dist. */
const staticFiles = ['manifest.json', 'sidepanel.html'];

/** Every file the manifest points at must exist in dist, or Chrome refuses to load it. */
async function assertManifestFilesExist() {
  const manifest = JSON.parse(readFileSync(path.join(outdir, 'manifest.json'), 'utf8'));
  const refs = new Set([
    manifest.background?.service_worker,
    manifest.side_panel?.default_path,
    manifest.action?.default_popup,
    ...(manifest.content_scripts ?? []).flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
    ...Object.values(manifest.icons ?? {}),
  ].filter(Boolean));
  const missing = [];
  for (const ref of refs) {
    try { await access(path.join(outdir, ref)); } catch { missing.push(ref); }
  }
  if (missing.length) throw new Error(`manifest.json references files that were not built: ${missing.join(', ')}`);
}

const copyStatic = {
  name: 'copy-static-and-verify',
  setup(b) {
    b.onEnd(async (result) => {
      if (result.errors.length) return;
      await mkdir(outdir, { recursive: true });
      for (const f of staticFiles) await copyFile(path.join(root, f), path.join(outdir, f));
      try {
        await assertManifestFilesExist();
        console.log(`[build] ok -> ${outdir}`);
      } catch (e) {
        console.error(`[build] ${e.message}`);
        if (!watch) process.exitCode = 1;
      }
    });
  },
};

/**
 * The server a freshly installed extension talks to. Anyone can still change it in the side panel.
 *   PATCHWORK_SERVER_URL=https://your-server node build.mjs
 */
function resolveDefaultServerUrl(raw) {
  if (!raw || !raw.trim()) return '';
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`PATCHWORK_SERVER_URL "${raw}" is not a valid URL. Example: https://patchwork-api.onrender.com`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`PATCHWORK_SERVER_URL must be http(s), got ${url.protocol}`);
  return url.origin;
}
const defaultServerUrl = resolveDefaultServerUrl(process.env.PATCHWORK_SERVER_URL);
if (defaultServerUrl) console.log(`[build] default server URL: ${defaultServerUrl}`);

const options = {
  entryPoints: entries,
  define: { __PATCHWORK_SERVER_URL__: JSON.stringify(defaultServerUrl) },
  outdir,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome114',
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
  plugins: [copyStatic],
};

await rm(outdir, { recursive: true, force: true });

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[build] watching for changes. Reload the extension at chrome://extensions after a rebuild.');
} else {
  try {
    await build(options);
  } catch {
    process.exit(1); // esbuild already printed the errors
  }
}
