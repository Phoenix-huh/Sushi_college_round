/**
 * Deploy / undeploy / rollback / merge logic shared by the routes.
 * "Live" = the patches listed in the version of the one live deployment.
 */
import type { Patch, Version, Deployment } from "@patchwork/shared";
import { getPatchOps, targetsSameElement } from "@patchwork/shared";
import * as store from "../store.js";

export const SYSTEM_ID = "00000000-0000-0000-0000-000000000000";

export interface LiveState {
  deployment: Deployment | null;
  version: Version | null;
  patches: Patch[];
  /** changes whenever what visitors should see changes (deploy, rollback, edit) */
  signature: string;
}

export async function getLiveState(): Promise<LiveState> {
  const dep = await store.getLiveDeployment();
  if (!dep || !dep.versions) {
    return { deployment: null, version: null, patches: [], signature: "none" };
  }
  const patches = await store.getPatchesByIds(dep.versions.patch_ids);
  const { versions, ...deployment } = dep;
  const signature = `${deployment.id}|${patches.map((p) => `${p.id}@${p.updated_at}`).join(",")}`;
  return { deployment, version: versions, patches, signature };
}

/** Keep patch.status in step with what is actually live. */
async function syncStatuses(liveIds: string[]) {
  const all = await store.listPatches();
  for (const p of all) {
    const isLive = liveIds.includes(p.id);
    if (isLive && p.status !== "live") {
      await store.updatePatch(p.id, { status: "live" });
    } else if (!isLive && p.status === "live") {
      await store.updatePatch(p.id, { status: "approved" });
    }
  }
}

export async function deployPatchSet(
  patchIds: string[],
  opts: { actor: string; canary_percent?: number; verification_status?: Version["verification_status"]; note?: string }
) {
  const allPatches = await store.getPatchesByIds(patchIds);
  const allOps = allPatches.flatMap((p) => getPatchOps(p));

  const version = await store.insertVersion({
    patch_ids: patchIds,
    ops_snapshot: allOps,
    created_by: opts.actor,
    verification_status: opts.verification_status ?? "pending",
  });
  const deployment = await store.insertDeployment({
    version_id: version.id,
    canary_percent: opts.canary_percent ?? 100,
  });
  await store.setOnlyLive(deployment.id);

  // Update site's live_version_id
  const sites = await store.listSites();
  if (sites.length > 0) {
    await store.updateSite(sites[0].id, { live_version_id: version.id });
  }

  await store.addAudit({
    actor_id: opts.actor,
    event_type: "version_created",
    entity_id: version.id,
    details: { version_number: version.number, patch_count: patchIds.length },
  });
  await store.addAudit({
    actor_id: opts.actor,
    event_type: "deployment_created",
    entity_id: deployment.id,
    details: { version_number: version.number, patch_ids: patchIds, note: opts.note },
  });
  await syncStatuses(patchIds);
  return { version, deployment: { ...deployment, is_live: true } };
}

const sameTarget = (a: Patch, b: Patch) =>
  targetsSameElement(a.anchors, b.anchors) && a.change.type === b.change.type;

/**
 * Merge must run in one DB transaction / atomic step with compare-and-swap:
 * - fail if sites.live_version_id != patch.base_version (rebase first)
 * - fail if open conflicts exist
 * - fail if the status is not approved
 * Then create a new version with ops_snapshot = live ops + patch ops,
 * flip sites.live_version_id, mark patch live, and write an audit event.
 */
export async function mergePatch(patchId: string, actor: string) {
  let patch = await store.getPatch(patchId);
  if (!patch) throw new Error("Patch not found");

  const sites = await store.listSites();
  const site = (patch.site_id ? sites.find((s) => s.id === patch.site_id) : null) ?? sites[0];

  const live = await getLiveState();
  const liveVersionNumber = live.version?.number ?? 0;
  const liveVersionId = live.version?.id ?? null;

  // 1. CAS check: auto-rebase if base_version doesn't match live version
  const baseMatches =
    patch.base_version === liveVersionNumber ||
    (site?.live_version_id && patch.base_version === (site.live_version_id as any)) ||
    (patch.base_version === 0 && !live.version);
  if (!baseMatches && live.version) {
    // Auto-rebase: update patch to current live version before merging
    await store.updatePatch(patch.id, { base_version: liveVersionNumber });
    patch = { ...patch, base_version: liveVersionNumber };
    await store.addAudit({
      actor_id: actor,
      event_type: "patch_rebased",
      entity_id: patch.id,
      details: { auto_rebase: true, new_base: liveVersionNumber },
    });
  }

  // 2. Open conflicts check
  const openConflicts = await store.getConflictsForPatch(patch.id);
  if (openConflicts.length > 0) {
    throw new Error("Cannot merge: patch has open conflicts that must be resolved first.");
  }

  // 3. Status must be approved
  if (patch.status !== "approved") {
    throw new Error(`Cannot merge: patch status is '${patch.status}' (must be 'approved' first).`);
  }

  // 4. Create new version with ops_snapshot = live ops + patch ops
  const patchOps = getPatchOps(patch);
  const liveOps = live.version?.ops_snapshot ?? [];
  const keptLiveOps = liveOps.filter(
    (lo) =>
      !patchOps.some(
        (po) => targetsSameElement(po.anchors, lo.anchors) && po.property.toLowerCase() === lo.property.toLowerCase()
      )
  );
  const mergedOps = [...keptLiveOps, ...patchOps];

  const keptPatchIds = live.patches.filter((p) => p.id !== patch.id && !sameTarget(p, patch)).map((p) => p.id);
  const newPatchIds = [...keptPatchIds, patch.id];

  const version = await store.insertVersion({
    patch_ids: newPatchIds,
    parent_id: live.version?.id ?? null,
    ops_snapshot: mergedOps,
    created_by: actor,
    verification_status: "passed",
  });

  const deployment = await store.insertDeployment({
    version_id: version.id,
    canary_percent: 100,
  });
  await store.setOnlyLive(deployment.id);

  if (site) {
    await store.updateSite(site.id, { live_version_id: version.id });
  }

  await store.updatePatch(patch.id, { status: "live" });
  await syncStatuses(newPatchIds);

  await store.addAudit({
    actor_id: actor,
    event_type: "patch_merged",
    entity_id: patch.id,
    details: {
      version_number: version.number,
      version_id: version.id,
      ops_count: mergedOps.length,
      note: `merged patch ${patch.id.slice(0, 8)}`,
    },
  });

  return { success: true, version, deployment: { ...deployment, is_live: true }, patch };
}

/**
 * Deploy ONE patch on top of whatever is already live.
 * If status is approved, performs mergePatch.
 */
export async function deployPatch(patchId: string, actor: string) {
  const patch = await store.getPatch(patchId);
  if (!patch) return null;
  if (patch.status === "approved") {
    return mergePatch(patchId, actor);
  }
  const live = await getLiveState();
  const kept = live.patches.filter((p) => p.id !== patch.id && !sameTarget(p, patch)).map((p) => p.id);
  return deployPatchSet([...kept, patch.id], { actor, note: `deploy patch ${patch.id.slice(0, 8)}` });
}

export async function undeployPatch(patchId: string, actor: string) {
  const live = await getLiveState();
  if (!live.patches.some((p) => p.id === patchId)) return null;
  const remaining = live.patches.filter((p) => p.id !== patchId).map((p) => p.id);
  return deployPatchSet(remaining, { actor, note: `roll back patch ${patchId.slice(0, 8)}` });
}

/**
 * Roll back the live deployment: mark it rolled back and put the most recent
 * earlier deployment (that was not itself rolled back) live again.
 * If there is nothing earlier, the site returns to its original, unpatched state.
 */
export async function rollbackLive(actor: string, reason = "manual") {
  const current = await store.getLiveDeployment();
  if (!current) return null;

  await store.updateDeployment(current.id, { rolled_back_at: new Date().toISOString() });

  const earlier = (await store.listDeployments()).find(
    (d) => d.id !== current.id && !d.rolled_back_at && d.deployed_at < current.deployed_at
  );
  await store.setOnlyLive(earlier?.id ?? null);

  const restoredIds = earlier?.versions?.patch_ids ?? [];
  await syncStatuses(restoredIds);

  const sites = await store.listSites();
  if (sites.length > 0) {
    await store.updateSite(sites[0].id, { live_version_id: earlier?.versions?.id ?? null });
  }

  await store.addAudit({
    actor_id: actor,
    event_type: "deployment_rolled_back",
    entity_id: current.id,
    details: {
      reason,
      rolled_back_version: current.versions?.number ?? null,
      restored_version: earlier?.versions?.number ?? null,
    },
  });
  return { rolled_back: current, restored: earlier ?? null };
}

/** Put an older deployment back live (the "Redeploy" button). */
export async function activateDeployment(id: string, actor: string) {
  const dep = await store.getDeployment(id);
  if (!dep) return null;
  await store.setOnlyLive(dep.id);
  await syncStatuses(dep.versions?.patch_ids ?? []);
  const sites = await store.listSites();
  if (sites.length > 0 && dep.version_id) {
    await store.updateSite(sites[0].id, { live_version_id: dep.version_id });
  }
  await store.addAudit({
    actor_id: actor,
    event_type: "deployment_created",
    entity_id: dep.id,
    details: { version_number: dep.versions?.number ?? null, note: "redeployed existing version" },
  });
  return dep;
}
