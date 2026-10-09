import { err, json, requireUser, selectWorkspace } from "@/lib/auth";
import { listUserOrgs } from "@/lib/db";

/**
 * POST /api/auth/workspace — bind the session to a workspace.
 * The org id from the body is ONLY accepted after verifying the logged-in
 * user's membership server-side; membership is the authorization, not the id.
 */
export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (!user) return err("Unauthorized", 401);
  const body = (await req.json().catch(() => null)) as { orgId?: string } | null;
  const orgId = String(body?.orgId ?? "").trim();
  if (!orgId) return err("orgId is required", 400);
  const ok = await selectWorkspace(orgId);
  if (!ok) return err("You are not a member of that workspace", 403);
  const orgs = listUserOrgs(user.email);
  return json({ orgId, orgs });
}
