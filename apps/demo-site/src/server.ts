import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.DEMO_PORT || 4100;

app.use(express.json());

let currentVersion: 'v1' | 'v2' = 'v1';
let isBroken = false;

// Serve static assets from shared folder
app.use('/shared', express.static(path.join(__dirname, '../public/shared')));

app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, `../public/${currentVersion}/index.html`);
  let html = fs.readFileSync(htmlPath, 'utf8');

  if (isBroken) {
    const errorScript = `
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          const btn = document.getElementById('checkout-btn') || document.getElementById('place-order-btn');
          if (btn) {
            btn.onclick = () => {
              throw new Error('Checkout process is broken');
            };
          }
        });
      </script>
    `;
    html = html.replace('</body>', `${errorScript}</body>`);
  }

  const patchworkRuntimeScript = `
    <!-- PATCHWORK CLIENT RUNTIME APPLIER -->
    <script>
      (function() {
        const urlParams = new URLSearchParams(window.location.search);
        const previewPatchId = urlParams.get('preview_patch');

        function applyPatchToElement(el, patch) {
          if (!el || !patch || !patch.change) return;
          const { type, value } = patch.change;
          if (type === 'text') {
            el.textContent = value;
          } else if (type === 'style') {
            try {
              const styles = typeof value === 'string' ? JSON.parse(value) : value;
              Object.assign(el.style, styles);
            } catch (e) {
              el.setAttribute('style', value);
            }
          } else if (type === 'visibility') {
            el.style.display = value === 'hidden' ? 'none' : 'block';
          } else if (type === 'script') {
            try {
              const fn = new Function('target', value);
              fn(el);
            } catch (err) {
              console.warn('[Patchwork] Script patch execution error:', err);
            }
          }
        }

        function findTargetElement(patch) {
          let el = document.querySelector(patch.anchors.cssSelector);
          if (el) return el;
          // Fallback / Auto-healing heuristic for demo v1 vs v2
          if (patch.anchors.cssSelector.includes('checkout-btn')) {
            el = document.querySelector('#place-order-btn') || document.querySelector('.btn-checkout');
          } else if (patch.anchors.cssSelector.includes('place-order-btn')) {
            el = document.querySelector('#checkout-btn') || document.querySelector('.btn-checkout');
          }
          return el;
        }

        function renderPreviewBanner(patch) {
          let banner = document.getElementById('patchwork-preview-banner');
          if (!banner) {
            banner = document.createElement('div');
            banner.id = 'patchwork-preview-banner';
            banner.style.position = 'fixed';
            banner.style.bottom = '0';
            banner.style.left = '0';
            banner.style.width = '100%';
            banner.style.backgroundColor = '#d97706';
            banner.style.color = '#ffffff';
            banner.style.textAlign = 'center';
            banner.style.padding = '10px 16px';
            banner.style.fontWeight = 'bold';
            banner.style.fontSize = '14px';
            banner.style.zIndex = '999999';
            banner.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.15)';
            banner.style.display = 'flex';
            banner.style.justifyContent = 'space-between';
            banner.style.alignItems = 'center';
            document.body.appendChild(banner);
          }
          banner.innerHTML = \`
            <span>⚡ PATCHWORK PREVIEW MODE (DRAFT: \${patch.id.slice(0, 8)}...) — \${patch.change.type}: \${patch.change.value}</span>
            <a href="/" style="color: #fff; background: rgba(0,0,0,0.25); padding: 4px 10px; border-radius: 4px; text-decoration: none; font-size: 12px;">Exit Preview</a>
          \`;
        }

        async function initPatchwork() {
          if (previewPatchId) {
            try {
              const res = await fetch('http://localhost:4000/patches/' + previewPatchId);
              if (res.ok) {
                const patch = await res.json();
                renderPreviewBanner(patch);
                const el = findTargetElement(patch);
                if (el) {
                  applyPatchToElement(el, patch);
                  console.log('[Patchwork] Applied draft preview patch:', patch);
                }
              }
            } catch (err) {
              console.warn('[Patchwork] Failed to load preview patch:', err);
            }
            return;
          }

          // Normal mode: Fetch and apply live patches
          async function fetchAndApplyLive() {
            try {
              const res = await fetch('http://localhost:4000/deployments/live');
              if (res.ok) {
                const data = await res.json();
                if (data && data.patches && data.patches.length > 0) {
                  for (const patch of data.patches) {
                    const el = findTargetElement(patch);
                    if (el) {
                      applyPatchToElement(el, patch);
                      console.log('[Patchwork] Applied live patch:', patch.id);
                    }
                  }
                }
              }
            } catch (err) {
              // ignore
            }
          }

          fetchAndApplyLive();
          setInterval(fetchAndApplyLive, 20000);
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initPatchwork);
        } else {
          initPatchwork();
        }
      })();
    </script>
  `;

  html = html.replace('</body>', `${patchworkRuntimeScript}</body>`);

  res.send(html);
});

app.post('/deploy/v1', (req, res) => {
  currentVersion = 'v1';
  isBroken = false;
  console.log('Switched to v1');
  res.json({ version: 'v1' });
});

app.post('/deploy/v2', (req, res) => {
  currentVersion = 'v2';
  isBroken = false;
  console.log('Switched to v2');
  res.json({ version: 'v2' });
});

app.post('/break', (req, res) => {
  isBroken = true;
  console.log('Site is now broken');
  res.json({ broken: true });
});

app.get('/status', (req, res) => {
  res.json({ version: currentVersion, broken: isBroken });
});

app.listen(port, () => {
  console.log(`Demo site listening on port ${port}`);
});
