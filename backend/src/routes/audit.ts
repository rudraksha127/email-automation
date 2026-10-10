import { Router } from "express";
import { requireWorkspace } from "../middleware/auth";
import { getDb } from "../lib/db";

const router = Router();

/**
 * GET /api/audit?limit= — recent audit events for the ACTIVE workspace.
 * Admin-only: records configuration, profile, and email delivery actions.
 */
router.get("/", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  const limitParam = Number(req.query.limit);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

  try {
    const rows = getDb().prepare(
      `SELECT id, actor, action, detail, created_at FROM audit_events
       WHERE org_id=? ORDER BY created_at DESC, id DESC LIMIT ?`
    ).all(auth.orgId, limit) as Array<Record<string, unknown>>;

    res.json(
      rows.map((r) => ({
        id: Number(r.id),
        actor: String(r.actor ?? ""),
        action: String(r.action),
        detail: (r.detail as string | null) ?? "",
        createdAt: String(r.created_at),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

export default router;
