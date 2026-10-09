import { err, json, requireUser } from "@/lib/auth";
import { audit, createOrganization, listUserOrgs } from "@/lib/db";

/** GET /api/organizations — workspaces the current user belongs to. */
export async function GET(): Promise<Response> {
  const user = await requireUser();
  if (!user) return err("Unauthorized", 401);
  return json(listUserOrgs(user.email));
}

/**
 * POST /api/organizations — create a workspace; the creator becomes its
 * admin. This never grants access to any other workspace.
 */
export async function POST(req: Request): Promise<Response> {
  const user = await requireUser();
  if (!user) return err("Unauthorized", 401);
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return err("Workspace name is required", 400);
  if (name.length > 60) return err("Workspace name must be 60 characters or fewer", 400);

  const org = createOrganization(name, user.email);
  audit(org.id, user.email, "workspace.created", name.slice(0, 60));
  return json({ id: org.id, name: org.name, role: "admin" as const }, 201);
}
