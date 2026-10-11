import { err, json, requireOrg } from "@/lib/auth";
import { ingestMessage } from "@/lib/pipeline";
import { audit, nowIso } from "@/lib/db";

/**
 * POST /api/mails/ingest — manually ingest an inbound email into the screening pipeline
 */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body", 400);
  }

  const sender = typeof body.sender === "string" ? body.sender.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  const senderName = typeof body.senderName === "string" ? body.senderName.trim() : null;

  if (!sender || !subject) {
    return err("Sender email and Subject are required", 400);
  }

  const gmailMsgId = `manual_inbound_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const outcome = await ingestMessage(auth.orgId, {
      gmailMessageId: gmailMsgId,
      sender,
      senderName,
      subject,
      body: bodyText,
      receivedAt: nowIso(),
    });
    audit(auth.orgId, auth.email, "mail.manual_ingest", `Ingested manual mail id=${outcome.mail.id}`);
    return json(outcome);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Failed to ingest email", 500);
  }
}
