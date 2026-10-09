import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getDb, nowIso, verifyPassword } from "./db";

const COOKIE = "ma_session";
const TTL_MS = 7 * 24 * 3600_000;

export async function createSession(email: string): Promise<string> {
  const d = getDb();
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  d.prepare("INSERT INTO sessions(token,admin_email,created_at,expires_at) VALUES(?,?,?,?)").run(
    token, email.toLowerCase(), now.toISOString(),
    new Date(now.getTime() + TTL_MS).toISOString()
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600, secure: process.env.NODE_ENV === "production",
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

export async function currentAdmin(): Promise<{ email: string; name: string } | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const row = getDb().prepare(
    "SELECT s.admin_email AS email, a.name, s.expires_at FROM sessions s JOIN admins a ON a.email=s.admin_email WHERE s.token=?"
  ).get(t) as { email: string; name: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    try { getDb().prepare("DELETE FROM sessions WHERE token=?").run(t); } catch { /* noop */ }
    return null;
  }
  return { email: row.email, name: row.name };
}

export async function requireAdmin(): Promise<{ email: string; name: string } | null> {
  return currentAdmin();
}

export function checkLogin(email: string, password: string): { email: string; name: string } | null {
  const d = getDb();
  const row = d.prepare("SELECT email,name,password_hash,salt FROM admins WHERE email=?").get(email.trim().toLowerCase()) as
    | { email: string; name: string; password_hash: string; salt: string } | undefined;
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
