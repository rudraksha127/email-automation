import { err, json, requireOrg } from "@/lib/auth";
import { audit } from "@/lib/db";
import { alreadyDelivered, deliverStoredMail, getOrgMailRow, mailToApi } from "@/lib/pipeline";

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/mails/[id]/retry — safe retry of a failed forward.
 * Retry still obeys idempotency: if forward_logs already has the gmail id,
 * no second send occurs. Never blind-retries an uncertain outcome.
 */
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  const row = getOrgMailRow(auth.orgId, id);
  if (!row) return err("Mail not found", 404);
  if (row.status !== "failed") return err("Only failed mails can be retried", 400);
  const batchId = row.batch_id ? String(row.batch_id) : null;
  if (!batchId) return err("This mail has no resolved group — use Select Group & Forward instead", 400);
  const gmailId = row.gmail_message_id ? String(row.gmail_message_id) : null;
  if (gmailId && alreadyDelivered(auth.orgId, gmailId)) {
    return err("This mail has already been forwarded", 409);
  }
  const delivered = await deliverStoredMail(row, batchId, true);
  if (delivered.status === "failed") {
    return err(String(delivered.failure_reason ?? "Retry failed"), 502);
  }
  audit(auth.orgId, auth.email, "mail.retried", `mail=${id}`);
  return json(mailToApi(delivered));
}
