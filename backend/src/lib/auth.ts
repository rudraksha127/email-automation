import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  getDb, listUserOrgs, membershipOf, nowIso, verifyPassword, type Membership,
} from "./db";

export const COOKIE = "ma_session";
export const SESSION_COOKIE = COOKIE;
export const TTL_MS = 7 * 24 * 3600_000;

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

/**
 * Creates a session in the database and returns the generated token.
 */
export function createSessionToken(email: string): string {
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
  return token;
}

export function destroySessionToken(token: string): void {
  try {
    getDb().prepare("DELETE FROM sessions WHERE token=?").run(token);
  } catch {
    /* noop */
  }
}

export function checkLogin(email: string, pass: string): SessionUser | null {
  const normalized = email.trim().toLowerCase();
  const d = getDb();
  const row = d.prepare("SELECT email, name, password_hash, salt FROM admins WHERE email=?").get(
    normalized
  ) as { email: string; name: string; password_hash: string; salt: string } | undefined;
  if (!row) return null;
  if (!verifyPassword(pass, row.password_hash, row.salt)) return null;
  return { email: row.email, name: row.name };
}

export function setSessionOrg(token: string, orgId: string): boolean {
  try {
    const res = getDb().prepare(
      "UPDATE sessions SET org_id=? WHERE token=?"
    ).run(orgId, token);
    return res.changes > 0;
  } catch {
    return false;
  }
}
