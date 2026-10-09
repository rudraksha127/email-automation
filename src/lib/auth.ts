import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import {
  getDb, listUserOrgs, membershipOf, nowIso, verifyPassword, type Membership,
} from "./db";

const COOKIE = "ma_session";
const TTL_MS = 7 * 24 * 3600_000;

export interface SessionUser {
  email: string;
  name: string;
}

export interface OrgAuthOk {
  ok: true;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: "admin" | "member";
}
export type OrgAuth =
  | OrgAuthOk
  | { ok: false; status: 401 | 403; message: string };

async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/**
 * Creates a session and binds it to the user's workspace when they belong to
 * exactly one. Users with multiple workspaces select one explicitly
 * (POST /api/auth/workspace) — the chosen org lives ONLY in the server-side
 * session row, never in a client-supplied header/param.
 */
export async function createSession(email: string): Promise<string> {
  const d = getDb();
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const orgs = listUserOrgs(email);
  const autoOrg = orgs.length === 1 ? orgs[0]!.orgId : null;
  d.prepare(
    "INSERT INTO sessions(token,admin_email,org_id,created_at,expires_at) VALUES(?,?,?,?,?)"
  ).run(
    token, email.toLowerCase(), autoOrg, now.toISOString(),
    new Date(now.getTime() + TTL_MS).toISOString()
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) {
    try { getDb().prepare("DELETE FROM sessions WHERE token=?").run(t); } catch { /* noop */ }
  }
  jar.delete(COOKIE);
}

interface SessionRow {
  email: string; name: string; org_id: string | null; expires_at: string;
}

async function sessionRow(): Promise<SessionRow | null> {
  const t = await sessionToken();
  if (!t) return null;
  const row = getDb().prepare(
    `SELECT s.admin_email AS email, a.name, s.org_id, s.expires_at
     FROM sessions s JOIN admins a ON a.email=s.admin_email WHERE s.token=?`
  ).get(t) as SessionRow | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    try { getDb().prepare("DELETE FROM sessions WHERE token=?").run(t); } catch { /* noop */ }
    return null;
  }
  return row;
}

/** Logged-in user regardless of workspace selection. */
export async function requireUser(): Promise<SessionUser | null> {
  const row = await sessionRow();
  return row ? { email: row.email, name: row.name } : null;
}

/**
 * Membership-verified organization context.
 * The org id comes from the server-side session; membership is re-checked on
 * every request so a stale/forged session org can never bypass authorization.
 */
export async function requireOrg(adminRequired = false): Promise<OrgAuth> {
  const row = await sessionRow();
  if (!row) return { ok: false, status: 401, message: "Unauthorized" };
  if (!row.org_id) {
    return { ok: false, status: 401, message: "No workspace selected" };
  }
  const membership = membershipOf(row.org_id, row.email);
  if (!membership) {
    return { ok: false, status: 403, message: "You are not a member of this workspace" };
  }
  const org = getDb().prepare("SELECT name FROM organizations WHERE id=?").get(row.org_id) as
    | { name: string } | undefined;
  if (!org) return { ok: false, status: 403, message: "Workspace no longer exists" };
  if (adminRequired && membership.role !== "admin") {
    return { ok: false, status: 403, message: "Administrator role required" };
  }
  return {
    ok: true, email: row.email, name: row.name,
    orgId: row.org_id, orgName: org.name, role: membership.role,
  };
}

/** Workspace/session payload for the client (never exposes tokens/secrets). */
export async function sessionState(): Promise<{
  user: SessionUser | null;
  orgId: string | null;
  orgs: Membership[];
}> {
  const row = await sessionRow();
  if (!row) return { user: null, orgId: null, orgs: [] };
  const orgs = listUserOrgs(row.email);
  const orgId = row.org_id && orgs.some((o) => o.orgId === row.org_id) ? row.org_id : null;
  return { user: { email: row.email, name: row.name }, orgId, orgs };
}

/** Bind the current session to a workspace the user is a member of. */
export async function selectWorkspace(orgId: string): Promise<boolean> {
  const t = await sessionToken();
  if (!t) return false;
  const row = await sessionRow();
  if (!row) return false;
  if (!membershipOf(orgId, row.email)) return false;
  getDb().prepare("UPDATE sessions SET org_id=? WHERE token=?").run(orgId, t);
  return true;
}

export function checkLogin(email: string, password: string): SessionUser | null {
  const d = getDb();
  const row = d.prepare("SELECT email,name,password_hash,salt FROM admins WHERE email=?").get(
    email.trim().toLowerCase()
  ) as { email: string; name: string; password_hash: string; salt: string } | undefined;
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash, row.salt)) return null;
  return { email: row.email, name: row.name };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function err(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function dbNow(): string {
  return nowIso();
}
