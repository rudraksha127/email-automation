"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-runs the async function (e.g. after a mutation or manual refresh). */
  reload: () => void;
  /** Directly set data after a local mutation. */
  setData: (data: T | null) => void;
}

/**
 * Runs an async operation and exposes loading / error / data in a consistent shape
 * so every screen handles the same states the same way.
 * Automatically re-fetches on an interval and when the tab regains focus, so a
 * second signed-in viewer sees collaborators' changes without a manual reload.
 * Silent background refreshes never clear `data` or flip `loading`, so the UI
 * stays stable while it syncs.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  options: { refreshMs?: number; refreshOnFocus?: boolean } = {}
): AsyncState<T> {
  const { refreshMs = 25_000, refreshOnFocus = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  const hasDataRef = useRef(false);

  // Keep the latest fn without writing refs during render.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  // When reload() bumps tick, flip back to loading during render
  // (React's recommended alternative to setState-in-effect).
  const [prevTick, setPrevTick] = useState(tick);
  if (prevTick !== tick) {
    setPrevTick(tick);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    fnRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          hasDataRef.current = true;
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // Keep the last good data on background refresh failures so the
          // screen doesn't start flickering when a poll request hiccups.
          if (!hasDataRef.current) {
            setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
          }
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  // Background polling: every refreshMs (default 25s), silently re-fetch.
  useEffect(() => {
    if (!refreshMs || refreshMs <= 0) return;
    const id = setInterval(() => setTick((t) => t + 1), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  // Focus refresh: when the user returns to the tab, sync immediately.
  useEffect(() => {
    if (!refreshOnFocus || typeof window === "undefined") return;
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshOnFocus]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, reload, setData };
}
