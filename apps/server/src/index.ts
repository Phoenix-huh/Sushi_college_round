import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
const PORT = Number(process.env.SERVER_PORT) || 4000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";

const hasSupabase = supabaseUrl.length > 0 && supabaseServiceKey.length > 0;

// Lazy-initialized admin client for server-side operations
let _supabaseAdmin: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    if (!hasSupabase) {
      throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env");
    }
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabaseAdmin;
}

// Create a request-scoped client from the user's token
export function createUserClient(token: string) {
  if (!hasSupabase) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const app = Fastify({ logger: true });

await app.register(cors, { origin: CORS_ORIGINS });

import { deployRoutes } from "./routes/deploy.js";
import { verifyRoutes } from "./routes/verify.js";
import { aiRoutes } from "./routes/ai.js";
import { patchRoutes } from "./routes/patches.js";

// Root endpoint
app.get("/", async (request, reply) => {
  return {
    name: "Patchwork Server",
    status: "online",
    message: "Hotfix the Internet — API is active and ready",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      patches: "GET /patches",
      create_patch: "POST /patches",
      deployments: "GET /deployments",
      live_deployment: "GET /deployments/live",
      conflicts: "GET /conflicts",
      audit: "GET /audit",
      verify: "POST /verify",
      deploy: "POST /deploy",
      rollback: "POST /rollback",
      ai_patch: "POST /ai/patch",
    },
  };
});

// Health check
app.get("/health", async () => {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    supabase: hasSupabase ? "connected" : "not configured",
  };
});

app.register(deployRoutes);
app.register(verifyRoutes);
app.register(aiRoutes);
app.register(patchRoutes);

if (!hasSupabase) {
  console.warn("⚠️  Supabase not configured — server will run but DB routes won't work. Set vars in .env");
}

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`🚀 Patchwork server running on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
