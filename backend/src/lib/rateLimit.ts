/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Scope: single Node process (the pilot runs one Render/web instance).
 * It resets on restart and is NOT shared across instances — documented as a
 * known limitation. It exists to blunt credential brute-forcing on /api/auth/*.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map cannot grow unbounded.
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry (0 when ok). */
  retryAfterSec: number;
  remaining: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  const ok = b.count <= limit;
  return {
    ok,
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    remaining: Math.max(0, limit - b.count),
  };
}

/** Reset a bucket after a successful login so honest users are not punished. */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}

/** Test helper — clears all state. */
export function rateLimitClear(): void {
  buckets.clear();
}

/**
 * Best-effort client IP. Works with Express req or standard Web Request.
 */
export function clientIp(req: any): string {
  if (!req) return "unknown";
  if (typeof req.ip === "string" && req.ip) return req.ip;
  const fwd = typeof req.headers?.get === "function" 
    ? req.headers.get("x-forwarded-for") 
    : req.headers?.["x-forwarded-for"];
  if (fwd) {
    const str = Array.isArray(fwd) ? fwd[0] : String(fwd);
    return str.split(",")[0]!.trim().slice(0, 64);
  }
  return req.socket?.remoteAddress || "unknown";
}
