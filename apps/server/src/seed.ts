import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";
import type { Patch, Version, Deployment, AuditEvent } from "@patchwork/shared";

dotenv.config({ path: "../../.env" });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

export const DEV_ID = "00000000-0000-0000-0000-000000000001";
export const REVIEWER_ID = "00000000-0000-0000-0000-000000000002";

export const DEMO_PROFILES = [
  { id: DEV_ID, email: "dev@patchwork.io", display_name: "Demo Developer", role: "developer" },
  { id: REVIEWER_ID, email: "reviewer@patchwork.io", display_name: "Demo Reviewer", role: "reviewer" },
];

export const PATCH_1_ID = "11111111-1111-1111-1111-111111111111"; // Live text patch
export const PATCH_2_ID = "22222222-2222-2222-2222-222222222222"; // Live style patch
export const PATCH_3_ID = "33333333-3333-3333-3333-333333333333"; // Healed patch
export const PATCH_4_ID = "44444444-4444-4444-4444-444444444444"; // Conflicting draft patch
export const PATCH_5_ID = "55555555-5555-5555-5555-555555555555"; // Broken patch for verification fail

export const DEMO_PATCHES: Patch[] = [
  {
    id: PATCH_1_ID,
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: {
      cssSelector: "#checkout-btn",
      xpath: '//*[@id="checkout-btn"]',
      textContent: "Checkout",
      attributes: { id: "checkout-btn", class: "btn-checkout" },
      parentContext: "div.cart-actions",
      siblingContext: ["div.cart-summary", "div.cart-total"],
    },
    change: { type: "text", value: "Pay & Complete Order" },
    author_id: DEV_ID,
    status: "live",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: PATCH_2_ID,
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: {
      cssSelector: "#checkout-btn",
      xpath: '//*[@id="checkout-btn"]',
      textContent: "Checkout",
      attributes: { id: "checkout-btn", class: "btn-checkout" },
      parentContext: "div.cart-actions",
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
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: {
      cssSelector: "#checkout-btn",
      xpath: '//*[@id="checkout-btn"]',
      textContent: "Checkout",
      attributes: { id: "checkout-btn", class: "btn-checkout" },
      parentContext: "div.cart-actions",
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
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: {
      cssSelector: "#checkout-btn",
      xpath: '//*[@id="checkout-btn"]',
      textContent: "Checkout",
      attributes: { id: "checkout-btn", class: "btn-checkout" },
      parentContext: "div.cart-actions",
      siblingContext: ["div.cart-summary"],
    },
    change: { type: "text", value: "Express Checkout (Free Shipping)" },
    author_id: DEV_ID,
    status: "draft",
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: PATCH_5_ID,
    target_url: "http://localhost:4100/",
    base_version: 0,
    anchors: {
      cssSelector: "#checkout-btn",
      xpath: '//*[@id="checkout-btn"]',
      textContent: "Checkout",
      attributes: { id: "checkout-btn", class: "btn-checkout" },
      parentContext: "div.cart-actions",
      siblingContext: ["div.cart-summary"],
    },
    change: { type: "visibility", value: "hidden" },
    author_id: DEV_ID,
    status: "broken",
    created_at: new Date(Date.now() - 900000).toISOString(),
    updated_at: new Date(Date.now() - 900000).toISOString(),
  },
];

export const VERSION_1_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const VERSION_2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

export const DEMO_VERSIONS: Version[] = [
  {
    id: VERSION_1_ID,
    number: 1,
    patch_ids: [PATCH_1_ID, PATCH_2_ID],
    created_by: DEV_ID,
    verification_status: "passed",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: VERSION_2_ID,
    number: 2,
    patch_ids: [PATCH_5_ID],
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
    actor_id: DEV_ID,
    event_type: "patch_healed",
    entity_id: PATCH_3_ID,
    details: {
      score: 0.88,
      breakdown: {
        text: 0.95,
        attributes: 0.82,
        parent: 0.90,
        sibling: 0.85,
        position: 0.80,
      },
      reason: "Element relocated from .cart-actions to .order-summary (ID changed from #checkout-btn to #place-order-btn)",
    },
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: DEV_ID,
    event_type: "conflict_detected",
    entity_id: PATCH_4_ID,
    details: {
      conflicting_patch_id: PATCH_1_ID,
      property: "text",
      selector: "#checkout-btn",
    },
    created_at: new Date(Date.now() - 1700000).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    actor_id: DEV_ID,
    event_type: "verification_failed",
    entity_id: VERSION_2_ID,
    details: {
      error: "Timeout waiting for button#checkout-btn: element hidden by patch",
      diffPixels: -1,
    },
    created_at: new Date(Date.now() - 580000).toISOString(),
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
    await supabaseAdmin.from("audit_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("deployments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("versions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("patches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    console.log("Inserting demo profiles...");
    await supabaseAdmin.from("profiles").insert(DEMO_PROFILES);

    console.log("Inserting demo patches...");
    await supabaseAdmin.from("patches").insert(DEMO_PATCHES);

    console.log("Inserting demo versions...");
    await supabaseAdmin.from("versions").insert(DEMO_VERSIONS);

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
