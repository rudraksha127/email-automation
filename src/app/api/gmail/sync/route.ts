import { err, json, requireAdmin } from "@/lib/auth";
import { syncGmailInbox } from "@/lib/gmailSync";

let running = false;

/**
 * POST /api/gmail/sync — admin-triggered inbox sync.
 * Guarded against concurrent execution; the background poller uses the same guard.
 */
export async function POST(): Promise<Response> {
  const admin = await requireAdmin();
  if (!admin) return err("Unauthorized", 401);
  if (running) return err("A sync is already in progress", 409);
  running = true;
  try {
    const result = await syncGmailInbox();
    return json(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Sync failed", 502);
  } finally {
    running = false;
  }
}