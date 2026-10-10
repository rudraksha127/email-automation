"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only.
 * Dev/test skip registration so hot-reload and jsdom tests stay clean.
 * The worker itself never caches /api responses (see public/sw.js).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installability is best-effort — never break the app over it */
    });
  }, []);

  return null;
}
