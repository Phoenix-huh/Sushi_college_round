/**
 * Single data layer for patches / versions / deployments / audit events / sites / conflicts / reviews.
 *
 * Every route goes through this module, so the dashboard, the demo site and the
 * verifier always see the same data. It runs against Supabase when it is
 * reachable and against an in-memory copy of the demo seed otherwise.
 */
import crypto from "crypto";
import type {
  Patch,
  Version,
  Deployment,
  AuditEvent,
  Site,
  PatchOp,
  Conflict,
  Review,
} from "@patchwork/shared";
import { getSupabaseAdmin, hasSupabase } from "./db.js";
import {
  DEMO_PATCHES,
  DEMO_VERSIONS,
  DEMO_DEPLOYMENTS,
  DEMO_AUDIT_EVENTS,
  DEMO_SITES,
  DEMO_PATCH_OPS,
  DEMO_CONFLICTS,
  DEMO_PROFILES,
} from "./seed.js";

export type StoreMode = "supabase" | "memory";
export let storeMode: StoreMode = "memory";

export type DeploymentWithVersion = Deployment & { versions: Version | null };

const mem = {
  sites: [] as Site[],
  patches: [] as Patch[],
  patch_ops: [] as PatchOp[],
  conflicts: [] as Conflict[],
  reviews: [] as Review[],
  profiles: [] as typeof DEMO_PROFILES,
  versions: [] as Version[],
  deployments: [] as Deployment[],
  audit: [] as AuditEvent[],
};

export function resetMemory() {
  mem.sites = structuredClone(DEMO_SITES);
  mem.patches = structuredClone(DEMO_PATCHES);
  mem.patch_ops = structuredClone(DEMO_PATCH_OPS);
  mem.conflicts = structuredClone(DEMO_CONFLICTS);
  mem.reviews = [];
  mem.profiles = structuredClone(DEMO_PROFILES);
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
  String(b[key] ?? "").localeCompare(String(a[key] ?? ""));

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message ?? String(res.error));
  return res.data;
}

// Fallback safely to memory if a table does not exist in Supabase
async function trySupabase<T>(
  fn: () => Promise<{ data: T | null; error: any }>,
  fallback: () => T | Promise<T>
): Promise<T> {
  if (storeMode !== "supabase") return fallback();
  try {
    const res = await fn();
    if (res.error) {
      if (
        res.error.code === "PGRST205" ||
        res.error.code === "PGRST204" ||
        String(res.error.message).includes("Could not find the table")
      ) {
        return fallback();
      }
      throw new Error(res.error.message ?? String(res.error));
    }
    return res.data as T;
  } catch (err: any) {
    if (err.message?.includes("Could not find the table") || err.message?.includes("PGRST205")) {
      return fallback();
    }
    throw err;
  }
}

// ---------- sites ----------
export async function listSites(): Promise<Site[]> {
  return trySupabase(
    async () => getSupabaseAdmin().from("sites").select("*").order("created_at", { ascending: false }),
    () => [...mem.sites].sort(byNewest("created_at"))
  );
}

export async function getSite(id: string): Promise<Site | null> {
  return trySupabase(
    async () => getSupabaseAdmin().from("sites").select("*").eq("id", id).maybeSingle(),
    () => mem.sites.find((s) => s.id === id) ?? null
  );
}

export async function insertSite(s: Omit<Site, "id"> & { id?: string }): Promise<Site> {
  const row: Site = {
    id: s.id || crypto.randomUUID(),
    created_at: new Date().toISOString(),
    live_version_id: null,
    ...s,
  };
  return trySupabase(
    async () => getSupabaseAdmin().from("sites").insert(row).select().single(),
    () => {
      mem.sites.unshift(row);
      return row;
    }
  );
}

export async function updateSite(id: string, updates: Partial<Site>): Promise<Site | null> {
  return trySupabase(
    async () => getSupabaseAdmin().from("sites").update(updates).eq("id", id).select().maybeSingle(),
    () => {
      const idx = mem.sites.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      mem.sites[idx] = { ...mem.sites[idx], ...updates };
      return mem.sites[idx];
    }
  );
}

// ---------- profiles ----------
export async function listProfiles() {
  return trySupabase(
    async () => getSupabaseAdmin().from("profiles").select("*"),
    () => mem.profiles
  );
}

export async function getProfile(id: string) {
  return (await listProfiles()).find((p) => p.id === id) ?? null;
}

// ---------- patches ----------
export async function listPatches(siteId?: string): Promise<Patch[]> {
  let patches: Patch[];
  if (storeMode === "supabase") {
    let q = getSupabaseAdmin().from("patches").select("*");
    if (siteId) q = q.eq("site_id", siteId);
    patches = check(await q.order("created_at", { ascending: false })) as Patch[];
  } else {
    patches = siteId ? mem.patches.filter((p) => p.site_id === siteId) : [...mem.patches];
    patches.sort(byNewest("created_at"));
  }

  // Populate ops from patch_ops if available
  const allOps = await listPatchOps();
  return patches.map((p) => {
    const matchingOps = allOps.filter((o) => o.patch_id === p.id);
    return matchingOps.length > 0 ? { ...p, ops: matchingOps } : p;
  });
}

export async function getPatch(id: string): Promise<Patch | null> {
  let patch: Patch | null = null;
  if (storeMode === "supabase") {
    const { data, error } = await getSupabaseAdmin().from("patches").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    patch = (data as Patch) ?? null;
  } else {
    patch = mem.patches.find((p) => p.id === id) ?? null;
  }
  if (!patch) return null;
  const ops = await listPatchOps(patch.id);
  return ops.length > 0 ? { ...patch, ops } : patch;
}

export async function getPatchesByIds(ids: string[]): Promise<Patch[]> {
  if (ids.length === 0) return [];
  if (storeMode === "supabase") {
    const rows = check(await getSupabaseAdmin().from("patches").select("*").in("id", ids)) as Patch[];
    return ids.map((id) => rows.find((r) => r.id === id)).filter((p): p is Patch => !!p);
  }
  return ids.map((id) => mem.patches.find((p) => p.id === id)).filter((p): p is Patch => !!p);
}

export async function insertPatch(p: Patch): Promise<Patch> {
  const patchToSave = { ...p };
  delete patchToSave.ops; // ops stored in patch_ops or json

  let saved: Patch;
  if (storeMode === "supabase") {
    const res = await getSupabaseAdmin().from("patches").insert(patchToSave).select().single();
    if (res.error && String(res.error.message).includes("title")) {
      const fallback = { ...patchToSave };
      delete fallback.title;
      saved = check(await getSupabaseAdmin().from("patches").insert(fallback).select().single()) as Patch;
      saved.title = p.title;
    } else {
      saved = check(res) as Patch;
    }
  } else {
    mem.patches.unshift(patchToSave);
    saved = patchToSave;
  }

  // If patch has ops, save them
  if (p.ops && p.ops.length > 0) {
    for (const op of p.ops) {
      await insertPatchOp({ ...op, patch_id: saved.id });
    }
  }
  return { ...saved, ops: p.ops };
}

export async function updatePatch(id: string, updates: Partial<Patch>): Promise<Patch | null> {
  const withTs = { ...updates, updated_at: new Date().toISOString() };
  const toSave = { ...withTs };
  delete toSave.ops;

  let updated: Patch | null = null;
  if (storeMode === "supabase") {
    let res = await getSupabaseAdmin().from("patches").update(toSave).eq("id", id).select().maybeSingle();
    if (res.error && String(res.error.message).includes("title")) {
      delete toSave.title;
      res = await getSupabaseAdmin().from("patches").update(toSave).eq("id", id).select().maybeSingle();
    }
    // If Supabase has the old 001 patches_status_check constraint ('draft', 'approved', 'live', 'broken', 'healed')
    if (res.error && String(res.error.message).includes("patches_status_check")) {
      const fallback = { ...toSave };
      if (fallback.status === "conflicted" || fallback.status === "stale" || fallback.status === "in_review" || fallback.status === "rejected") {
        fallback.status = "draft";
      }
      res = await getSupabaseAdmin().from("patches").update(fallback).eq("id", id).select().maybeSingle();
    }
    if (res.error) throw new Error(res.error.message);
    updated = (res.data as Patch) ?? null;
    if (updated && toSave.status) {
      updated.status = toSave.status;
    }
  } else {
    const i = mem.patches.findIndex((p) => p.id === id);
    if (i !== -1) {
      mem.patches[i] = { ...mem.patches[i], ...toSave } as Patch;
      updated = mem.patches[i];
    }
  }

  if (updated && updates.ops) {
    // Replace ops
    await deletePatchOpsForPatch(id);
    for (const op of updates.ops) {
      await insertPatchOp({ ...op, patch_id: id });
    }
  }
  return updated;
}

export async function deletePatch(id: string): Promise<boolean> {
  await deletePatchOpsForPatch(id);
  if (storeMode === "supabase") {
    const { error } = await getSupabaseAdmin().from("patches").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }
  const before = mem.patches.length;
  mem.patches = mem.patches.filter((p) => p.id !== id);
  return mem.patches.length < before;
}

// ---------- patch_ops ----------
export async function listPatchOps(patchId?: string): Promise<PatchOp[]> {
  return trySupabase(
    async () => {
      let q = getSupabaseAdmin().from("patch_ops").select("*");
      if (patchId) q = q.eq("patch_id", patchId);
      return q;
    },
    () => (patchId ? mem.patch_ops.filter((o) => o.patch_id === patchId) : mem.patch_ops)
  );
}

export async function insertPatchOp(op: PatchOp): Promise<PatchOp> {
  const row: PatchOp = { ...op, id: op.id || crypto.randomUUID() };
  return trySupabase(
    async () => getSupabaseAdmin().from("patch_ops").insert(row).select().single(),
    () => {
      mem.patch_ops.unshift(row);
      return row;
    }
  );
}

export async function deletePatchOpsForPatch(patchId: string): Promise<void> {
  await trySupabase(
    async () => getSupabaseAdmin().from("patch_ops").delete().eq("patch_id", patchId),
    () => {
      mem.patch_ops = mem.patch_ops.filter((o) => o.patch_id !== patchId);
      return null as any;
    }
  );
}

// ---------- conflicts ----------
export async function listConflicts(status?: "open" | "resolved"): Promise<Conflict[]> {
  return trySupabase(
    async () => {
      let q = getSupabaseAdmin().from("conflicts").select("*");
      if (status) q = q.eq("status", status);
      return q.order("created_at", { ascending: false });
    },
    () => {
      const list = status ? mem.conflicts.filter((c) => c.status === status) : mem.conflicts;
      return [...list].sort(byNewest("created_at"));
    }
  );
}

export async function getConflict(id: string): Promise<Conflict | null> {
  return trySupabase(
    async () => getSupabaseAdmin().from("conflicts").select("*").eq("id", id).maybeSingle(),
    () => mem.conflicts.find((c) => c.id === id) ?? null
  );
}

export async function getConflictsForPatch(patchId: string): Promise<Conflict[]> {
  const all = await listConflicts("open");
  return all.filter((c) => c.patch_a === patchId || c.patch_b === patchId);
}

export async function insertConflict(
  c: Omit<Conflict, "id" | "created_at" | "status" | "resolution"> & {
    id?: string;
    created_at?: string;
    status?: Conflict["status"];
    resolution?: string | null;
  }
): Promise<Conflict> {
  const row: Conflict = {
    ...c,
    id: c.id || crypto.randomUUID(),
    created_at: c.created_at || new Date().toISOString(),
    status: c.status || "open",
    resolution: c.resolution ?? null,
  };
  return trySupabase(
    async () => getSupabaseAdmin().from("conflicts").insert(row).select().single(),
    () => {
      mem.conflicts.unshift(row);
      return row;
    }
  );
}

export async function updateConflict(id: string, updates: Partial<Conflict>): Promise<Conflict | null> {
  return trySupabase(
    async () => getSupabaseAdmin().from("conflicts").update(updates).eq("id", id).select().maybeSingle(),
    () => {
      const idx = mem.conflicts.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      mem.conflicts[idx] = { ...mem.conflicts[idx], ...updates };
      return mem.conflicts[idx];
    }
  );
}

// ---------- reviews ----------
export async function listReviews(patchId?: string): Promise<Review[]> {
  return trySupabase(
    async () => {
      let q = getSupabaseAdmin().from("reviews").select("*");
      if (patchId) q = q.eq("patch_id", patchId);
      return q.order("created_at", { ascending: false });
    },
    () => (patchId ? mem.reviews.filter((r) => r.patch_id === patchId) : mem.reviews)
  );
}

export async function insertReview(
  r: Omit<Review, "id" | "created_at"> & { id?: string; created_at?: string }
): Promise<Review> {
  const row: Review = {
    ...r,
    id: r.id || crypto.randomUUID(),
    created_at: r.created_at || new Date().toISOString(),
  };
  return trySupabase(
    async () => getSupabaseAdmin().from("reviews").insert(row).select().single(),
    () => {
      mem.reviews.unshift(row);
      return row;
    }
  );
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

export async function insertVersion(
  v: Pick<Version, "patch_ids" | "created_by" | "verification_status"> & {
    parent_id?: string | null;
    ops_snapshot?: PatchOp[];
  }
): Promise<Version> {
  const all = await listVersions();
  const number = (all[0]?.number ?? 0) + 1;
  const row: Version = {
    id: crypto.randomUUID(),
    number,
    parent_id: v.parent_id ?? all[0]?.id ?? null,
    ops_snapshot: v.ops_snapshot ?? [],
    created_at: new Date().toISOString(),
    ...v,
  };
  if (storeMode === "supabase") {
    // try with all columns, fallback without new columns if needed
    try {
      return check(await getSupabaseAdmin().from("versions").insert(row).select().single()) as Version;
    } catch {
      const basic = {
        id: row.id,
        number: row.number,
        patch_ids: row.patch_ids,
        created_by: row.created_by,
        verification_status: row.verification_status,
        created_at: row.created_at,
      };
      return check(await getSupabaseAdmin().from("versions").insert(basic).select().single()) as Version;
    }
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
      await getSupabaseAdmin().from("deployments").select("*, versions (*)").order("deployed_at", { ascending: false })
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
    d.id === id ? { ...d, is_live: true, rolled_back_at: null } : { ...d, is_live: false }
  );
}

// ---------- audit ----------
export async function addAudit(e: Omit<AuditEvent, "id" | "created_at">): Promise<void> {
  const row: AuditEvent = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...e };
  if (storeMode === "supabase") {
    const { error } = await getSupabaseAdmin().from("audit_events").insert(row);
    if (error) console.error("[audit] insert failed:", error.message);
    return;
  }
  mem.audit.unshift(row);
}

export async function listAudit(): Promise<AuditEvent[]> {
  if (storeMode === "supabase") {
    return check(
      await getSupabaseAdmin().from("audit_events").select("*").order("created_at", { ascending: false })
    ) as AuditEvent[];
  }
  return [...mem.audit].sort(byNewest("created_at"));
}
