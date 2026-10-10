import { err, json, sessionState } from "@/lib/auth";

/** GET /api/auth/session — current user + workspaces (never tokens). */
export async function GET(): Promise<Response> {
  const state = await sessionState();
  if (!state.user) return err("Unauthorized", 401);
  return json({ user: state.user, orgId: state.orgId, orgs: state.orgs });
}
