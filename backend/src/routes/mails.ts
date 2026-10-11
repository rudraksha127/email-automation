import { Router } from "express";
import { requireWorkspace } from "../middleware/auth";
import { audit, getDb, nowIso } from "../lib/db";
import {
  alreadyDelivered,
  deliverStoredMail,
  getOrgMailRow,
  mailToApi,
  ingestMessage,
} from "../lib/pipeline";
import type { MailStatus } from "../types/shared";

const router = Router();
const STATUSES: MailStatus[] = ["pending", "forwarded", "needs_review", "failed"];

/** GET /api/mails — list mails with filtering */
router.get("/", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }

  const status = req.query.status as string | undefined;
  const batchId = req.query.batchId as string | undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const date = typeof req.query.date === "string" ? req.query.date.trim() : undefined;
  const year = typeof req.query.year === "string" ? req.query.year.trim() : undefined;
  const limitParam = Number(req.query.limit);
  const offsetParam = Number(req.query.offset);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 500;
  const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? Math.floor(offsetParam) : 0;

  const where: string[] = ["org_id = ?"];
  const args: unknown[] = [auth.orgId];
  if (status && status !== "all") {
    if (!STATUSES.includes(status as MailStatus)) {
      res.status(400).json({ error: "Invalid status filter" });
      return;
    }
    where.push("status = ?");
    args.push(status);
  }
  if (batchId && batchId !== "all") {
    where.push("batch_id = ?");
    args.push(batchId);
  }
  if (date) {
    where.push("received_at LIKE ?");
    args.push(`${date}%`);
  }
  if (year && year !== "all") {
    where.push("(batch_name LIKE ? OR subject LIKE ? OR body_text LIKE ?)");
    args.push(`%${year}%`, `%${year}%`, `%${year}%`);
  }
  if (search) {
    where.push("(subject LIKE ? OR sender LIKE ? OR batch_name LIKE ?)");
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const sql =
    "SELECT id,sender,sender_name,subject,received_at,batch_id,batch_name,status,recipient_count,forwarded_at,failure_reason FROM mails WHERE " +
    where.join(" AND ") +
    " ORDER BY received_at DESC LIMIT ? OFFSET ?";
  const rows = (getDb().prepare(sql).all as any)(...args, limit, offset) as Array<Record<string, unknown>>;
  res.json(rows.map((r) => ({
    id: String(r.id),
    sender: String(r.sender),
    senderName: (r.sender_name as string | null) ?? null,
    subject: String(r.subject),
    receivedAt: String(r.received_at),
    batchId: (r.batch_id as string | null) ?? null,
    batchName: (r.batch_name as string | null) ?? null,
    status: r.status as MailStatus,
    recipientCount: typeof r.recipient_count === "number" ? r.recipient_count : null,
    forwardedAt: (r.forwarded_at as string | null) ?? null,
    failureReason: (r.failure_reason as string | null) ?? null,
  })));
});

/** GET /api/mails/:id */
router.get("/:id", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const row = getOrgMailRow(auth.orgId, String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Mail not found" });
    return;
  }
  res.json(mailToApi(row));
});

/** POST /api/mails/:id/forward */
router.post("/:id/forward", requireWorkspace(false), async (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const row = getOrgMailRow(auth.orgId, id);
  if (!row) {
    res.status(404).json({ error: "Mail not found" });
    return;
  }
  const batchId = String(req.body?.batchId ?? "").trim();
  if (!batchId) {
    res.status(400).json({ error: "batchId is required" });
    return;
  }
  const batch = getDb().prepare("SELECT id FROM batches WHERE id=? AND org_id=?").get(batchId, auth.orgId);
  if (!batch) {
    res.status(400).json({ error: "Selected group does not exist in this workspace" });
    return;
  }
  if (row.status === "forwarded") {
    res.status(409).json({ error: "This mail has already been forwarded" });
    return;
  }
  const gmailId = row.gmail_message_id ? String(row.gmail_message_id) : null;
  if (gmailId && alreadyDelivered(auth.orgId, gmailId)) {
    res.status(409).json({ error: "This mail has already been forwarded" });
    return;
  }
  const delivered = await deliverStoredMail(row, batchId, true);
  if (delivered.status === "failed") {
    res.status(502).json({ error: String(delivered.failure_reason ?? "Forwarding failed") });
    return;
  }
  if (delivered.status === "needs_review") {
    res.status(400).json({ error: String(delivered.failure_reason ?? "Unable to forward this mail") });
    return;
  }
  audit(auth.orgId, auth.email, "mail.forwarded", `manual forward mail=${id}`);
  res.json(mailToApi(delivered));
});

/** POST /api/mails/:id/retry */
router.post("/:id/retry", requireWorkspace(false), async (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const row = getOrgMailRow(auth.orgId, id);
  if (!row) {
    res.status(404).json({ error: "Mail not found" });
    return;
  }
  if (row.status !== "failed") {
    res.status(400).json({ error: "Only failed mails can be retried" });
    return;
  }
  const batchId = row.batch_id ? String(row.batch_id) : null;
  if (!batchId) {
    res.status(400).json({ error: "This mail has no resolved group — use Select Group & Forward instead" });
    return;
  }
  const gmailId = row.gmail_message_id ? String(row.gmail_message_id) : null;
  if (gmailId && alreadyDelivered(auth.orgId, gmailId)) {
    res.status(409).json({ error: "This mail has already been forwarded" });
    return;
  }
  const delivered = await deliverStoredMail(row, batchId, true);
  if (delivered.status === "failed") {
    res.status(502).json({ error: String(delivered.failure_reason ?? "Retry failed") });
    return;
  }
  audit(auth.orgId, auth.email, "mail.retried", `mail=${id}`);
  res.json(mailToApi(delivered));
});

/** POST /api/mails/:id/reject */
router.post("/:id/reject", requireWorkspace(false), (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const id = String(req.params.id);
  const row = getOrgMailRow(auth.orgId, id);
  if (!row) {
    res.status(404).json({ error: "Mail not found" });
    return;
  }
  if (row.status === "forwarded") {
    res.status(409).json({ error: "A forwarded mail cannot be marked as not relevant" });
    return;
  }
  getDb().prepare(
    "UPDATE mails SET status='failed', failure_reason=?, updated_at=? WHERE id=? AND org_id=?"
  ).run("Marked as not relevant by admin", nowIso(), id, auth.orgId);
  audit(auth.orgId, auth.email, "mail.rejected", `mail=${id}`);
  res.json(mailToApi(getOrgMailRow(auth.orgId, id)!));
});

/** POST /api/mails/ingest — manually ingest an inbound email into the screening pipeline */
router.post("/ingest", requireWorkspace(false), async (req, res) => {
  const auth = req.orgAuth!;
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.message });
    return;
  }
  const sender = typeof req.body?.sender === "string" ? req.body.sender.trim() : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  const senderName = typeof req.body?.senderName === "string" ? req.body.senderName.trim() : null;

  if (!sender || !subject) {
    res.status(400).json({ error: "Sender email and Subject are required" });
    return;
  }

  const gmailMsgId = `manual_inbound_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const outcome = await ingestMessage(auth.orgId, {
      gmailMessageId: gmailMsgId,
      sender,
      senderName,
      subject,
      body,
      receivedAt: nowIso(),
    });
    audit(auth.orgId, auth.email, "mail.manual_ingest", `Ingested manual mail id=${outcome.mail.id}`);
    res.json(outcome);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to ingest email" });
  }
});

export default router;
