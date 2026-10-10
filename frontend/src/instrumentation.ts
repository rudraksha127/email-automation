/**
 * Background Gmail poller — runs inside the Next.js server (NOT the browser).
 * The PWA does not need to be open for mail processing to continue.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.PILOT_DISABLE_POLLER === "true") return;
  const g = globalThis as typeof globalThis & { __mailPilotSyncStarted?: boolean };
  if (g.__mailPilotSyncStarted) return; // dev hot-reload guard
  g.__mailPilotSyncStarted = true;

  const intervalMs = Math.max(15_000, Number(process.env.PILOT_SYNC_INTERVAL_MS ?? 60_000));
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) return; // single poller — no overlapping cycles
    running = true;
    try {
      const { listConnectedOrgs } = await import("./lib/db");
      const { syncGmailInbox } = await import("./lib/gmailSync");
      // Sequential per-organization: each org only ever uses ITS OWN tokens;
      // the in-flight guard above guarantees no duplicate pollers.
      for (const orgId of listConnectedOrgs()) {
        try {
          const result = await syncGmailInbox(orgId, 10);
          if (result.errors.length > 0) {
            console.warn(`[mail-sync] org=${orgId} ${result.errors.length} error(s):`, result.errors.slice(0, 3));
          }
        } catch (e) {
          console.warn(`[mail-sync] org=${orgId} failed:`, e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.warn("[mail-sync] cycle failed:", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };

  // First pass shortly after boot, then on the configured interval.
  setTimeout(() => void tick(), 10_000);
  setInterval(() => void tick(), intervalMs);
  console.log(`[mail-sync] background Gmail poller started (every ${intervalMs / 1000}s)`);
}