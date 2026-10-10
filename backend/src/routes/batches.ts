import { Router } from "express";
import { requireWorkspace } from "../middleware/auth";
import { audit, getDb, listBatchesWithCounts, nowIso, uid } from "../lib/db";
import { isValidEmail } from "../types/shared";

const router = Router();

function orgBatchExists(orgId: string, id: string): boolean {
  return Boolean(getDb().prepare("SELECT id FROM batches WHERE id=? AND org_id=?").get(id, orgId));
}

function findOrgBatch(orgId: string, id: string) {
  return listBatchesWithCounts(orgId).find((b) => b.id === id) ?? null;
}

function listRecipients(batchId: string) {
  const rows = getDb().prepare(
    "SELECT id,batch_id,name,email,created_at FROM recipients WHERE batch_id=? ORDER BY created_at ASC"
  ).all(batchId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    batchId: String(r.batch_id),
    name: String(r.name),
    email: String(r.email),
    createdAt: String(r.created_at),
  }));
}

/** GET /api/batches */
router.get("/", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  res.json(listBatchesWithCounts(auth.orgId));
});

/** POST /api/batches */
router.post("/", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Group name is required" });
    return;
  }
  if (name.length > 80) {
    res.status(400).json({ error: "Group name must be 80 characters or fewer" });
    return;
  }
  const d = getDb();
  const dupe = d.prepare(
    "SELECT id FROM batches WHERE org_id=? AND lower(name)=lower(?)"
  ).get(auth.orgId, name);
  if (dupe) {
    res.status(400).json({ error: "A group with this name already exists" });
    return;
  }
  const now = nowIso();
  const id = uid("b");
  d.prepare(
    "INSERT INTO batches(id,org_id,name,description,created_at,updated_at) VALUES(?,?,?,?,?,?)"
  ).run(id, auth.orgId, name, String(req.body?.description ?? "").trim() || null, now, now);
  audit(auth.orgId, auth.email, "group.created", name.slice(0, 80));
  const row = d.prepare("SELECT * FROM batches WHERE id=?").get(id) as Record<string, unknown>;
  res.status(201).json({
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    recipientCount: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
});

/** GET /api/batches/:id */
router.get("/:id", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const batch = findOrgBatch(auth.orgId, String(req.params.id));
  if (!batch) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  res.json(batch);
});

/** PUT /api/batches/:id */
const updateBatchHandler = (req: any, res: any) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const existing = findOrgBatch(auth.orgId, id);
  if (!existing) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Group name is required" });
    return;
  }
  if (name.length > 80) {
    res.status(400).json({ error: "Group name must be 80 characters or fewer" });
    return;
  }
  const d = getDb();
  const dupe = d.prepare(
    "SELECT id FROM batches WHERE org_id=? AND lower(name)=lower(?) AND id<>?"
  ).get(auth.orgId, name, id);
  if (dupe) {
    res.status(400).json({ error: "A group with this name already exists" });
    return;
  }
  d.prepare("UPDATE batches SET name=?, description=?, updated_at=? WHERE id=? AND org_id=?").run(
    name, String(req.body?.description ?? "").trim() || null, nowIso(), id, auth.orgId
  );
  d.prepare("UPDATE mails SET batch_name=? WHERE batch_id=? AND org_id=?").run(name, id, auth.orgId);
  audit(auth.orgId, auth.email, "group.renamed", name.slice(0, 80));
  res.json(findOrgBatch(auth.orgId, id));
};
router.put("/:id", requireWorkspace(true), updateBatchHandler);
router.patch("/:id", requireWorkspace(true), updateBatchHandler);

/** DELETE /api/batches/:id */
router.delete("/:id", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const existing = findOrgBatch(auth.orgId, id);
  if (!existing) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  if (existing.recipientCount > 0) {
    res.status(400).json({ error: "Remove all recipients from this group before deleting it" });
    return;
  }
  const result = getDb().prepare("DELETE FROM batches WHERE id=? AND org_id=?").run(id, auth.orgId);
  if (result.changes === 0) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  getDb().prepare("DELETE FROM forwarding_rules WHERE org_id=? AND target_batch_id=?").run(auth.orgId, id);
  audit(auth.orgId, auth.email, "group.deleted", existing.name.slice(0, 80));
  res.json({ ok: true });
});

/** GET /api/batches/:id/recipients */
router.get("/:id/recipients", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  if (!orgBatchExists(auth.orgId, id)) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  res.json(listRecipients(id));
});

/** POST /api/batches/:id/recipients */
router.post("/:id/recipients", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  if (!orgBatchExists(auth.orgId, id)) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  const d = getDb();
  const dupe = d.prepare(
    "SELECT id FROM recipients WHERE batch_id=? AND lower(email)=?"
  ).get(id, email);
  if (dupe) {
    res.status(400).json({ error: "This email already exists in this group" });
    return;
  }
  const rid = uid("r");
  const now = nowIso();
  d.prepare(
    "INSERT INTO recipients(id,batch_id,org_id,name,email,created_at) VALUES(?,?,?,?,?,?)"
  ).run(rid, id, auth.orgId, name, email, now);
  res.status(201).json({ id: rid, batchId: id, name, email, createdAt: now });
});

/** POST /api/batches/:id/recipients/import */
router.post("/:id/recipients/import", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const d = getDb();
  if (!d.prepare("SELECT id FROM batches WHERE id=? AND org_id=?").get(id, auth.orgId)) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) {
    res.status(400).json({ error: "rows array is required" });
    return;
  }
  if (rows.length > 2000) {
    res.status(400).json({ error: "Maximum 2000 rows per import" });
    return;
  }

  const existing = new Set(
    (d.prepare("SELECT lower(email) AS e FROM recipients WHERE batch_id=?").all(id) as Array<{ e: string }>)
      .map((r) => r.e)
  );
  const now = nowIso();
  let added = 0;
  let skipped = 0;
  const insert = d.prepare(
    "INSERT INTO recipients(id,batch_id,org_id,name,email,created_at) VALUES(?,?,?,?,?,?)"
  );
  for (const raw of rows) {
    const name = String(raw?.name ?? "").trim();
    const email = String(raw?.email ?? "").trim().toLowerCase();
    if (!name || !isValidEmail(email) || existing.has(email)) {
      skipped += 1;
      continue;
    }
    insert.run(uid("r"), id, auth.orgId, name, email, now);
    existing.add(email);
    added += 1;
  }
  res.json({ added, skipped });
});

/** PUT /api/batches/:id/recipients/:rid */
router.put("/:id/recipients/:rid", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const rid = String(req.params.rid);
  const d = getDb();
  const row = d.prepare(
    `SELECT r.id, r.batch_id, r.created_at FROM recipients r
     JOIN batches b ON b.id = r.batch_id
     WHERE r.id=? AND r.batch_id=? AND b.org_id=?`
  ).get(rid, id, auth.orgId) as { id: string; batch_id: string; created_at: string } | undefined;
  if (!row) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  const dupe = d.prepare(
    "SELECT id FROM recipients WHERE batch_id=? AND lower(email)=? AND id<>?"
  ).get(id, email, rid);
  if (dupe) {
    res.status(400).json({ error: "This email already exists in this group" });
    return;
  }
  d.prepare("UPDATE recipients SET name=?, email=? WHERE id=? AND batch_id=?").run(name, email, rid, id);
  res.json({ id: rid, batchId: id, name, email, createdAt: row.created_at });
});

/** DELETE /api/batches/:id/recipients/:rid */
router.delete("/:id/recipients/:rid", requireWorkspace(true), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const rid = String(req.params.rid);
  const row = getDb().prepare(
    `SELECT r.id FROM recipients r
     JOIN batches b ON b.id = r.batch_id
     WHERE r.id=? AND r.batch_id=? AND b.org_id=?`
  ).get(rid, id, auth.orgId);
  if (!row) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }
  const result = getDb().prepare("DELETE FROM recipients WHERE id=? AND batch_id=?").run(rid, id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
