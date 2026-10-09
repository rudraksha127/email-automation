import { err, json, requireAdmin } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { getMailRow, mailToApi } from "@/lib/pipeline";

interface Params { params: Promise<{ id: string }> }

/** POST /api/mails/[id]/reject — admin marks a mail as not relevant. */
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id } = await params;
  const row = getMailRow(id);
  if (!row) return err("Mail not found", 404);
  if (row.status === "forwarded") return err("A forwarded mail cannot be marked as not relevant", 409);
  getDb().prepare(
    "UPDATE mails SET status='failed', failure_reason=?, updated_at=? WHERE id=?"
  ).run("Marked as not relevant by admin", nowIso(), id);
  return json(mailToApi(getMailRow(id)!));
}