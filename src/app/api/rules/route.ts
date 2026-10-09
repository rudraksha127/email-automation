import { err, json, requireOrg } from "@/lib/auth";
import { audit, getDb, nowIso, uid } from "@/lib/db";

interface RuleBody {
  name?: string;
  priority?: number;
  active?: boolean;
  senderPattern?: string | null;
  subjectKeywords?: string[] | string;
  bodyKeywords?: string[] | string;
  targetBatchId?: string;
}

function ruleToApi(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    name: String(r.name),
    priority: Number(r.priority ?? 0),
    active: Number(r.active ?? 1) === 1,
    senderPattern: (r.sender_pattern as string | null) || null,
    subjectKeywords: String(r.subject_keywords ?? "").split(",").filter(Boolean),
    bodyKeywords: String(r.body_keywords ?? "").split(",").filter(Boolean),
    targetBatchId: (r.target_batch_id as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function keywords(raw: RuleBody["subjectKeywords"]): string {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [...new Set(list.map((k) => String(k).trim()).filter(Boolean))]
    .slice(0, 30).join(",");
}

/** GET /api/rules — rules of the active workspace. */
export async function GET(): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  const rows = getDb().prepare(
    "SELECT * FROM forwarding_rules WHERE org_id=? ORDER BY priority DESC, created_at ASC"
  ).all(auth.orgId) as Array<Record<string, unknown>>;
  return json(rows.map(ruleToApi));
}

/** POST /api/rules — create a rule (admin only). */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const body = (await req.json().catch(() => null)) as RuleBody | null;
  if (!body) return err("Invalid request body", 400);
  const name = String(body.name ?? "").trim();
  if (!name) return err("Rule name is required", 400);
  if (name.length > 80) return err("Rule name must be 80 characters or fewer", 400);

  const targetBatchId = String(body.targetBatchId ?? "").trim();
  if (!targetBatchId) return err("A target group is required", 400);
  const batch = getDb().prepare(
    "SELECT id FROM batches WHERE id=? AND org_id=?"
  ).get(targetBatchId, auth.orgId);
  if (!batch) return err("Target group does not exist in this workspace", 400);

  const subjectKeywords = keywords(body.subjectKeywords);
  const bodyKeywords = keywords(body.bodyKeywords);
  if (!subjectKeywords && !bodyKeywords) {
    return err("Provide at least one subject or body keyword", 400);
  }

  let senderPattern: string | null = null;
  if (body.senderPattern != null && String(body.senderPattern).trim()) {
    senderPattern = String(body.senderPattern).trim().toLowerCase();
  }

  const priority = Number.isFinite(Number(body.priority)) ? Math.trunc(Number(body.priority)) : 0;
  if (priority < -1000 || priority > 1000) return err("Priority must be between -1000 and 1000", 400);

  const id = uid("rule");
  const now = nowIso();
  getDb().prepare(
    `INSERT INTO forwarding_rules(id,org_id,name,priority,active,sender_pattern,subject_keywords,body_keywords,target_batch_id,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, auth.orgId, name, priority, body.active === false ? 0 : 1,
    senderPattern, subjectKeywords, bodyKeywords, targetBatchId, now, now
  );
  audit(auth.orgId, auth.email, "rule.created", name.slice(0, 80));
  const row = getDb().prepare("SELECT * FROM forwarding_rules WHERE id=?").get(id) as Record<string, unknown>;
  return json(ruleToApi(row), 201);
}
