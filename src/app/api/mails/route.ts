import { err, json, requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { MailStatus } from "@/types";

const STATUSES: MailStatus[] = ["pending", "forwarded", "needs_review", "failed"];

/** GET /api/mails — server-side filtered list (status, batchId, search). */
export async function GET(req: Request): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const batchId = url.searchParams.get("batchId");
  const search = url.searchParams.get("search")?.trim();

  const where: string[] = [];
  const args: unknown[] = [];
  if (status && status !== "all") {
    if (!STATUSES.includes(status as MailStatus)) return err("Invalid status filter", 400);
    where.push("status = ?");
    args.push(status);
  }
  if (batchId && batchId !== "all") {
    where.push("batch_id = ?");
    args.push(batchId);
  }
  if (search) {
    where.push("(subject LIKE ? OR sender LIKE ?)");
    args.push(`%${search}%`, `%${search}%`);
  }
  const sql =
    "SELECT id,sender,subject,received_at,batch_id,batch_name,status FROM mails" +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY received_at DESC LIMIT 500";
  const rows = getDb().prepare(sql).all(...args) as Array<Record<string, unknown>>;
  return json(rows.map((r) => ({
    id: String(r.id), sender: String(r.sender), subject: String(r.subject),
    receivedAt: String(r.received_at),
    batchId: (r.batch_id as string | null) ?? null,
    batchName: (r.batch_name as string | null) ?? null,
    status: r.status as MailStatus,
  })));
}