import { err, json, requireOrg } from "@/lib/auth";
import { getTokens } from "@/lib/gmail";
import { syncGmailInbox } from "@/lib/gmailSync";

// Single-process guard: manual sync and the background poller must never run
// the same organization's sync concurrently.
let running = false;

/**
 * POST /api/gmail/sync — member-triggered inbox sync for the ACTIVE
 * workspace only (uses that workspace's own connection/tokens).
 */
export async function POST(): Promise<Response> {
  const auth = await requireOrg();
  if (!auth.ok) return err(auth.message, auth.status);
  if (running) return err("A sync is already in progress", 409);
  if (!getTokens(auth.orgId)?.refresh_token) {
    return err("No Gmail account is connected for this workspace", 409);
  }
  running = true;
  try {
    const result = await syncGmailInbox(auth.orgId);
    return json(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Sync failed", 502);
  } finally {
    running = false;
  }
}
