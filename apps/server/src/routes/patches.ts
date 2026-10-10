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

  // GET /patches/:id
  app.get("/patches/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.from("patches").select("*").eq("id", id).single();
      if (error && error.code !== "PGRST116") throw error;
      if (data) return reply.send(data);
    } catch {
      // fallback
    }
    const found = localPatches.find((p) => p.id === id);
    if (!found) return reply.code(404).send({ error: "Patch not found" });
    return reply.send(found);
  });

  // POST /patches/:id/deploy (Directly deploy a draft patch to live store)
  app.post("/patches/:id/deploy", async (request, reply) => {
    const { id } = request.params as { id: string };
    const now = new Date().toISOString();

    try {
      const supabase = getSupabaseAdmin();
      // Update patch status to live
      await supabase.from("patches").update({ status: "live", updated_at: now }).eq("id", id);

      const { data: lastVersion } = await supabase
        .from("versions")
        .select("number")
        .order("number", { ascending: false })
        .limit(1)
        .single();

      const nextNumber = (lastVersion?.number || 0) + 1;

      const { data: version, error: vErr } = await supabase
        .from("versions")
        .insert({
          number: nextNumber,
          patch_ids: [id],
          created_by: DEV_ID,
          verification_status: "passed",
        })
        .select()
        .single();

      if (vErr) throw vErr;

      // Mark old deployments inactive
      await supabase.from("deployments").update({ is_live: false }).eq("is_live", true);

      // Create new live deployment
      const { data: deployment, error: dErr } = await supabase
        .from("deployments")
        .insert({
          version_id: version.id,
          is_live: true,
          canary_percent: 100,
        })
        .select()
        .single();

      if (dErr) throw dErr;

      await supabase.from("audit_events").insert({
        actor_id: DEV_ID,
        event_type: "deployment_created",
        entity_id: deployment.id,
        details: { patch_id: id, version_number: version.number },
      });

      return reply.send({ success: true, version, deployment });
    } catch {
      localPatches = localPatches.map((p) => (p.id === id ? { ...p, status: "live" } : p));
      return reply.send({ success: true, message: "Deployed locally" });
    }
  });

  // PUT /patches/:id (Update/edit a draft patch)
  app.put("/patches/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<Patch>;
    const now = new Date().toISOString();

    try {
      const supabase = getSupabaseAdmin();
      const updates: Record<string, unknown> = { updated_at: now };
      if (body.change) updates.change = body.change;
      if (body.anchors) updates.anchors = body.anchors;
      if (body.status) updates.status = body.status;

      const { data, error } = await supabase
        .from("patches")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("audit_events").insert({
        actor_id: DEV_ID,
        event_type: "patch_updated",
        entity_id: id,
        details: { updates },
      });

      return reply.send(data);
    } catch {
      let updated: Patch | null = null;
      localPatches = localPatches.map((p) => {
        if (p.id === id) {
          updated = {
            ...p,
            change: body.change || p.change,
            anchors: body.anchors || p.anchors,
            status: body.status || p.status,
            updated_at: now,
          };
          return updated;
        }
        return p;
      });

      if (!updated) return reply.code(404).send({ error: "Patch not found" });
      return reply.send(updated);
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
