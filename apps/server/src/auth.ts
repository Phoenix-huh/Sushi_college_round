import { createUserClient, hasSupabase } from "./db.js";
import { DEV_ID } from "./seed.js";

/** Who is making this request? Checks x-actor-id, falls back to auth token or demo dev. */
export async function resolveActor(authHeader?: string, actorHeader?: string): Promise<string> {
  if (actorHeader && typeof actorHeader === "string" && actorHeader.trim()) {
    return actorHeader.trim();
  }
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !hasSupabase) return DEV_ID;
  try {
    const { data } = await createUserClient(token).auth.getUser();
    return data?.user?.id ?? DEV_ID;
  } catch {
    return DEV_ID;
  }
}
