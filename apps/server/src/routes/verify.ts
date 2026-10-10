import type { FastifyInstance } from "fastify";
import * as store from "../store.js";
import { resolveActor } from "../auth.js";
import { verifyPatches } from "../services/verifier.js";
import { rollbackLive, SYSTEM_ID } from "../services/deploy.js";

export async function verifyRoutes(app: FastifyInstance) {
  app.post("/verify", async (request, reply) => {
    const actorId = await resolveActor(request.headers.authorization);
    const { version_id } = (request.body ?? {}) as { version_id?: string };
    if (!version_id) return reply.code(400).send({ error: "Missing version_id" });

    const version = await store.getVersion(version_id);
    if (!version) return reply.code(404).send({ error: "Version not found" });

    const patches = await store.getPatchesByIds(version.patch_ids);
    const targetUrl = patches[0]?.target_url || "http://localhost:4100/";
    const result = await verifyPatches(targetUrl, patches);
    const status = result.passed ? "passed" : "failed";

    await store.updateVersion(version.id, { verification_status: status });
    await store.addAudit({
      actor_id: actorId,
      event_type: result.passed ? "verification_passed" : "verification_failed",
      entity_id: version.id,
      details: { diffPixels: result.diffPixels, error: result.error, targetUrl },
    });

    // Auto-rollback when the failing version is the one that is live
    if (!result.passed) {
      const live = await store.getLiveDeployment();
      if (live && live.version_id === version.id) {
        await rollbackLive(SYSTEM_ID, "verification_failed");
      }
    }

    return { version_id, ...result, status };
  });
}
