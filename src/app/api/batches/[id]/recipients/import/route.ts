import { err, json, requireAdmin } from "@/lib/auth";
import { getDb, nowIso, uid } from "@/lib/db";
import { isValidEmail } from "@/utils/validation";

interface Params { params: Promise<{ id: string }> }

/** Bulk CSV/import add — dedupes against existing batch emails (case-insensitive). */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  const { id } = await params;
  const d = getDb();
  if (!d.prepare("SELECT id FROM batches WHERE id=?").get(id)) return err("Batch not found", 404);
  const body = (await req.json().catch(() => null)) as { rows?: Array<{ name?: string; email?: string }> } | null;
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows) return err("rows array is required", 400);

  const existing = new Set(
    (d.prepare("SELECT lower(email) AS e FROM recipients WHERE batch_id=?").all(id) as Array<{ e: string }>).map((r) => r.e)
  );
  const now = nowIso();
  let added = 0;
  let skipped = 0;
  const insert = d.prepare("INSERT INTO recipients(id,batch_id,name,email,created_at) VALUES(?,?,?,?,?)");
  for (const raw of rows) {
    const name = String(raw?.name ?? "").trim();
    const email = String(raw?.email ?? "").trim().toLowerCase();
    if (!name || !isValidEmail(email) || existing.has(email)) {
      skipped += 1;
      continue;
    }
    insert.run(uid("r"), id, name, email, now);
    existing.add(email);
    added += 1;
  }
  return json({ added, skipped });
}