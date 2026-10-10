import { err, json, requireOrg } from "@/lib/auth";
import { audit, getDb, listBatchesWithCounts, nowIso } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

/** Loads a batch only when it belongs to the caller's workspace (else null). */
function findOrgBatch(orgId: string, id: string) {
  return listBatchesWithCounts(orgId).find((b) => b.id === id) ?? null;
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  const batch = findOrgBatch(auth.orgId, id);
  if (!batch) return err("Group not found", 404);
  return json(batch);
}

export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  const existing = findOrgBatch(auth.orgId, id);
  if (!existing) return err("Group not found", 404);
  const body = (await req.json().catch(() => null)) as { name?: string; description?: string } | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return err("Group name is required", 400);
  if (name.length > 80) return err("Group name must be 80 characters or fewer", 400);
  const d = getDb();
  const dupe = d.prepare(
    "SELECT id FROM batches WHERE org_id=? AND lower(name)=lower(?) AND id<>?"
  ).get(auth.orgId, name, id);
  if (dupe) return err("A group with this name already exists", 400);
  d.prepare("UPDATE batches SET name=?, description=?, updated_at=? WHERE id=? AND org_id=?").run(
    name, String(body?.description ?? "").trim() || null, nowIso(), id, auth.orgId
  );
  // Keep denormalized mails.batch_name in sync so the UI never shows a stale name.
  d.prepare("UPDATE mails SET batch_name=? WHERE batch_id=? AND org_id=?").run(name, id, auth.orgId);
  audit(auth.orgId, auth.email, "group.renamed", name.slice(0, 80));
  return json(findOrgBatch(auth.orgId, id));
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  const existing = findOrgBatch(auth.orgId, id);
  if (!existing) return err("Group not found", 404);
  if (existing.recipientCount > 0) {
    return err("Remove all recipients from this group before deleting it", 400);
  }
  // DELETE carries org_id — a foreign workspace can never delete this row.
  const res = getDb().prepare("DELETE FROM batches WHERE id=? AND org_id=?").run(id, auth.orgId);
  if (res.changes === 0) return err("Group not found", 404);
  getDb().prepare("DELETE FROM forwarding_rules WHERE org_id=? AND target_batch_id=?").run(auth.orgId, id);
  audit(auth.orgId, auth.email, "group.deleted", existing.name.slice(0, 80));
  return json({ ok: true }, 200);
}
