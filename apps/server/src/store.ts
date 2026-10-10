/**
 * Single data layer for patches / versions / deployments / audit events.
 *
 * Every route goes through this module, so the dashboard, the demo site and the
 * verifier always see the same data. It runs against Supabase when it is
 * reachable and against an in-memory copy of the demo seed otherwise. The mode
 * is decided ONCE at startup (see initStore) and never silently switches, which
 * is what used to make dashboard changes disappear.
 */
import crypto from "crypto";
import type { Patch, Version, Deployment, AuditEvent } from "@patchwork/shared";
import { getSupabaseAdmin, hasSupabase } from "./db.js";
import { DEMO_PATCHES, DEMO_VERSIONS, DEMO_DEPLOYMENTS, DEMO_AUDIT_EVENTS } from "./seed.js";

export type StoreMode = "supabase" | "memory";
export let storeMode: StoreMode = "memory";

export type DeploymentWithVersion = Deployment & { versions: Version | null };

const mem = {
  patches: [] as Patch[],
  versions: [] as Version[],
  deployments: [] as Deployment[],
  audit: [] as AuditEvent[],
};

export function resetMemory() {
  mem.patches = structuredClone(DEMO_PATCHES);
  mem.versions = structuredClone(DEMO_VERSIONS);
  mem.deployments = structuredClone(DEMO_DEPLOYMENTS);
  mem.audit = structuredClone(DEMO_AUDIT_EVENTS);
}
resetMemory();

export async function initStore(log: { info: (m: string) => void; warn: (m: string) => void }) {
  if (!hasSupabase) {
    storeMode = "memory";
    log.warn("Supabase not configured -> using IN-MEMORY store (data resets when the server restarts).");
    return;
  }
  try {
    const { error } = await getSupabaseAdmin().from("patches").select("id").limit(1);
    if (error) throw error;
    storeMode = "supabase";
    log.info("Store: Supabase connected.");
  } catch (e: any) {
    storeMode = "memory";
    log.warn(`Supabase configured but unreachable (${e?.message ?? e}) -> using IN-MEMORY store.`);
  }
}

const byNewest = <T extends Record<string, any>>(key: string) => (a: T, b: T) =>
  String(b[key]).localeCompare(String(a[key]));

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message ?? String(res.error));
  return res.data;
}

// ---------- patches ----------
export async function listPatches(): Promise<Patch[]> {
  if (storeMode === "supabase") {
    return check(await getSupabaseAdmin().from("patches").select("*").order("created_at", { ascending: false })) as Patch[];
  }
  return [...mem.patches].sort(byNewest("created_at"));
}

export async function getPatch(id: string): Promise<Patch | null> {
  if (storeMode === "supabase") {
    const { data, error } = await getSupabaseAdmin().from("patches").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Patch) ?? null;
  }
  return mem.patches.find((p) => p.id === id) ?? null;
}

export async function getPatchesByIds(ids: string[]): Promise<Patch[]> {
  if (ids.length === 0) return [];
  if (storeMode === "supabase") {
    const rows = check(await getSupabaseAdmin().from("patches").select("*").in("id", ids)) as Patch[];
    // keep the order of `ids` so patches apply in the order they were deployed
    return ids.map((id) => rows.find((r) => r.id === id)).filter((p): p is Patch => !!p);
  }
  return ids.map((id) => mem.patches.find((p) => p.id === id)).filter((p): p is Patch => !!p);
}

export async function insertPatch(p: Patch): Promise<Patch> {
  if (storeMode === "supabase") {
    return check(await getSupabaseAdmin().from("patches").insert(p).select().single()) as Patch;
  }
  mem.patches.unshift(p);
  return p;
}

export async function updatePatch(id: string, updates: Partial<Patch>): Promise<Patch | null> {
  const withTs = { ...updates, updated_at: new Date().toISOString() };
  if (storeMode === "supabase") {
    const { data, error } = await getSupabaseAdmin().from("patches").update(withTs).eq("id", id).select().maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Patch) ?? null;
  }
  const i = mem.patches.findIndex((p) => p.id === id);
  if (i === -1) return null;
  mem.patches[i] = { ...mem.patches[i], ...withTs } as Patch;
  return mem.patches[i];
}

export async function deletePatch(id: string): Promise<boolean> {
  if (storeMode === "supabase") {
    const { error } = await getSupabaseAdmin().from("patches").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }
  const before = mem.patches.length;
  mem.patches = mem.patches.filter((p) => p.id !== id);
  return mem.patches.length < before;
}

// ---------- versions ----------
export async function listVersions(): Promise<Version[]> {
  if (storeMode === "supabase") {
    return check(await getSupabaseAdmin().from("versions").select("*").order("number", { ascending: false })) as Version[];
  }
  return [...mem.versions].sort((a, b) => b.number - a.number);
}

export async function getVersion(id: string): Promise<Version | null> {
  if (storeMode === "supabase") {
    const { data, error } = await getSupabaseAdmin().from("versions").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Version) ?? null;
  }
  return mem.versions.find((v) => v.id === id) ?? null;
}

export async function insertVersion(v: Pick<Version, "patch_ids" | "created_by" | "verification_status">): Promise<Version> {
  const all = await listVersions();
  const number = (all[0]?.number ?? 0) + 1;
  const row: Version = { id: crypto.randomUUID(), number, created_at: new Date().toISOString(), ...v };
  if (storeMode === "supabase") {
    return check(await getSupabaseAdmin().from("versions").insert(row).select().single()) as Version;
  }
  mem.versions.unshift(row);
  return row;
}

export async function updateVersion(id: string, updates: Partial<Version>): Promise<void> {
  if (storeMode === "supabase") {
    const { error } = await getSupabaseAdmin().from("versions").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  mem.versions = mem.versions.map((v) => (v.id === id ? { ...v, ...updates } : v));
}

// ---------- deployments ----------
export async function listDeployments(): Promise<DeploymentWithVersion[]> {
  if (storeMode === "supabase") {
    return check(
      await getSupabaseAdmin().from("deployments").select("*, versions (*)").order("deployed_at", { ascending: false }),
    ) as DeploymentWithVersion[];
  }
  return [...mem.deployments]
    .sort(byNewest("deployed_at"))
    .map((d) => ({ ...d, versions: mem.versions.find((v) => v.id === d.version_id) ?? null }));
}

export async function getDeployment(id: string): Promise<DeploymentWithVersion | null> {
  return (await listDeployments()).find((d) => d.id === id) ?? null;
}

export async function getLiveDeployment(): Promise<DeploymentWithVersion | null> {
  // newest first, so if more than one row is ever live the newest wins
  return (await listDeployments()).find((d) => d.is_live) ?? null;
}

export async function insertDeployment(d: Pick<Deployment, "version_id" | "canary_percent">): Promise<Deployment> {
  const row: Deployment = {
    id: crypto.randomUUID(),
    version_id: d.version_id,
    is_live: false,
    canary_percent: d.canary_percent,
    deployed_at: new Date().toISOString(),
    rolled_back_at: null,
  };
  if (storeMode === "supabase") {
    return check(await getSupabaseAdmin().from("deployments").insert(row).select().single()) as Deployment;
  }
  mem.deployments.unshift(row);
  return row;
}

export async function updateDeployment(id: string, updates: Partial<Deployment>): Promise<void> {
  if (storeMode === "supabase") {
    const { error } = await getSupabaseAdmin().from("deployments").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  mem.deployments = mem.deployments.map((d) => (d.id === id ? { ...d, ...updates } : d));
}

/** Make exactly one deployment live (or none when id is null). */
export async function setOnlyLive(id: string | null): Promise<void> {
  if (storeMode === "supabase") {
    const sb = getSupabaseAdmin();
    const off = await sb.from("deployments").update({ is_live: false }).eq("is_live", true);
    if (off.error) throw new Error(off.error.message);
    if (id) {
      const on = await sb.from("deployments").update({ is_live: true, rolled_back_at: null }).eq("id", id);
      if (on.error) throw new Error(on.error.message);
    }
    return;
  }
  mem.deployments = mem.deployments.map((d) =>
    d.id === id ? { ...d, is_live: true, rolled_back_at: null } : { ...d, is_live: false },
  );
}

// ---------- audit ----------
export async function addAudit(e: Omit<AuditEvent, "id" | "created_at">): Promise<void> {
  const row: AuditEvent = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...e };
  if (storeMode === "supabase") {
    const { error } = await getSupabaseAdmin().from("audit_events").insert(row);
    if (error) console.error("[audit] insert failed:", error.message);
    return; // an audit failure must never block the user's action
  }
  mem.audit.unshift(row);
}

export async function listAudit(): Promise<AuditEvent[]> {
  if (storeMode === "supabase") {
    return check(
      await getSupabaseAdmin().from("audit_events").select("*").order("created_at", { ascending: false }),
    ) as AuditEvent[];
  }
  return [...mem.audit].sort(byNewest("created_at"));
}
