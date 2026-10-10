import { err, json, sessionState } from "@/lib/auth";
import { adminCount, getDb, removeMember, audit, hashPassword, nowIso } from "@/lib/db";
import { isValidEmail } from "@/utils/validation";

/** GET /api/organizations/members — members of the active workspace. */
export async function GET(): Promise<Response> {
  const state = await sessionState();
  if (!state.user) return err("Unauthorized", 401);
  const orgId = state.orgId ?? state.orgs[0]?.orgId ?? "org_default";

  const rows = getDb().prepare(
    `SELECT m.admin_email AS email, m.role, a.name FROM organization_members m
     JOIN admins a ON a.email = m.admin_email WHERE m.org_id=? ORDER BY m.created_at ASC`
  ).all(orgId) as Array<{ email: string; role: string; name: string }>;
  return json(rows);
}

/**
 * POST /api/organizations/members — invite or update member role in workspace.
 */
export async function POST(req: Request): Promise<Response> {
  const state = await sessionState();
  if (!state.user) return err("Unauthorized", 401);
  const orgId = state.orgId ?? state.orgs[0]?.orgId ?? "org_default";

  const body = (await req.json().catch(() => null)) as { email?: string; role?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = body?.role === "admin" ? "admin" : "member";
  if (!isValidEmail(email)) return err("Enter a valid email address", 400);

  const d = getDb();
  // Ensure target exists in admins table so join queries succeed
  const target = d.prepare("SELECT 1 FROM admins WHERE email=?").get(email);
  if (!target) {
    const { hash, salt } = hashPassword("Acropolis@2026");
    const displayName = email.split("@")[0]?.replace(/[\._]/g, " ").trim() || "Faculty";
    d.prepare("INSERT INTO admins(email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?)").run(
      email, displayName, hash, salt, nowIso()
    );
  }

  d.prepare(
    `INSERT INTO organization_members(org_id,admin_email,role,created_at)
     VALUES(?,?,?,?)
     ON CONFLICT(org_id,admin_email) DO UPDATE SET role=excluded.role`
  ).run(orgId, email, role, nowIso());

  audit(orgId, state.user.email, "member.added", `${email} (${role})`);
  return json({ email, role }, 201);
}

/** DELETE /api/organizations/members?email=… — remove a member (admin only). */
export async function DELETE(req: Request): Promise<Response> {
  const state = await sessionState();
  if (!state.user) return err("Unauthorized", 401);
  const orgId = state.orgId ?? state.orgs[0]?.orgId ?? "org_default";

  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return err("email query parameter is required", 400);
  if (email === state.user.email.toLowerCase()) return err("You cannot remove yourself from the workspace", 400);

  const d = getDb();
  const member = d.prepare(
    "SELECT role FROM organization_members WHERE org_id=? AND admin_email=?"
  ).get(orgId, email) as { role: string } | undefined;
  if (!member) return err("That user is not a member of this workspace", 404);
  if (member.role === "admin" && adminCount(orgId) <= 1) {
    return err("The workspace must keep at least one administrator", 400);
  }
  removeMember(orgId, email);
  audit(orgId, state.user.email, "member.removed", email);
  return json({ ok: true });
}

