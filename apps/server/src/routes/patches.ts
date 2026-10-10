import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { z } from "zod";
import {
  CreatePatchSchema,
  PatchChangeSchema,
  PatchAnchorSchema,
  PatchOpSchema,
  type Patch,
  type PatchOp,
} from "@patchwork/shared";
import * as store from "../store.js";
import { resolveActor } from "../auth.js";
import {
  detectConflicts,
  checkSubmitConflicts,
  getPatchOps,
} from "../services/conflicts.js";
import {
  deployPatch,
  undeployPatch,
  mergePatch,
  getLiveState,
} from "../services/deploy.js";

const UpdatePatchSchema = z.object({
  title: z.string().optional(),
  site_id: z.string().uuid().optional(),
  change: PatchChangeSchema.optional(),
  anchors: PatchAnchorSchema.partial().optional(),
  status: z
    .enum(["draft", "in_review", "approved", "live", "conflicted", "rejected", "stale", "broken", "healed"])
    .optional(),
  ops: z.array(PatchOpSchema).optional(),
});

const ReviewRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().optional(),
});

const ResolveConflictSchema = z.object({
  choice: z.enum(["a", "b", "custom"]),
  value: z.string().optional(),
});

export async function patchRoutes(app: FastifyInstance) {
  // ---------- sites ----------
  app.get("/sites", async () => store.listSites());

  app.post("/sites", async (request, reply) => {
    const { name, url } = (request.body ?? {}) as { name?: string; url?: string };
    if (!name || !url) return reply.code(400).send({ error: "Name and URL are required" });

    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    const site = await store.insertSite({ name, url });

    await store.addAudit({
      actor_id: actor,
      event_type: "site_created",
      entity_id: site.id,
      details: { name: site.name, url: site.url },
    });
    return reply.code(201).send(site);
  });

  // ---------- profiles ----------
  app.get("/profiles", async () => store.listProfiles());

  // ---------- patches ----------
  app.get("/patches", async (request) => {
    const { site_id } = (request.query ?? {}) as { site_id?: string };
    return store.listPatches(site_id);
  });

  app.get("/patches/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const patch = await store.getPatch(id);
    return patch ?? reply.code(404).send({ error: "Patch not found" });
  });

  app.post("/patches", async (request, reply) => {
    const parsed = CreatePatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    const now = new Date().toISOString();
    const patch: Patch = {
      id: crypto.randomUUID(),
      ...parsed.data,
      author_id: parsed.data.author_id || actor,
      status: "draft",
      created_at: now,
      updated_at: now,
    };
    const saved = await store.insertPatch(patch);
    await store.addAudit({
      actor_id: actor,
      event_type: "patch_created",
      entity_id: saved.id,
      details: {
        title: saved.title,
        selector: saved.anchors.cssSelector,
        change: saved.change,
        author_id: saved.author_id,
      },
    });
    return reply.code(201).send(saved);
  });

  app.put("/patches/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdatePatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const existing = await store.getPatch(id);
    if (!existing) return reply.code(404).send({ error: "Patch not found" });

    const updates: Partial<Patch> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.site_id !== undefined) updates.site_id = parsed.data.site_id;
    if (parsed.data.change) updates.change = parsed.data.change;
    if (parsed.data.anchors) updates.anchors = { ...existing.anchors, ...parsed.data.anchors } as any;
    if (parsed.data.status) updates.status = parsed.data.status;
    if (parsed.data.ops) updates.ops = parsed.data.ops;

    const updated = await store.updatePatch(id, updates);
    await store.addAudit({
      actor_id: await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string),
      event_type: "patch_updated",
      entity_id: id,
      details: { updates },
    });
    return updated;
  });

  // PUT /patches/:id/ops — update operations of a patch
  app.put("/patches/:id/ops", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { ops } = (request.body ?? {}) as { ops?: PatchOp[] };
    if (!ops || !Array.isArray(ops)) return reply.code(400).send({ error: "ops array required" });

    const patch = await store.getPatch(id);
    if (!patch) return reply.code(404).send({ error: "Patch not found" });

    const updated = await store.updatePatch(id, { ops });
    await store.addAudit({
      actor_id: await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string),
      event_type: "patch_updated",
      entity_id: id,
      details: { ops_count: ops.length },
    });
    return updated;
  });

  app.delete("/patches/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    const existing = await store.getPatch(id);
    if (!existing) return reply.code(404).send({ error: "Patch not found" });

    await undeployPatch(id, actor);
    await store.deletePatch(id);
    return { ok: true };
  });

  // POST /patches/:id/submit — runs conflict detection -> in_review, conflicted, or auto-rebase
  app.post("/patches/:id/submit", async (request, reply) => {
    const { id } = request.params as { id: string };
    const patch = await store.getPatch(id);
    if (!patch) return reply.code(404).send({ error: "Patch not found" });

    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    const allPatches = await store.listPatches();
    const otherOpen = allPatches.filter(
      (p) => p.id !== patch.id && ["draft", "in_review", "approved"].includes(p.status)
    );

    const live = await getLiveState();
    const liveVersionNumber = live.version?.number ?? 0;
    const versions = await store.listVersions();
    const newerVersions = versions.filter((v) => v.number > patch.base_version);
    const newerVersionOps = newerVersions.map((v) => ({
      version_number: v.number,
      ops: v.ops_snapshot || [],
    }));

    const result = checkSubmitConflicts(patch, otherOpen, newerVersionOps);

    if (result.status === "stale") {
      await store.updatePatch(id, { status: "stale" });
      return reply.send({ status: "stale", reason: "Target element could not be resolved" });
    }

    if (result.conflicts.length > 0) {
      // Save conflict rows
      const savedConflicts = [];
      for (const c of result.conflicts) {
        const row = await store.insertConflict({
          patch_a: c.patch_a,
          patch_b: c.patch_b,
          op_a: c.op_a,
          op_b: c.op_b,
          type: c.type,
          status: "open",
          resolution: null,
        });
        savedConflicts.push(row);
        await store.addAudit({
          actor_id: actor,
          event_type: "conflict_detected",
          entity_id: patch.id,
          details: {
            conflicting_patch_id: c.patch_b,
            type: c.type,
            reason: c.reason,
          },
        });
      }
      await store.updatePatch(id, { status: "conflicted" });
      return reply.send({ status: "conflicted", conflicts: savedConflicts });
    }

    // Always rebase to current live version so CAS check passes at deploy time
    const wasRebased = patch.base_version !== liveVersionNumber;
    if (wasRebased) {
      await store.updatePatch(id, { base_version: liveVersionNumber });
      await store.addAudit({
        actor_id: actor,
        event_type: "patch_rebased",
        entity_id: patch.id,
        details: { old_base: patch.base_version, new_base: liveVersionNumber },
      });
    }

    // Move to in_review: a reviewer (≠ author) must approve before deploy
    await store.updatePatch(id, { status: "in_review" });
    await store.addAudit({
      actor_id: actor,
      event_type: "patch_submitted",
      entity_id: patch.id,
      details: { base_version: liveVersionNumber, rebased: wasRebased },
    });
    return reply.send({ status: "in_review", rebased: wasRebased });
  });

  // GET /patches/:id/conflicts
  app.get("/patches/:id/conflicts", async (request) => {
    const { id } = request.params as { id: string };
    return store.getConflictsForPatch(id);
  });

  // POST /patches/:id/review — reject self-approval
  app.post("/patches/:id/review", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ReviewRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const patch = await store.getPatch(id);
    if (!patch) return reply.code(404).send({ error: "Patch not found" });

    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);

    // Rule: author cannot approve their own patch
    if (patch.author_id === actor && parsed.data.decision === "approved") {
      return reply.code(400).send({ error: "Author cannot approve their own patch" });
    }

    await store.insertReview({
      patch_id: id,
      reviewer_id: actor,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });

    const newStatus = parsed.data.decision === "approved" ? "approved" : "rejected";
    const updated = await store.updatePatch(id, { status: newStatus });

    await store.addAudit({
      actor_id: actor,
      event_type: parsed.data.decision === "approved" ? "patch_approved" : "patch_reviewed",
      entity_id: id,
      details: { decision: parsed.data.decision, comment: parsed.data.comment },
    });

    return reply.send({ success: true, patch: updated });
  });

  // POST /patches/:id/merge — the Deploy action for approved patches (CAS merge)
  app.post("/patches/:id/merge", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    try {
      const result = await mergePatch(id, actor);
      return reply.send(result);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  // POST /patches/:id/deploy — backward compatible deploy (calls mergePatch if approved)
  app.post("/patches/:id/deploy", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    try {
      const result = await deployPatch(id, actor);
      if (!result) return reply.code(404).send({ error: "Patch not found" });
      return reply.send({ success: true, ...result });
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  // POST /patches/:id/undeploy — roll back single patch
  app.post("/patches/:id/undeploy", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    const result = await undeployPatch(id, actor);
    if (!result) return reply.code(409).send({ error: "Patch is not live" });
    return reply.send({ success: true, ...result });
  });

  // POST /patches/:id/healed — content script reports a successful self-heal
  app.post("/patches/:id/healed", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { score, breakdown } = (request.body ?? {}) as {
      score?: number;
      breakdown?: Record<string, number>;
    };

    const patch = await store.getPatch(id);
    if (!patch) return reply.code(404).send({ error: "Patch not found" });

    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);

    // Mark as healed (only update status if it isn't already healed)
    if (patch.status !== "healed") {
      await store.updatePatch(id, { status: "healed" });
    }

    await store.addAudit({
      actor_id: actor,
      event_type: "patch_healed",
      entity_id: id,
      details: {
        score,
        breakdown,
        previous_status: patch.status,
      },
    });

    return reply.send({ ok: true, patchId: id, score });
  });

  // ---------- conflicts ----------
  app.get("/conflicts", async () => {
    const openConflicts = await store.listConflicts("open");
    const allPatches = await store.listPatches();
    const patchMap = new Map(allPatches.map((p) => [p.id, p]));

    // Format for client
    const pairs: [Patch, Patch][] = [];
    const enriched = openConflicts
      .map((c) => {
        const patchA = patchMap.get(c.patch_a);
        const patchB = patchMap.get(c.patch_b);
        if (patchA && patchB) {
          pairs.push([patchA, patchB]);
          return { ...c, patchA, patchB };
        }
        return null;
      })
      .filter(Boolean);

    // Also include pairs detected dynamically if no stored conflicts
    const dynamic = detectConflicts(allPatches.filter((p) => !["broken", "rejected"].includes(p.status)));
    const mergedPairs = [...pairs];
    for (const [p1, p2] of dynamic.conflictingPatches) {
      if (!mergedPairs.some(([a, b]) => (a.id === p1.id && b.id === p2.id) || (a.id === p2.id && b.id === p1.id))) {
        mergedPairs.push([p1, p2]);
      }
    }

    return {
      hasConflict: mergedPairs.length > 0,
      conflicts: enriched,
      conflictingPatches: mergedPairs,
    };
  });

  // POST /conflicts/:id/resolve { choice: 'a'|'b'|'custom', value? }
  app.post("/conflicts/:id/resolve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ResolveConflictSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    const conflict = await store.getConflict(id);
    if (!conflict) return reply.code(404).send({ error: "Conflict not found" });

    const patchA = await store.getPatch(conflict.patch_a);
    const patchB = await store.getPatch(conflict.patch_b);
    if (!patchA || !patchB) return reply.code(404).send({ error: "One or more patches in conflict not found" });

    const choice = parsed.data.choice;
    let resolution: string = choice;

    if (choice === "a") {
      // Keep A, discard B's change
      await store.updatePatch(patchA.id, { status: "approved" });
      await store.updatePatch(patchB.id, { status: "broken" });
      resolution = `Kept patch A (${patchA.id.slice(0, 8)})`;
    } else if (choice === "b") {
      // Keep B, discard A's change
      await store.updatePatch(patchB.id, { status: "approved" });
      await store.updatePatch(patchA.id, { status: "broken" });
      resolution = `Kept patch B (${patchB.id.slice(0, 8)})`;
    } else if (choice === "custom") {
      // Custom value applied to patch A
      const customVal = parsed.data.value || "";
      await store.updatePatch(patchA.id, {
        change: { ...patchA.change, value: customVal },
        status: "approved",
      });
      await store.updatePatch(patchB.id, { status: "broken" });
      resolution = `Custom value applied: "${customVal}"`;
    }

    await store.updateConflict(id, { status: "resolved", resolution });

    await store.addAudit({
      actor_id: actor,
      event_type: "conflict_resolved",
      entity_id: conflict.id,
      details: {
        patch_a: patchA.id,
        patch_b: patchB.id,
        choice,
        resolution,
      },
    });

    return reply.send({ success: true, resolution });
  });

  // Legacy POST /conflicts/resolve backward compatibility
  app.post("/conflicts/resolve", async (request, reply) => {
    const { keptPatchId, discardedPatchId } = (request.body ?? {}) as {
      keptPatchId?: string;
      discardedPatchId?: string;
    };
    if (!keptPatchId || !discardedPatchId) return reply.code(400).send({ error: "Missing patch IDs" });

    const actor = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    const live = await getLiveState();
    const kept = await store.updatePatch(keptPatchId, {
      status: live.patches.some((p) => p.id === keptPatchId) ? "live" : "approved",
    });
    await store.updatePatch(discardedPatchId, { status: "broken" });

    // Mark any open conflicts matching these patches as resolved
    const allConflicts = await store.listConflicts("open");
    for (const c of allConflicts) {
      if (
        (c.patch_a === keptPatchId && c.patch_b === discardedPatchId) ||
        (c.patch_b === keptPatchId && c.patch_a === discardedPatchId)
      ) {
        await store.updateConflict(c.id, { status: "resolved", resolution: `Kept ${keptPatchId.slice(0, 8)}` });
      }
    }

    await store.addAudit({
      actor_id: actor,
      event_type: "conflict_resolved",
      entity_id: keptPatchId,
      details: { resolved_against: discardedPatchId, action: "merged" },
    });
    return reply.send({ ok: true, kept: keptPatchId, discarded: discardedPatchId });
  });

  // ---------- audit ----------
  app.get("/audit", async () => store.listAudit());
}
