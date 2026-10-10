import type { FastifyInstance } from "fastify";
import { getSupabaseAdmin, createUserClient } from "../index.js";
import { z } from "zod";
import {
  DEMO_DEPLOYMENTS,
  DEMO_VERSIONS,
  DEMO_PATCHES,
  DEV_ID,
} from "../seed.js";
import type { Deployment, Version, Patch } from "@patchwork/shared";
import crypto from "crypto";

const DeployRequestSchema = z.object({
  patch_ids: z.array(z.string().uuid()),
  canary_percent: z.number().min(0).max(100).default(100),
});

const CanaryErrorSchema = z.object({
  deployment_id: z.string().uuid(),
  error_message: z.string(),
  url: z.string().optional(),
});

// Local in-memory store fallback
let localDeployments: Deployment[] = [...DEMO_DEPLOYMENTS];
let localVersions: Version[] = [...DEMO_VERSIONS];

const canaryErrors: Record<string, number> = {};
const CANARY_ERROR_THRESHOLD = 3;

export async function deployRoutes(app: FastifyInstance) {
  // GET /deployments/live
  app.get("/deployments/live", async (request, reply) => {
    try {
      const supabase = getSupabaseAdmin();
      const { data: deployment, error } = await supabase
        .from("deployments")
        .select("*")
        .eq("is_live", true)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!deployment) {
        return reply.send({ live: null });
      }

      const { data: version } = await supabase
        .from("versions")
        .select("*")
        .eq("id", deployment.version_id)
        .single();

      let patches: Patch[] = [];
      if (version?.patch_ids?.length) {
        const { data: p } = await supabase
          .from("patches")
          .select("*")
          .in("id", version.patch_ids);
        patches = (p || []) as Patch[];
      }

      return reply.send({ deployment, version, patches });
    } catch {
      // Fallback
      const liveDep = localDeployments.find((d) => d.is_live);
      if (!liveDep) return reply.send({ live: null });

      const version = localVersions.find((v) => v.id === liveDep.version_id);
      const patches = DEMO_PATCHES.filter((p) => version?.patch_ids.includes(p.id));

      return reply.send({ deployment: liveDep, version, patches });
    }
  });

  // GET /deployments
  app.get("/deployments", async (request, reply) => {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("deployments")
        .select("*, versions (*)")
        .order("deployed_at", { ascending: false });
      return reply.send(data || []);
    } catch {
      const combined = localDeployments.map((d) => ({
        ...d,
        versions: localVersions.find((v) => v.id === d.version_id),
      }));
      return reply.send(combined);
    }
  });

  // POST /deploy
  app.post("/deploy", async (request, reply) => {
    let userId = DEV_ID;
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (token) {
      try {
        const client = createUserClient(token);
        const { data: user } = await client.auth.getUser();
        if (user?.user) userId = user.user.id;
      } catch {
        // Fallback
      }
    }

    const parsed = DeployRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error });
    }

    const { patch_ids, canary_percent } = parsed.data;
    const now = new Date().toISOString();

    try {
      const supabase = getSupabaseAdmin();
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
          patch_ids,
          created_by: userId,
          verification_status: "pending",
        })
        .select()
        .single();

      if (vErr) throw vErr;

      await supabase.from("deployments").update({ is_live: false }).eq("is_live", true);

      const { data: deployment, error: dErr } = await supabase
        .from("deployments")
        .insert({
          version_id: version.id,
          is_live: true,
          canary_percent,
        })
        .select()
        .single();

      if (dErr) throw dErr;

      await supabase.from("audit_events").insert({
        actor_id: userId,
        event_type: "deployment_created",
        entity_id: deployment.id,
        details: { version_number: version.number },
      });

      return reply.send({ version, deployment });
    } catch {
      // Local fallback
      const nextNumber = localVersions.length + 1;
      const versionId = crypto.randomUUID();
      const depId = crypto.randomUUID();

      const newVersion: Version = {
        id: versionId,
        number: nextNumber,
        patch_ids,
        created_by: userId,
        verification_status: "pending",
        created_at: now,
      };
      localVersions.unshift(newVersion);

      // Set old deployments to false
      localDeployments = localDeployments.map((d) => ({ ...d, is_live: false }));

      const newDeployment: Deployment = {
        id: depId,
        version_id: versionId,
        is_live: true,
        canary_percent,
        deployed_at: now,
        rolled_back_at: null,
      };
      localDeployments.unshift(newDeployment);

      return reply.send({ version: newVersion, deployment: newDeployment });
    }
  });

  // POST /rollback
  app.post("/rollback", async (request, reply) => {
    let userId = DEV_ID;
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (token) {
      try {
        const client = createUserClient(token);
        const { data: user } = await client.auth.getUser();
        if (user?.user) userId = user.user.id;
      } catch {
        // Fallback
      }
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data: current } = await supabase
        .from("deployments")
        .select("*")
        .eq("is_live", true)
        .single();

      if (!current) {
        return reply.code(400).send({ error: "No live deployment to rollback" });
      }

      await supabase
        .from("deployments")
        .update({ is_live: false, rolled_back_at: new Date().toISOString() })
        .eq("id", current.id);

      await supabase.from("audit_events").insert({
        actor_id: userId,
        event_type: "deployment_rolled_back",
        entity_id: current.id,
        details: { rolled_back_version_id: current.version_id },
      });

      return reply.send({ success: true, rolled_back_deployment: current });
    } catch {
      const liveIndex = localDeployments.findIndex((d) => d.is_live);
      if (liveIndex === -1) {
        return reply.code(400).send({ error: "No live deployment to rollback" });
      }

      localDeployments[liveIndex].is_live = false;
      localDeployments[liveIndex].rolled_back_at = new Date().toISOString();

      return reply.send({ success: true, rolled_back_deployment: localDeployments[liveIndex] });
    }
  });

  // POST /canary/error
  app.post("/canary/error", async (request, reply) => {
    const parsed = CanaryErrorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error });
    }

    const { deployment_id, error_message, url } = parsed.data;
    canaryErrors[deployment_id] = (canaryErrors[deployment_id] || 0) + 1;
    const count = canaryErrors[deployment_id];

    if (count >= CANARY_ERROR_THRESHOLD) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("deployments")
          .update({ is_live: false, rolled_back_at: new Date().toISOString() })
          .eq("id", deployment_id);

        await supabase.from("audit_events").insert({
          actor_id: "system",
          event_type: "deployment_rolled_back",
          entity_id: deployment_id,
          details: { reason: "canary_error_threshold_exceeded", count },
        });
      } catch {
        const dep = localDeployments.find((d) => d.id === deployment_id);
        if (dep) {
          dep.is_live = false;
          dep.rolled_back_at = new Date().toISOString();
        }
      }

      delete canaryErrors[deployment_id];
      return reply.send({ action: "rolled_back", count });
    }

    return reply.send({ action: "error_recorded", count });
  });
}
