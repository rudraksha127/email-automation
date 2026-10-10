import { err, json, requireOrg } from "@/lib/auth";
import { audit, getDb, nowIso, setSetting, uid } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { isValidEmail } from "@/utils/validation";
import type { AppSettings } from "@/types";

export async function GET(): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  return json(loadSettings(auth.orgId));
}

/**
 * PUT /api/settings — admin-only workspace configuration.
 * Client can edit: organizationName, ccEmail, autoForwarding, allowedSenders.
 * gmailConnected/gmailAccount/lastSyncedAt are server-managed via OAuth.
 */
export async function PUT(req: Request): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const body = (await req.json().catch(() => null)) as Partial<AppSettings> | null;
  if (!body) return err("Invalid request body", 400);
  const d = getDb();

  if (body.organizationName !== undefined) {
    const name = String(body.organizationName).trim();
    if (!name) return err("Workspace name is required", 400);
    if (name.length > 60) return err("Workspace name must be 60 characters or fewer", 400);
    d.prepare("UPDATE organizations SET name=?, updated_at=? WHERE id=?").run(name, nowIso(), auth.orgId);
    audit(auth.orgId, auth.email, "settings.workspace_renamed", name.slice(0, 60));
  }

  if (body.ccEmail !== undefined) {
    const email = String(body.ccEmail).trim();
    if (email && !isValidEmail(email)) return err("Enter a valid CC email address", 400);
    setSetting(auth.orgId, "ccEmail", email);
    audit(auth.orgId, auth.email, "settings.cc_updated", email ? "set" : "cleared");
  }

  if (body.autoForwarding !== undefined) {
    setSetting(auth.orgId, "autoForwarding", body.autoForwarding ? "1" : "0");
    audit(auth.orgId, auth.email, "settings.auto_forwarding", body.autoForwarding ? "on" : "off");
  }

  if (body.allowedSenders !== undefined) {
    const raw = Array.isArray(body.allowedSenders) ? body.allowedSenders : [];
    if (raw.length > 200) return err("Maximum 200 allowed senders", 400);
    const emails = [...new Set(raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
    for (const e of emails) {
      if (!isValidEmail(e)) return err(`Invalid sender address: ${e.slice(0, 60)}`, 400);
    }
    d.prepare("DELETE FROM sender_rules WHERE org_id=?").run(auth.orgId);
    const now = nowIso();
    const ins = d.prepare(
      "INSERT OR IGNORE INTO sender_rules(id,org_id,sender_email,active,created_at) VALUES(?,?,?,1,?)"
    );
    for (const e of emails) ins.run(uid("sr"), auth.orgId, e, now);
    audit(auth.orgId, auth.email, "settings.allowlist_updated", `${emails.length} sender(s)`);
  }

  setSetting(auth.orgId, "updatedAt", nowIso());
  return json(loadSettings(auth.orgId));
}
