import { getDb } from "./db";
import { getTokens } from "./gmail";
import type { AppSettings } from "@/types";

function getSetting(key: string, fb = ""): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key=?").get(key) as
    | { value: string } | undefined;
  return row?.value ?? fb;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}

export function loadSettings(): AppSettings {
  const tokens = getTokens();
  const connected = Boolean(tokens?.refresh_token);
  const account = tokens?.account_email ?? (getSetting("gmailAccount") || null);
  return {
    ccEmail: getSetting("ccEmail"),
    autoForwarding: getSetting("autoForwarding", "1") === "1",
    gmailConnected: connected && getSetting("gmailConnected", "0") === "1",
    gmailAccount: connected ? account : null,
    lastSyncedAt: getSetting("lastSyncedAt") || null,
  };
}