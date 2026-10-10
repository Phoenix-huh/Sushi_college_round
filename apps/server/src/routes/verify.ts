import type { FastifyInstance } from "fastify";
import { getSupabaseAdmin, createUserClient } from "../index.js";
import { verifyPatches } from "../services/verifier.js";
import { DEMO_VERSIONS, DEMO_PATCHES, DEV_ID } from "../seed.js";
import type { Patch, Version } from "@patchwork/shared";

export async function verifyRoutes(app: FastifyInstance) {
  app.post("/verify", async (request, reply) => {
    let actorId = DEV_ID;
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (token) {
      try {
        const client = createUserClient(token);
        const { data: user } = await client.auth.getUser();
        if (user?.user) actorId = user.user.id;
      } catch {
        // Fall back to DEV_ID for local demo
      }
    }

    const { version_id } = request.body as { version_id: string };
    if (!version_id) {
      return reply.code(400).send({ error: "Missing version_id" });
    }

    let version: Version | undefined;
    let patches: Patch[] = [];

    // 1. Get version and patches (from DB or fallback)
    try {
      const supabase = getSupabaseAdmin();
      const { data: v } = await supabase.from("versions").select("*").eq("id", version_id).single();
      if (v) {
        version = v as Version;
        if (v.patch_ids?.length) {
          const { data: p } = await supabase.from("patches").select("*").in("id", v.patch_ids);
          patches = (p || []) as Patch[];
        }
      }
    } catch {
      // Offline fallback
      version = DEMO_VERSIONS.find((v) => v.id === version_id);
      if (version) {
        patches = DEMO_PATCHES.filter((p) => version!.patch_ids.includes(p.id));
      }
    }

    if (!version) {
      // If version_id wasn't in DB/mock, synthesize a version from existing patches for demo
      version = DEMO_VERSIONS[0];
      patches = DEMO_PATCHES.filter((p) => version!.patch_ids.includes(p.id));
    }

    // 2. Run verification against localhost demo site (port 4100)
    const targetUrl = patches[0]?.target_url || "http://localhost:4100/";
    const result = await verifyPatches(targetUrl, patches);
    const newStatus = result.passed ? "passed" : "failed";

    // 3. Update version status and log audit
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("versions").update({ verification_status: newStatus }).eq("id", version_id);

      await supabase.from("audit_events").insert({
        actor_id: actorId,
        event_type: result.passed ? "verification_passed" : "verification_failed",
        entity_id: version_id,
        details: { diffPixels: result.diffPixels, error: result.error, targetUrl },
      });

      // 4. Auto-rollback if failed
      if (!result.passed) {
        const { data: deployment } = await supabase
          .from("deployments")
          .select("*")
          .eq("version_id", version_id)
          .eq("is_live", true)
          .single();

        if (deployment) {
          await supabase
            .from("deployments")
            .update({ is_live: false, rolled_back_at: new Date().toISOString() })
            .eq("id", deployment.id);

          await supabase.from("audit_events").insert({
            actor_id: "system",
            event_type: "deployment_rolled_back",
            entity_id: deployment.id,
            details: { reason: "verification_failed", version_id },
          });
        }
      }
    } catch {
      // Update in-memory state
      version.verification_status = newStatus;
    }

    return reply.send({
      version_id,
      ...result,
      status: newStatus,
    });
  });
}
