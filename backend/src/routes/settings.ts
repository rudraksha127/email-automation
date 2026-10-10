import { Router } from "express";
import { requireWorkspace } from "../middleware/auth";
import { audit, getDb, nowIso, setSetting, uid } from "../lib/db";
import { loadSettings } from "../lib/settings";
import { isValidEmail, type AppSettings } from "../types/shared";

const router = Router();

/** GET /api/settings */
router.get("/", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  res.json(loadSettings(auth.orgId));
});

/** PUT /api/settings or PATCH /api/settings */
const updateSettingsHandler = (req: any, res: any) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const body = req.body as Partial<AppSettings> | null;
  if (!body) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const d = getDb();

  if (body.organizationName !== undefined) {
    const name = String(body.organizationName).trim();
    if (!name) {
      res.status(400).json({ error: "Workspace name is required" });
      return;
    }
    if (name.length > 60) {
      res.status(400).json({ error: "Workspace name must be 60 characters or fewer" });
      return;
    }
    d.prepare("UPDATE organizations SET name=?, updated_at=? WHERE id=?").run(name, nowIso(), auth.orgId);
    audit(auth.orgId, auth.email, "settings.workspace_renamed", name.slice(0, 60));
  }

  if (body.ccEmail !== undefined) {
    const email = String(body.ccEmail).trim();
    if (email && !isValidEmail(email)) {
      res.status(400).json({ error: "Enter a valid CC email address" });
      return;
    }
    setSetting(auth.orgId, "ccEmail", email);
    audit(auth.orgId, auth.email, "settings.cc_updated", email ? "set" : "cleared");
  }

  if (body.autoForwarding !== undefined) {
    setSetting(auth.orgId, "autoForwarding", body.autoForwarding ? "1" : "0");
    audit(auth.orgId, auth.email, "settings.auto_forwarding", body.autoForwarding ? "on" : "off");
  }

  if (body.allowedSenders !== undefined) {
    const raw = Array.isArray(body.allowedSenders) ? body.allowedSenders : [];
    if (raw.length > 200) {
      res.status(400).json({ error: "Maximum 200 allowed senders" });
      return;
    }
    const emails: string[] = [...new Set(raw.map((s: unknown) => String(s).trim().toLowerCase()).filter(Boolean))];
    for (const e of emails) {
      if (!isValidEmail(e)) {
        res.status(400).json({ error: `Invalid sender address: ${e.slice(0, 60)}` });
        return;
      }
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
  res.json(loadSettings(auth.orgId));
};

router.put("/", requireWorkspace(true), updateSettingsHandler);
router.patch("/", requireWorkspace(true), updateSettingsHandler);

export default router;
