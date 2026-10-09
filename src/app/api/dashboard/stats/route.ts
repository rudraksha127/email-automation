import { err, json, requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { DashboardStats } from "@/types";

/** GET /api/dashboard/stats — all numbers derived from the real database (no mock data). */
export async function GET(): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const d = getDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startIso = startOfToday.toISOString();

  const one = (sql: string, ...args: unknown[]): number => {
    const row = d.prepare(sql).get(...args) as { c: number | null } | undefined;
    return Number(row?.c ?? 0);
  };

  const stats: DashboardStats = {
    newMails: one("SELECT COUNT(*) AS c FROM mails WHERE status='pending'"),
    forwardedToday: one(
      "SELECT COUNT(*) AS c FROM mails WHERE status='forwarded' AND forwarded_at >= ?",
      startIso
    ),
    needsReview: one("SELECT COUNT(*) AS c FROM mails WHERE status='needs_review'"),
    totalBatches: one("SELECT COUNT(*) AS c FROM batches"),
  };
  return json(stats);
}