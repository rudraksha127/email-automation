/**
 * Bounded retry with exponential backoff + jitter for OUTBOUND Gmail API reads.
 *
 * Usage rules (delivery safety):
 *  - USE for idempotent reads: message list/get, attachment fetch, token refresh.
 *  - NEVER use for the send call itself — if a send's outcome is uncertain we
 *    must NOT blindly re-send (see pipeline.deliverStoredMail / forward_logs).
 */

export interface BackoffOptions {
  /** 0-based attempt number. */
  attempt: number;
  /** First retry delay in ms (default 500). */
  baseDelayMs?: number;
  /** Upper bound for any single delay (default 15000). */
  maxDelayMs?: number;
}

/** Exponential backoff with full jitter, capped at maxDelayMs. */
export function backoffDelayMs({ attempt, baseDelayMs = 500, maxDelayMs = 15_000 }: BackoffOptions): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));
  // Full jitter: random point in [exp/2, exp] — spreads concurrent workers out.
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}

/** Statuses worth retrying for idempotent requests. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Parse a Retry-After header (seconds or HTTP-date) into ms; null when absent/invalid. */
export function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

export interface RetryConfig {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Injectable sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Should a response/throwable be retried? Defaults to isRetryableStatus + network errors. */
  shouldRetry?: (error: unknown) => boolean;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Run `fn` with bounded retries. `fn` receives the 0-based attempt number and
 * may throw a RetryableError (carrying retryAfterMs) to guide the wait.
 * Non-retryable failures and the final attempt rethrow immediately.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, cfg: RetryConfig = {}): Promise<T> {
  const attempts = Math.max(1, cfg.attempts ?? 3);
  const sleep = cfg.sleep ?? defaultSleep;
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastErr = e;
      const retryable = cfg.shouldRetry ? cfg.shouldRetry(e) : e instanceof RetryableError;
      if (!retryable || attempt === attempts - 1) throw e;
      const hinted = e instanceof RetryableError ? e.retryAfterMs : null;
      await sleep(hinted ?? backoffDelayMs({ attempt, baseDelayMs: cfg.baseDelayMs, maxDelayMs: cfg.maxDelayMs }));
    }
  }
  throw lastErr;
}

export class RetryableError extends Error {
  retryAfterMs: number | null;
  status: number | null;
  constructor(message: string, status: number | null = null, retryAfterMs: number | null = null) {
    super(message);
    this.name = "RetryableError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * fetch() wrapper for idempotent Gmail reads with bounded retry.
 * - Retries network errors and 408/429/5xx with backoff + jitter.
 * - Honors Retry-After on 429/503 (capped at maxDelayMs... via hint clamp).
 * - Returns the Response when not retryable so callers keep their own error handling.
 */
export async function fetchWithRetry(input: string, init: RequestInit | undefined, cfg: RetryConfig = {}): Promise<Response> {
  const attempts = Math.max(1, cfg.attempts ?? 3);
  const sleep = cfg.sleep ?? defaultSleep;
  const maxDelayMs = cfg.maxDelayMs ?? 15_000;
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(input, init);
    } catch (e) {
      // Network-level failure — safe to retry an idempotent read.
      lastErr = e;
      if (attempt === attempts - 1) throw e;
      await sleep(backoffDelayMs({ attempt, baseDelayMs: cfg.baseDelayMs, maxDelayMs }));
      continue;
    }
    if (res.ok || !isRetryableStatus(res.status)) return res;
    lastErr = new RetryableError(`Request failed (${res.status})`, res.status);
    if (attempt === attempts - 1) return res; // give the caller the final response
    const hinted = retryAfterMs(res.headers.get("retry-after"));
    await sleep(Math.min(maxDelayMs, hinted ?? backoffDelayMs({ attempt, baseDelayMs: cfg.baseDelayMs, maxDelayMs })));
  }
  throw lastErr;
}
