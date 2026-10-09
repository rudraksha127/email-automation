import { getDb, nowIso, uid } from "./db";
import { detectBatch } from "./batchDetection";
import { isAllowedSender, normalizeEmail } from "./pilotConfig";
import { getValidAccessToken } from "./gmail";
import { fetchWithRetry } from "./retry";

export interface IngestInput {
  gmailMessageId: string;
  sender: string;
  senderName?: string | null;
  subject: string;
  body: string;
  receivedAt?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    /** Gmail attachment resource id — used to fetch bytes at forward time. */
    gmailAttachmentId?: string | null;
  }>;
}
export function extractEmail(raw: string): string {
  if (!raw) return "";
  const angle = raw.match(/<([^>]+)>/);
  if (angle) return normalizeEmail(angle[1]);
  const addr = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (addr) return normalizeEmail(addr[0]);
  return normalizeEmail(raw);
}
function getSetting(key: string, fb = ""): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key=?").get(key) as
    | { value: string } | undefined;
  return row?.value ?? fb;
}
export function mailToApi(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id, gmailMessageId: row.gmail_message_id ?? null,
    sender: row.sender, senderName: row.sender_name ?? null,
    subject: row.subject, bodyText: row.body_text,
    receivedAt: row.received_at, status: row.status,
    batchId: row.batch_id ?? null, batchName: row.batch_name ?? null,
    recipientCount: row.recipient_count ?? null,
    failureReason: row.failure_reason ?? null,
    attachments: loadAttachments(String(row.id)),
    forwardedAt: row.forwarded_at ?? null,
    ccEmail: row.cc_email ?? null,
  };
}

interface StoredAttachment {
  id: string; filename: string; mimeType: string; sizeBytes: number;
  gmailAttachmentId: string | null; dataB64: string | null;
}

export function loadAttachments(mailId: string): Array<{ id: string; filename: string; sizeBytes: number; mimeType: string }> {
  const rows = getDb().prepare(
    "SELECT id, filename, mime, size_bytes FROM mail_attachments WHERE mail_id=?"
  ).all(mailId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id), filename: String(r.filename),
    sizeBytes: Number(r.size_bytes ?? 0), mimeType: String(r.mime),
  }));
}

function loadFullAttachments(mailId: string): StoredAttachment[] {
  const rows = getDb().prepare(
    "SELECT id, filename, mime, size_bytes, gmail_attachment_id, data_b64 FROM mail_attachments WHERE mail_id=?"
  ).all(mailId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id), filename: String(r.filename), mimeType: String(r.mime),
    sizeBytes: Number(r.size_bytes ?? 0),
    gmailAttachmentId: (r.gmail_attachment_id as string | null) ?? null,
    dataB64: (r.data_b64 as string | null) ?? null,
  }));
}
export function getMailRow(id: string): Record<string, unknown> | undefined {
  return getDb().prepare("SELECT * FROM mails WHERE id=?").get(id) as Record<string, unknown> | undefined;
}
export function getMailByGmail(gmailId: string): Record<string, unknown> | undefined {
  return getDb().prepare("SELECT * FROM mails WHERE gmail_message_id=?").get(gmailId) as Record<string, unknown> | undefined;
}
function batchName(id: string): string | null {
  const r = getDb().prepare("SELECT name FROM batches WHERE id=?").get(id) as { name: string } | undefined;
  return r?.name ?? null;
}
function recipientsOf(batchId: string): Array<{ email: string }> {
  const rows = getDb().prepare("SELECT email FROM recipients WHERE batch_id=? ORDER BY email ASC").all(batchId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ email: String(r.email) }));
}
/**
 * True only if a delivery was RESERVED or SENT for this gmail id.
 * Rows in 'failed' state do NOT count — they must remain retryable.
 */
export function alreadyDelivered(gmailMessageId: string): boolean {
  return Boolean(
    getDb().prepare(
      "SELECT id FROM forward_logs WHERE gmail_message_id=? AND status IN ('pending','sent','sent_manual')"
    ).get(gmailMessageId)
  );
}
function setMail(id: string, patch: Record<string, unknown>): void {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  getDb().prepare(`UPDATE mails SET ${keys.map((k) => `${k}=?`).join(",")},updated_at=? WHERE id=?`)
    .run(...keys.map((k) => patch[k] as unknown), nowIso(), id);
}

/** Send via Gmail API (MIME). Text body + optional attachments. Returns provider id. */
export async function sendViaGmail(opts: {
  to: string[]; cc?: string | null; subject: string; body: string;
  attachments?: Array<{ filename: string; mimeType: string; dataB64: string }>;
}): Promise<string> {
  const token = await getValidAccessToken();
  const b64url = (s: string): string =>
    Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  let raw: string;
  if (opts.attachments && opts.attachments.length > 0) {
    // multipart/mixed: preserve original body AND attachments (spec §11).
    const boundary = `pilot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const parts: string[] = [
      `To: ${opts.to.join(", ")}`,
      ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      "",
      opts.body,
    ];
    for (const a of opts.attachments) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${a.mimeType}; name="${a.filename.replace(/"/g, "")}"`,
        `Content-Disposition: attachment; filename="${a.filename.replace(/"/g, "")}"`,
        `Content-Transfer-Encoding: base64`,
        "",
        a.dataB64.replace(/\s+/g, "")
      );
    }
    parts.push(`--${boundary}--`, "");
    raw = b64url(parts.join("\r\n"));
  } else {
    raw = b64url(
      [`To: ${opts.to.join(", ")}`, ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
        `Subject: ${opts.subject}`, "Content-Type: text/plain; charset=UTF-8", "",
        opts.body].join("\r\n")
    );
  }
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gmail send failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { id?: string };
  return j.id ?? "sent";
}

/**
 * Delivery guard: reserves the gmail message id in forward_logs BEFORE the network
 * call. UNIQUE(gmail_message_id) + status check makes double-send impossible even
 * under concurrent attempts or process crashes between send and log write.
 * Returns false when another attempt already owns the delivery.
 */
function reserveDelivery(gmailId: string, mailId: string, batchId: string, cc: string): boolean {
  const d = getDb();
  try {
    d.prepare(
      "INSERT INTO forward_logs(gmail_message_id,mail_id,batch_id,recipient_count,cc_email,provider,status,created_at) VALUES(?,?,?,?,?,?, 'pending', ?)"
    ).run(gmailId, mailId, batchId, 0, cc, "gmail", nowIso());
    return true;
  } catch {
    // UNIQUE conflict: delivery already reserved/sent — allow re-open only from 'failed'.
    const row = d.prepare("SELECT status, created_at FROM forward_logs WHERE gmail_message_id=?").get(gmailId) as
      | { status: string; created_at: string } | undefined;
    if (row?.status === "failed") {
      d.prepare("UPDATE forward_logs SET status='pending', mail_id=?, batch_id=?, error=NULL WHERE gmail_message_id=? AND status='failed'").run(mailId, batchId, gmailId);
      return true;
    }
    // Stale 'pending' = a previous attempt crashed before/while sending.
    // Reclaim after 5 minutes so forwarding isn't permanently blocked; the
    // double-send window this opens is only the crash-between-send-and-finalize gap.
    if (row?.status === "pending" && Date.now() - new Date(row.created_at).getTime() > 5 * 60_000) {
      d.prepare("UPDATE forward_logs SET status='pending', created_at=? WHERE gmail_message_id=? AND status='pending'").run(nowIso(), gmailId);
      return true;
    }
    return false;
  }
}

/** Deliver a stored mail row to a batch. Idempotent via forward_logs. */
export async function deliverStoredMail(
  row: Record<string, unknown>, batchId: string, manual = false
): Promise<Record<string, unknown>> {
  const gmailId = row.gmail_message_id as string | null;
  const mailId = String(row.id);
  if (gmailId && alreadyDelivered(gmailId)) {
    if (row.status !== "forwarded") {
      setMail(mailId, { status: "forwarded", batch_id: batchId, batch_name: batchName(batchId), failure_reason: null });
    }
    return getMailRow(mailId)!;
  }
  const cc = getSetting("ccEmail", "");
  if (!cc) {
    setMail(mailId, { status: "failed", batch_id: batchId, batch_name: batchName(batchId), failure_reason: "IT Company CC is not configured — forwarding disabled until configured." });
    return getMailRow(mailId)!;
  }
  const to = recipientsOf(batchId);
  if (to.length === 0) {
    setMail(mailId, { status: "needs_review", batch_id: batchId, batch_name: batchName(batchId), failure_reason: "Target batch has no recipients." });
    return getMailRow(mailId)!;
  }
  // Reserve first (DB-level idempotency), then send, then finalize the log row.
  if (gmailId && !reserveDelivery(gmailId, mailId, batchId, cc)) {
    return getMailRow(mailId)!;
  }
  // Load stored attachment bytes (fetch from Gmail on demand if not cached).
  const storedAtts = loadFullAttachments(mailId);
  const attachPayload: Array<{ filename: string; mimeType: string; dataB64: string }> = [];
  for (const a of storedAtts) {
    let data = a.dataB64;
    if (!data && gmailId && a.gmailAttachmentId) {
      try {
        const token = await getValidAccessToken();
        const res = await fetchWithRetry(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/attachments/${a.gmailAttachmentId}`,
          { headers: { Authorization: `Bearer ${token}` } },
          { attempts: 3 }
        );
        if (res.ok) {
          const j = (await res.json()) as { data?: string };
          if (j.data) {
            data = j.data;
            getDb().prepare("UPDATE mail_attachments SET data_b64=? WHERE id=?").run(data, a.id);
          }
        }
      } catch { /* attachment fetch failed — forward body anyway, noted below */ }
    }
    if (data) attachPayload.push({ filename: a.filename, mimeType: a.mimeType, dataB64: data });
  }
  const missingAtts = storedAtts.length - attachPayload.length;
  const finalizeLog = (status: "sent" | "sent_manual" | "failed", error?: string): void => {
    if (!gmailId) return;
    getDb().prepare(
      "UPDATE forward_logs SET status=?, recipient_count=?, error=?, created_at=? WHERE gmail_message_id=?"
    ).run(status, to.length, error ?? null, nowIso(), gmailId);
  };
  try {
    await sendViaGmail({
      to: to.map((r) => r.email), cc,
      subject: String(row.subject ?? "").startsWith("Fwd:") ? String(row.subject) : `Fwd: ${String(row.subject ?? "")}`,
      body:
        `Forwarded from ${String(row.sender ?? "")}\nOriginal subject: ${String(row.subject ?? "")}\nDetected batch: ${batchName(batchId) ?? batchId}\n\n${String(row.body_text ?? "")}` +
        (missingAtts > 0 ? `\n\n[Note: ${missingAtts} attachment(s) could not be retrieved from Gmail and were omitted.]` : ""),
      attachments: attachPayload.length > 0 ? attachPayload : undefined,
    });
    const now = nowIso();
    setMail(mailId, { status: "forwarded", batch_id: batchId, batch_name: batchName(batchId), recipient_count: to.length, cc_email: cc, forwarded_at: now, failure_reason: null });
    finalizeLog(manual ? "sent_manual" : "sent");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forwarding failed";
    const safe = msg.replace(/Bearer\s+[A-Za-z0-9\-._~+/=]+/g, "Bearer [redacted]").slice(0, 500);
    setMail(mailId, { status: "failed", batch_id: batchId, batch_name: batchName(batchId), failure_reason: safe });
    finalizeLog("failed", safe);
  }
  return getMailRow(mailId)!;
}

/** Main ingest: dedupe → allowlist → detect → (auto) forward. */
export async function ingestMessage(input: IngestInput): Promise<{ mail: Record<string, unknown>; action: string }> {
  const now = nowIso();
  const senderEmail = extractEmail(input.sender);
  const dupe = getMailByGmail(input.gmailMessageId);
  if (dupe) return { mail: mailToApi(dupe), action: "duplicate_ignored" };
  const id = uid("mail");
  getDb().prepare(
    "INSERT INTO mails(id,gmail_message_id,sender,sender_name,subject,body_text,received_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(id, input.gmailMessageId, senderEmail, input.senderName ?? null, input.subject ?? "", input.body ?? "", input.receivedAt ?? now, "pending", now, now);
  if (input.attachments && input.attachments.length > 0) {
    const ins = getDb().prepare(
      "INSERT INTO mail_attachments(id,mail_id,filename,mime,size_bytes,gmail_attachment_id) VALUES(?,?,?,?,?,?)"
    );
    for (const a of input.attachments) {
      ins.run(uid("att"), id, a.filename, a.mimeType, a.sizeBytes, a.gmailAttachmentId ?? null);
    }
  }
  if (!isAllowedSender(senderEmail)) {
    setMail(id, { status: "needs_review", failure_reason: `Unauthorized sender (${senderEmail}) — held for review, not forwarded.` });
    return { mail: mailToApi(getMailRow(id)!), action: "unauthorized_held" };
  }
  const det = detectBatch(input.subject ?? "", input.body ?? "");
  if (det.kind === "none") {
    setMail(id, { status: "needs_review", failure_reason: "No supported batch (2027/2028) detected in subject or body." });
    return { mail: mailToApi(getMailRow(id)!), action: "needs_review" };
  }
  if (det.kind === "ambiguous") {
    setMail(id, { status: "needs_review", failure_reason: `Ambiguous batches detected (${det.years.join(", ")}) — held for review, not auto-forwarded.` });
    return { mail: mailToApi(getMailRow(id)!), action: "needs_review" };
  }
  setMail(id, { batch_id: det.batchId, batch_name: batchName(det.batchId) });
  if (getSetting("autoForwarding", "1") !== "1") {
    setMail(id, { status: "pending", failure_reason: "Auto-forwarding is disabled — awaiting manual action." });
    return { mail: mailToApi(getMailRow(id)!), action: "pending_manual" };
  }
  const delivered = await deliverStoredMail(getMailRow(id)!, det.batchId);
  const status = String(delivered.status);
  return { mail: mailToApi(delivered), action: status === "forwarded" ? "forwarded" : status };
}
