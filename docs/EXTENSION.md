# Patchwork Chrome extension

Status: **Phase 0** (skeleton). It loads, opens an empty side panel and injects an empty content
script. Picker, editor, live-patch applier and healing arrive in later phases; this file grows with them.

## Build and load it (Chrome / Chromium 114 or newer)

```bash
npm install
npm run build -w apps/extension      # writes apps/extension/dist
```

1. Open `chrome://extensions`.
2. Switch **Developer mode** on (top right).
3. Click **Load unpacked** and choose the folder `apps/extension/dist`.
4. Optional: pin the extension (puzzle-piece icon in the toolbar, then the pin) so its icon stays visible.

Clicking the toolbar icon opens the side panel. Browsers without the side panel API show the same
page as a toolbar popup instead.

## Development loop

```bash
npm run dev -w apps/extension        # rebuilds dist on every file change
```

After a rebuild: click the circular **reload** arrow on the extension's card in `chrome://extensions`,
then reload any page you are testing (content scripts are only injected when a page loads).

Always build before loading: `dist/` is generated and git-ignored. `npx tsc --build` writes to
`apps/extension/.tsc-out`, never to `dist`, so the two do not interfere.

## Where to look for errors

The extension has three separate consoles:

| Part | How to open its console |
| --- | --- |
| Background service worker | `chrome://extensions` -> Patchwork card -> **service worker** link. A red **Errors** button on the card also lists failures. |
| Content script | DevTools on the page itself (F12). Messages are prefixed `[Patchwork]`. |
| Side panel | Right-click inside the side panel -> **Inspect**. |

The service worker is stopped by Chrome when idle. Its console may then show "inactive"; that is normal.

## Layout of `apps/extension`

| Path | What it is |
| --- | --- |
| `manifest.json` | The MV3 manifest, copied unchanged into `dist`. Paths in it point at **built** files. |
| `build.mjs` | esbuild script. Bundles each entry into one self-contained file and fails the build if the manifest references a file that was not produced. |
| `sidepanel.html` | The side panel page. |
| `src/background/index.ts` | Service worker -> `dist/background.js` |
| `src/content/index.ts` | Content script -> `dist/content.js` |
| `src/sidepanel/index.ts` | Side panel script -> `dist/sidepanel.js` |

Other files under `src/content/` (`applier`, `healer`, `preview`, `canary`, `picker`, `editor`) are earlier
stubs that are **not built yet**. They are replaced in the phases that implement them.

## Phase 0: manual checklist

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Load unpacked as above | A card "Patchwork 0.1.0" with **no** red Errors button and no warnings |
| 2 | Click the card's **service worker** link | DevTools opens with no red errors |
| 3 | Open any http(s) page, press F12, look at the Console | `[Patchwork] content script loaded` and no errors; the page looks and behaves as before |
| 4 | Click the Patchwork toolbar icon | The side panel opens showing "Extension loaded (phase 0 skeleton)." |
| 5 | Open a `chrome://` page or the Chrome Web Store | No Patchwork log line (Chrome does not allow extensions there; this is expected) |

## Automated checks

```bash
npx vitest run                       # includes apps/extension/src/build.test.ts
npx tsx scripts/e2e-extension.ts     # real Chromium; HEADED=1 to watch it
```

`scripts/e2e-extension.ts` builds the extension, loads `apps/extension/dist` into Chromium, and checks
the service worker, the content script and the side panel page for correct behaviour and for console
errors (service worker errors are read over the DevTools Protocol). It needs Playwright's Chromium:
`npx playwright install chromium`.

It cannot open the real side panel UI or click the toolbar icon (browser automation cannot do either),
so checklist step 4 is manual.
