/**
 * Gmail OAuth + API client (server-side only).
 * Never import this from client components — secrets stay on the backend.
 */
import { randomBytes } from "node:crypto";
import { getDb, nowIso } from "./db";
import { PILOT_TARGET_MAILBOX } from "./pilotConfig";
import { fetchWithRetry } from "./retry";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function gmailConfig(): {
  clientId: string; clientSecret: string; redirectUri: string; target: string;
  configured: boolean;
} {
  const clientId = process.env.GMAIL_CLIENT_ID ?? "";
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? "";
  const redirectUri =
    process.env.GMAIL_REDIRECT_URI ?? "http://localhost:3000/api/gmail/callback";
  // Target mailbox comes exclusively from env — never hardcoded.
  const target = PILOT_TARGET_MAILBOX;
  return { clientId, clientSecret, redirectUri, target, configured: Boolean(clientId && clientSecret) };
}

export function buildAuthUrl(): { url: string; state: string } {
  const cfg = gmailConfig();
  if (!cfg.configured) throw new Error("Gmail OAuth is not configured (GMAIL_CLIENT_ID/SECRET missing)");
  const state = randomBytes(16).toString("hex");
  getDb().prepare(
    "INSERT INTO gmail_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(`oauth:${state}`, JSON.stringify({ createdAt: nowIso() }));
  const p = new URLSearchParams({
    client_id: cfg.clientId, redirect_uri: cfg.redirectUri,
    response_type: "code", scope: SCOPES,
    access_type: "offline", prompt: "consent", state,
  });
  return { url: `${AUTH_URL}?${p.toString()}`, state };
}

export function consumeState(state: string): boolean {
  const row = getDb().prepare("SELECT value FROM gmail_state WHERE key=?").get(`oauth:${state}`) as
    | { value: string } | undefined;
  if (!row) return false;
  getDb().prepare("DELETE FROM gmail_state WHERE key=?").run(`oauth:${state}`);
  return true;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string; refresh_token?: string; expires_in: number;
}> {
  const cfg = gmailConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: cfg.clientId, client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri, grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed (${res.status})`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function fetchAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to verify Gmail account (${res.status})`);
  const j = (await res.json()) as { email?: string };
  return String(j.email ?? "").toLowerCase();
}

export function saveTokens(accountEmail: string, access: string, refresh: string | undefined, expiresIn: number): void {
  const d = getDb();
  const prev = d.prepare("SELECT refresh_token FROM gmail_tokens WHERE id=1").get() as
    | { refresh_token: string | null } | undefined;
  const rt = refresh ?? prev?.refresh_token ?? null;
  d.prepare(
    "INSERT INTO gmail_tokens(id,account_email,access_token,refresh_token,expiry_ms,updated_at) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET account_email=excluded.account_email, access_token=excluded.access_token, refresh_token=excluded.refresh_token, expiry_ms=excluded.expiry_ms, updated_at=excluded.updated_at"
  ).run(accountEmail.toLowerCase(), access, rt, Date.now() + expiresIn * 1000, nowIso());
  d.prepare("INSERT INTO settings(key,value) VALUES('gmailConnected','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
  d.prepare("INSERT INTO settings(key,value) VALUES('gmailAccount',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(accountEmail.toLowerCase());
  d.prepare("INSERT INTO settings(key,value) VALUES('lastSyncedAt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(nowIso());
}

export function getTokens(): {
  account_email: string | null; access_token: string | null;
  refresh_token: string | null; expiry_ms: number | null;
} | null {
  const row = getDb().prepare("SELECT * FROM gmail_tokens WHERE id=1").get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    account_email: (row.account_email as string | null) ?? null,
    access_token: (row.access_token as string | null) ?? null,
    refresh_token: (row.refresh_token as string | null) ?? null,
    expiry_ms: (row.expiry_ms as number | null) ?? null,
  };
}

export async function getValidAccessToken(): Promise<string> {
  const t = getTokens();
  if (!t?.access_token) throw new Error("Gmail not connected");
  if (t.expiry_ms && t.expiry_ms - Date.now() > 60_000) return t.access_token;
  if (!t.refresh_token) return t.access_token; // no refresh available; try anyway
  const cfg = gmailConfig();
  // Refresh grant is idempotent — safe to retry with backoff.
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId, client_secret: cfg.clientSecret,
      refresh_token: t.refresh_token, grant_type: "refresh_token",
    }).toString(),
  });
  if (res.status === 400 || res.status === 401) {
    throw new Error("Gmail refresh token rejected (consent revoked or expired) — reconnect the account from Settings.");
  }
  if (!res.ok) throw new Error(`Gmail token refresh failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  saveTokens(t.account_email ?? "", j.access_token, undefined, j.expires_in ?? 3600);
  return j.access_token;
}
