import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'patchwork-ext-build-'));

afterAll(() => fs.rmSync(out, { recursive: true, force: true }));

describe('extension build', () => {
  it('builds, and every file the manifest points at exists', () => {
    // build.mjs exits non-zero (so this throws) if the manifest references a missing file
    execFileSync(process.execPath, ['build.mjs', `--outdir=${out}`], { cwd: extRoot, stdio: 'pipe' });

    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.manifest_version).toBe(3);

    const refs: string[] = [
      manifest.background.service_worker,
      manifest.side_panel.default_path,
      ...manifest.content_scripts.flatMap((c: { js: string[] }) => c.js),
    ];
    for (const ref of refs) {
      expect(fs.existsSync(path.join(out, ref)), `${ref} should exist in dist`).toBe(true);
    }
  }, 60_000);

  it('bundles scripts as single files with no ES module syntax (content scripts cannot import)', () => {
    for (const file of ['content.js', 'marker.js', 'background.js', 'sidepanel.js']) {
      const code = fs.readFileSync(path.join(out, file), 'utf8');
      expect(/^\s*(import|export)\s/m.test(code), `${file} must not contain import/export statements`).toBe(false);
    }
  });

  it('only runs on http(s) pages and never asks for broader access than needed', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.content_scripts[0].matches).toEqual(['http://*/*', 'https://*/*']);
    expect(manifest.permissions).toEqual(['storage', 'sidePanel']);
  });
});
