import { err, json, requireOrg } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isValidEmail } from "@/utils/validation";

interface RecipientParams { params: Promise<{ id: string; rid: string }> }

/** Recipient row joined to its batch — only visible within the caller's org. */
function orgRecipient(orgId: string, batchId: string, rid: string) {
  return getDb().prepare(
    `SELECT r.id, r.batch_id, r.created_at FROM recipients r
     JOIN batches b ON b.id = r.batch_id
     WHERE r.id=? AND r.batch_id=? AND b.org_id=?`
  ).get(rid, batchId, orgId) as
    | { id: string; batch_id: string; created_at: string } | undefined;
}

export async function PUT(req: Request, { params }: RecipientParams): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const { id, rid } = await params;
  const d = getDb();
  const row = orgRecipient(auth.orgId, id, rid);
  if (!row) return err("Recipient not found", 404);
  const body = (await req.json().catch(() => null)) as { name?: string; email?: string } | null;
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!name) return err("Name is required", 400);
  if (!isValidEmail(email)) return err("Enter a valid email address", 400);
  const dupe = d.prepare(
    "SELECT id FROM recipients WHERE batch_id=? AND lower(email)=? AND id<>?"
  ).get(id, email, rid);
  if (dupe) return err("This email already exists in this group", 400);
  d.prepare("UPDATE recipients SET name=?, email=? WHERE id=? AND batch_id=?").run(name, email, rid, id);
  return json({ id: rid, batchId: id, name, email, createdAt: row.created_at });
}

export async function DELETE(_req: Request, { params }: RecipientParams): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const { id, rid } = await params;
  if (!orgRecipient(auth.orgId, id, rid)) return err("Recipient not found", 404);
  const res = getDb().prepare("DELETE FROM recipients WHERE id=? AND batch_id=?").run(rid, id);
  if (res.changes === 0) return err("Recipient not found", 404);
  return json({ ok: true });
}
