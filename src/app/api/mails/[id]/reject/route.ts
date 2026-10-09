import { err, json, requireOrg } from "@/lib/auth";
import { audit, getDb, nowIso } from "@/lib/db";
import { getOrgMailRow, mailToApi } from "@/lib/pipeline";

interface Params { params: Promise<{ id: string }> }

/** POST /api/mails/[id]/reject — member marks a mail as not relevant. */
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  const row = getOrgMailRow(auth.orgId, id);
  if (!row) return err("Mail not found", 404);
  if (row.status === "forwarded") return err("A forwarded mail cannot be marked as not relevant", 409);
  getDb().prepare(
    "UPDATE mails SET status='failed', failure_reason=?, updated_at=? WHERE id=? AND org_id=?"
  ).run("Marked as not relevant by admin", nowIso(), id, auth.orgId);
  audit(auth.orgId, auth.email, "mail.rejected", `mail=${id}`);
  return json(mailToApi(getOrgMailRow(auth.orgId, id)!));
}
