import { Router } from "express";
import { requireWorkspace } from "../middleware/auth";
import { audit, getDb, nowIso, uid } from "../lib/db";

const router = Router();

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

function keywords(raw: unknown): string {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return [...new Set(list.map((k) => String(k).trim()).filter(Boolean))].slice(0, 30).join(",");
}

function orgRule(orgId: string, id: string): Record<string, unknown> | undefined {
  return getDb().prepare(
    "SELECT * FROM forwarding_rules WHERE id=? AND org_id=?"
  ).get(id, orgId) as Record<string, unknown> | undefined;
}

/** GET /api/rules */
router.get("/", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const rows = getDb().prepare(
    "SELECT * FROM forwarding_rules WHERE org_id=? ORDER BY priority DESC, created_at ASC"
  ).all(auth.orgId) as Array<Record<string, unknown>>;
  res.json(rows.map(ruleToApi));
});

/** POST /api/rules */
router.post("/", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const body = req.body ?? {};
  const name = String(body.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Rule name is required" });
    return;
  }
  if (name.length > 80) {
    res.status(400).json({ error: "Rule name must be 80 characters or fewer" });
    return;
  }

  const targetBatchId = String(body.targetBatchId ?? "").trim();
  if (!targetBatchId) {
    res.status(400).json({ error: "A target group is required" });
    return;
  }
  const batch = getDb().prepare("SELECT id FROM batches WHERE id=? AND org_id=?").get(targetBatchId, auth.orgId);
  if (!batch) {
    res.status(400).json({ error: "Target group does not exist in this workspace" });
    return;
  }

  const subjectKeywords = keywords(body.subjectKeywords);
  const bodyKeywords = keywords(body.bodyKeywords);
  if (!subjectKeywords && !bodyKeywords) {
    res.status(400).json({ error: "Provide at least one subject or body keyword" });
    return;
  }

  let senderPattern: string | null = null;
  if (body.senderPattern != null && String(body.senderPattern).trim()) {
    senderPattern = String(body.senderPattern).trim().toLowerCase();
  }

  const priority = Number.isFinite(Number(body.priority)) ? Math.trunc(Number(body.priority)) : 0;
  if (priority < -1000 || priority > 1000) {
    res.status(400).json({ error: "Priority must be between -1000 and 1000" });
    return;
  }

  const id = uid("rule");
  const now = nowIso();
  getDb().prepare(
    `INSERT INTO forwarding_rules(id,org_id,name,priority,active,sender_pattern,subject_keywords,body_keywords,target_batch_id,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    auth.orgId,
    name,
    priority,
    body.active === false ? 0 : 1,
    senderPattern,
    subjectKeywords,
    bodyKeywords,
    targetBatchId,
    now,
    now
  );
  audit(auth.orgId, auth.email, "rule.created", name.slice(0, 80));
  const row = getDb().prepare("SELECT * FROM forwarding_rules WHERE id=?").get(id) as Record<string, unknown>;
  res.status(201).json(ruleToApi(row));
});

/** PUT /api/rules/:id or PATCH /api/rules/:id */
const updateRuleHandler = (req: any, res: any) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const existing = orgRule(auth.orgId, id);
  if (!existing) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  const body = req.body ?? {};
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      res.status(400).json({ error: "Rule name is required" });
      return;
    }
    patch.name = name.slice(0, 80);
  }
  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (!Number.isFinite(p) || p < -1000 || p > 1000) {
      res.status(400).json({ error: "Priority must be between -1000 and 1000" });
      return;
    }
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
    const batch = getDb().prepare("SELECT id FROM batches WHERE id=? AND org_id=?").get(target, auth.orgId);
    if (!batch) {
      res.status(400).json({ error: "Target group does not exist in this workspace" });
      return;
    }
    patch.target_batch_id = target;
  }
  if (!patch.subject_keywords && !patch.body_keywords) {
    const subj = patch.subject_keywords ?? existing.subject_keywords;
    const bod = patch.body_keywords ?? existing.body_keywords;
    if (!String(subj ?? "") && !String(bod ?? "")) {
      res.status(400).json({ error: "Provide at least one subject or body keyword" });
      return;
    }
  }

  const keys = Object.keys(patch);
  if (keys.length === 0) {
    res.json(ruleToApi(existing));
    return;
  }
  (getDb().prepare(
    `UPDATE forwarding_rules SET ${keys.map((k) => `${k}=?`).join(",")}, updated_at=? WHERE id=? AND org_id=?`
  ) as any).run(...keys.map((k) => patch[k]), nowIso(), id, auth.orgId);
  audit(auth.orgId, auth.email, "rule.updated", id);
  res.json(ruleToApi(orgRule(auth.orgId, id)!));
};

router.put("/:id", requireWorkspace(true), updateRuleHandler);
router.patch("/:id", requireWorkspace(true), updateRuleHandler);

/** DELETE /api/rules/:id */
router.delete("/:id", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  if (!orgRule(auth.orgId, id)) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  getDb().prepare("DELETE FROM forwarding_rules WHERE id=? AND org_id=?").run(id, auth.orgId);
  audit(auth.orgId, auth.email, "rule.deleted", id);
  res.json({ ok: true });
});

export default router;
