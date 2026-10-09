import { err, json, requireAdmin } from "@/lib/auth";
import { getDb, listBatchesWithCounts, nowIso, uid } from "@/lib/db";

export async function GET(): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  return json(listBatchesWithCounts());
}

export async function POST(req: Request): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const body = (await req.json().catch(() => null)) as { name?: string; description?: string } | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return err("Batch name is required", 400);
  const d = getDb();
  const dupe = d.prepare("SELECT id FROM batches WHERE lower(name)=lower(?)").get(name);
  if (dupe) return err("A batch with this name already exists", 400);
  const now = nowIso();
  const id = uid("b");
  d.prepare("INSERT INTO batches(id,name,description,created_at,updated_at) VALUES(?,?,?,?,?)").run(
    id, name, String(body?.description ?? "").trim() || null, now, now
  );
  const row = d.prepare("SELECT * FROM batches WHERE id=?").get(id) as Record<string, unknown>;
  return json({
    id: row.id, name: row.name, description: row.description ?? null,
    recipientCount: 0, createdAt: row.created_at, updatedAt: row.updated_at,
  }, 201);
}
