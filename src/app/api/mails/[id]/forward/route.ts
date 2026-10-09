import { err, json, requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { alreadyDelivered, deliverStoredMail, getMailRow, mailToApi } from "@/lib/pipeline";

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/mails/[id]/forward — manual forward from the review flow.
 * Idempotent: a gmail message already present in forward_logs is never re-sent.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id } = await params;
  const row = getMailRow(id);
  if (!row) return err("Mail not found", 404);
  const body = (await req.json().catch(() => null)) as { batchId?: string } | null;
  const batchId = String(body?.batchId ?? "").trim();
  if (!batchId) return err("batchId is required", 400);
  if (!getDb().prepare("SELECT id FROM batches WHERE id=?").get(batchId)) {
    return err("Selected batch no longer exists", 400);
  }
  if (row.status === "forwarded") return err("This mail has already been forwarded", 409);
  const gmailId = row.gmail_message_id ? String(row.gmail_message_id) : null;
  if (gmailId && alreadyDelivered(gmailId)) {
    // Race/duplicate guard — never send twice.
    return err("This mail has already been forwarded", 409);
  }
  const delivered = await deliverStoredMail(row, batchId, true);
  if (delivered.status === "failed") {
    return err(String(delivered.failure_reason ?? "Forwarding failed"), 502);
  }
  if (delivered.status === "needs_review") {
    return err(String(delivered.failure_reason ?? "Unable to forward this mail"), 400);
  }
  return json(mailToApi(delivered));
}