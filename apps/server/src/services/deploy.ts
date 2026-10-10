/**
 * Deploy / undeploy / rollback logic shared by the routes.
 * "Live" = the patches listed in the version of the one live deployment.
 */
import type { Patch, Version, Deployment } from "@patchwork/shared";
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
  opts: { actor: string; canary_percent?: number; verification_status?: Version["verification_status"]; note?: string },
) {
  const version = await store.insertVersion({
    patch_ids: patchIds,
    created_by: opts.actor,
    verification_status: opts.verification_status ?? "pending",
  });
  const deployment = await store.insertDeployment({
    version_id: version.id,
    canary_percent: opts.canary_percent ?? 100,
  });
  await store.setOnlyLive(deployment.id);

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
  a.anchors.cssSelector === b.anchors.cssSelector && a.change.type === b.change.type;

/**
 * Deploy ONE patch on top of whatever is already live.
 * A newer patch replaces an older live patch that edits the same property of
 * the same element, so deploying never wipes unrelated live patches.
 */
export async function deployPatch(patchId: string, actor: string) {
  const patch = await store.getPatch(patchId);
  if (!patch) return null;
  const live = await getLiveState();
  const kept = live.patches.filter((p) => p.id !== patch.id && !sameTarget(p, patch)).map((p) => p.id);
  return deployPatchSet([...kept, patch.id], { actor, note: `deploy patch ${patch.id.slice(0, 8)}` });
}

export async function undeployPatch(patchId: string, actor: string) {
  const live = await getLiveState();
  if (!live.patches.some((p) => p.id === patchId)) return null;
  const remaining = live.patches.filter((p) => p.id !== patchId).map((p) => p.id);
  return deployPatchSet(remaining, { actor, note: `remove patch ${patchId.slice(0, 8)} from live` });
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
    (d) => d.id !== current.id && !d.rolled_back_at && d.deployed_at < current.deployed_at,
  );
  await store.setOnlyLive(earlier?.id ?? null);

  const restoredIds = earlier?.versions?.patch_ids ?? [];
  await syncStatuses(restoredIds);

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
  await store.addAudit({
    actor_id: actor,
    event_type: "deployment_created",
    entity_id: dep.id,
    details: { version_number: dep.versions?.number ?? null, note: "redeployed existing version" },
  });
  return dep;
}
