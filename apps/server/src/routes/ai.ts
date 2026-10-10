import type { FastifyInstance } from "fastify";
import { getSupabaseAdmin, createUserClient } from "../index.js";
import { generatePatchFromInstruction } from "../services/ai.js";
import { DEV_ID, DEMO_PATCHES, DEMO_AUDIT_EVENTS } from "../seed.js";
import type { Patch, AuditEvent } from "@patchwork/shared";
import { z } from "zod";
import crypto from "crypto";

const AIPatchRequestSchema = z.object({
  instruction: z.string().min(2).max(500),
  element_context: z.string().optional().default('<button id="checkout-btn">Checkout</button>'),
  target_url: z.string().optional().default("http://localhost:4100/"),
  author_id: z.string().uuid().optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  // POST /ai/patch — NL instruction → validated draft patch (never auto-applied)
  app.post("/ai/patch", async (request, reply) => {
    let actorId = DEV_ID;
    const token = request.headers.authorization?.replace("Bearer ", "");

    if (token) {
      try {
        const client = createUserClient(token);
        const { data: user } = await client.auth.getUser();
        if (user?.user) actorId = user.user.id;
      } catch {
        // Fall back to DEV_ID
      }
    }

    const parsed = AIPatchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error });
    }

    const { instruction, element_context, target_url } = parsed.data;

    // Generate draft patch (either via Gemini API if key is present, or heuristic NL generator)
    let generatedPatch;
    try {
      generatedPatch = await generatePatchFromInstruction(instruction, element_context, target_url);
    } catch (e: any) {
      return reply.code(422).send({ error: "Patch generation failed: " + e.message });
    }

    const patchId = crypto.randomUUID();
    const now = new Date().toISOString();

    const draftPatch: Patch = {
      id: patchId,
      ...generatedPatch,
      author_id: actorId,
      status: "draft",
      created_at: now,
      updated_at: now,
    };

    // Attempt to persist in Supabase, or fall back to local in-memory store
    try {
      const supabase = getSupabaseAdmin();
      const { data: patch, error: patchErr } = await supabase
        .from("patches")
        .insert(draftPatch)
        .select()
        .single();

      if (patchErr) throw patchErr;

      await supabase.from("audit_events").insert({
        actor_id: actorId,
        event_type: "patch_created",
        entity_id: patchId,
        details: { source: "ai", instruction },
      });

      return reply.send({ draft: patch, instruction });
    } catch {
      // Local fallback
      DEMO_PATCHES.unshift(draftPatch);
      const auditEvt: AuditEvent = {
        id: crypto.randomUUID(),
        actor_id: actorId,
        event_type: "patch_created",
        entity_id: patchId,
        details: { source: "ai", instruction },
        created_at: now,
      };
      DEMO_AUDIT_EVENTS.unshift(auditEvt);

      return reply.send({ draft: draftPatch, instruction });
    }
  });
}
