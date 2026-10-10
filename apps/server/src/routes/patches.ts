import type { FastifyInstance } from "fastify";
import { getSupabaseAdmin, createUserClient } from "../index.js";
import { CreatePatchSchema, type Patch, type AuditEvent } from "@patchwork/shared";
import { detectConflicts } from "../services/conflicts.js";
import {
  DEMO_PATCHES,
  DEMO_AUDIT_EVENTS,
  DEV_ID,
} from "../seed.js";
import crypto from "crypto";

// In-memory fallback cache if Supabase is offline
let localPatches: Patch[] = [...DEMO_PATCHES];
let localAuditEvents: AuditEvent[] = [...DEMO_AUDIT_EVENTS];

export async function patchRoutes(app: FastifyInstance) {
  // GET /patches
  app.get("/patches", async (request, reply) => {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("patches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return reply.send(data || []);
    } catch {
      // Graceful offline fallback
      return reply.send(localPatches);
    }
  });

  // POST /patches (Draft patch creation with validation & audit event)
  app.post("/patches", async (request, reply) => {
    const parsed = CreatePatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error });
    }

    const patchId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newPatch: Patch = {
      id: patchId,
      ...parsed.data,
      status: "draft",
      created_at: now,
      updated_at: now,
    };

    let actorId = parsed.data.author_id || DEV_ID;

    // Check optional bearer token
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (token) {
      try {
        const client = createUserClient(token);
        const { data: user } = await client.auth.getUser();
        if (user?.user) actorId = user.user.id;
      } catch {
        // use actorId fallback
      }
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from("patches").insert(newPatch).select().single();
      if (error) throw error;

      await supabase.from("audit_events").insert({
        actor_id: actorId,
        event_type: "patch_created",
        entity_id: patchId,
        details: { selector: newPatch.anchors.cssSelector, change: newPatch.change },
      });

      return reply.code(201).send(data);
    } catch {
      // Save locally
      localPatches.unshift(newPatch);
      const auditEvt: AuditEvent = {
        id: crypto.randomUUID(),
        actor_id: actorId,
        event_type: "patch_created",
        entity_id: patchId,
        details: { selector: newPatch.anchors.cssSelector, change: newPatch.change },
        created_at: now,
      };
      localAuditEvents.unshift(auditEvt);

      return reply.code(201).send(newPatch);
    }
  });

  // GET /conflicts
  app.get("/conflicts", async (request, reply) => {
    let patches = localPatches;
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from("patches").select("*");
      if (data?.length) patches = data as Patch[];
    } catch {
      // use local
    }

    const result = detectConflicts(patches);
    return reply.send(result);
  });

  // POST /conflicts/resolve
  app.post("/conflicts/resolve", async (request, reply) => {
    const { keptPatchId, discardedPatchId } = request.body as {
      keptPatchId: string;
      discardedPatchId: string;
    };

    if (!keptPatchId || !discardedPatchId) {
      return reply.code(400).send({ error: "Missing patch IDs" });
    }

    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("patches").update({ status: "approved" }).eq("id", keptPatchId);
      await supabase.from("patches").update({ status: "broken" }).eq("id", discardedPatchId);

      await supabase.from("audit_events").insert({
        actor_id: DEV_ID,
        event_type: "patch_approved",
        entity_id: keptPatchId,
        details: { resolved_against: discardedPatchId, action: "merged" },
      });
    } catch {
      localPatches = localPatches.map((p) => {
        if (p.id === keptPatchId) return { ...p, status: "approved" };
        if (p.id === discardedPatchId) return { ...p, status: "broken" };
        return p;
      });
    }

    return reply.send({ ok: true, kept: keptPatchId, discarded: discardedPatchId });
  });

  // GET /audit
  app.get("/audit", async (request, reply) => {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("audit_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return reply.send(data || []);
    } catch {
      return reply.send(localAuditEvents);
    }
  });
}
