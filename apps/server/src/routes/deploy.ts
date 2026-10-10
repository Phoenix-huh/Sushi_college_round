import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as store from "../store.js";
import { resolveActor } from "../auth.js";
import { getLiveState, deployPatchSet, rollbackLive, activateDeployment, SYSTEM_ID } from "../services/deploy.js";

const DeployRequestSchema = z.object({
  patch_ids: z.array(z.string().uuid()),
  canary_percent: z.number().min(0).max(100).default(100),
});

const CanaryErrorSchema = z.object({
  deployment_id: z.string().uuid(),
  error_message: z.string(),
  url: z.string().optional(),
});

const CANARY_ERROR_THRESHOLD = 3;
const canaryErrors: Record<string, number> = {};

export async function deployRoutes(app: FastifyInstance) {
  // What visitors of the demo site should see right now.
  // `no-store` so browsers never serve a stale answer.
  app.get("/deployments/live", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return getLiveState();
  });

  app.get("/deployments", async () => store.listDeployments());

  app.get("/versions", async () => store.listVersions());

  app.post("/deploy", async (request, reply) => {
    const parsed = DeployRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const found = await store.getPatchesByIds(parsed.data.patch_ids);
    if (found.length !== parsed.data.patch_ids.length) {
      return reply.code(404).send({ error: "One or more patches do not exist" });
    }
    return deployPatchSet(parsed.data.patch_ids, {
      actor: await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string),
      canary_percent: parsed.data.canary_percent,
    });
  });

  app.post("/rollback", async (request, reply) => {
    const result = await rollbackLive(
      await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string)
    );
    if (!result) return reply.code(400).send({ error: "No live deployment to rollback" });
    return { success: true, rolled_back_deployment: result.rolled_back, restored_deployment: result.restored };
  });

  // Redeploy an older deployment
  app.post("/deployments/:id/activate", async (request, reply) => {
    const { id } = request.params as { id: string };
    const dep = await activateDeployment(
      id,
      await resolveActor(request.headers.authorization, request.headers["x-actor-id"] as string)
    );
    if (!dep) return reply.code(404).send({ error: "Deployment not found" });
    return { success: true, deployment: dep };
  });

  app.post("/canary/error", async (request, reply) => {
    const parsed = CanaryErrorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error });

    const { deployment_id } = parsed.data;
    const count = (canaryErrors[deployment_id] = (canaryErrors[deployment_id] || 0) + 1);

    if (count >= CANARY_ERROR_THRESHOLD) {
      delete canaryErrors[deployment_id];
      const live = await store.getLiveDeployment();
      // only act if the failing deployment is still the live one
      if (live?.id === deployment_id) {
        await rollbackLive(SYSTEM_ID, "canary_error_threshold_exceeded");
        return { action: "rolled_back", count };
      }
    }
    return { action: "error_recorded", count };
  });
}
