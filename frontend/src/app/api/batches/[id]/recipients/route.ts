import { err, json, requireOrg } from "@/lib/auth";
import { getDb, nowIso, uid } from "@/lib/db";
import { isValidEmail } from "@/utils/validation";

interface BatchParams { params: Promise<{ id: string }> }

/** Verifies the batch exists WITHIN the caller's workspace. */
function orgBatchExists(orgId: string, id: string): boolean {
  return Boolean(getDb().prepare("SELECT id FROM batches WHERE id=? AND org_id=?").get(id, orgId));
}

function listRecipients(batchId: string) {
  const rows = getDb().prepare(
    "SELECT id,batch_id,name,email,created_at FROM recipients WHERE batch_id=? ORDER BY created_at ASC"
  ).all(batchId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id), batchId: String(r.batch_id),
    name: String(r.name), email: String(r.email), createdAt: String(r.created_at),
  }));
}

export async function GET(_req: Request, { params }: BatchParams): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  if (!orgBatchExists(auth.orgId, id)) return err("Group not found", 404);
  return json(listRecipients(id));
}

export async function POST(req: Request, { params }: BatchParams): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  if (!orgBatchExists(auth.orgId, id)) return err("Group not found", 404);
  const body = (await req.json().catch(() => null)) as { name?: string; email?: string } | null;
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!name) return err("Name is required", 400);
  if (!isValidEmail(email)) return err("Enter a valid email address", 400);
  const d = getDb();
  const dupe = d.prepare(
    "SELECT id FROM recipients WHERE batch_id=? AND lower(email)=?"
  ).get(id, email);
  if (dupe) return err("This email already exists in this group", 400);
  const rid = uid("r");
  const now = nowIso();
  d.prepare(
    "INSERT INTO recipients(id,batch_id,org_id,name,email,created_at) VALUES(?,?,?,?,?,?)"
  ).run(rid, id, auth.orgId, name, email, now);
  return json({ id: rid, batchId: id, name, email, createdAt: now }, 201);
}
