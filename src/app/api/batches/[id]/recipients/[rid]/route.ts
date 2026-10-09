import { err, json, requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isValidEmail } from "@/utils/validation";

interface RecipientParams { params: Promise<{ id: string; rid: string }> }

export async function PUT(req: Request, { params }: RecipientParams): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id, rid } = await params;
  const d = getDb();
  const row = d.prepare("SELECT id,batch_id,created_at FROM recipients WHERE id=? AND batch_id=?").get(rid, id) as
    | { id: string; batch_id: string; created_at: string } | undefined;
  if (!row) return err("Recipient not found", 404);
  const body = (await req.json().catch(() => null)) as { name?: string; email?: string } | null;
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!name) return err("Name is required", 400);
  if (!isValidEmail(email)) return err("Enter a valid email address", 400);
  const dupe = d.prepare("SELECT id FROM recipients WHERE batch_id=? AND lower(email)=? AND id<>?").get(id, email, rid);
  if (dupe) return err("This email already exists in this batch", 400);
  d.prepare("UPDATE recipients SET name=?, email=? WHERE id=?").run(name, email, rid);
  return json({ id: rid, batchId: id, name, email, createdAt: row.created_at });
}

export async function DELETE(_req: Request, { params }: RecipientParams): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id, rid } = await params;
  const res = getDb().prepare("DELETE FROM recipients WHERE id=? AND batch_id=?").run(rid, id);
  if (res.changes === 0) return err("Recipient not found", 404);
  return json({ ok: true });
}