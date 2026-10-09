import { err, json, requireOrg } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/audit?limit= — recent audit events for the ACTIVE workspace.
 * Admin-only: the audit trail records configuration and delivery actions.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
  const rows = getDb().prepare(
    `SELECT id, actor, action, detail, created_at FROM audit_events
     WHERE org_id=? ORDER BY created_at DESC, id DESC LIMIT ?`
  ).all(auth.orgId, limit) as Array<Record<string, unknown>>;
  return json(rows.map((r) => ({
    id: Number(r.id),
    actor: String(r.actor ?? ""),
    action: String(r.action),
    detail: (r.detail as string | null) ?? "",
    createdAt: String(r.created_at),
  })));
}
