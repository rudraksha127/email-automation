import { getDb, getSetting, setSetting } from "./db";
import { connectionInfo } from "./gmail";
import type { AppSettings } from "../types/shared";

export { setSetting };

/** Server-managed connection settings + org-editable values, scoped to one org. */
export function loadSettings(orgId: string): AppSettings {
  const info = connectionInfo(orgId);
  const org = getDb().prepare("SELECT name FROM organizations WHERE id=?").get(orgId) as
    | { name: string } | undefined;
  const senders = getDb().prepare(
    "SELECT sender_email FROM sender_rules WHERE org_id=? ORDER BY sender_email ASC"
  ).all(orgId) as Array<{ sender_email: string }>;
  return {
    organizationName: org?.name ?? "",
    allowedSenders: senders.map((s) => s.sender_email),
    ccEmail: getSetting(orgId, "ccEmail"),
    autoForwarding: getSetting(orgId, "autoForwarding", "1") === "1",
    gmailConnected: info.connected && getSetting(orgId, "gmailConnected", "0") === "1",
    gmailAccount: info.connected ? info.account : null,
    lastSyncedAt: info.lastSyncedAt,
  };
}
