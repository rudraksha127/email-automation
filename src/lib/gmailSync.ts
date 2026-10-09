/**
 * Gmail inbox sync — polls ONE organization's connected mailbox for new
 * messages and ingests them into that organization's pipeline.
 * Dedupe via (org_id, gmail_message_id). Safe to run sequentially across
 * orgs (single poller, in-flight guard in instrumentation).
 */
import { getTokens, getValidAccessToken } from "./gmail";
import { getDb, nowIso } from "./db";
import { ingestMessage } from "./pipeline";
import { fetchWithRetry } from "./retry";

function b64urlToUtf8(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf-8");
}

function header(headers: Array<{ name: string; value: string }>, name: string): string {
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

function extractBody(payload: Record<string, unknown>): {
  text: string;
  attachments: Array<{ filename: string; mimeType: string; sizeBytes: number; gmailAttachmentId: string | null }>;
} {
  let plainText = "";
  let htmlText = "";
  const attachments: Array<{ filename: string; mimeType: string; sizeBytes: number; gmailAttachmentId: string | null }> = [];

  const walk = (part: Record<string, unknown>): void => {
    const mime = String(part.mimeType ?? "");
    const body = (part.body as { data?: string; size?: number; attachmentId?: string } | undefined) ?? {};
    const filename = String((part as { filename?: string }).filename ?? "");

    if (filename) {
      attachments.push({
        filename,
        mimeType: mime || "application/octet-stream",
        sizeBytes: Number(body.size ?? 0),
        gmailAttachmentId: body.attachmentId ?? null,
      });
    }

    if (body.data) {
      try {
        const decoded = b64urlToUtf8(body.data);
        if (mime === "text/plain" && !plainText) {
          plainText = decoded;
        } else if (mime === "text/html" && !htmlText) {
          htmlText = decoded;
        }
      } catch {
        /* keep empty */
      }
    }

    const parts = (part.parts as Array<Record<string, unknown>> | undefined) ?? [];
    for (const p of parts) walk(p);
  };

  walk(payload);

  const text = plainText || (htmlText ? htmlToPlainText(htmlText) : "");
  return { text, attachments };
}

export async function syncGmailInbox(orgId: string, limit = 25): Promise<{
  checked: number;
  ingested: number;
  forwarded: number;
  needsReview: number;
  errors: string[];
}> {
  const out = { checked: 0, ingested: 0, forwarded: 0, needsReview: 0, errors: [] as string[] };
  const tok = getTokens(orgId);
  if (!tok?.access_token) throw new Error("Gmail not connected for this workspace");
  const token = await getValidAccessToken(orgId);
  const q = encodeURIComponent(`newer_than:30d`);
  const listRes = await fetchWithRetry(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) {
    if (listRes.status === 401) {
      throw new Error("Gmail authorization expired or revoked (401) — reconnect the account from Settings.");
    }
    throw new Error(`Gmail list failed (${listRes.status})`);
  }
  const list = (await listRes.json()) as { messages?: Array<{ id: string }> };
  const ids = (list.messages ?? []).map((m) => m.id);

  // Already-ingested ids for THIS organization (tenant-scoped dedupe).
  const seen = new Set(
    (
      getDb()
        .prepare("SELECT gmail_message_id AS id FROM mails WHERE org_id=? AND gmail_message_id IS NOT NULL")
        .all(orgId) as Array<{ id: string }>
    ).map((r) => r.id)
  );

  for (const gid of ids) {
    if (seen.has(gid)) continue;
    out.checked += 1;
    try {
      const g = await fetchWithRetry(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gid}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!g.ok) throw new Error(`Gmail get failed (${g.status})`);
      const full = (await g.json()) as {
        id: string;
        internalDate?: string;
        payload?: { headers?: Array<{ name: string; value: string }>; [k: string]: unknown };
      };
      const headers = full.payload?.headers ?? [];
      const { text, attachments } = extractBody((full.payload ?? {}) as Record<string, unknown>);
      const from = header(headers, "From");
      const subject = header(headers, "Subject");
      const nameMatch = from.match(/^\"?([^\"<]+)\"?\s*<.+>$/);
      const senderName = nameMatch ? nameMatch[1].trim() : null;
      const receivedAt = full.internalDate
        ? new Date(Number(full.internalDate)).toISOString()
        : nowIso();

      const { action } = await ingestMessage(orgId, {
        gmailMessageId: full.id,
        sender: from || "unknown",
        senderName,
        subject,
        body: text.slice(0, 50000),
        receivedAt,
        attachments,
      });

      out.ingested += 1;
      if (action === "forwarded") out.forwarded += 1;
      else if (action === "needs_review" || action === "unauthorized_held") out.needsReview += 1;
    } catch (e) {
      out.errors.push(`Message ${gid}: ${e instanceof Error ? e.message : "failed"}`.slice(0, 300));
    }
    if (out.checked >= limit) break;
  }

  try {
    getDb().prepare(
      "INSERT INTO settings(org_id,key,value) VALUES(?,?,?) ON CONFLICT(org_id,key) DO UPDATE SET value=excluded.value"
    ).run(orgId, "lastSyncedAt", nowIso());
  } catch {
    /* noop */
  }

  return out;
}
