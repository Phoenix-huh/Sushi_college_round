# Patchwork Chrome extension

Status: **Phase 3** (element picker and anchor builder). The extension loads, opens a side panel
that shows whether the Patchwork server is reachable, and applies the live patches to every page whose origin
matches the patch's `target_url`, and lets you pick an element and see the anchor that finds it again. Editor and full healing arrive in later phases; this file grows with them.

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

## Live patches (Phase 2)

The content script asks the background worker for `GET /deployments/live` (message `GET_LIVE_PATCHES`) every 3 s
while the tab is visible, and only re-applies when the `signature` changes.

- A patch applies to a page when its `target_url` has the same origin, and the same path unless the path is `/` (whole site).
- Targets are all found first, then changes are applied. `pw-find=text` never falls back to the first match.
- A patch that is rolled back or replaced is undone in place (original text, inline styles and display are restored). No reload.
- If the page re-renders the element (single-page apps), a debounced `MutationObserver` applies the patch again.
- `script` patches are not run by the extension (content scripts must not eval code); the console shows a warning.
- The demo site also loads `patchwork-runtime.js`. With both active on the same page, each applies the same patches; the result is the same.

Rules live in `packages/shared/src/targeting.ts`; the page-side loop is `apps/extension/src/content/applier.ts`.

## Picking an element (Phase 3)

Open the side panel, click **Pick element**, then click something on the page. Hover shows an outline and the
tag.class of the element; the click is swallowed so links and buttons do not fire; **Esc** cancels. The result
appears as a card in the side panel (selector, text, parent, siblings, page).

Reload the page first if it was open before you installed or reloaded the extension: content scripts only load with a page.

How the selector is chosen (`content/anchor.ts`). The first candidate that matches exactly one element, checked
against the live page, wins:

1. a stable `#id`
2. a stable attribute: `data-testid`, `data-test`, `data-cy`, `data-qa`, `name`, `aria-label`, or a plain `href` on links
3. `tag.class` steps (with `:nth-of-type` where siblings look alike), climbing parents until the path is unique and contains a class, attribute or id; it stops early at a stable ancestor `#id`

"Stable" excludes generated names (`css-1a2b3c`, `sc-…`, React `:r1:`, hashes, long digit runs) and `pw-` markers.
The anchor also stores the `textContent` hint (whitespace collapsed, cut at 200 characters), an xpath,
useful attributes, `parentContext` (the parent's own `tag.class`, which the shared matcher tests with `matches()`)
and `siblingContext` (tags of the previous and next sibling). Generated anchors never set `pw-find`.

Not covered yet: elements inside iframes or shadow roots. Phase 4 turns a pick into an editable draft.

## Settings

Set in the side panel, stored in `chrome.storage.local`:

| Setting | Default | Notes |
| --- | --- | --- |
| Server URL | `http://localhost:4000` | Must be `http://` or `https://`. Any path or trailing slash is dropped. |
| Author id | `00000000-0000-0000-0000-000000000001` | Must be a UUID. Sent as the `x-actor-id` header and (from Phase 4) as the patch `author_id`. |

No login is needed; the server falls back to the demo developer. A change applies immediately (the
background worker reads settings on every request).

## Where to look for errors

The extension has three separate consoles:

| Part | How to open its console |
| --- | --- |
| Background service worker | `chrome://extensions` -> Patchwork card -> **service worker** link. A red **Errors** button on the card also lists failures. |
| Content script | DevTools on the page itself (F12). Messages are prefixed `[Patchwork]`. |
| Side panel | Right-click inside the side panel -> **Inspect**. |

The service worker is stopped by Chrome when idle. Its console may then show "inactive"; that is normal.
When the server is down, Chrome itself may log `net::ERR_CONNECTION_REFUSED` in the service worker
console. That is the browser's network log, not an extension error: the panel shows the reason in plain words.

## Layout of `apps/extension`

| Path | What it is |
| --- | --- |
| `manifest.json` | The MV3 manifest, copied unchanged into `dist`. Paths in it point at **built** files. |
| `build.mjs` | esbuild script. Bundles each entry into one self-contained file and fails the build if the manifest references a file that was not produced. |
| `sidepanel.html` | The side panel page (static skeleton; the script fills it in with `textContent`, never `innerHTML`). |
| `src/messages.ts` | **The** message protocol shared by every part: message types, runtime validation, and `send()`. |
| `src/settings.ts` | Defaults, validation, load/save. |
| `src/background/index.ts` | Service worker -> `dist/background.js`. Registers the message listener. |
| `src/background/handlers.ts` | What the worker does for each message (dependencies injected, so it is unit-tested without Chrome). |
| `src/background/api.ts` | Server client: `x-actor-id` header, 5 s timeout, readable errors. |
| `src/content/index.ts` | Content script -> `dist/content.js` |
| `src/sidepanel/index.ts` | Side panel script -> `dist/sidepanel.js` |

Other files under `src/content/` (`applier`, `healer`, `preview`, `canary`, `picker`, `editor`) are earlier
stubs that are **not built yet**. They are replaced in the phases that implement them.

### Rules the code follows

- Content scripts and the side panel never call the server. They send a message (`send({ type: ... })`) and the
  background worker calls the server. To add a message: one entry in `MessageMap`, one validator in `messages.ts`,
  one handler in `background/handlers.ts`. The compiler rejects a missing handler.
- MV3 service workers sleep. The worker keeps nothing in variables: settings are in `storage.local`, the last
  connection result in `storage.session`.
- Do not call the global `fetch` as a method of another object in the worker ("Illegal invocation"); `index.ts`
  passes an arrow wrapper for that reason.

## Manual checklists

### Phase 0

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Load unpacked as above | A card "Patchwork 0.1.0" with **no** red Errors button and no warnings |
| 2 | Click the card's **service worker** link | DevTools opens with no red errors |
| 3 | Open any http(s) page, press F12, look at the Console | `[Patchwork] content script loaded` and no errors; the page looks and behaves as before |
| 4 | Click the Patchwork toolbar icon | The side panel opens with the heading "Patchwork", a connection indicator and a Settings form |
| 5 | Open a `chrome://` page or the Chrome Web Store | No Patchwork log line (Chrome does not allow extensions there; this is expected) |

### Phase 1

Start the server first: `npm run demo` (or only the server: `npm run dev -w apps/server`).

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Reload the extension at `chrome://extensions`, click the toolbar icon | Side panel: **green** dot, "Connected to http://localhost:4000", "Data store: memory" (or "supabase") |
| 2 | Stop the server (Ctrl+C in its terminal), click **Check again** (or wait up to 5 s) | **Red** dot, "Not connected: Cannot reach http://localhost:4000. Is the Patchwork server running?" |
| 3 | Start the server again, wait up to 5 s | Dot turns green by itself |
| 4 | Server URL: type `banana`, click **Save** | Red message "Server URL is not a valid URL...". Close and reopen the panel: the field shows the old good value |
| 5 | Server URL: type `http://localhost:4000/` (trailing slash), **Save** | "Saved." and the field now shows `http://localhost:4000` |
| 6 | Author id: type `abc`, **Save** | Red message "Author id must be a UUID..." |
| 7 | Server URL: type `http://localhost:9`, **Save** | "Saved.", then red dot (nothing listens there). Put `http://localhost:4000` back, **Save**: green |
| 8 | Close and reopen the panel; also restart Chrome | Settings are still there |
| 9 | At `chrome://extensions` click **service worker**, leave it ~30 s | It shows "inactive". Open the side panel: it still works (the worker woke up) |
| 10 | Right-click in the side panel -> Inspect -> Console | No red errors |

## Automated checks

```bash
npx vitest run                       # includes apps/extension/src/**/*.test.ts
npx tsx scripts/e2e-extension.ts     # real Chrome; HEADED=1 to watch it (also: npm run e2e:ext)
```

`scripts/e2e-extension.ts` builds the extension, loads `apps/extension/dist` into Chromium, and checks the
service worker, the content script and the side panel page for correct behaviour and for console errors
(service worker errors are read over the DevTools Protocol). Phase 1 checks run against a tiny fake server
that only implements `GET /health`, and put the service worker to sleep mid-test to prove state survives.

It needs a Chromium that can load extensions: `npx playwright install chromium`, or point it at an installed
Chrome with `CHROME_PATH` (macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`;
Windows PowerShell: `$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"`).

It cannot open the real docked side panel or click the toolbar icon (browser automation cannot do either); it
loads `sidepanel.html` as a normal tab instead. Checklist step "click the toolbar icon" is therefore manual.
