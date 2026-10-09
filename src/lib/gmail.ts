/**
 * Gmail OAuth + API client (server-side only).
 * - One centrally maintained Google OAuth client for the whole application.
 * - Each workspace authorizes its OWN mailbox; the org binding is derived
 *   from the server-side OAuth state record, never from browser input.
 * - Tokens are encrypted at rest (see ./crypto) and NEVER leave the server:
 *   not in API responses, not in the frontend, not in logs.
 * Never import this from client components.
 */
import { randomBytes } from "node:crypto";
import { getDb, nowIso, listConnectedOrgs, audit } from "./db";
import { decryptToken, encryptToken, tokenEncryptionReady } from "./crypto";
import { fetchWithRetry } from "./retry";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
// Minimum scopes for the actual workflow: read inbox metadata/content to
// classify, send the forward, identify the authorized account.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function gmailConfig(): {
  clientId: string; clientSecret: string; redirectUri: string; configured: boolean;
} {
  const clientId = process.env.GMAIL_CLIENT_ID ?? "";
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? "";
  const redirectUri =
    process.env.GMAIL_REDIRECT_URI ?? "http://localhost:3000/api/gmail/callback";
  return { clientId, clientSecret, redirectUri, configured: Boolean(clientId && clientSecret) };
}

/** Start the OAuth consent flow for a specific organization. */
export function buildAuthUrl(orgId: string): { url: string; state: string } {
  const cfg = gmailConfig();
  if (!cfg.configured) throw new Error("Gmail OAuth is not configured (GMAIL_CLIENT_ID/SECRET missing)");
  if (!tokenEncryptionReady() && process.env.NODE_ENV === "production") {
    throw new Error("GMAIL_TOKEN_KEY is not configured — refusing to start OAuth without token encryption.");
  }
  const state = randomBytes(16).toString("hex");
  // The state record is the ONLY place the org binding lives during the flow.
  getDb().prepare(
    "INSERT INTO gmail_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(`oauth:${state}`, JSON.stringify({ orgId, createdAt: nowIso() }));
  const p = new URLSearchParams({
    client_id: cfg.clientId, redirect_uri: cfg.redirectUri,
    response_type: "code", scope: SCOPES,
    access_type: "offline", prompt: "consent", state,
  });
  return { url: `${AUTH_URL}?${p.toString()}`, state };
}

/**
 * Consumes a one-time OAuth state and returns the organization it was issued
 * for — null for forged/expired/unknown states. Never accepts the org from
 * query parameters.
 */
export function consumeState(state: string): string | null {
  const row = getDb().prepare("SELECT value FROM gmail_state WHERE key=?").get(`oauth:${state}`) as
    | { value: string } | undefined;
  if (!row) return null;
  getDb().prepare("DELETE FROM gmail_state WHERE key=?").run(`oauth:${state}`);
  try {
    const parsed = JSON.parse(row.value) as { orgId?: string; createdAt?: string };
    if (!parsed.orgId) return null;
    // 10-minute expiry for the state
    const created = parsed.createdAt ? Date.parse(parsed.createdAt) : 0;
    if (Date.now() - created > 10 * 60_000) return null;
    return parsed.orgId;
  } catch {
    return null;
  }
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

export function saveTokens(
  orgId: string, accountEmail: string, access: string, refresh: string | undefined, expiresIn: number
): void {
  const d = getDb();
  const prev = d.prepare("SELECT refresh_token FROM gmail_tokens WHERE org_id=?").get(orgId) as
    | { refresh_token: string | null } | undefined;
  const rt = refresh ?? prev?.refresh_token ?? null;
  d.prepare(
    `INSERT INTO gmail_tokens(org_id,account_email,access_token,refresh_token,expiry_ms,updated_at)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(org_id) DO UPDATE SET account_email=excluded.account_email,
       access_token=excluded.access_token, refresh_token=excluded.refresh_token,
       expiry_ms=excluded.expiry_ms, updated_at=excluded.updated_at`
  ).run(
    orgId, accountEmail.toLowerCase(),
    encryptToken(access), rt ? encryptToken(rt) : null,
    Date.now() + expiresIn * 1000, nowIso()
  );
  d.prepare(
    "INSERT INTO settings(org_id,key,value) VALUES(?, 'gmailConnected','1') ON CONFLICT(org_id,key) DO UPDATE SET value='1'"
  ).run(orgId);
  d.prepare(
    "INSERT INTO settings(org_id,key,value) VALUES(?,?,?) ON CONFLICT(org_id,key) DO UPDATE SET value=excluded.value"
  ).run(orgId, "gmailAccount", accountEmail.toLowerCase());
  d.prepare(
    "INSERT INTO settings(org_id,key,value) VALUES(?,?,?) ON CONFLICT(org_id,key) DO UPDATE SET value=excluded.value"
  ).run(orgId, "lastSyncedAt", nowIso());
  audit(orgId, accountEmail, "gmail.connected", "OAuth connection established");
}

export interface TokenRow {
  account_email: string | null;
  access_token: string | null;   // decrypted
  refresh_token: string | null;  // decrypted
  expiry_ms: number | null;
}

export function getTokens(orgId: string): TokenRow | null {
  const row = getDb().prepare(
    "SELECT account_email, access_token, refresh_token, expiry_ms FROM gmail_tokens WHERE org_id=?"
  ).get(orgId) as
    | { account_email: string | null; access_token: string | null; refresh_token: string | null; expiry_ms: number | null }
    | undefined;
  if (!row) return null;
  try {
    return {
      account_email: row.account_email,
      access_token: row.access_token ? decryptToken(row.access_token) : null,
      refresh_token: row.refresh_token ? decryptToken(row.refresh_token) : null,
      expiry_ms: row.expiry_ms,
    };
  } catch (e) {
    // Wrong/missing key: surface a clear error instead of silently retrying.
    throw new Error(e instanceof Error ? e.message : "Stored Gmail tokens cannot be decrypted");
  }
}

export async function getValidAccessToken(orgId: string): Promise<string> {
  const t = getTokens(orgId);
  if (!t?.access_token) throw new Error("Gmail not connected for this workspace");
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
  saveTokens(orgId, t.account_email ?? "", j.access_token, undefined, j.expires_in ?? 3600);
  return j.access_token;
}

/**
 * Disconnect a workspace's Gmail account: best-effort revocation at Google,
 * then delete the stored tokens and connection settings. Idempotent.
 */
export async function disconnectGmail(orgId: string, actor: string): Promise<void> {
  let refresh: string | null = null;
  try {
    refresh = getTokens(orgId)?.refresh_token ?? null;
  } catch {
    refresh = null;
  }
  if (refresh) {
    try {
      await fetch(REVOKE_URL, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refresh }).toString(),
      });
    } catch {
      /* revocation is best-effort — local cleanup still proceeds */
    }
  }
  const d = getDb();
  d.prepare("DELETE FROM gmail_tokens WHERE org_id=?").run(orgId);
  d.prepare("UPDATE settings SET value='0' WHERE org_id=? AND key='gmailConnected'").run(orgId);
  d.prepare("UPDATE settings SET value='' WHERE org_id=? AND key='gmailAccount'").run(orgId);
  audit(orgId, actor, "gmail.disconnected", "OAuth connection removed");
}

/** Connected-mailbox metadata for the UI — NEVER tokens. */
export function connectionInfo(orgId: string): {
  connected: boolean; account: string | null; lastSyncedAt: string | null;
} {
  const row = getDb().prepare(
    "SELECT account_email FROM gmail_tokens WHERE org_id=?"
  ).get(orgId) as { account_email: string | null } | undefined;
  const lastSynced = getDb().prepare(
    "SELECT value FROM settings WHERE org_id=? AND key='lastSyncedAt'"
  ).get(orgId) as { value: string } | undefined;
  return {
    connected: Boolean(row?.account_email),
    account: row?.account_email ?? null,
    lastSyncedAt: lastSynced?.value ?? null,
  };
}

export { listConnectedOrgs };
