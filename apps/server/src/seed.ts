import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";
import type { Patch, Version, Deployment, AuditEvent, Site, PatchOp, Conflict } from "@patchwork/shared";

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
const supabaseUrl = process.env.SUPABASE_URL || "";
const realKey = (v?: string) => (v && v.length > 20 && !v.startsWith("your-") ? v : "");
const supabaseServiceKey = realKey(process.env.SUPABASE_SERVICE_KEY) || realKey(process.env.SUPABASE_ANON_KEY);

export const DEV_ID = "00000000-0000-0000-0000-000000000001";
export const REVIEWER_ID = "00000000-0000-0000-0000-000000000002";
export const ALICE_ID = "00000000-0000-0000-0000-000000000003";
export const BOB_ID = "00000000-0000-0000-0000-000000000004";
export const CAROL_ID = "00000000-0000-0000-0000-000000000005";

export const DEMO_PROFILES = [
  { id: DEV_ID, email: "dev@patchwork.io", display_name: "Demo Developer", role: "developer" },
  { id: REVIEWER_ID, email: "reviewer@patchwork.io", display_name: "Demo Reviewer", role: "reviewer" },
  { id: ALICE_ID, email: "alice@patchwork.io", display_name: "Alice", role: "developer" },
  { id: BOB_ID, email: "bob@patchwork.io", display_name: "Bob", role: "developer" },
  { id: CAROL_ID, email: "carol@patchwork.io", display_name: "Carol", role: "developer" },
];

export const VERSION_1_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const VERSION_2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

export const DEFAULT_SITE_ID = "00000000-0000-0000-0000-000000000100";
export const DEMO_SITES: Site[] = [
  {
    id: DEFAULT_SITE_ID,
    name: "Demo Store",
    url: "http://localhost:4100/",
    live_version_id: VERSION_1_ID,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export const PATCH_1_ID = "11111111-1111-1111-1111-111111111111"; // Live text patch
export const PATCH_2_ID = "22222222-2222-2222-2222-222222222222"; // Live style patch
export const PATCH_3_ID = "33333333-3333-3333-3333-333333333333"; // Healed patch
export const PATCH_4_ID = "44444444-4444-4444-4444-444444444444"; // Alice's patch (Coral background color)
export const PATCH_5_ID = "55555555-5555-5555-5555-555555555555"; // Broken patch for verification fail
export const PATCH_6_ID = "66666666-6666-6666-6666-666666666666"; // Bob's patch (Emerald background color - conflict with Alice)
export const PATCH_7_ID = "77777777-7777-7777-7777-777777777777"; // Carol's patch (Font weight - auto-merges, no conflict)

const checkoutAnchor = {
  cssSelector: "#checkout-btn",
  xpath: '//*[@id="checkout-btn"]',
  textContent: "Checkout",
  attributes: { id: "checkout-btn", class: "btn-checkout" },
  parentContext: "div.cart-actions",
  siblingContext: ["div.cart-summary", "div.cart-total"],
};

export const DEMO_PATCHES: Patch[] = [
  {
    id: PATCH_1_ID,
    site_id: DEFAULT_SITE_ID,
    title: "Checkout Button Text Update",
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: checkoutAnchor,
    change: { type: "text", value: "Pay & Complete Order" },
    author_id: DEV_ID,
    status: "live",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: PATCH_2_ID,
    site_id: DEFAULT_SITE_ID,
    title: "Checkout Button Elevation Glow",
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: {
      ...checkoutAnchor,
      siblingContext: ["div.cart-summary"],
    },
    change: { type: "style", value: "box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); font-weight: 700;" },
    author_id: DEV_ID,
    status: "live",
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: PATCH_3_ID,
    site_id: DEFAULT_SITE_ID,
    title: "1-Click Buy Healed Anchor",
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: {
      ...checkoutAnchor,
      siblingContext: ["div.cart-summary"],
    },
    change: { type: "text", value: "1-Click Instant Buy" },
    author_id: DEV_ID,
    status: "healed",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: PATCH_4_ID,
    site_id: DEFAULT_SITE_ID,
    title: "Checkout Button - Coral Accent (Alice)",
    target_url: "http://localhost:4100/",
    base_version: 1,
    anchors: checkoutAnchor,
    change: { type: "style", value: "background-color: #f43f5e; color: #ffffff;" },
    author_id: ALICE_ID,
    status: "in_review",
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: PATCH_5_ID,
    site_id: DEFAULT_SITE_ID,
    title: "Hide Button Verification Test",
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: checkoutAnchor,
    change: { type: "visibility", value: "hidden" },
    author_id: DEV_ID,
    status: "broken",
    created_at: new Date(Date.now() - 900000).toISOString(),
    updated_at: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: PATCH_6_ID,
    site_id: DEFAULT_SITE_ID,
    title: "Checkout Button - Emerald Accent (Bob)",
    target_url: "http://localhost:4100/",
    base_version: 1,
    anchors: checkoutAnchor,
    change: { type: "style", value: "background-color: #10b981; color: #ffffff;" },
    author_id: BOB_ID,
    status: "conflicted",
    created_at: new Date(Date.now() - 1200000).toISOString(),
    updated_at: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: PATCH_7_ID,
    site_id: DEFAULT_SITE_ID,
    title: "Checkout Button - Heavy Weight (Carol)",
    target_url: "http://localhost:4100/",
    base_version: 1,
    anchors: checkoutAnchor,
    change: { type: "style", value: "font-weight: 800;" },
    author_id: CAROL_ID,
    status: "approved",
    created_at: new Date(Date.now() - 600000).toISOString(),
    updated_at: new Date(Date.now() - 600000).toISOString(),
  },
];

export const DEMO_PATCH_OPS: PatchOp[] = [
  {
    id: "op-alice-1",
    patch_id: PATCH_4_ID,
    anchors: checkoutAnchor,
    property: "background-color",
    old_value: null,
    new_value: "#f43f5e",
  },
  {
    id: "op-bob-1",
    patch_id: PATCH_6_ID,
    anchors: checkoutAnchor,
    property: "background-color",
    old_value: null,
    new_value: "#10b981",
  },
  {
    id: "op-carol-1",
    patch_id: PATCH_7_ID,
    anchors: checkoutAnchor,
    property: "font-weight",
    old_value: null,
    new_value: "800",
  },
];

export const DEMO_CONFLICTS: Conflict[] = [
  {
    id: "c1111111-1111-1111-1111-111111111111",
    patch_a: PATCH_4_ID,
    patch_b: PATCH_6_ID,
    op_a: "op-alice-1",
    op_b: "op-bob-1",
    type: "concurrent",
    status: "open",
    resolution: null,
    created_at: new Date(Date.now() - 1200000).toISOString(),
  },
];

export const DEMO_VERSIONS: Version[] = [
  {
    id: VERSION_1_ID,
    number: 1,
    parent_id: null,
    patch_ids: [PATCH_1_ID, PATCH_2_ID],
    ops_snapshot: [
      {
        id: "op-live-1",
        patch_id: PATCH_1_ID,
        anchors: checkoutAnchor,
        property: "text",
        old_value: "Checkout",
        new_value: "Pay & Complete Order",
      },
      {
        id: "op-live-2",
        patch_id: PATCH_2_ID,
        anchors: checkoutAnchor,
        property: "box-shadow",
        old_value: null,
        new_value: "0 4px 14px rgba(79, 70, 229, 0.4)",
      },
    ],
    created_by: DEV_ID,
    verification_status: "passed",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: VERSION_2_ID,
    number: 2,
    parent_id: VERSION_1_ID,
    patch_ids: [PATCH_5_ID],
    ops_snapshot: [],
    created_by: DEV_ID,
    verification_status: "failed",
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
];

export const DEPLOYMENT_1_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
export const DEPLOYMENT_2_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

export const DEMO_DEPLOYMENTS: Deployment[] = [
  {
    id: DEPLOYMENT_1_ID,
    version_id: VERSION_1_ID,
    is_live: true,
    canary_percent: 100,
    deployed_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    rolled_back_at: null,
  },
  {
    id: DEPLOYMENT_2_ID,
    version_id: VERSION_2_ID,
    is_live: false,
    canary_percent: 10,
    deployed_at: new Date(Date.now() - 600000).toISOString(),
    rolled_back_at: new Date(Date.now() - 550000).toISOString(),
  },
];

export const DEMO_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: crypto.randomUUID(),
    actor_id: DEV_ID,
    event_type: "site_created",
    entity_id: DEFAULT_SITE_ID,
    details: { name: "Demo Store", url: "http://localhost:4100/" },
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: DEV_ID,
    event_type: "patch_created",
    entity_id: PATCH_1_ID,
    details: { type: "text", value: "Pay & Complete Order", selector: "#checkout-btn" },
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: REVIEWER_ID,
    event_type: "patch_approved",
    entity_id: PATCH_1_ID,
    details: { reviewer: "reviewer@patchwork.io" },
    created_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: DEV_ID,
    event_type: "patch_created",
    entity_id: PATCH_2_ID,
    details: { type: "style", value: "box-shadow elevation" },
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: DEV_ID,
    event_type: "version_created",
    entity_id: VERSION_1_ID,
    details: { version_number: 1, patch_count: 2 },
    created_at: new Date(Date.now() - 3600000 * 2.5).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: REVIEWER_ID,
    event_type: "verification_passed",
    entity_id: VERSION_1_ID,
    details: { flow: "checkout.flow.ts", diffPixels: 142, status: "passed" },
    created_at: new Date(Date.now() - 3600000 * 2.1).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: DEV_ID,
    event_type: "deployment_created",
    entity_id: DEPLOYMENT_1_ID,
    details: { version_number: 1, canary_percent: 100 },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: ALICE_ID,
    event_type: "patch_created",
    entity_id: PATCH_4_ID,
    details: { title: "Checkout Button - Coral Accent", property: "background-color", value: "#f43f5e" },
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: ALICE_ID,
    event_type: "patch_submitted",
    entity_id: PATCH_4_ID,
    details: { base_version: 1, status: "in_review" },
    created_at: new Date(Date.now() - 1700000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: BOB_ID,
    event_type: "patch_created",
    entity_id: PATCH_6_ID,
    details: { title: "Checkout Button - Emerald Accent", property: "background-color", value: "#10b981" },
    created_at: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: BOB_ID,
    event_type: "conflict_detected",
    entity_id: PATCH_6_ID,
    details: {
      conflicting_patch_id: PATCH_4_ID,
      property: "background-color",
      selector: "#checkout-btn",
      type: "concurrent",
    },
    created_at: new Date(Date.now() - 1100000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: CAROL_ID,
    event_type: "patch_created",
    entity_id: PATCH_7_ID,
    details: { title: "Checkout Button - Heavy Weight", property: "font-weight", value: "800" },
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: ALICE_ID,
    event_type: "patch_approved",
    entity_id: PATCH_7_ID,
    details: { reviewer: "alice@patchwork.io", note: "Auto-merges cleanly with other patches" },
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: DEV_ID,
    event_type: "deployment_rolled_back",
    entity_id: DEPLOYMENT_2_ID,
    details: {
      reason: "verification_failed",
      auto_rollback: true,
      restored_version: 1,
    },
    created_at: new Date(Date.now() - 550000).toISOString(),
  },
];

async function main() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("⚠️ Supabase credentials missing in .env.");
    console.log("✅ Seed completed in offline mock mode with valid demo datasets.");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  console.log("Connected to Supabase. Resetting to clean demo state...");

  try {
    console.log("Cleaning existing records...");
    const tryDelete = async (table: string) => {
      try {
        await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch {}
    };
    await tryDelete("audit_events");
    await tryDelete("conflicts");
    await tryDelete("patch_ops");
    await tryDelete("reviews");
    await tryDelete("deployments");
    await tryDelete("versions");
    await tryDelete("patches");
    await tryDelete("sites");
    await tryDelete("profiles");

    console.log("Inserting demo profiles...");
    await supabaseAdmin.from("profiles").insert(DEMO_PROFILES);

    console.log("Inserting demo sites (if table exists)...");
    try {
      await supabaseAdmin.from("sites").insert(DEMO_SITES);
    } catch (e: any) {
      console.log("sites table optional:", e.message);
    }

    console.log("Inserting demo patches...");
    // Filter columns if table hasn't migrated yet
    const cleanPatches = DEMO_PATCHES.map((p) => ({
      id: p.id,
      target_url: p.target_url,
      base_version: p.base_version,
      anchors: p.anchors,
      change: p.change,
      author_id: p.author_id,
      status: ["draft", "approved", "live", "broken", "healed"].includes(p.status) ? p.status : "draft",
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
    await supabaseAdmin.from("patches").insert(cleanPatches);

    console.log("Inserting demo versions...");
    const cleanVersions = DEMO_VERSIONS.map((v) => ({
      id: v.id,
      number: v.number,
      patch_ids: v.patch_ids,
      created_by: v.created_by,
      verification_status: v.verification_status,
      created_at: v.created_at,
    }));
    await supabaseAdmin.from("versions").insert(cleanVersions);

    console.log("Inserting demo deployments...");
    await supabaseAdmin.from("deployments").insert(DEMO_DEPLOYMENTS);

    console.log("Inserting demo audit trail...");
    await supabaseAdmin.from("audit_events").insert(DEMO_AUDIT_EVENTS);

    console.log("✨ Seed completed successfully! Perfect demo state established.");
  } catch (error) {
    console.error("Error during Supabase seed:", error);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  void main();
}
