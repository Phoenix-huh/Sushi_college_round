# Showing Patchwork on a live website

This is the runbook for the judges' demo: the store is deployed on Vercel, and patches you make appear on it.

## How the pieces fit

```
 Judge's browser                      Hosted Patchwork server (Node, https)
 ┌──────────────────────┐   polls     ┌──────────────────────────────┐
 │ TechMart on Vercel   │ ──────────► │ GET /deployments/live        │
 │  + patchwork-runtime │             │ drafts, review, deploy,      │
 └──────────────────────┘             │ rollback, audit              │
 ┌──────────────────────┐   HTTPS     │                              │
 │ Chrome extension     │ ──────────► │  (Supabase for storage)      │
 └──────────────────────┘             └──────────────────────────────┘
 ┌──────────────────────┐   HTTPS                 ▲
 │ Dashboard            │ ────────────────────────┘
 └──────────────────────┘
```

Only the demo store goes on Vercel. The Patchwork server is a long-running Node process, so it needs a Node host (Render, Railway, Fly, ...) or a tunnel to your laptop.

There are two honest ways patches reach a live site, and it helps to say which one you are showing:

| | Who sees the patch | Needs |
|---|---|---|
| **Runtime** (`patchwork-runtime.js` on the page) | Every visitor, no extension | The site owner adds one script tag. The demo store already has it. |
| **Extension** | Anyone with the extension installed, on any website | Nothing from the site owner. This is the "any live website" story. |

## 1. Host the Patchwork server

1. Create a Web Service from your GitHub repo on a Node host.
2. **Install command:** `npm install --include=dev` (the server runs through `tsx`, which is a dev dependency; a host that skips dev dependencies would install fine and then fail to start).
3. **Start command:** `npm run start -w apps/server`
4. Environment variables:

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Recommended. Without them the server keeps everything in memory and **forgets it on restart or sleep**. |
   | `CORS_ORIGINS` | `https://<your-demo>.vercel.app,https://<your-dashboard>.vercel.app` |
   | `DEMO_URL` | `https://<your-demo>.vercel.app` (so seed data targets the deployed store) |
   | `GEMINI_API_KEY` | Optional (natural-language patches) |

   The platform sets `PORT` for you. Never put keys in the repo.
5. Open `https://<your-server>/health`. You should see `{"ok":true,...}`.

## 2. Deploy the demo store to Vercel

1. New Project, pick the repo, **Root Directory: `apps/demo-site`**. `vercel.json` there sets the build.
2. Environment variable: **`SERVER_URL` = `https://<your-server>`** (https is required: a page on https cannot call an http server).
3. Deploy. The build fails with a clear message if `SERVER_URL` is missing or not https; that is on purpose, so you never ship a page that tries to load patches from `localhost`.

What gets deployed (`npm run build:static`):

| URL | What |
|---|---|
| `/` | The store (version 1) with the runtime pointed at your server |
| `/v2/` | The "site was updated" version (renamed buttons), for the self-healing part |
| `/?broken=1` | Simulates the production defect: the Checkout button throws when clicked |

The local demo server's `/break` and `/deploy/v2` endpoints do not exist on a static host; these URLs replace them.

## 3. Dashboard

Easiest and most reliable: **run it on your laptop** against the hosted server.

```bash
VITE_SERVER_URL=https://<your-server> VITE_DEMO_URL=https://<your-demo>.vercel.app npm run dev -w apps/dashboard
```

Or deploy it: Vercel project with **Root Directory `apps/dashboard`**, env `VITE_SERVER_URL` and `VITE_DEMO_URL`. `vercel.json` there makes routes like `/patches` work on refresh.

## 4. Build the extension for the demo

```bash
PATCHWORK_SERVER_URL=https://<your-server> npm run build -w apps/extension
```

Load `apps/extension/dist` in Chrome (chrome://extensions, Developer mode, Load unpacked). It already talks to your server; nothing to type. (If the extension was used before, the old server URL is remembered: change it in the side panel Settings.)

## 5. Check everything before you present

```bash
npm run check:deploy -- --demo https://<your-demo>.vercel.app --server https://<your-server> --dashboard https://<your-dashboard>.vercel.app
```

It checks: https and mixed content, server awake and how fast it answered, the data store, a live deployment, CORS from the demo's origin, that the demo page loads the runtime pointed at *this* server, the runtime script, and `/v2/`. Each failure says how to fix it. Run it again right before going on stage.

## The demo, step by step (on the deployed site)

1. Open the store on Vercel. Open `/?broken=1` in another tab and click **Checkout**: it errors. That is the production bug.
2. Open the store, click the extension, **Pick element**, choose the Checkout button, change its text (or hide a broken element), **Save Draft**. Say: *"No code access, no redeploy."* The draft's `target_url` is the Vercel address.
3. In the dashboard: open the draft, **Submit**, then **Review/Approve** (a different person than the author), then **Deploy**.
4. Switch to the store tab. Within about 2 seconds it reloads with the change, for anyone visiting, no extension needed.
5. **Rollback** in the dashboard. The store returns to its original state within seconds.
6. Open `/v2/` (the "site was updated" version) with the patch live: the patch still finds its element (self-healing). Show the "healed" entry in the Audit page.
7. To make the "any website" point: with the extension, patch a *different* real website, **Save Draft**, deploy it, and reload that site with the extension installed.

## Backup plan: your laptop is the server

If you do not trust the free host (it may sleep and answer slowly at first), run everything locally and expose the server with a tunnel:

```bash
npm run demo                              # server on :4000
cloudflared tunnel --url http://localhost:4000   # prints https://<random>.trycloudflare.com
```

Use that https address as `SERVER_URL` / `CORS_ORIGINS` / `PATCHWORK_SERVER_URL` and redeploy the demo once. Cloudflare's quick tunnel needs no account. ngrok's free plan can show a warning page to browser requests, which can interfere with the page's fetches; test it first if you prefer ngrok.

## Things to know before you present

- **There is no real login yet.** The server trusts the `x-actor-id` header and the reviewer/developer role is a dashboard toggle. Anyone who finds your server URL can create, approve and deploy patches, including `script` patches that run on every visitor of the demo store. Keep the server URL private, share it only at demo time, and consider tearing it down afterwards.
- **In-memory store resets.** Without Supabase, a restart or a sleeping free host wipes every patch. Check `/health` shows `"store":"supabase"`, or set up the demo right before presenting.
- **Verification needs a browser on the server.** It uses Playwright. On a host without Chromium (`npx playwright install chromium`), or when the server cannot open the page, **Verify now answers 503 "could not run" and changes nothing.** (Before this change, a failed run on the live version triggered an automatic rollback.) For a hosted demo, either skip the Verify step or run the server where Chromium is installed.
- **Patches made on localhost do not apply via the extension on the Vercel site**: a patch only applies on the origin it was made for. Make the demo patches on the deployed site, or set `DEMO_URL` before seeding. The runtime applies live patches regardless of origin.
- **Other people's websites** with a strict Content-Security-Policy may restrict the editor's styling. Try the sites you plan to show beforehand.
