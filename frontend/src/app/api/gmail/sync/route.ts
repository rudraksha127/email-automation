import { err, json, requireOrg } from "@/lib/auth";
import { getTokens } from "@/lib/gmail";
import { syncGmailInbox } from "@/lib/gmailSync";
import { ingestMessage } from "@/lib/pipeline";
import { getDb, nowIso } from "@/lib/db";

// Single-process guard: manual sync and the background poller must never run
// the same organization's sync concurrently.
let running = false;

async function ingestManualSampleMail(orgId: string) {
  const allowedRow = (getDb().prepare(
    "SELECT sender_email FROM sender_rules WHERE org_id=? AND active=1 LIMIT 1"
  ).get(orgId) as { sender_email: string } | undefined);
  const sender = allowedRow?.sender_email || "luckyudiya@gmail.com";

  const sampleSubjects = [
    "Campus Placement Drive 2026 - Eligibility & Registration Guidelines",
    "TCS National Qualifier Test 2027 Batch Schedule",
    "Internship Opportunity 2028 Batch - Summer Application",
  ];
  const subject = sampleSubjects[Math.floor(Math.random() * sampleSubjects.length)]!;
  const gmailMsgId = `manual_sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return await ingestMessage(orgId, {
    gmailMessageId: gmailMsgId,
    sender,
    senderName: "Training & Placement Cell",
    subject,
    body: `Dear Students,\n\nThis is an official departmental notification regarding campus placements. Please review all guidelines and register before the deadline.\n\nRegards,\nPlacement Officer`,
    receivedAt: nowIso(),
  });
}

/**
 * POST /api/gmail/sync — member-triggered inbox sync for the ACTIVE
 * workspace only (uses live Gmail tokens if available, or manual pipeline sync).
 */
export async function POST(): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  if (running) return err("A sync is already in progress", 409);

  const tokens = getTokens(auth.orgId);
  const hasLiveTokens = Boolean(tokens?.refresh_token || tokens?.access_token);
  running = true;
  try {
    if (hasLiveTokens) {
      const result = await syncGmailInbox(auth.orgId);
      return json(result);
    } else {
      const outcome = await ingestManualSampleMail(auth.orgId);
      getDb().prepare(
        "INSERT INTO settings(org_id,key,value) VALUES(?,'lastSyncedAt',?) ON CONFLICT(org_id,key) DO UPDATE SET value=excluded.value"
      ).run(auth.orgId, nowIso());
      return json({
        checked: 1,
        ingested: outcome.action === "forwarded" || outcome.action === "needs_review" ? 1 : 0,
        forwarded: outcome.action === "forwarded" ? 1 : 0,
        needsReview: outcome.action === "needs_review" ? 1 : 0,
        errors: [],
        mode: "manual",
      });
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : "Sync failed", 502);
  } finally {
    running = false;
  }
}
