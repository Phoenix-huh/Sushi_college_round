import Fastify from "fastify";
import cors from "@fastify/cors";
import { CORS_ORIGINS, PORT, hasSupabase } from "./db.js";
import { isOriginAllowed } from "./cors.js";
import { initStore, storeMode } from "./store.js";
import { deployRoutes } from "./routes/deploy.js";
import { verifyRoutes } from "./routes/verify.js";
import { aiRoutes } from "./routes/ai.js";
import { patchRoutes } from "./routes/patches.js";

const app = Fastify({ logger: true });

if (CORS_ORIGINS.length === 0) {
  app.log.warn("CORS_ORIGINS is not set: any website can call this API. Fine locally; set it before sharing a public URL.");
}

await app.register(cors, {
  origin: (origin, cb) => cb(null, isOriginAllowed(origin, CORS_ORIGINS)),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
});

// Buttons like Deploy / Rollback POST with no body. Fastify rejects an empty body
// when the content-type is JSON, so accept it and treat it as "no body".
app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
  try {
    const text = typeof body === "string" ? body : body.toString();
    done(null, text.trim() ? JSON.parse(text) : undefined);
  } catch (e: any) {
    e.statusCode = 400;
    done(e, undefined);
  }
});

await initStore(app.log);

app.get("/", async () => ({
  name: "Patchwork Server",
  status: "online",
  store: storeMode,
  timestamp: new Date().toISOString(),
  endpoints: {
    versions: "GET /versions",
    health: "GET /health",
    patches: "GET /patches",
    create_patch: "POST /patches",
    edit_patch: "PUT /patches/:id",
    delete_patch: "DELETE /patches/:id",
    deploy_patch: "POST /patches/:id/deploy",
    undeploy_patch: "POST /patches/:id/undeploy",
    deployments: "GET /deployments",
    live_deployment: "GET /deployments/live",
    activate_deployment: "POST /deployments/:id/activate",
    conflicts: "GET /conflicts",
    audit: "GET /audit",
    verify: "POST /verify",
    deploy: "POST /deploy",
    rollback: "POST /rollback",
    ai_patch: "POST /ai/patch",
  },
}));

app.get("/health", async () => ({
  ok: true,
  timestamp: new Date().toISOString(),
  supabase: hasSupabase ? "configured" : "not configured",
  store: storeMode,
}));

app.register(deployRoutes);
app.register(verifyRoutes);
app.register(aiRoutes);
app.register(patchRoutes);

// Never leak internals, but never swallow errors silently either.
app.setErrorHandler((err: any, _req, reply) => {
  app.log.error(err);
  const status = err?.statusCode && err.statusCode < 500 ? err.statusCode : 500;
  reply.code(status).send({ error: err?.message ?? "Internal error" });
});

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Patchwork server running on http://localhost:${PORT} (store: ${storeMode})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
