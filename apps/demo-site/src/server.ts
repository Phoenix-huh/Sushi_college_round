import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.DEMO_PORT || 4100;
const SERVER_URL = (process.env.SERVER_URL || `http://localhost:${process.env.SERVER_PORT || 4000}`).replace(/\/$/, '');

app.use(express.json());

let currentVersion: 'v1' | 'v2' = 'v1';
let isBroken = false;

// Serve static assets from shared folder
app.use('/shared', express.static(path.join(__dirname, '../public/shared'), { maxAge: 0, etag: false }));

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
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

  const patchworkRuntimeScript = `<script src="/shared/patchwork-runtime.js" data-api="${SERVER_URL}"></script>`;

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
