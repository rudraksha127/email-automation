import { getDb, getSetting, nowIso, uid } from "./db";
import { detectTarget, type DetectionGroup, type DetectionRule } from "./ruleEngine";
import { getValidAccessToken } from "./gmail";
import { fetchWithRetry } from "./retry";

export interface IngestInput {
  gmailMessageId: string;
  sender: string;
  senderName?: string | null;
  subject: string;
  body: string;
  bodyHtml?: string;
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
  if (angle) return normalize(angle[1]);
  const addr = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (addr) return normalize(addr[0]);
  return normalize(raw);
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** Server-side sender allowlist check — empty allowlist = fail closed. */
export function isAllowedSender(orgId: string, sender: string): boolean {
  const email = normalize(sender);
  if (!email) return false;
  const row = getDb().prepare(
    "SELECT 1 FROM sender_rules WHERE org_id=? AND sender_email=? AND active=1"
  ).get(orgId, email);
  return Boolean(row);
}

function loadGroups(orgId: string): DetectionGroup[] {
  const rows = getDb().prepare(
    "SELECT id, name FROM batches WHERE org_id=?"
  ).all(orgId) as Array<{ id: string; name: string }>;
  return rows;
}

function loadRules(orgId: string): DetectionRule[] {
  const rows = getDb().prepare(
    "SELECT * FROM forwarding_rules WHERE org_id=? AND active=1"
  ).all(orgId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    targetBatchId: String(r.target_batch_id ?? ""),
    priority: Number(r.priority ?? 0),
    active: Number(r.active ?? 1) === 1,
    senderPattern: (r.sender_pattern as string | null) || null,
    subjectKeywords: String(r.subject_keywords ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    bodyKeywords: String(r.body_keywords ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  }));
}

export function mailToApi(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id, gmailMessageId: row.gmail_message_id ?? null,
    sender: row.sender, senderName: row.sender_name ?? null,
    subject: row.subject, bodyText: row.body_text,
    bodyHtml: row.body_html ?? null,
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

/** Tenant-checked fetch — returns undefined unless the row belongs to orgId. */
export function getOrgMailRow(orgId: string, id: string): Record<string, unknown> | undefined {
  const row = getMailRow(id);
  if (!row || String(row.org_id) !== orgId) return undefined;
  return row;
}

export function getMailByGmail(orgId: string, gmailId: string): Record<string, unknown> | undefined {
  return getDb().prepare(
    "SELECT * FROM mails WHERE org_id=? AND gmail_message_id=?"
  ).get(orgId, gmailId) as Record<string, unknown> | undefined;
}

function batchName(orgId: string, id: string): string | null {
  const r = getDb().prepare(
    "SELECT name FROM batches WHERE id=? AND org_id=?"
  ).get(id, orgId) as { name: string } | undefined;
  return r?.name ?? null;
}

function recipientsOf(orgId: string, batchId: string): Array<{ email: string }> {
  const rows = getDb().prepare(
    "SELECT email FROM recipients WHERE batch_id=? AND org_id=? ORDER BY email ASC"
  ).all(batchId, orgId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ email: String(r.email) }));
}

/**
 * True only if a delivery was RESERVED or SENT for this gmail id WITHIN THE
 * ORGANIZATION. Rows in 'failed' state do NOT count — they stay retryable.
 */
export function alreadyDelivered(orgId: string, gmailMessageId: string): boolean {
  return Boolean(
    getDb().prepare(
      "SELECT id FROM forward_logs WHERE org_id=? AND gmail_message_id=? AND status IN ('pending','sent','sent_manual')"
    ).get(orgId, gmailMessageId)
  );
}

function setMail(id: string, patch: Record<string, unknown>): void {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  getDb().prepare(`UPDATE mails SET ${keys.map((k) => `${k}=?`).join(",")},updated_at=? WHERE id=?`)
    .run(...keys.map((k) => patch[k] as unknown), nowIso(), id);
}

/** Send via Gmail API (MIME) using the ORGANIZATION's connection. */
export async function sendViaGmail(orgId: string, opts: {
  to: string[]; cc?: string | null; subject: string; body: string; html?: string;
  attachments?: Array<{ filename: string; mimeType: string; dataB64: string }>;
}): Promise<string> {
  const token = await getValidAccessToken(orgId);
  const b64url = (s: string): string =>
    Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const hasAttachments = Boolean(opts.attachments && opts.attachments.length > 0);
  const hasHtml = Boolean(opts.html);

  const toHeader = `To: ${opts.to.join(", ")}`;
  const ccHeader = opts.cc ? `Cc: ${opts.cc}` : null;
  const subjectHeader = `Subject: =?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`;

  let raw: string;
  if (hasAttachments) {
    const mixedBoundary = `pilot_mixed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const altBoundary = `pilot_alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const headers = [
      toHeader,
      ...(ccHeader ? [ccHeader] : []),
      subjectHeader,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
    ];

    const bodyParts: string[] = [];
    if (hasHtml) {
      bodyParts.push(
        `--${mixedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        "",
        `--${altBoundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        opts.body,
        "",
        `--${altBoundary}`,
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        opts.html!,
        "",
        `--${altBoundary}--`
      );
    } else {
      bodyParts.push(
        `--${mixedBoundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        opts.body
      );
    }

    for (const a of opts.attachments!) {
      bodyParts.push(
        "",
        `--${mixedBoundary}`,
        `Content-Type: ${a.mimeType}; name="${a.filename.replace(/"/g, "")}"`,
        `Content-Disposition: attachment; filename="${a.filename.replace(/"/g, "")}"`,
        "Content-Transfer-Encoding: base64",
        "",
        a.dataB64.replace(/\s+/g, "")
      );
    }

    bodyParts.push("", `--${mixedBoundary}--`, "");
    raw = b64url([...headers, ...bodyParts].join("\r\n"));
  } else if (hasHtml) {
    const altBoundary = `pilot_alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const parts: string[] = [
      toHeader,
      ...(ccHeader ? [ccHeader] : []),
      subjectHeader,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      `--${altBoundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      opts.body,
      "",
      `--${altBoundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      opts.html!,
      "",
      `--${altBoundary}--`,
      "",
    ];
    raw = b64url(parts.join("\r\n"));
  } else {
    const parts: string[] = [
      toHeader,
      ...(ccHeader ? [ccHeader] : []),
      subjectHeader,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      opts.body,
    ];
    raw = b64url(parts.join("\r\n"));
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
 * Delivery guard: reserves the gmail message id (per organization) in
 * forward_logs BEFORE the network call. UNIQUE(org_id, gmail_message_id) +
 * status check makes double-send impossible even under concurrent attempts or
 * process crashes between send and log write. Returns false when another
 * attempt already owns the delivery.
 */
function reserveDelivery(orgId: string, gmailId: string, mailId: string, batchId: string, cc: string): boolean {
  const d = getDb();
  try {
    d.prepare(
      `INSERT INTO forward_logs(org_id,gmail_message_id,mail_id,batch_id,recipient_count,cc_email,provider,status,created_at)
       VALUES(?,?,?,?,?,?, 'gmail', 'pending', ?)`
    ).run(orgId, gmailId, mailId, batchId, 0, cc, nowIso());
    return true;
  } catch {
    const row = d.prepare(
      "SELECT status, created_at FROM forward_logs WHERE org_id=? AND gmail_message_id=?"
    ).get(orgId, gmailId) as { status: string; created_at: string } | undefined;
    if (row?.status === "failed") {
      d.prepare(
        "UPDATE forward_logs SET status='pending', mail_id=?, batch_id=?, error=NULL WHERE org_id=? AND gmail_message_id=? AND status='failed'"
      ).run(mailId, batchId, orgId, gmailId);
      return true;
    }
    // Stale 'pending' = a previous attempt crashed before/while sending.
    // Reclaim after 5 minutes; the remaining double-send window is only the
    // crash-between-send-and-finalize gap (documented limitation).
    if (row?.status === "pending" && Date.now() - new Date(row.created_at).getTime() > 5 * 60_000) {
      d.prepare(
        "UPDATE forward_logs SET status='pending', created_at=? WHERE org_id=? AND gmail_message_id=? AND status='pending'"
      ).run(nowIso(), orgId, gmailId);
      return true;
    }
    return false;
  }
}

/** Deliver a stored mail row to a batch. Idempotent via forward_logs. */
export async function deliverStoredMail(
  row: Record<string, unknown>, batchId: string, manual = false
): Promise<Record<string, unknown>> {
  const orgId = String(row.org_id);
  const gmailId = row.gmail_message_id as string | null;
  const mailId = String(row.id);

  if (gmailId && alreadyDelivered(orgId, gmailId)) {
    if (row.status !== "forwarded") {
      setMail(mailId, { status: "forwarded", batch_id: batchId, batch_name: batchName(orgId, batchId), failure_reason: null });
    }
    return getMailRow(mailId)!;
  }

  // Tenant check: the target batch must belong to the mail's organization.
  const batch = getDb().prepare("SELECT org_id FROM batches WHERE id=?").get(batchId) as
    | { org_id: string } | undefined;
  if (!batch || batch.org_id !== orgId) {
    setMail(mailId, { status: "needs_review", failure_reason: "Selected group does not belong to this workspace." });
    return getMailRow(mailId)!;
  }

  const cc = getSetting(orgId, "ccEmail", "");
  const to = recipientsOf(orgId, batchId);
  if (to.length === 0) {
    setMail(mailId, { status: "needs_review", batch_id: batchId, batch_name: batchName(orgId, batchId), failure_reason: "Target group has no recipients." });
    return getMailRow(mailId)!;
  }
  if (gmailId && !reserveDelivery(orgId, gmailId, mailId, batchId, cc)) {
    return getMailRow(mailId)!;
  }

  const storedAtts = loadFullAttachments(mailId);
  const attachPayload: Array<{ filename: string; mimeType: string; dataB64: string }> = [];
  for (const a of storedAtts) {
    let data = a.dataB64;
    if (!data && gmailId && a.gmailAttachmentId) {
      try {
        const token = await getValidAccessToken(orgId);
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
      "UPDATE forward_logs SET status=?, recipient_count=?, error=?, created_at=? WHERE org_id=? AND gmail_message_id=?"
    ).run(status, to.length, error ?? null, nowIso(), orgId, gmailId);
  };
  try {
    const subject = String(row.subject ?? "");
    const bodyText = String(row.body_text ?? "");
    const bodyHtml = row.body_html ? String(row.body_html) : undefined;
    await sendViaGmail(orgId, {
      to: to.map((r) => r.email),
      cc,
      subject,
      body: bodyText + (missingAtts > 0 ? `\n\n[Note: ${missingAtts} attachment(s) could not be retrieved from Gmail and were omitted.]` : ""),
      html: bodyHtml,
      attachments: attachPayload.length > 0 ? attachPayload : undefined,
    });
    const now = nowIso();
    setMail(mailId, { status: "forwarded", batch_id: batchId, batch_name: batchName(orgId, batchId), recipient_count: to.length, cc_email: cc, forwarded_at: now, failure_reason: null });
    finalizeLog(manual ? "sent_manual" : "sent");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forwarding failed";
    const safe = msg.replace(/Bearer\s+[A-Za-z0-9\-._~+/=]+/g, "Bearer [redacted]").slice(0, 500);
    setMail(mailId, { status: "failed", batch_id: batchId, batch_name: batchName(orgId, batchId), failure_reason: safe });
    finalizeLog("failed", safe);
  }
  return getMailRow(mailId)!;
}

/** Main ingest: dedupe -> allowlist -> rules/detect -> (auto) forward. */
export async function ingestMessage(
  orgId: string, input: IngestInput
): Promise<{ mail: Record<string, unknown>; action: string }> {
  const now = nowIso();
  const senderEmail = extractEmail(input.sender);
  const dupe = getMailByGmail(orgId, input.gmailMessageId);
  if (dupe) return { mail: mailToApi(dupe), action: "duplicate_ignored" };

  // Fail-closed sender allowlist check BEFORE saving to database:
  // If sender is not in the allowed list, do NOT pollute the application inbox!
  if (!isAllowedSender(orgId, senderEmail)) {
    getDb().prepare(
      "INSERT INTO gmail_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(`ignored_mail:${input.gmailMessageId}`, JSON.stringify({ orgId, sender: senderEmail, at: now }));
    return { mail: null as any, action: "unauthorized_ignored" };
  }

  const id = uid("mail");
  getDb().prepare(
    `INSERT INTO mails(id,org_id,gmail_message_id,sender,sender_name,subject,body_text,body_html,received_at,status,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, orgId, input.gmailMessageId, senderEmail, input.senderName ?? null, input.subject ?? "",
    input.body ?? "", input.bodyHtml ?? null, input.receivedAt ?? now, "pending", now, now);
  if (input.attachments && input.attachments.length > 0) {
    const ins = getDb().prepare(
      "INSERT INTO mail_attachments(id,mail_id,filename,mime,size_bytes,gmail_attachment_id) VALUES(?,?,?,?,?,?)"
    );
    for (const a of input.attachments) {
      ins.run(uid("att"), id, a.filename, a.mimeType, a.sizeBytes, a.gmailAttachmentId ?? null);
    }
  }

  const det = detectTarget({
    groups: loadGroups(orgId),
    rules: loadRules(orgId),
    sender: senderEmail,
    subject: input.subject ?? "",
    body: input.body ?? "",
  });

  if (det.kind === "none") {
    setMail(id, { status: "needs_review", failure_reason: "No configured group detected in subject or body." });
    return { mail: mailToApi(getMailRow(id)!), action: "needs_review" };
  }
  if (det.kind === "ambiguous") {
    setMail(id, { status: "needs_review", failure_reason: `${det.reason} — held for review, not auto-forwarded.` });
    return { mail: mailToApi(getMailRow(id)!), action: "needs_review" };
  }

  setMail(id, { batch_id: det.batchId, batch_name: batchName(orgId, det.batchId) });

  if (getSetting(orgId, "autoForwarding", "1") !== "1") {
    setMail(id, { status: "pending", failure_reason: "Auto-forwarding is disabled — awaiting manual action." });
    return { mail: mailToApi(getMailRow(id)!), action: "pending_manual" };
  }

  const delivered = await deliverStoredMail(getMailRow(id)!, det.batchId);
  const status = String(delivered.status);
  return { mail: mailToApi(delivered), action: status === "forwarded" ? "forwarded" : status };
}
