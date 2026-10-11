import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { z } from "zod";
import type { Patch } from "@patchwork/shared";
import { generatePatchFromInstruction } from "../services/ai.js";
import * as store from "../store.js";
import { resolveActor } from "../auth.js";
import { DEMO_SITE_URL } from "../db.js";

const AIPatchRequestSchema = z.object({
  instruction: z.string().min(2).max(500),
  element_context: z.string().optional().default(""),
  target_url: z.string().optional().default(DEMO_SITE_URL),
  author_id: z.string().uuid().optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  // POST /ai/patch: natural-language instruction -> validated DRAFT patch (never auto-applied)
  app.post("/ai/patch", async (request, reply) => {
    const parsed = AIPatchRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const actorId = await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string);
    const { instruction, element_context, target_url } = parsed.data;

    let generated;
    try {
      generated = await generatePatchFromInstruction(instruction, element_context, target_url);
    } catch (e: any) {
      return reply.code(422).send({ error: "Patch generation failed: " + e.message });
    }

    const now = new Date().toISOString();
    const draft: Patch = {
      id: crypto.randomUUID(),
      ...generated,
      author_id: actorId,
      status: "draft",
      created_at: now,
      updated_at: now,
    };
    const saved = await store.insertPatch(draft);
    await store.addAudit({
      actor_id: actorId,
      event_type: "patch_created",
      entity_id: saved.id,
      details: { source: "ai", instruction },
    });
    return { draft: saved, instruction };
  });
}
