import { err, json, requireOrg } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { DashboardStats } from "@/types";

/** GET /api/dashboard/stats — numbers derived from THIS workspace's records. */
export async function GET(): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const d = getDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startIso = startOfToday.toISOString();

  const one = (sql: string, ...args: unknown[]): number => {
    const row = d.prepare(sql).get(...args) as { c: number | null } | undefined;
    return Number(row?.c ?? 0);
  };

  const stats: DashboardStats = {
    newMails: one("SELECT COUNT(*) AS c FROM mails WHERE org_id=? AND status='pending'", auth.orgId),
    forwardedToday: one(
      "SELECT COUNT(*) AS c FROM mails WHERE org_id=? AND status='forwarded' AND forwarded_at >= ?",
      auth.orgId, startIso
    ),
    needsReview: one("SELECT COUNT(*) AS c FROM mails WHERE org_id=? AND status='needs_review'", auth.orgId),
    totalBatches: one("SELECT COUNT(*) AS c FROM batches WHERE org_id=?", auth.orgId),
  };
  return json(stats);
}
