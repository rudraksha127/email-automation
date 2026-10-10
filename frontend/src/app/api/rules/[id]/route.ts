import { err, json, requireOrg } from "@/lib/auth";
import { audit, getDb, nowIso } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

function orgRule(orgId: string, id: string): Record<string, unknown> | undefined {
  return getDb().prepare(
    "SELECT * FROM forwarding_rules WHERE id=? AND org_id=?"
  ).get(id, orgId) as Record<string, unknown> | undefined;
}

function toApi(r: Record<string, unknown>) {
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

function keywords(raw: unknown): string {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [...new Set(list.map((k) => String(k).trim()).filter(Boolean))].slice(0, 30).join(",");
}

/** PUT /api/rules/[id] — partial update (admin only). */
export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  const existing = orgRule(auth.orgId, id);
  if (!existing) return err("Rule not found", 404);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return err("Invalid request body", 400);

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return err("Rule name is required", 400);
    patch.name = name.slice(0, 80);
  }
  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (!Number.isFinite(p) || p < -1000 || p > 1000) return err("Priority must be between -1000 and 1000", 400);
    patch.priority = Math.trunc(p);
  }
  if (body.active !== undefined) patch.active = body.active ? 1 : 0;
  if (body.subjectKeywords !== undefined) patch.subject_keywords = keywords(body.subjectKeywords);
  if (body.bodyKeywords !== undefined) patch.body_keywords = keywords(body.bodyKeywords);
  if (body.senderPattern !== undefined) {
    const v = String(body.senderPattern ?? "").trim().toLowerCase();
    patch.sender_pattern = v || null;
  }
  if (body.targetBatchId !== undefined) {
    const target = String(body.targetBatchId).trim();
    const batch = getDb().prepare(
      "SELECT id FROM batches WHERE id=? AND org_id=?"
    ).get(target, auth.orgId);
    if (!batch) return err("Target group does not exist in this workspace", 400);
    patch.target_batch_id = target;
  }
  if (!patch.subject_keywords && !patch.body_keywords) {
    const subj = patch.subject_keywords ?? existing.subject_keywords;
    const bod = patch.body_keywords ?? existing.body_keywords;
    if (!String(subj ?? "") && !String(bod ?? "")) return err("Provide at least one subject or body keyword", 400);
  }

  const keys = Object.keys(patch);
  if (keys.length === 0) return json(toApi(existing));
  getDb().prepare(
    `UPDATE forwarding_rules SET ${keys.map((k) => `${k}=?`).join(",")}, updated_at=? WHERE id=? AND org_id=?`
  ).run(...keys.map((k) => patch[k]), nowIso(), id, auth.orgId);
  audit(auth.orgId, auth.email, "rule.updated", id);
  return json(toApi(orgRule(auth.orgId, id)!));
}

/** DELETE /api/rules/[id] (admin only). */
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const auth = await requireOrg(true);
  if (!auth.ok) return err(auth.message, auth.status);
  const { id } = await params;
  if (!orgRule(auth.orgId, id)) return err("Rule not found", 404);
  getDb().prepare("DELETE FROM forwarding_rules WHERE id=? AND org_id=?").run(id, auth.orgId);
  audit(auth.orgId, auth.email, "rule.deleted", id);
  return json({ ok: true });
}
