import { err, json, requireOrg } from "@/lib/auth";
import { addMember, adminCount, getDb, removeMember, audit } from "@/lib/db";
import { isValidEmail } from "@/utils/validation";

/** GET /api/organizations/members — members of the active workspace. */
export async function GET(): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const rows = getDb().prepare(
    `SELECT m.admin_email AS email, m.role, a.name FROM organization_members m
     JOIN admins a ON a.email = m.admin_email WHERE m.org_id=? ORDER BY m.created_at ASC`
  ).all(auth.orgId) as Array<{ email: string; role: string; name: string }>;
  return json(rows);
}

/**
 * POST /api/organizations/members — invite an EXISTING account into the
 * workspace (admin only). Target users must already have logged in/registered;
 * no privilege escalation is possible: the caller must be an org admin and can
 * only grant roles within their own workspace.
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const body = (await req.json().catch(() => null)) as { email?: string; role?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = body?.role === "admin" ? "admin" : "member";
  if (!isValidEmail(email)) return err("Enter a valid email address", 400);

  const d = getDb();
  const target = d.prepare("SELECT 1 FROM admins WHERE email=?").get(email);
  if (!target) return err("No account with that email — ask them to register first", 404);
  const existing = d.prepare(
    "SELECT 1 FROM organization_members WHERE org_id=? AND admin_email=?"
  ).get(auth.orgId, email);
  if (existing) return err("That user is already a member", 400);

  addMember(auth.orgId, email, role);
  audit(auth.orgId, auth.email, "member.added", `${email} (${role})`);
  return json({ email, role }, 201);
}

/** DELETE /api/organizations/members?email=… — remove a member (admin only). */
export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return err("email query parameter is required", 400);
  if (email === auth.email) return err("You cannot remove yourself from the workspace", 400);

  const member = getDb().prepare(
    "SELECT role FROM organization_members WHERE org_id=? AND admin_email=?"
  ).get(auth.orgId, email) as { role: string } | undefined;
  if (!member) return err("That user is not a member of this workspace", 404);
  if (member.role === "admin" && adminCount(auth.orgId) <= 1) {
    return err("The workspace must keep at least one administrator", 400);
  }
  removeMember(auth.orgId, email);
  audit(auth.orgId, auth.email, "member.removed", email);
  return json({ ok: true });
}
