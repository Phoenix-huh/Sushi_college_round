import { createUserClient, hasSupabase } from "./db.js";
import { DEV_ID } from "./seed.js";

/** Who is making this request? Falls back to the demo developer when no valid token is sent. */
export async function resolveActor(authHeader?: string): Promise<string> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !hasSupabase) return DEV_ID;
  try {
    const { data } = await createUserClient(token).auth.getUser();
    return data?.user?.id ?? DEV_ID;
  } catch {
    return DEV_ID;
  }
}
