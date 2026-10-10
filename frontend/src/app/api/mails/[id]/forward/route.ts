import { err, json, requireOrg } from "@/lib/auth";
import { audit, getDb } from "@/lib/db";
import { deliverStoredMail, alreadyDelivered, getOrgMailRow, mailToApi } from "@/lib/pipeline";

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/mails/[id]/forward — manual forward from the review flow.
 * Idempotent: a gmail message already present in forward_logs is never re-sent.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  const row = getOrgMailRow(auth.orgId, id);
  if (!row) return err("Mail not found", 404);
  const body = (await req.json().catch(() => null)) as { batchId?: string } | null;
  const batchId = String(body?.batchId ?? "").trim();
  if (!batchId) return err("batchId is required", 400);
  const batch = getDb().prepare(
    "SELECT id FROM batches WHERE id=? AND org_id=?"
  ).get(batchId, auth.orgId);
  if (!batch) return err("Selected group does not exist in this workspace", 400);
  if (row.status === "forwarded") return err("This mail has already been forwarded", 409);
  const gmailId = row.gmail_message_id ? String(row.gmail_message_id) : null;
  if (gmailId && alreadyDelivered(auth.orgId, gmailId)) {
    return err("This mail has already been forwarded", 409);
  }
  const delivered = await deliverStoredMail(row, batchId, true);
  if (delivered.status === "failed") {
    return err(String(delivered.failure_reason ?? "Forwarding failed"), 502);
  }
  if (delivered.status === "needs_review") {
    return err(String(delivered.failure_reason ?? "Unable to forward this mail"), 400);
  }
  audit(auth.orgId, auth.email, "mail.forwarded", `manual forward mail=${id}`);
  return json(mailToApi(delivered));
}
