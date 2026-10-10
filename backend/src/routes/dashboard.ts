import { Router } from "express";
import { requireWorkspace } from "../middleware/auth";
import { getDb } from "../lib/db";
import type { DashboardStats } from "../types/shared";

const router = Router();

/** GET /api/dashboard/stats — numbers derived from this workspace's records */
router.get("/stats", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const d = getDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startIso = startOfToday.toISOString();

  const one = (sql: string, ...args: any[]): number => {
    const row = (d.prepare(sql).get as any)(...args) as { c: number | null } | undefined;
    return Number(row?.c ?? 0);
  };

  const stats: DashboardStats = {
    newMails: one("SELECT COUNT(*) AS c FROM mails WHERE org_id=? AND status='pending'", auth.orgId),
    forwardedToday: one(
      "SELECT COUNT(*) AS c FROM mails WHERE org_id=? AND status='forwarded' AND forwarded_at >= ?",
      auth.orgId,
      startIso
    ),
    needsReview: one("SELECT COUNT(*) AS c FROM mails WHERE org_id=? AND status='needs_review'", auth.orgId),
    totalBatches: one("SELECT COUNT(*) AS c FROM batches WHERE org_id=?", auth.orgId),
  };
  res.json(stats);
});

export default router;
