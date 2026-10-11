import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseCorsOrigins } from "./cors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Hosting platforms (Render, Railway, Fly, Heroku...) tell the app which port to use through PORT.
export const PORT = Number(process.env.PORT || process.env.SERVER_PORT) || 4000;

/** The public address of the demo site; seed data and AI drafts use it as their target page. */
export const DEMO_URL = (process.env.DEMO_URL || "http://localhost:4100").trim().replace(/\/+$/, "");
export const DEMO_SITE_URL = `${DEMO_URL}/`;

/** Origins (comma separated) allowed to call this API from a web page. Empty means "any origin". */
export const CORS_ORIGINS = parseCorsOrigins(process.env.CORS_ORIGINS);

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

// A real service key is required for server-side writes. The placeholder from
// .env.example ("your-service-role-key") must not count as configured.
const looksReal = (v: string) => v.length > 20 && !v.startsWith("your-");

export const hasSupabase = supabaseUrl.startsWith("http") && (looksReal(supabaseServiceKey) || looksReal(supabaseAnonKey));

let _admin: SupabaseClient | null = null;

/** Server-side client (service key if present, otherwise anon key). */
export function getSupabaseAdmin(): SupabaseClient {
  if (!hasSupabase) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env");
  }
  if (!_admin) {
    const key = looksReal(supabaseServiceKey) ? supabaseServiceKey : supabaseAnonKey;
    _admin = createClient(supabaseUrl, key);
  }
  return _admin;
}

/** Request-scoped client acting as the signed-in user. */
export function createUserClient(token: string) {
  if (!hasSupabase) throw new Error("Supabase is not configured.");
  return createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
