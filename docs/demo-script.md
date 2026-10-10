# PATCHWORK Demo Script: "Hotfix the Internet"

This guide demonstrates the entire Patchwork lifecycle step-by-step: patching a live production website, resilient element re-targeting (auto-healing), automated flow verification with pixel regression testing, versioned release, collaborative merge resolution, and automated safety rollback.

---

## Prerequisites & Environment Setup

1. **Start all servers**:
   ```bash
   npm run demo
   ```
   This launches:
   - **Demo Storefront** (TechMart): [http://localhost:4100](http://localhost:4100)
   - **Patchwork Backend**: [http://localhost:4000](http://localhost:4000)
   - **Reviewer & Developer Dashboard**: [http://localhost:5173](http://localhost:5173)

2. **Initialize or Reset Demo State**:
   ```bash
   npm run seed
   ```

---

## The 9-Step Walkthrough

### Step 1: Discover Broken Checkout on Live Store
- Open the demo storefront at [http://localhost:4100](http://localhost:4100).
- Trigger a production defect via the demo control API:
  ```bash
  curl -X POST http://localhost:4100/break
  ```
- Click the **"Checkout"** button (`#checkout-btn`) on the page.
- **Result**: The checkout process errors out in console (`Uncaught Error: Checkout process is broken`), preventing customers from completing orders.

---

### Step 2: Author a Visual Patch
- A developer creates a non-invasive patch targeting `#checkout-btn` without redeploying the merchant store.
- **Patch Spec**:
  - Target URL: `http://localhost:4100/`
  - Anchor: `#checkout-btn` inside `.cart-actions`
  - Change Type: `text`
  - Change Value: `"Pay & Complete Order"`
- Alternatively, generate the draft patch using Natural Language via the dashboard:
  - Go to [http://localhost:5173/patches](http://localhost:5173/patches).
  - In the **Natural Language Patching** prompt, enter:
    `"Change the checkout button text to Pay & Complete Order"`
  - Click **Generate Draft Patch**. A Zod-validated draft patch is created in status `draft`.

---

### Step 3: Isolated Local Preview Mode
- Before publishing to real users, test the patch locally.
- In preview mode, the Chrome extension applies the draft patch locally only.
- An amber **"PATCHWORK PREVIEW MODE (DRAFT)"** banner is displayed across the bottom of the viewport.
- The merchant's production website is unaffected for all other visitors.

---

### Step 4: Automated Verification (Playwright + Pixel Diff)
- Open the dashboard at [http://localhost:5173/verification](http://localhost:5173/verification).
- Select **Version 1** and click **Verify Now** (calls `POST /verify`).
- Playwright launches headlessly, executes `flows/checkout.flow.ts`:
  1. Loads baseline store and takes a reference screenshot.
  2. Injects the candidate patch into the page session.
  3. Locates and asserts the checkout button is interactive and clickable.
  4. Runs `pixelmatch` to measure pixel difference (`142 px` altered).
- **Result**: Flow passes. Status updates to `PASSED`.

---

### Step 5: Versioned Live Deployment
- Open [http://localhost:5173/deployments](http://localhost:5173/deployments).
- Deploy Version 1:
  - Bundles the approved text and styling patches.
  - Deploys with `canary_percent: 100`.
- The live store at [http://localhost:4100](http://localhost:4100) now displays the updated, functioning **"Pay & Complete Order"** button with elevated styling.

---

### Step 6: Site v2 Upgrade & Smart Element Auto-Healing
- The merchant redesigns their storefront and deploys **Storefront v2**:
  ```bash
  curl -X POST http://localhost:4100/deploy/v2
  ```
- **The Structural Problem**:
  - The button is moved out of `.cart-actions` into `.order-summary`.
  - The DOM ID changed from `#checkout-btn` to `#place-order-btn`.
  - The button CSS class changed from `.btn-checkout` to `.btn-primary.btn-order`.
  - The text changed from `"Checkout"` to `"Place Order"`.
- **The Auto-Healing Mechanism**:
  - The direct selector fails.
  - The Patchwork Matcher (`findBestMatch`) computes semantic similarity using:
    - Text overlap
    - Attribute context
    - Sibling & parent container hierarchy
  - Finds the relocated element with a high confidence score (`88%`).
  - Automatically heals the patch and fires a `patch_healed` audit event.
- In the dashboard at [http://localhost:5173/patches](http://localhost:5173/patches), locate the healed patch and click **"Why healed?"** to inspect the confidence breakdown.

---

### Step 7: Collaborative Conflict Detection & Merge
- A second developer drafts a concurrent patch modifying the same button text to `"Express Checkout (Free Shipping)"`.
- Navigate to [http://localhost:5173/conflicts](http://localhost:5173/conflicts).
- **Conflict Screen**:
  - Highlights overlapping patches touching the same DOM selector and property.
  - Displays a side-by-side comparison of Version 1 vs Version 2.
- Click **"Accept Version 1"** (or Version 2) to resolve and merge into the approved queue.

---

### Step 8: Broken Deploy, Verification Failure & Auto-Rollback
- A buggy patch is introduced that sets the button's visibility to `hidden` (`#checkout-btn { display: none }`).
- Navigate to [http://localhost:5173/verification](http://localhost:5173/verification).
- Select **Version 2 (Broken / Hidden Patch)** and click **Verify Now**.
- **What Happens**:
  1. Playwright attempts to run `checkout.flow.ts`.
  2. The required checkout button is hidden and unreachable.
  3. The verification flow throws a locator timeout error.
  4. The server marks Version 2 as `FAILED`.
  5. The server immediately initiates an **Automated Rollback**, setting `is_live: false` and repointing to the stable live release.
  6. The dashboard displays the red **"AUTO-ROLLBACK TRIGGERED"** badge.

---

### Step 9: Audit Trail Inspection
- Open [http://localhost:5173/audit](http://localhost:5173/audit).
- Inspect the complete chronological timeline of every state change:
  - `patch_created`
  - `patch_approved`
  - `version_created`
  - `verification_passed`
  - `deployment_created`
  - `patch_healed` (with score breakdown)
  - `conflict_detected`
  - `verification_failed`
  - `deployment_rolled_back`
- Every action records the actor ID, entity ID, timestamp, and metadata payload.

---

## Verification Checklist

- [x] All 5 dashboard views display live or seeded data (`/patches`, `/deployments`, `/verification`, `/conflicts`, `/audit`).
- [x] Auto-healing explanation expands with multi-factor score breakdown.
- [x] Automated verifier reports pixel diff and catches broken flows.
- [x] Auto-rollback triggers on verification failure.
- [x] Audit trail captures the full modification history.
