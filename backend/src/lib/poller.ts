/**
 * 24/7 Autonomous Background Mail Poller & Self-Healing Worker
 * 
 * Ensures continuous email screening, batch classification, and automated
 * forwarding runs independently in the background, whether the user's browser
 * or PWA is open or closed.
 */
import { listConnectedOrgs } from "./db";
import { syncGmailInbox } from "./gmailSync";

export interface PollerStats {
  active: boolean;
  status: "idle" | "running" | "degraded" | "healthy";
  intervalSeconds: number;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
  lastError: string | null;
  consecutiveErrors: number;
  totalRuns: number;
  totalIngested: number;
  totalForwarded: number;
}

const stats: PollerStats = {
  active: false,
  status: "idle",
  intervalSeconds: 60,
  lastTickStartedAt: null,
  lastTickCompletedAt: null,
  lastError: null,
  consecutiveErrors: 0,
  totalRuns: 0,
  totalIngested: 0,
  totalForwarded: 0,
};

let timerId: NodeJS.Timeout | null = null;
let keepAliveTimerId: NodeJS.Timeout | null = null;
let isExecuting = false;

export function getPollerStats(): Readonly<PollerStats> {
  return { ...stats };
}

/**
 * Execute one autonomous polling tick across all connected workspaces.
 * Recovers automatically from any API or network anomalies without crashing.
 */
export async function runPollerTick(): Promise<void> {
  if (isExecuting) return;
  isExecuting = true;
  stats.status = "running";
  stats.lastTickStartedAt = new Date().toISOString();

  try {
    const orgIds = listConnectedOrgs();
    for (const orgId of orgIds) {
      try {
        const result = await syncGmailInbox(orgId, 10);
        stats.totalIngested += result.ingested;
        stats.totalForwarded += result.forwarded;
        if (result.errors.length > 0) {
          console.warn(`[mail-sync] org=${orgId} ${result.errors.length} error(s):`, result.errors.slice(0, 3));
        }
      } catch (e) {
        console.warn(`[mail-sync] org=${orgId} error:`, e instanceof Error ? e.message : e);
      }
    }
    stats.consecutiveErrors = 0;
    stats.lastError = null;
    stats.status = "healthy";
  } catch (e) {
    stats.consecutiveErrors += 1;
    stats.lastError = e instanceof Error ? e.message : String(e);
    stats.status = "degraded";
    console.warn(`[mail-sync] background cycle error (${stats.consecutiveErrors}):`, stats.lastError);
  } finally {
    stats.totalRuns += 1;
    stats.lastTickCompletedAt = new Date().toISOString();
    isExecuting = false;
  }
}

/**
 * Start the 24/7 background worker loop and host keep-alive heartbeat.
 */
export function startBackgroundPoller(intervalMs?: number): void {
  if (process.env.PILOT_DISABLE_POLLER === "true") {
    stats.active = false;
    stats.status = "idle";
    return;
  }

  const interval = Math.max(15_000, intervalMs ?? Number(process.env.PILOT_SYNC_INTERVAL_MS ?? 60_000));
  stats.active = true;
  stats.intervalSeconds = Math.round(interval / 1000);
  stats.status = "healthy";

  // First sync shortly after server boot
  setTimeout(() => void runPollerTick(), 6_000);

  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => void runPollerTick(), interval);
  console.log(`[mail-sync] 24/7 autonomous background poller active (interval: ${stats.intervalSeconds}s)`);

  // Host keep-alive ping every 7 minutes (prevents cloud/container sleep on idle)
  if (!keepAliveTimerId) {
    const port = Number(process.env.PORT || 3001);
    keepAliveTimerId = setInterval(() => {
      fetch(`http://localhost:${port}/api/health`).catch(() => {
        /* best-effort internal keep-alive */
      });
      const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_API_URL;
      if (externalUrl && !externalUrl.includes("localhost")) {
        fetch(`${externalUrl.replace(/\/$/, "")}/api/health`).catch(() => {});
      }
    }, 7 * 60_000);
  }
}

export function stopBackgroundPoller(): void {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (keepAliveTimerId) {
    clearInterval(keepAliveTimerId);
    keepAliveTimerId = null;
  }
  stats.active = false;
  stats.status = "idle";
}
