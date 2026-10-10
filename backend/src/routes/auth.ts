import { Router } from "express";
import {
  checkLogin,
  createSessionToken,
  destroySessionToken,
  setSessionOrg,
  SESSION_COOKIE,
  TTL_MS,
  type SessionUser,
} from "../lib/auth";
import {
  getDb,
  hashPassword,
  verifyPassword,
  listUserOrgs,
  getSetting,
  setSetting,
  audit,
  nowIso,
} from "../lib/db";
import { clientIp, rateLimit, rateLimitReset } from "../lib/rateLimit";
import { isValidEmail } from "../types/shared";
import { requireAuth, requireWorkspace } from "../middleware/auth";

const router = Router();

function setSessionCookie(res: any, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 3600 * 1000,
    secure: process.env.NODE_ENV === "production",
  });
}

function clearSessionCookie(res: any): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

/** POST /api/auth/login */
router.post("/login", (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const ip = clientIp(req);
  const emailKey = `login:${ip}:${email.toLowerCase()}`;
  const ipKey = `login-ip:${ip}`;
  const perAccount = rateLimit(emailKey, 8, 10 * 60_000);
  const perIp = rateLimit(ipKey, 30, 10 * 60_000);
  if (!perAccount.ok || !perIp.ok) {
    const retryAfter = Math.max(perAccount.retryAfterSec, perIp.retryAfterSec);
    res.status(429).json({ error: `Too many login attempts. Try again in ${retryAfter} seconds.` });
    return;
  }

  const admin = checkLogin(email, password);
  if (!admin) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  rateLimitReset(emailKey);
  const token = createSessionToken(admin.email);
  setSessionCookie(res, token);

  // The token stays in the httpOnly cookie. Returning it would expose a
  // bearer credential to browser JavaScript and any XSS on the frontend.
  res.json({ user: admin });
});

/** GET /api/auth/login — verification endpoint */
router.get("/login", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/** POST /api/auth/logout */
router.post("/logout", (req, res) => {
  if (req.sessionToken) {
    destroySessionToken(req.sessionToken);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** GET /api/auth/session — returns current user + workspaces */
router.get("/session", requireAuth, (req, res) => {
  const user = req.user!;
  const orgs = listUserOrgs(user.email);
  const orgId = req.orgAuth?.ok ? req.orgAuth.orgId : (orgs.length === 1 ? orgs[0]!.orgId : null);
  res.json({ user, orgId, orgs });
});

/** GET /api/auth/profile — institutional faculty / HOD profile */
router.get("/profile", requireAuth, (req, res) => {
  const user = req.user!;
  const orgId = req.orgAuth?.ok ? req.orgAuth.orgId : "org_default";

  const name =
    user.name && user.name !== "Department Admin"
      ? user.name
      : "Prof. (Dr.) Prashant Lakkadwala";

  const employeeId = getSetting(orgId, "profile_employee_id", "HOD-IT-001");
  const roleTitle = getSetting(orgId, "profile_role_title", "Role: HOD");
  const status = getSetting(orgId, "profile_status", "Active");
  const departmentScope = getSetting(orgId, "profile_department_scope", "IT & CSE-DS");
  const activeBatches = getSetting(orgId, "profile_active_batches", "2nd, 3rd & 4th Year");

  res.json({
    name,
    email: user.email,
    employeeId,
    roleTitle,
    status,
    departmentScope,
    activeBatches,
    institution: "Acropolis Institute of Technology And Research Indore",
    department: "IT Department",
    academicSession: "Academic Session 2026–27",
  });
});

/** PATCH /api/auth/profile — update profile metadata */
router.patch("/profile", requireAuth, (req, res) => {
  const user = req.user!;
  const orgs = listUserOrgs(user.email);
  const orgId = req.orgAuth?.ok ? req.orgAuth.orgId : (orgs[0]?.orgId ?? "org_default");

  const body = req.body ?? {};
  const d = getDb();

  if (typeof body.name === "string" && body.name.trim()) {
    const trimmedName = body.name.trim();
    d.prepare("UPDATE admins SET name=? WHERE email=?").run(trimmedName, user.email);
  }

  if (typeof body.employeeId === "string") {
    setSetting(orgId, "profile_employee_id", body.employeeId.trim());
  }
  if (typeof body.departmentScope === "string") {
    setSetting(orgId, "profile_department_scope", body.departmentScope.trim());
  }
  if (typeof body.activeBatches === "string") {
    setSetting(orgId, "profile_active_batches", body.activeBatches.trim());
  }
  if (typeof body.roleTitle === "string") {
    setSetting(orgId, "profile_role_title", body.roleTitle.trim());
  }

  audit(orgId, user.email, "profile.updated", "User updated institutional profile");

  const adminRow = d.prepare("SELECT name FROM admins WHERE email=?").get(user.email) as
    | { name: string }
    | undefined;

  const updatedName = adminRow?.name ?? user.name;
  res.json({
    name: updatedName,
    email: user.email,
    employeeId: getSetting(orgId, "profile_employee_id", "HOD-IT-001"),
    roleTitle: getSetting(orgId, "profile_role_title", "Role: HOD"),
    status: getSetting(orgId, "profile_status", "Active"),
    departmentScope: getSetting(orgId, "profile_department_scope", "IT & CSE-DS"),
    activeBatches: getSetting(orgId, "profile_active_batches", "2nd, 3rd & 4th Year"),
    institution: "Acropolis Institute of Technology And Research Indore",
    department: "IT Department",
    academicSession: "Academic Session 2026–27",
  });
});

/** POST /api/auth/change-password */
router.post("/change-password", requireAuth, (req, res) => {
  const user = req.user!;
  const rl = rateLimit(`pwchange:${clientIp(req)}`, 10, 5 * 60_000);
  if (!rl.ok) {
    res.status(429).json({ error: "Too many password change attempts. Try again later." });
    return;
  }

  const cur = String(req.body?.currentPassword ?? "");
  const next = String(req.body?.newPassword ?? "");
  if (!cur || !next) {
    res.status(400).json({ error: "Current and new passwords are required" });
    return;
  }
  if (next.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const row = getDb().prepare("SELECT password_hash,salt FROM admins WHERE email=?").get(user.email) as
    | { password_hash: string; salt: string } | undefined;
  if (!row || !verifyPassword(cur, row.password_hash, row.salt)) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const { hash, salt } = hashPassword(next);
  getDb().prepare("UPDATE admins SET password_hash=?,salt=? WHERE email=?").run(hash, salt, user.email);
  res.json({ ok: true });
});

/** POST /api/auth/register */
router.post("/register", (req, res) => {
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 15 * 60_000);
  if (!rl.ok) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const name = String(req.body?.name ?? "").trim().slice(0, 60);

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const d = getDb();
  const existing = d.prepare("SELECT 1 FROM admins WHERE email=?").get(email);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const { hash, salt } = hashPassword(password);
  try {
    d.prepare("INSERT INTO admins(email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?)").run(
      email, name || email.split("@")[0] || "User", hash, salt, nowIso()
    );
  } catch {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const token = createSessionToken(email);
  setSessionCookie(res, token);
  res.status(201).json({ user: { email, name: name || email.split("@")[0] } });
});

/** POST /api/auth/workspace */
router.post("/workspace", requireAuth, (req, res) => {
  const user = req.user!;
  const orgId = String(req.body?.orgId ?? "").trim();
  if (!orgId) {
    res.status(400).json({ error: "orgId is required" });
    return;
  }

  const orgs = listUserOrgs(user.email);
  const isMember = orgs.some((o) => o.orgId === orgId);
  if (!isMember) {
    res.status(403).json({ error: "You are not a member of that workspace" });
    return;
  }

  if (req.sessionToken) {
    setSessionOrg(req.sessionToken, orgId);
  }
  res.json({ orgId, orgs });
});

export default router;
