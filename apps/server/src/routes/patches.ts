import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { z } from "zod";
import { CreatePatchSchema, PatchChangeSchema, type Patch } from "@patchwork/shared";
import * as store from "../store.js";
import { resolveActor } from "../auth.js";
import { detectConflicts } from "../services/conflicts.js";
import { deployPatch, undeployPatch, getLiveState } from "../services/deploy.js";

const UpdatePatchSchema = z.object({
  change: PatchChangeSchema.optional(),
  anchors: z.object({ cssSelector: z.string().min(1) }).passthrough().optional(),
  status: z.enum(["draft", "approved", "live", "broken", "healed"]).optional(),
});

export async function patchRoutes(app: FastifyInstance) {
  app.get("/patches", async () => store.listPatches());

  app.get("/patches/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const patch = await store.getPatch(id);
    return patch ?? reply.code(404).send({ error: "Patch not found" });
  });

  app.post("/patches", async (request, reply) => {
    const parsed = CreatePatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const actor = await resolveActor(request.headers.authorization);
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
      details: { selector: saved.anchors.cssSelector, change: saved.change },
    });
    return reply.code(201).send(saved);
  });

  // Edit a patch. If it is live, visitors get the edited version automatically
  // because the live version references the patch by id.
  app.put("/patches/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = UpdatePatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const existing = await store.getPatch(id);
    if (!existing) return reply.code(404).send({ error: "Patch not found" });

    const updates: Partial<Patch> = {};
    if (parsed.data.change) updates.change = parsed.data.change;
    if (parsed.data.anchors) updates.anchors = { ...existing.anchors, ...parsed.data.anchors };
    if (parsed.data.status) updates.status = parsed.data.status;

    const updated = await store.updatePatch(id, updates);
    await store.addAudit({
      actor_id: await resolveActor(request.headers.authorization),
      event_type: "patch_updated",
      entity_id: id,
      details: { updates },
    });
    return updated;
  });

  app.delete("/patches/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await resolveActor(request.headers.authorization);
    const existing = await store.getPatch(id);
    if (!existing) return reply.code(404).send({ error: "Patch not found" });

    await undeployPatch(id, actor); // no-op when the patch is not live
    await store.deletePatch(id);
    return { ok: true };
  });

  // Put one patch live (on top of what is already live)
  app.post("/patches/:id/deploy", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deployPatch(id, await resolveActor(request.headers.authorization));
    if (!result) return reply.code(404).send({ error: "Patch not found" });
    return { success: true, ...result };
  });

  // Take one patch off the live site (keeps every other live patch)
  app.post("/patches/:id/undeploy", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await undeployPatch(id, await resolveActor(request.headers.authorization));
    if (!result) return reply.code(409).send({ error: "Patch is not live" });
    return { success: true, ...result };
  });

  // Patches that were discarded in a resolution (status "broken") no longer count as conflicting.
  app.get("/conflicts", async () =>
    detectConflicts((await store.listPatches()).filter((p) => p.status !== "broken")),
  );

  app.post("/conflicts/resolve", async (request, reply) => {
    const { keptPatchId, discardedPatchId } = (request.body ?? {}) as {
      keptPatchId?: string;
      discardedPatchId?: string;
    };
    if (!keptPatchId || !discardedPatchId) return reply.code(400).send({ error: "Missing patch IDs" });

    const live = await getLiveState();
    const kept = await store.updatePatch(keptPatchId, { status: live.patches.some((p) => p.id === keptPatchId) ? "live" : "approved" });
    await store.updatePatch(discardedPatchId, { status: "broken" });
    if (!kept) return reply.code(404).send({ error: "Kept patch not found" });

    await store.addAudit({
      actor_id: await resolveActor(request.headers.authorization),
      event_type: "patch_approved",
      entity_id: keptPatchId,
      details: { resolved_against: discardedPatchId, action: "merged" },
    });
    return { ok: true, kept: keptPatchId, discarded: discardedPatchId };
  });

  app.get("/audit", async () => store.listAudit());
}
