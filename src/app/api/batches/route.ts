import { err, json, requireOrg } from "@/lib/auth";
import { getDb, listBatchesWithCounts, nowIso, uid, audit } from "@/lib/db";

export async function GET(): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  return json(listBatchesWithCounts(auth.orgId));
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const body = (await req.json().catch(() => null)) as { name?: string; description?: string } | null;
  const name = String(body?.name ?? "").trim();
  if (!name) return err("Group name is required", 400);
  if (name.length > 80) return err("Group name must be 80 characters or fewer", 400);
  const d = getDb();
  // Case-insensitive duplicate check WITHIN this workspace only.
  const dupe = d.prepare(
    "SELECT id FROM batches WHERE org_id=? AND lower(name)=lower(?)"
  ).get(auth.orgId, name);
  if (dupe) return err("A group with this name already exists", 400);
  const now = nowIso();
  const id = uid("b");
  d.prepare(
    "INSERT INTO batches(id,org_id,name,description,created_at,updated_at) VALUES(?,?,?,?,?,?)"
  ).run(id, auth.orgId, name, String(body?.description ?? "").trim() || null, now, now);
  audit(auth.orgId, auth.email, "group.created", name.slice(0, 80));
  const row = d.prepare("SELECT * FROM batches WHERE id=?").get(id) as Record<string, unknown>;
  return json({
    id: row.id, name: row.name, description: row.description ?? null,
    recipientCount: 0, createdAt: row.created_at, updatedAt: row.updated_at,
  }, 201);
}
