import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  audit,
  createOrganization,
  listUserOrgs,
  getDb,
  adminCount,
  removeMember,
  membershipOf,
  hashPassword,
  nowIso,
} from "../lib/db";
import { isValidEmail } from "../types/shared";

const router = Router();

function resolveOrgId(req: any): string {
  if (req.orgAuth?.ok) return req.orgAuth.orgId;
  const user = req.user!;
  const orgs = listUserOrgs(user.email);
  return orgs[0]?.orgId ?? "org_default";
}

/** GET /api/organizations — list user's workspaces */
router.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  res.json(listUserOrgs(user.email));
});

/** POST /api/organizations — create a new workspace */
router.post("/", requireAuth, (req, res) => {
  const user = req.user!;
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Workspace name is required" });
    return;
  }
  if (name.length > 60) {
    res.status(400).json({ error: "Workspace name must be 60 characters or fewer" });
    return;
  }

  const org = createOrganization(name, user.email);
  audit(org.id, user.email, "workspace.created", name.slice(0, 60));
  res.status(201).json({ id: org.id, name: org.name, role: "admin" as const });
});

/** GET /api/organizations/members — list members of active workspace */
router.get("/members", requireAuth, (req, res) => {
  const orgId = resolveOrgId(req);
  const rows = getDb().prepare(
    `SELECT m.admin_email AS email, m.role, a.name FROM organization_members m
     JOIN admins a ON a.email = m.admin_email WHERE m.org_id=? ORDER BY m.created_at ASC`
  ).all(orgId) as Array<{ email: string; role: string; name: string }>;
  res.json(rows);
});

/** POST /api/organizations/members — add/invite/update member in active workspace */
router.post("/members", requireAuth, (req, res) => {
  const user = req.user!;
  const orgId = resolveOrgId(req);

  const callerMembership = membershipOf(orgId, user.email);
  if (!callerMembership || callerMembership.role !== "admin") {
    res.status(403).json({ error: "Administrator privilege required" });
    return;
  }

  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const role = req.body?.role === "admin" ? "admin" : "member";

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }

  const d = getDb();
  // Ensure target exists in admins table so join queries succeed
  const target = d.prepare("SELECT email FROM admins WHERE email=?").get(email);
  if (!target) {
    const { hash, salt } = hashPassword("Acropolis@2026");
    const displayName = email.split("@")[0]?.replace(/[\._]/g, " ").trim() || "Faculty";
    d.prepare("INSERT INTO admins(email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?)").run(
      email, displayName, hash, salt, nowIso()
    );
  }

  // Upsert member into organization_members
  d.prepare(
    `INSERT INTO organization_members(org_id,admin_email,role,created_at)
     VALUES(?,?,?,?)
     ON CONFLICT(org_id,admin_email) DO UPDATE SET role=excluded.role`
  ).run(orgId, email, role, nowIso());

  audit(orgId, user.email, "member.added", `${email} (${role})`);
  res.status(201).json({ email, role });
});

/** DELETE /api/organizations/members — remove a member (admin only) */
router.delete("/members", requireAuth, (req, res) => {
  const user = req.user!;
  const orgId = resolveOrgId(req);

  const callerMembership = membershipOf(orgId, user.email);
  if (!callerMembership || callerMembership.role !== "admin") {
    res.status(403).json({ error: "Administrator privilege required" });
    return;
  }

  const email = String(req.query.email ?? "").trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: "email query parameter is required" });
    return;
  }
  if (email === user.email.toLowerCase()) {
    res.status(400).json({ error: "You cannot remove yourself from the workspace" });
    return;
  }

  const d = getDb();
  const member = d.prepare(
    "SELECT role FROM organization_members WHERE org_id=? AND admin_email=?"
  ).get(orgId, email) as { role: string } | undefined;
  if (!member) {
    res.status(404).json({ error: "That user is not a member of this workspace" });
    return;
  }

  if (member.role === "admin" && adminCount(orgId) <= 1) {
    res.status(400).json({ error: "The workspace must keep at least one administrator" });
    return;
  }

  removeMember(orgId, email);
  audit(orgId, user.email, "member.removed", email);
  res.json({ ok: true });
});

export default router;

