import { err, json, requireOrg } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { MailStatus } from "@/types";

const STATUSES: MailStatus[] = ["pending", "forwarded", "needs_review", "failed"];

/**
 * GET /api/mails — server-side filtered list for the active workspace.
 * Optional limit/offset pagination (defaults preserve existing behaviour:
 * up to 500 newest rows as a plain array).
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const batchId = url.searchParams.get("batchId");
  const search = url.searchParams.get("search")?.trim();
  const limitParam = Number(url.searchParams.get("limit"));
  const offsetParam = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 500;
  const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? Math.floor(offsetParam) : 0;

  const where: string[] = ["org_id = ?"];
  const args: unknown[] = [auth.orgId];
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
    "SELECT id,sender,subject,received_at,batch_id,batch_name,status FROM mails WHERE " +
    where.join(" AND ") +
    " ORDER BY received_at DESC LIMIT ? OFFSET ?";
  const rows = getDb().prepare(sql).all(...args, limit, offset) as Array<Record<string, unknown>>;
  return json(rows.map((r) => ({
    id: String(r.id), sender: String(r.sender), subject: String(r.subject),
    receivedAt: String(r.received_at),
    batchId: (r.batch_id as string | null) ?? null,
    batchName: (r.batch_name as string | null) ?? null,
    status: r.status as MailStatus,
  })));
}
