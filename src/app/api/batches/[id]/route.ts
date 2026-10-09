import { err, json, requireAdmin } from "@/lib/auth";
import { getDb, listBatchesWithCounts, nowIso } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

function findBatch(id: string) {
  return listBatchesWithCounts().find((b) => b.id === id) ?? null;
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id } = await params;
  const batch = findBatch(id);
  if (!batch) return err("Batch not found", 404);
  return json(batch);
}

export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id } = await params;
  const existing = findBatch(id);
  if (!existing) return err("Batch not found", 404);
  const body = (await req.json().catch(() => null)) as { name?: string; description?: string } | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return err("Batch name is required", 400);
  if (name.length > 50) return err("Batch name must be 50 characters or fewer", 400);
  const d = getDb();
  const dupe = d.prepare("SELECT id FROM batches WHERE lower(name)=lower(?) AND id<>?").get(name, id);
  if (dupe) return err("A batch with this name already exists", 400);
  d.prepare("UPDATE batches SET name=?, description=?, updated_at=? WHERE id=?").run(
    name, String(body?.description ?? "").trim() || null, nowIso(), id
  );
  // Keep denormalized mails.batch_name in sync so the UI never shows a stale name.
  d.prepare("UPDATE mails SET batch_name=? WHERE batch_id=?").run(name, id);
  return json(findBatch(id));
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id } = await params;
  const existing = findBatch(id);
  if (!existing) return err("Batch not found", 404);
  if (existing.recipientCount > 0) {
    // Guard against accidental data loss of pilot recipients.
    return err("Remove all recipients from this batch before deleting it", 400);
  }
  getDb().prepare("DELETE FROM batches WHERE id=?").run(id);
  return json({ ok: true }, 200);
}